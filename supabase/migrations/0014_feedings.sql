-- MeowPin 0014: บันทึกการให้อาหาร (กันให้ซ้ำจนน้องอ้วน)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0013

create type public.food_kind as enum ('dry', 'wet', 'treat', 'other');

create table public.feedings (
  id bigint generated always as identity primary key,
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  food public.food_kind not null default 'other',
  fed_at timestamptz not null default now()
);

create index feedings_cat_idx on public.feedings (cat_id, fed_at desc);

-- ไม่มี policy: อ่าน/เขียนผ่านฟังก์ชันเท่านั้น — ไม่ให้ใครดูได้ว่าใครไปให้อาหารตอนไหน (รู้กิจวัตรของคนได้)
alter table public.feedings enable row level security;
grant all on public.feedings to service_role;

-- วันนี้ (เวลาไทย) ให้อาหารไปกี่ครั้ง ล่าสุดเมื่อไหร่ และเราให้ไปแล้วหรือยัง
create function public.cat_feedings_today(p_cat_id uuid)
returns table (feedings integer, last_fed_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::integer,
    max(f.fed_at),
    coalesce(bool_or(f.user_id = (select auth.uid())), false)
  from public.feedings f
  where f.cat_id = p_cat_id
    and f.fed_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
$$;

create function public.record_feeding(p_cat_id uuid, p_food public.food_kind)
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
  if not exists (select 1 from public.cats c where c.id = p_cat_id) then
    raise exception 'not_found';
  end if;
  -- คนเดียวกันบันทึกน้องตัวเดิมได้ทุก 2 ชั่วโมง
  if exists (
    select 1 from public.feedings f
    where f.cat_id = p_cat_id and f.user_id = uid and f.fed_at > now() - interval '2 hours'
  ) then
    raise exception 'too_soon';
  end if;
  insert into public.feedings (cat_id, user_id, food) values (p_cat_id, uid, p_food);
  perform public.log_activity(uid, 'feeding', p_cat_id, jsonb_build_object('food', p_food));
end;
$$;

revoke execute on function public.cat_feedings_today(uuid) from public;
revoke execute on function public.record_feeding(uuid, public.food_kind) from public, anon;
grant execute on function public.cat_feedings_today(uuid) to anon, authenticated;
grant execute on function public.record_feeding(uuid, public.food_kind) to authenticated;

-- ── log กิจกรรม ──
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding'
));
