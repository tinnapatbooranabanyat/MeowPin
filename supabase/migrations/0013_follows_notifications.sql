-- MeowPin 0013: ติดตามน้อง + การแจ้งเตือนในแอป (กระดิ่ง)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0012

-- ═══════════════ ติดตามน้อง ═══════════════
create table public.cat_follows (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  cat_id uuid not null references public.cats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cat_id)
);

create index cat_follows_cat_idx on public.cat_follows (cat_id);

alter table public.cat_follows enable row level security;
create policy "Users see own follows" on public.cat_follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users follow cats" on public.cat_follows
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unfollow cats" on public.cat_follows
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Active session only" on public.cat_follows
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant select, delete on public.cat_follows to authenticated;
grant insert (cat_id) on public.cat_follows to authenticated;
grant all on public.cat_follows to service_role;

-- คนปักหมุดติดตามน้องของตัวเองอัตโนมัติ (รวมหมุดที่ปักไว้ก่อนหน้านี้)
insert into public.cat_follows (user_id, cat_id, created_at)
select c.created_by, c.id, c.created_at from public.cats c where c.created_by is not null
on conflict do nothing;

create function public.follow_own_cat()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.cat_follows (user_id, cat_id) values (new.created_by, new.id) on conflict do nothing;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

create trigger cats_follow_own
  after insert on public.cats
  for each row execute function public.follow_own_cat();

-- ═══════════════ การแจ้งเตือน ═══════════════
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('new_review', 'help_request', 'help_resolved', 'not_seen')),
  cat_id uuid references public.cats (id) on delete cascade,
  -- ชื่อแมว/คนทำ ณ ตอนแจ้ง (ไม่ต้อง join ตอนแสดง)
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- อ่าน/กดว่าอ่านแล้วได้เฉพาะของตัวเอง — สร้างได้เฉพาะ trigger ในฐานข้อมูล
alter table public.notifications enable row level security;
create policy "Users see own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ส่งให้ทุกคนที่ติดตามน้อง ยกเว้นคนที่ทำเอง — กันซ้ำ: เรื่องเดียวกันของน้องตัวเดียวกันภายใน 10 นาที
create function public.notify_followers(p_cat_id uuid, p_actor uuid, p_kind text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, cat_id, data)
  select f.user_id, p_kind, p_cat_id,
    coalesce(p_data, '{}') || jsonb_strip_nulls(jsonb_build_object(
      'cat_name', (select c.name from public.cats c where c.id = p_cat_id),
      'actor_name', (select p.display_name from public.profiles p where p.id = p_actor)
    ))
  from public.cat_follows f
  where f.cat_id = p_cat_id
    and f.user_id is distinct from p_actor
    and not exists (
      select 1 from public.notifications n
      where n.user_id = f.user_id and n.cat_id = p_cat_id and n.kind = p_kind
        and n.created_at > now() - interval '10 minutes'
    );
exception when others then
  raise warning 'notify followers failed: %', sqlerrm;
end;
$$;

revoke execute on function public.notify_followers(uuid, uuid, text, jsonb) from public, anon, authenticated;

create function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_followers(new.cat_id, new.user_id, 'new_review', jsonb_build_object('paws', new.paws));
  return new;
end;
$$;

create trigger reviews_notify_followers
  after insert on public.reviews
  for each row execute function public.notify_new_review();

create function public.notify_help_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_followers(new.cat_id, new.user_id, 'help_request', jsonb_build_object('help_kind', new.kind));
  elsif old.resolved_at is null and new.resolved_at is not null then
    perform public.notify_followers(new.cat_id, new.resolved_by, 'help_resolved', '{}');
  end if;
  return new;
end;
$$;

create trigger cat_help_notify_followers
  after insert or update on public.cat_help_requests
  for each row execute function public.notify_help_change();

-- ไม่มีใครเจอน้องเกิน 14 วัน → แจ้งผู้ติดตาม (ครั้งเดียวต่อช่วงที่หายไป จนกว่าจะมีคนเจออีก)
create function public.notify_stale_cats()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.notifications (user_id, kind, cat_id, data)
  select f.user_id, 'not_seen', c.id,
    jsonb_build_object('cat_name', c.name, 'days', extract(day from now() - c.last_seen_at)::integer)
  from public.cat_follows f
  join public.cats c on c.id = f.cat_id
  where c.last_seen_at < now() - interval '14 days'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = f.user_id and n.cat_id = c.id and n.kind = 'not_seen' and n.created_at > c.last_seen_at
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.notify_stale_cats() from public, anon, authenticated;

-- รันทุกวันตอนเช้า (09:00 เวลาไทย) ด้วย pg_cron — ถ้าโปรเจกต์เปิด pg_cron ไม่ได้ ส่วนอื่นยังใช้ได้ครบ
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('meowpin-notify-stale-cats', '0 2 * * *', 'select public.notify_stale_cats()');
exception when others then
  raise warning 'ตั้งเวลาด้วย pg_cron ไม่ได้ (%): ไปเปิด pg_cron ที่ Database → Extensions แล้วรันส่วนนี้อีกครั้ง', sqlerrm;
end;
$$;
