-- MeowPin 0009: ตรวจแมวด้วย AI (Gemini) + สีขนแบบพิมพ์เอง
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0008

-- ── สีขน "อื่นๆ" ที่ผู้ใช้พิมพ์เอง (เช่น "ส้มลายเปรอะขาว") ──
-- (ค่า enum ใหม่ใช้ใน transaction เดียวกันไม่ได้ เลยไม่อ้างถึง 'other' ใน check ด้านล่าง — backend เช็กให้)
alter type public.fur_color add value if not exists 'other';
alter table public.cats
  add column fur_color_custom text check (fur_color_custom is null or char_length(fur_color_custom) between 1 and 30);

-- ── ตรวจว่าเป็นแมวด้วยวิธีไหน: model = โมเดลในเครื่องมั่นใจ / ai = Gemini ยืนยัน / user = ผู้ใช้ยืนยันเอง (รอ admin ตรวจ) ──
alter table public.cats
  add column cat_check text not null default 'model' check (cat_check in ('model', 'ai', 'user'));
alter table public.cat_photos
  add column cat_check text not null default 'model' check (cat_check in ('model', 'ai', 'user'));

-- ── view สาธารณะ: เพิ่มคอลัมน์ใหม่ท้ายสุด (ต้องสร้าง view และฟังก์ชันที่ใช้ view ใหม่) ──
drop function public.cats_in_view(double precision, double precision, double precision, double precision, integer);
drop view public.cats_public;

create view public.cats_public with (security_invoker = true) as
select
  c.id,
  c.name,
  c.fur_color,
  extensions.st_y(c.location::extensions.geometry) as lat,
  extensions.st_x(c.location::extensions.geometry) as lng,
  c.place_name,
  c.description,
  c.photo_path,
  c.verification,
  c.cat_confidence,
  c.sightings_count,
  c.last_seen_at,
  c.is_friendly,
  c.is_clingy,
  c.is_playful,
  c.neutered,
  c.created_by,
  p.display_name as created_by_name,
  coalesce(r.review_count, 0)::integer as review_count,
  r.paw_avg,
  coalesce(r.recommend_count, 0)::integer as recommend_count,
  c.breed,
  c.owner_status,
  c.fur_color_custom,
  c.cat_check
from public.cats c
left join public.profiles p on p.id = c.created_by
left join lateral (
  select
    count(*) as review_count,
    round(avg(rv.paws)::numeric, 1)::double precision as paw_avg,
    count(*) filter (where rv.recommend) as recommend_count
  from public.reviews rv
  where rv.cat_id = c.id
) r on true;

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

grant select on public.cats_public to anon, authenticated, service_role;
grant execute on function public.cats_in_view(double precision, double precision, double precision, double precision, integer)
  to anon, authenticated;
