-- MeowPin 0027: "เจอ" ต้องอยู่ที่น้องจริง
--   - กดเจอ / ให้อาหาร ต้องอยู่ใกล้หมุดไม่เกิน 300 ม. (GPS แม่นไม่เกิน 150 ม.) — เช็กในฐานข้อมูล ไม่เก็บพิกัดคนกด
--   - สมุดสะสม/เจ้าถิ่นนับเฉพาะสิ่งที่ทำตรงจุด: ปักหมุด, กดเจอ, ให้อาหาร, รูปที่อัปโหลดตอนอยู่ใกล้น้อง
--     (รีวิวไม่นับแล้ว — รีวิวความน่ารักจากที่ไหนก็ได้)
--   - ของเก่าก่อน migration นี้ (ไม่มีข้อมูลตำแหน่ง) ยังนับเหมือนเดิม ไม่ให้คนที่เล่นมาก่อนเสียของที่สะสมไว้
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0026

-- null = บันทึกก่อนมีกฎนี้ (นับ) / true = อยู่ใกล้ / false = อยู่ไกล (ไม่นับเข้าสมุดสะสม)
alter table public.feedings add column near_cat boolean;
alter table public.cat_photos add column near_cat boolean;

-- ระยะห่างจากหมุด (เมตร) — ใช้บอกผู้ใช้ว่าอยู่ไกลแค่ไหน
create function public.distance_to_cat(p_cat_id uuid, p_lat double precision, p_lng double precision)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select extensions.st_distance(
    c.location,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  )
  from public.cats c where c.id = p_cat_id;
$$;

revoke execute on function public.distance_to_cat(uuid, double precision, double precision) from public, anon, authenticated;

-- เช็กก่อนกดเจอ/ให้อาหาร: ไม่ผ่าน → raise พร้อมรหัส (location_required / gps_inaccurate / too_far:<เมตร>)
create function public.require_near_cat(p_cat_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d double precision;
begin
  if p_lat is null or p_lng is null or p_accuracy is null then
    raise exception 'location_required';
  end if;
  if p_accuracy > 150 then
    raise exception 'gps_inaccurate';
  end if;
  d := public.distance_to_cat(p_cat_id, p_lat, p_lng);
  if d is null then
    raise exception 'not_found';
  end if;
  if d > 300 then
    raise exception 'too_far:%', round(d)::integer;
  end if;
end;
$$;

revoke execute on function public.require_near_cat(uuid, double precision, double precision, double precision) from public, anon, authenticated;

-- ═══════════════ กดเจอ ═══════════════
-- แบบเดิม (ไม่ส่งตำแหน่ง) ใช้ไม่ได้แล้ว — แอปเวอร์ชันเก่าที่ค้างในเครื่องจะได้ข้อความให้รีเฟรช
create or replace function public.record_sighting(p_cat_id uuid)
returns table (sightings_count integer, last_seen_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'location_required';
end;
$$;

create function public.record_sighting(
  p_cat_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
)
returns table (sightings_count integer, last_seen_at timestamptz)
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
  perform public.require_near_cat(p_cat_id, p_lat, p_lng, p_accuracy);
  if exists (
    select 1 from public.sightings s
    where s.cat_id = p_cat_id and s.user_id = uid and s.seen_at > now() - interval '10 minutes'
  ) then
    raise exception 'too_soon';
  end if;
  insert into public.sightings (cat_id, user_id) values (p_cat_id, uid);
  return query
    update public.cats c
    set sightings_count = c.sightings_count + 1, last_seen_at = now()
    where c.id = p_cat_id
    returning c.sightings_count, c.last_seen_at;
end;
$$;

revoke execute on function public.record_sighting(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.record_sighting(uuid, double precision, double precision, double precision) to authenticated;

-- ═══════════════ ให้อาหาร ═══════════════
create or replace function public.record_feeding(p_cat_id uuid, p_food public.food_kind)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'location_required';
end;
$$;

create function public.record_feeding(
  p_cat_id uuid,
  p_food public.food_kind,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
)
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
  perform public.require_near_cat(p_cat_id, p_lat, p_lng, p_accuracy);
  -- คนเดียวกันบันทึกน้องตัวเดิมได้ทุก 2 ชั่วโมง
  if exists (
    select 1 from public.feedings f
    where f.cat_id = p_cat_id and f.user_id = uid and f.fed_at > now() - interval '2 hours'
  ) then
    raise exception 'too_soon';
  end if;
  insert into public.feedings (cat_id, user_id, food, near_cat) values (p_cat_id, uid, p_food, true);
  perform public.log_activity(uid, 'feeding', p_cat_id, jsonb_build_object('food', p_food));
end;
$$;

revoke execute on function public.record_feeding(uuid, public.food_kind, double precision, double precision, double precision) from public, anon;
grant execute on function public.record_feeding(uuid, public.food_kind, double precision, double precision, double precision) to authenticated;

-- ═══════════════ สมุดสะสม: นับเฉพาะสิ่งที่ทำตรงจุด (ไม่นับรีวิว) ═══════════════
create or replace view public.cat_touches as
select created_by as user_id, id as cat_id, created_at as at from public.cats where created_by is not null
union all select user_id, cat_id, seen_at from public.sightings where user_id is not null
union all select user_id, cat_id, created_at from public.cat_photos where user_id is not null and near_cat is not false
union all select user_id, cat_id, fed_at from public.feedings where user_id is not null and near_cat is not false;

revoke all on public.cat_touches from public, anon, authenticated;
