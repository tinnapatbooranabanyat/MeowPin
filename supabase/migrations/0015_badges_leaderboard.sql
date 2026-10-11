-- MeowPin 0015: ตราสัญลักษณ์ (สถิติของแต่ละคน) + อันดับทาสแมวในพื้นที่
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0014

-- สถิติรวมของผู้ใช้ (แค่จำนวนครั้ง ไม่มีเวลา/สถานที่) — ใช้คำนวณตราสัญลักษณ์ในหน้าโปรไฟล์
create function public.user_stats(p_user_id uuid)
returns table (pins integer, reviews integer, sightings integer, feedings integer, photos integer, helps integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.cats where created_by = p_user_id),
    (select count(*)::integer from public.reviews where user_id = p_user_id),
    (select count(*)::integer from public.sightings where user_id = p_user_id),
    (select count(*)::integer from public.feedings where user_id = p_user_id),
    (select count(*)::integer from public.cat_photos where user_id = p_user_id),
    (select count(*)::integer from public.cat_help_requests where user_id = p_user_id);
$$;

-- อันดับคนที่ช่วยดูแลน้องในกรอบแผนที่ 90 วันล่าสุด
-- คะแนน: ปักหมุด 5 · แจ้งช่วยน้อง 3 · รีวิว 3 · รูป 2 · เจอน้อง 1 · ให้อาหาร 1
create function public.area_leaderboard(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns table (user_id uuid, display_name text, avatar_url text, avatar_path text, points integer)
language sql
stable
security definer
set search_path = ''
as $$
  with area as (
    select c.id from public.cats c
    where c.location operator(extensions.&&)
      extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography
  ),
  since as (select now() - interval '90 days' as t),
  acts as (
    select created_by as uid, 5 as pts from public.cats, since where id in (select id from area) and created_at > since.t
    union all
    select user_id, 3 from public.cat_help_requests, since where cat_id in (select id from area) and created_at > since.t
    union all
    select user_id, 3 from public.reviews, since where cat_id in (select id from area) and created_at > since.t
    union all
    select user_id, 2 from public.cat_photos, since where cat_id in (select id from area) and created_at > since.t
    union all
    select user_id, 1 from public.sightings, since where cat_id in (select id from area) and seen_at > since.t
    union all
    select user_id, 1 from public.feedings, since where cat_id in (select id from area) and fed_at > since.t
  )
  select p.id, p.display_name, p.avatar_url, p.avatar_path, sum(a.pts)::integer as points
  from acts a
  join public.profiles p on p.id = a.uid
  group by p.id
  order by points desc, p.display_name
  limit 10;
$$;

revoke execute on function public.user_stats(uuid) from public;
revoke execute on function public.area_leaderboard(double precision, double precision, double precision, double precision) from public;
grant execute on function public.user_stats(uuid) to anon, authenticated;
grant execute on function public.area_leaderboard(double precision, double precision, double precision, double precision)
  to anon, authenticated;
