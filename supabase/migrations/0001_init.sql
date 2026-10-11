-- MeowPin: ตารางแมว + การเจอ + ที่เก็บรูป
-- รันใน Supabase Dashboard → SQL Editor (รันครั้งเดียว)

create extension if not exists postgis with schema extensions;

create type public.fur_color as enum ('orange', 'black', 'white', 'calico', 'tabby', 'gray');
create type public.verification as enum ('camera_gps', 'exif_gps', 'manual');

create table public.cats (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  fur_color public.fur_color not null,
  -- แมวที่มีเจ้าของเก็บเฉพาะพิกัดที่เบลอแล้ว ไม่เก็บพิกัดจริง
  location extensions.geography(point, 4326) not null,
  place_name text not null default '' check (char_length(place_name) <= 80),
  description text not null default '' check (char_length(description) <= 500),
  -- path ใน bucket cat-photos (null = ยังไม่มีรูป ใช้ไอคอนแทน)
  photo_path text,
  verification public.verification not null,
  cat_confidence real not null check (cat_confidence between 0 and 1),
  has_owner boolean not null default false,
  sightings_count integer not null default 1 check (sightings_count >= 0),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index cats_location_idx on public.cats using gist (location);
create index cats_last_seen_idx on public.cats (last_seen_at desc);

create table public.sightings (
  id bigint generated always as identity primary key,
  cat_id uuid not null references public.cats (id) on delete cascade,
  seen_at timestamptz not null default now()
);

create index sightings_cat_idx on public.sightings (cat_id, seen_at desc);

-- ── สิทธิ์: ใครก็อ่านแมวได้ แต่เขียนได้เฉพาะ backend (service role) ──
alter table public.cats enable row level security;
alter table public.sightings enable row level security;

create policy "Anyone can view cats" on public.cats
  for select to anon, authenticated using (true);
-- sightings ไม่มี policy = anon/authenticated อ่านเขียนไม่ได้เลย

-- ── view สำหรับ frontend: แปลง location เป็น lat/lng และไม่เปิด has_owner ──
create view public.cats_public with (security_invoker = true) as
select
  id,
  name,
  fur_color,
  extensions.st_y(location::extensions.geometry) as lat,
  extensions.st_x(location::extensions.geometry) as lng,
  place_name,
  description,
  photo_path,
  verification,
  cat_confidence,
  sightings_count,
  last_seen_at
from public.cats;

-- แมวที่อยู่ในกรอบแผนที่ที่กำลังดู (ใช้ GIST index)
create function public.cats_in_view(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  max_count integer default 500
)
returns setof public.cats_public
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.cats_public p
  where p.id in (
    select c.id
    from public.cats c
    where c.location operator(extensions.&&)
      extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography
  )
  order by p.last_seen_at desc
  limit least(max_count, 1000);
$$;

-- บันทึกการเจอ 1 ครั้ง แล้วคืนจำนวนล่าสุด — เรียกได้เฉพาะ backend
create function public.record_sighting(p_cat_id uuid)
returns table (sightings_count integer, last_seen_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sightings (cat_id) values (p_cat_id);
  return query
    update public.cats c
    set sightings_count = c.sightings_count + 1, last_seen_at = now()
    where c.id = p_cat_id
    returning c.sightings_count, c.last_seen_at;
end;
$$;

revoke execute on function public.record_sighting(uuid) from public, anon, authenticated;
grant execute on function public.record_sighting(uuid) to service_role;

-- ── ให้สิทธิ์แบบระบุชัด (รองรับโปรเจกต์ที่ปิด "Automatically expose new tables") ──
grant usage on schema public to anon, authenticated, service_role;
-- คนทั่วไป: อ่านได้อย่างเดียว (RLS ยังคุมอีกชั้น)
grant select on public.cats, public.cats_public to anon, authenticated;
grant execute on function public.cats_in_view(double precision, double precision, double precision, double precision, integer)
  to anon, authenticated;
-- backend (service role): เขียนได้
grant select, insert, update, delete on public.cats, public.sightings to service_role;
grant select on public.cats_public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ── ที่เก็บรูป: อ่านได้สาธารณะ อัปโหลดได้เฉพาะ backend ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cat-photos', 'cat-photos', true, 1048576, array['image/webp']);
