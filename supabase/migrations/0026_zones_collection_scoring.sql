-- MeowPin 0026: สมุดสะสมน้องแมว + โซน (เขต/อำเภอ) + เจ้าถิ่น + คิดแต้มใหม่ให้ยุติธรรม
--   - backend ใส่โซนให้หมุดเองจากพิกัด (OpenStreetMap) — หมุดเก่าค่อยๆ ถูกเติมทุกครั้งที่ server ถูกปลุก
--   - "เจอน้อง" ในสมุดสะสม = ปักหมุด / กดเจอ / รีวิว / ถ่ายรูป / ให้อาหาร นับตัวละ 1 ครั้ง
--   - แต้มในพื้นที่: เจอตัวเดิม/ให้อาหารตัวเดิม ได้วันละครั้ง, แจ้งเรื่องอย่างเดียวไม่ได้แต้ม, ช่วยน้องสำเร็จได้แต้มฮีโร่
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0025

-- ═══════════════ โซน ═══════════════
create table public.zones (
  key text primary key check (char_length(key) <= 200),
  name_th text not null,
  name_en text not null,
  province_th text not null default '',
  province_en text not null default '',
  created_at timestamptz not null default now()
);

alter table public.zones enable row level security;
create policy "Anyone can view zones" on public.zones for select to anon, authenticated using (true);
grant select on public.zones to anon, authenticated;
grant all on public.zones to service_role;

alter table public.cats add column zone_key text references public.zones (key) on delete set null;
create index cats_zone_idx on public.cats (zone_key);

-- น้องที่แต่ละคน "เจอแล้ว" (ไม่ซ้ำตัว) — ใช้ภายในฟังก์ชันเท่านั้น ไม่เปิดให้ดูตรงๆ (บอกได้ว่าใครไปไหนมา)
create view public.cat_touches as
select created_by as user_id, id as cat_id, created_at as at from public.cats where created_by is not null
union all select user_id, cat_id, seen_at from public.sightings where user_id is not null
union all select user_id, cat_id, created_at from public.reviews
union all select user_id, cat_id, created_at from public.cat_photos where user_id is not null
union all select user_id, cat_id, fed_at from public.feedings where user_id is not null;

revoke all on public.cat_touches from public, anon, authenticated;

-- ── เจ้าถิ่น: คนที่เจอน้องในโซนนั้นมากที่สุด (อย่างน้อย 3 ตัว / เท่ากันใครครบก่อนชนะ) ──
create function public.zone_mayors()
returns table (zone_key text, user_id uuid, collected integer)
language sql
stable
security definer
set search_path = ''
as $$
  with per_user as (
    select c.zone_key, t.user_id, count(distinct t.cat_id)::integer as collected, max(t.at) as last_at
    from public.cat_touches t
    join public.cats c on c.id = t.cat_id
    where c.zone_key is not null
    group by c.zone_key, t.user_id
  ),
  ranked as (
    select *, row_number() over (partition by zone_key order by collected desc, last_at asc) as rn from per_user
  )
  select zone_key, user_id, collected from ranked where rn = 1 and collected >= 3;
$$;

revoke execute on function public.zone_mayors() from public, anon, authenticated;

-- ── สรุปสมุดสะสมของผู้ใช้ (ดูได้ทุกคน: เป็นตัวเลข + ชื่อโซนที่เป็นเจ้าถิ่นเท่านั้น) ──
create function public.user_collection_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select distinct t.cat_id, c.zone_key
    from public.cat_touches t
    join public.cats c on c.id = t.cat_id
    where t.user_id = p_user_id
  ),
  zone_totals as (
    select zone_key, count(*)::integer as total from public.cats where zone_key is not null group by zone_key
  ),
  my_zones as (
    select m.zone_key, count(*)::integer as collected from mine m where m.zone_key is not null group by m.zone_key
  )
  select jsonb_build_object(
    'cats', (select count(*) from mine),
    'zones', (select count(*) from my_zones),
    'completed', (select count(*) from my_zones z join zone_totals t using (zone_key) where z.collected >= t.total),
    'mayor', coalesce((
      select jsonb_agg(jsonb_build_object('key', z.key, 'th', z.name_th, 'en', z.name_en) order by z.name_th)
      from public.zone_mayors() m join public.zones z on z.key = m.zone_key
      where m.user_id = p_user_id
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.user_collection_stats(uuid) from public;
grant execute on function public.user_collection_stats(uuid) to anon, authenticated;

-- ── โซนของฉัน (เห็นเฉพาะตัวเอง): เจอแล้วกี่ตัวจากทั้งหมด ──
create function public.my_zone_progress()
returns table (zone_key text, name_th text, name_en text, province_th text, province_en text, collected integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select distinct t.cat_id from public.cat_touches t where t.user_id = (select auth.uid())
  )
  select z.key, z.name_th, z.name_en, z.province_th, z.province_en,
    count(*) filter (where c.id in (select cat_id from mine))::integer,
    count(*)::integer
  from public.zones z
  join public.cats c on c.zone_key = z.key
  group by z.key
  having count(*) filter (where c.id in (select cat_id from mine)) > 0
  order by 6 desc, 7 desc;
$$;

revoke execute on function public.my_zone_progress() from public, anon;
grant execute on function public.my_zone_progress() to authenticated;

-- ── น้องที่ฉันเจอแล้ว (เห็นเฉพาะตัวเอง) ล่าสุดก่อน ──
create function public.my_collected_cats(p_limit integer default 60)
returns table (cat_id uuid, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.cat_id, max(t.at)
  from public.cat_touches t
  where t.user_id = (select auth.uid())
  group by t.cat_id
  order by 2 desc
  limit least(p_limit, 200);
$$;

revoke execute on function public.my_collected_cats(integer) from public, anon;
grant execute on function public.my_collected_cats(integer) to authenticated;

-- ── โซนที่อยู่ในกรอบแผนที่ (เรียงตามจำนวนน้องในกรอบ) ──
create function public.zones_in_view(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision)
returns table (zone_key text, name_th text, name_en text, province_th text, province_en text, cats_in_view integer)
language sql
stable
security definer
set search_path = ''
as $$
  select z.key, z.name_th, z.name_en, z.province_th, z.province_en, count(*)::integer
  from public.cats c
  join public.zones z on z.key = c.zone_key
  where c.location operator(extensions.&&)
    extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography
  group by z.key
  order by 6 desc
  limit 12;
$$;

revoke execute on function public.zones_in_view(double precision, double precision, double precision, double precision) from public;
grant execute on function public.zones_in_view(double precision, double precision, double precision, double precision) to anon, authenticated;

-- ── อันดับนักสะสมของโซน ──
create function public.zone_board(p_zone_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with per_user as (
    select t.user_id, count(distinct t.cat_id)::integer as collected, max(t.at) as last_at
    from public.cat_touches t
    join public.cats c on c.id = t.cat_id
    where c.zone_key = p_zone_key
    group by t.user_id
  )
  select jsonb_build_object(
    'total', (select count(*) from public.cats where zone_key = p_zone_key),
    'mine', (select collected from per_user where user_id = (select auth.uid())),
    'top', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb order by r.collected desc, r.last_at asc)
      from (
        select u.user_id, p.display_name, p.avatar_url, p.avatar_path, u.collected, u.last_at
        from per_user u join public.profiles p on p.id = u.user_id
        order by u.collected desc, u.last_at asc
        limit 10
      ) r
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.zone_board(text) from public;
grant execute on function public.zone_board(text) to anon, authenticated;

-- ═══════════════ ช่วยน้องสำเร็จ (แต้มฮีโร่) ═══════════════
-- คนที่กด "ฉันกำลังไปช่วย" แล้วมีคนปิดเรื่อง (ไม่ใช่ปิดเองเพราะหมดอายุ) ภายใน 2 วัน
create table public.help_rescues (
  id bigint generated always as identity primary key,
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  responded_at timestamptz not null,
  resolved_at timestamptz not null default now()
);

create index help_rescues_user_idx on public.help_rescues (user_id);
alter table public.help_rescues enable row level security;
grant all on public.help_rescues to service_role;

create or replace function public.clear_help_responders()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.resolved_at is null and new.resolved_at is not null
     and not exists (select 1 from public.cat_help_requests h where h.cat_id = new.cat_id and h.resolved_at is null) then
    if new.resolved_by is not null then
      insert into public.help_rescues (cat_id, user_id, responded_at)
      select r.cat_id, r.user_id, r.created_at
      from public.cat_help_responders r
      where r.cat_id = new.cat_id and r.created_at > now() - interval '2 days';
    end if;
    delete from public.cat_help_responders where cat_id = new.cat_id;
  end if;
  return new;
end;
$$;

-- ═══════════════ คิดแต้มใหม่ ═══════════════
-- เหรียญ "ช่วยน้อง" นับจากการช่วยจริง (ช่วยสำเร็จ + ยืนยันเรื่องของคนอื่น) แทนการแจ้งเรื่อง
create or replace function public.user_stats(p_user_id uuid)
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
    (select count(*)::integer from public.help_rescues where user_id = p_user_id)
      + (select count(*)::integer from public.cat_help_confirmations where user_id = p_user_id);
$$;

create or replace function public.area_leaderboard(
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
    -- ปักหมุด 5
    select created_by as uid, 5 as pts from public.cats, since where id in (select id from area) and created_at > since.t
    union all
    -- รีวิว 3
    select user_id, 3 from public.reviews, since where cat_id in (select id from area) and created_at > since.t
    union all
    -- รูป 2 (ตัวเดียวกันวันเดียวกันนับไม่เกิน 3 รูป)
    select x.user_id, 2 from (
      select p.user_id, row_number() over (
        partition by p.user_id, p.cat_id, (p.created_at at time zone 'Asia/Bangkok')::date order by p.created_at
      ) as rn
      from public.cat_photos p, since
      where p.cat_id in (select id from area) and p.created_at > since.t and p.user_id is not null
    ) x where x.rn <= 3
    union all
    -- เจอน้อง 1 (ตัวเดิมวันละครั้ง)
    select s.user_id, 1 from (
      select distinct user_id, cat_id, (seen_at at time zone 'Asia/Bangkok')::date
      from public.sightings, since
      where cat_id in (select id from area) and seen_at > since.t and user_id is not null
    ) s
    union all
    -- ให้อาหาร 1 (ตัวเดิมวันละครั้ง)
    select f.user_id, 1 from (
      select distinct user_id, cat_id, (fed_at at time zone 'Asia/Bangkok')::date
      from public.feedings, since
      where cat_id in (select id from area) and fed_at > since.t and user_id is not null
    ) f
    union all
    -- ยืนยันเรื่องขอความช่วยเหลือของคนอื่น 1 (อยู่ใกล้น้องตอนกด 2)
    select c.user_id, case when c.near_cat then 2 else 1 end
    from public.cat_help_confirmations c
    join public.cat_help_requests h on h.id = c.request_id, since
    where h.cat_id in (select id from area) and c.created_at > since.t
    union all
    -- ช่วยน้องสำเร็จ 8
    select r.user_id, 8 from public.help_rescues r, since where r.cat_id in (select id from area) and r.resolved_at > since.t
  )
  select p.id, p.display_name, p.avatar_url, p.avatar_path, sum(a.pts)::integer as points
  from acts a
  join public.profiles p on p.id = a.uid
  group by p.id
  order by points desc, p.display_name
  limit 10;
$$;
