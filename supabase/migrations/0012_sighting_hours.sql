-- MeowPin 0012: ช่วงเวลาที่มักเจอน้อง (สรุปจากประวัติการกด "เจอน้อง")
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0011

-- ตาราง sightings อ่านตรงๆ ไม่ได้ (ไม่อยากให้รู้ว่าใครไปเจอน้องตอนไหน) — ฟังก์ชันนี้คืนแค่จำนวนครั้งต่อชั่วโมง
create function public.cat_sighting_hours(p_cat_id uuid)
returns table (hour integer, sightings integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    extract(hour from s.seen_at at time zone 'Asia/Bangkok')::integer as hour,
    count(*)::integer as sightings
  from public.sightings s
  where s.cat_id = p_cat_id and s.seen_at > now() - interval '180 days'
  group by 1
  order by 1;
$$;

revoke execute on function public.cat_sighting_hours(uuid) from public;
grant execute on function public.cat_sighting_hours(uuid) to anon, authenticated;
