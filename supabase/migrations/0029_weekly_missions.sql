-- MeowPin 0029: ภารกิจประจำสัปดาห์ (เหมือนกันทุกคน สลับทุกวันจันทร์ 00:00 เวลาไทย)
-- ความคืบหน้าคำนวณจากข้อมูลที่มีอยู่แล้ว (เจอ/รูป/ให้อาหาร/ยืนยันเรื่อง) — เก็บแค่ว่าใครทำครบสัปดาห์ไหน
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0028

-- คลังภารกิจ (เรียงตามนี้ สลับมาสัปดาห์ละ 3 อัน)
--   new_cats      เจอน้องที่ไม่เคยเจอ 3 ตัว
--   lost_cat      ไปดูน้องที่ไม่มีใครเจอเกิน 14 วัน 1 ตัว
--   photo_needy   ถ่ายรูปน้องที่ยังมีรูปไม่ถึง 2 รูป 1 ตัว (ตอนอยู่ที่น้อง)
--   feed_unfed    ให้อาหารน้องที่วันนั้นยังไม่มีใครให้ 2 ตัว
--   confirm_help  ยืนยันเรื่องขอความช่วยเหลือ 1 เรื่อง
--   two_zones     เจอน้องใน 2 โซนต่างกัน

create function public.weekly_missions(p_week_start date)
returns table (key text, goal integer)
language sql
immutable
set search_path = ''
as $$
  with pool(i, key, goal) as (
    values (0, 'new_cats', 3), (1, 'lost_cat', 1), (2, 'photo_needy', 1), (3, 'feed_unfed', 2), (4, 'confirm_help', 1), (5, 'two_zones', 2)
  ),
  -- นับสัปดาห์จากวันจันทร์ที่ 5 ม.ค. 2026
  wk as (select ((p_week_start - date '2026-01-05') / 7) as n),
  picks(ord, idx) as (
    select 1, (select n from wk) % 6 union all
    select 2, ((select n from wk) + 1) % 6 union all
    select 3, ((select n from wk) + 3) % 6
  )
  select pool.key, pool.goal from picks join pool on pool.i = ((picks.idx % 6) + 6) % 6 order by picks.ord;
$$;

grant execute on function public.weekly_missions(date) to anon, authenticated;

create table public.mission_completions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.mission_completions enable row level security;
grant all on public.mission_completions to service_role;

-- ── ความคืบหน้าของภารกิจหนึ่งอัน (ภายใน) ──
create function public.mission_progress(p_user_id uuid, p_key text, p_from timestamptz, p_to timestamptz)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := 0;
begin
  if p_key = 'new_cats' then
    select count(*) into n from (
      select t.cat_id from public.cat_touches t where t.user_id = p_user_id
      group by t.cat_id having min(t.at) >= p_from and min(t.at) < p_to
    ) x;
  elsif p_key = 'lost_cat' then
    -- กดเจอในสัปดาห์นี้ ที่ก่อนหน้านั้นไม่มีใครเจอน้องตัวนั้นเกิน 14 วัน
    select count(distinct s.cat_id) into n
    from public.sightings s
    join public.cats c on c.id = s.cat_id
    where s.user_id = p_user_id and s.seen_at >= p_from and s.seen_at < p_to
      and coalesce(
        (select max(s2.seen_at) from public.sightings s2 where s2.cat_id = s.cat_id and s2.seen_at < s.seen_at),
        c.created_at
      ) < s.seen_at - interval '14 days';
  elsif p_key = 'photo_needy' then
    -- รูปที่อัปตอนอยู่ใกล้น้อง ที่ตอนนั้นน้องมีรูป (รวมรูปหลัก) ไม่ถึง 2 รูป
    select count(distinct p.cat_id) into n
    from public.cat_photos p
    join public.cats c on c.id = p.cat_id
    where p.user_id = p_user_id and p.near_cat is true and p.created_at >= p_from and p.created_at < p_to
      and (case when c.photo_path is null then 0 else 1 end)
        + (select count(*) from public.cat_photos p2 where p2.cat_id = p.cat_id and p2.created_at < p.created_at) < 2;
  elsif p_key = 'feed_unfed' then
    -- เป็นคนแรกที่ให้อาหารน้องตัวนั้นในวันนั้น
    select count(*) into n from (
      select distinct f.cat_id, (f.fed_at at time zone 'Asia/Bangkok')::date as d
      from public.feedings f
      where f.user_id = p_user_id and f.near_cat is not false and f.fed_at >= p_from and f.fed_at < p_to
        and not exists (
          select 1 from public.feedings f2
          where f2.cat_id = f.cat_id and f2.fed_at < f.fed_at
            and (f2.fed_at at time zone 'Asia/Bangkok')::date = (f.fed_at at time zone 'Asia/Bangkok')::date
        )
    ) x;
  elsif p_key = 'confirm_help' then
    select count(*) into n from public.cat_help_confirmations c
    where c.user_id = p_user_id and c.created_at >= p_from and c.created_at < p_to;
  elsif p_key = 'two_zones' then
    select count(distinct c.zone_key) into n
    from public.cat_touches t join public.cats c on c.id = t.cat_id
    where t.user_id = p_user_id and t.at >= p_from and t.at < p_to and c.zone_key is not null;
  end if;
  return n;
end;
$$;

revoke execute on function public.mission_progress(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

-- ── ภารกิจสัปดาห์นี้ของฉัน + บันทึกว่าทำครบ + สัปดาห์ติดกัน ──
create function public.my_weekly_missions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  t_from timestamptz := public.period_start('week');
  wk date := (t_from at time zone 'Asia/Bangkok')::date;
  items jsonb := '[]'::jsonb;
  m record;
  p integer;
  all_done boolean := true;
  streak integer := 0;
  d date;
begin
  for m in select * from public.weekly_missions(wk) loop
    p := case when uid is null then 0 else public.mission_progress(uid, m.key, t_from, 'infinity') end;
    items := items || jsonb_build_object('key', m.key, 'goal', m.goal, 'progress', least(p, m.goal), 'done', p >= m.goal);
    all_done := all_done and p >= m.goal;
  end loop;

  if uid is not null and all_done then
    insert into public.mission_completions (user_id, week_start) values (uid, wk) on conflict do nothing;
  end if;

  if uid is not null then
    -- นับย้อนจากสัปดาห์นี้ (ถ้าทำครบแล้ว) หรือสัปดาห์ที่แล้ว
    d := case when all_done then wk else wk - 7 end;
    while exists (select 1 from public.mission_completions c where c.user_id = uid and c.week_start = d) loop
      streak := streak + 1;
      d := d - 7;
    end loop;
  end if;

  return jsonb_build_object('week_start', wk, 'missions', items, 'all_done', all_done and uid is not null, 'streak', streak);
end;
$$;

revoke execute on function public.my_weekly_missions() from public;
grant execute on function public.my_weekly_missions() to anon, authenticated;

-- ── เหรียญภารกิจในโปรไฟล์ (ดูได้ทุกคน) ──
create function public.user_mission_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('weeks', (select count(*) from public.mission_completions where user_id = p_user_id));
$$;

revoke execute on function public.user_mission_stats(uuid) from public;
grant execute on function public.user_mission_stats(uuid) to anon, authenticated;

-- ── ตัวกรอง "รูปยังน้อย" บนแผนที่: น้องในรายการที่มีรูป (รวมรูปหลัก) ไม่ถึง 2 รูป ──
create function public.cat_ids_few_photos(p_cat_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.cats c
  where c.id = any (p_cat_ids[1:1000])
    and (case when c.photo_path is null then 0 else 1 end)
      + (select count(*) from public.cat_photos p where p.cat_id = c.id) < 2;
$$;

revoke execute on function public.cat_ids_few_photos(uuid[]) from public;
grant execute on function public.cat_ids_few_photos(uuid[]) to anon, authenticated;

-- ── ทุกวันจันทร์: บันทึกว่าใครทำภารกิจสัปดาห์ที่แล้วครบ (เผื่อคนที่ทำครบแต่ไม่ได้เปิดดู) ──
create function public.record_mission_completions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_to timestamptz := public.period_start('week');
  t_from timestamptz := t_to - interval '7 days';
  wk date := (t_from at time zone 'Asia/Bangkok')::date;
  u record;
  m record;
  ok boolean;
  n integer := 0;
begin
  for u in
    select distinct t.user_id from public.cat_touches t where t.at >= t_from and t.at < t_to
    union
    select distinct c.user_id from public.cat_help_confirmations c where c.created_at >= t_from and c.created_at < t_to
  loop
    ok := true;
    for m in select * from public.weekly_missions(wk) loop
      if public.mission_progress(u.user_id, m.key, t_from, t_to) < m.goal then
        ok := false;
        exit;
      end if;
    end loop;
    if ok then
      insert into public.mission_completions (user_id, week_start) values (u.user_id, wk) on conflict do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.record_mission_completions() from public, anon, authenticated;

-- ทุกวันจันทร์ 00:10 เวลาไทย (= อาทิตย์ 17:10 UTC)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('meowpin-mission-completions', '10 17 * * 0', 'select public.record_mission_completions()');
exception when others then
  raise warning 'ตั้งเวลาด้วย pg_cron ไม่ได้ (%): ไปเปิด pg_cron ที่ Database → Extensions แล้วรันส่วนนี้อีกครั้ง', sqlerrm;
end;
$$;
