-- MeowPin 0024: ช่วยน้องต่อหลังแจ้ง
--   1) แจ้งเตือนคนใกล้ๆ — ผู้ใช้เลือกเปิดเอง ตั้ง "พื้นที่ของฉัน" (จุด + รัศมี) มีน้องต้องการความช่วยเหลือในพื้นที่ → แจ้งเตือน
--   2) "ฉันกำลังไปช่วย" — บอกคนอื่นว่ามีคนรับเรื่องแล้ว แจ้งคนที่แจ้งเรื่องไว้
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0023

-- ═══════════════ พื้นที่รับแจ้งเตือน ═══════════════
-- เก็บพิกัดแบบปัด (~100 ม.) ไม่ใช่ตำแหน่งบ้านเป๊ะๆ / เห็นได้เฉพาะเจ้าของ
create table public.help_alert_areas (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  radius_m integer not null default 2000 check (radius_m between 500 and 10000),
  updated_at timestamptz not null default now()
);

create index help_alert_areas_location_idx on public.help_alert_areas using gist (location);

alter table public.help_alert_areas enable row level security;
create policy "Users see own alert area" on public.help_alert_areas
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users remove own alert area" on public.help_alert_areas
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.help_alert_areas to authenticated;
grant all on public.help_alert_areas to service_role;

-- ตั้ง/อัปเดตพื้นที่ (ผ่านฟังก์ชัน เพื่อปัดพิกัดก่อนเก็บ)
create function public.set_help_alert_area(p_lat double precision, p_lng double precision, p_radius_m integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not public.session_is_active() then
    raise exception 'login_required';
  end if;
  insert into public.help_alert_areas (user_id, location, radius_m, updated_at)
  values (
    uid,
    extensions.st_setsrid(extensions.st_makepoint(round(p_lng::numeric, 3)::double precision, round(p_lat::numeric, 3)::double precision), 4326)::extensions.geography,
    least(greatest(p_radius_m, 500), 10000),
    now()
  )
  on conflict (user_id) do update
    set location = excluded.location, radius_m = excluded.radius_m, updated_at = now();
end;
$$;

revoke execute on function public.set_help_alert_area(double precision, double precision, integer) from public, anon;
grant execute on function public.set_help_alert_area(double precision, double precision, integer) to authenticated;

-- พื้นที่ของฉัน (อ่านเป็น lat/lng)
create function public.my_help_alert_area()
returns table (lat double precision, lng double precision, radius_m integer, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select extensions.st_y(a.location::extensions.geometry), extensions.st_x(a.location::extensions.geometry), a.radius_m, a.updated_at
  from public.help_alert_areas a
  where a.user_id = (select auth.uid());
$$;

revoke execute on function public.my_help_alert_area() from public, anon;
grant execute on function public.my_help_alert_area() to authenticated;

-- ═══════════════ ฉันกำลังไปช่วย ═══════════════
create table public.cat_help_responders (
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cat_id, user_id)
);

alter table public.cat_help_responders enable row level security;
create policy "Anyone can view help responders" on public.cat_help_responders
  for select to anon, authenticated using (true);
create policy "Users respond to help" on public.cat_help_responders
  for insert to authenticated with check (
    user_id = (select auth.uid())
    -- กดได้เฉพาะตอนที่น้องยังมีเรื่องค้างอยู่
    and exists (select 1 from public.cat_help_requests h where h.cat_id = cat_help_responders.cat_id and h.resolved_at is null)
  );
create policy "Users cancel own response" on public.cat_help_responders
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Active session only" on public.cat_help_responders
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant select on public.cat_help_responders to anon, authenticated;
grant insert (cat_id), delete on public.cat_help_responders to authenticated;
grant all on public.cat_help_responders to service_role;

-- ── แจ้งเตือน + log ──
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'new_review', 'help_request', 'help_resolved', 'not_seen', 'review_reply', 'help_check', 'move_request', 'move_accepted',
  'help_nearby', 'help_on_way'
));

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete', 'user_ban', 'user_unban', 'cat_verify',
  'review_reply', 'review_report', 'help_confirm', 'help_expire', 'move_request', 'photo_report', 'photo_delete',
  'help_respond'
));

-- มีคนกดกำลังไปช่วย → แจ้งคนที่แจ้งเรื่องไว้ (ที่ยังค้าง) + เรื่องไม่เก่า เริ่มนับ 7 วันใหม่
create function public.on_help_respond()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, cat_id, data)
  select distinct h.user_id, 'help_on_way', new.cat_id, jsonb_strip_nulls(jsonb_build_object(
    'cat_name', (select c.name from public.cats c where c.id = new.cat_id),
    'actor_name', (select p.display_name from public.profiles p where p.id = new.user_id)
  ))
  from public.cat_help_requests h
  where h.cat_id = new.cat_id and h.resolved_at is null and h.user_id <> new.user_id;

  update public.cat_help_requests set last_activity_at = now(), reminded_at = null
  where cat_id = new.cat_id and resolved_at is null;

  perform public.log_activity(new.user_id, 'help_respond', new.cat_id, '{}');
  return new;
exception when others then
  raise warning 'help respond side effects failed: %', sqlerrm;
  return new;
end;
$$;

create trigger cat_help_responders_notify
  after insert on public.cat_help_responders
  for each row execute function public.on_help_respond();

-- ปิดเรื่องครบทุกเรื่องแล้ว → ล้างรายชื่อคนที่กำลังไปช่วย
create function public.clear_help_responders()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.resolved_at is null and new.resolved_at is not null
     and not exists (select 1 from public.cat_help_requests h where h.cat_id = new.cat_id and h.resolved_at is null) then
    delete from public.cat_help_responders where cat_id = new.cat_id;
  end if;
  return new;
end;
$$;

create trigger cat_help_clear_responders
  after update on public.cat_help_requests
  for each row execute function public.clear_help_responders();

-- แจ้งเรื่องใหม่ → แจ้งคนที่ตั้งพื้นที่ครอบคลุมหมุดนี้ (ยกเว้นคนแจ้ง และคนที่ติดตามน้องอยู่แล้ว ซึ่งได้แจ้งเตือนอยู่แล้ว)
-- กันซ้ำ: น้องตัวเดียวกันแจ้งคนเดิมไม่เกิน 1 ครั้งต่อ 12 ชม.
create function public.notify_help_nearby()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, cat_id, data)
  select a.user_id, 'help_nearby', new.cat_id, jsonb_strip_nulls(jsonb_build_object(
    'cat_name', c.name,
    'help_kind', new.kind,
    'distance_m', (round(extensions.st_distance(a.location, c.location) / 100) * 100)::integer
  ))
  from public.cats c
  join public.help_alert_areas a on extensions.st_dwithin(a.location, c.location, a.radius_m)
  where c.id = new.cat_id
    and a.user_id <> new.user_id
    and not exists (select 1 from public.cat_follows f where f.cat_id = new.cat_id and f.user_id = a.user_id)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.user_id and n.cat_id = new.cat_id and n.kind = 'help_nearby'
        and n.created_at > now() - interval '12 hours'
    );
  return new;
exception when others then
  raise warning 'notify help nearby failed: %', sqlerrm;
  return new;
end;
$$;

create trigger cat_help_notify_nearby
  after insert on public.cat_help_requests
  for each row execute function public.notify_help_nearby();
