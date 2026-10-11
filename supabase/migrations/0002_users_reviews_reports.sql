-- MeowPin 0002: ผู้ใช้ (Google), เจ้าของแพลตฟอร์ม, นิสัยแมว, รีวิวอุ้งเท้า, รายงานปัญหา, รายงานหมุดแมว
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0001_init.sql

-- ═══════════════ โปรไฟล์ผู้ใช้ ═══════════════
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Anyone can view profiles" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users can edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.profiles to anon, authenticated;
-- แก้ได้เฉพาะชื่อที่แสดง (คอลัมน์อื่นแก้ไม่ได้แม้จะเป็นแถวของตัวเอง)
grant update (display_name) on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ═══════════════ เจ้าของแพลตฟอร์ม ═══════════════
-- ไม่มี policy ให้ insert/update เลย → เพิ่มได้ทางเดียวคือ SQL Editor (เฉพาะคนที่คุม Supabase project)
create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
grant all on public.admins to service_role;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- อีเมลที่จะเป็นเจ้าของแพลตฟอร์ม — backend sync จาก ADMIN_EMAILS ใน .env ให้ (อีเมลไม่ต้องอยู่ในโค้ด)
create table public.admin_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;
grant all on public.admin_emails to service_role;

-- เพิ่มอีเมลหลังจากคนนั้นสมัครไปแล้ว → ตั้งเป็น admin ทันที
create function public.promote_admin_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admins (user_id)
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = new.email
  on conflict do nothing;
  return new;
end;
$$;

create trigger admin_emails_promote
  after insert on public.admin_emails
  for each row execute function public.promote_admin_email();

-- ลบอีเมลออก → ถอดสิทธิ์ admin
create function public.demote_admin_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.admins a
  using auth.users u
  where a.user_id = u.id and lower(u.email) = old.email;
  return old;
end;
$$;

create trigger admin_emails_demote
  after delete on public.admin_emails
  for each row execute function public.demote_admin_email();

-- สมัครด้วย Google ครั้งแรก → สร้างโปรไฟล์จากชื่อ/รูปใน Google อัตโนมัติ
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'คนรักแมว'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  -- อีเมลอยู่ในรายชื่อเจ้าของแพลตฟอร์ม → เป็น admin ตั้งแต่ล็อกอินครั้งแรก
  if exists (select 1 from public.admin_emails where email = lower(new.email)) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════ แมว: คนปักหมุด + นิสัย + ทำหมัน ═══════════════
create type public.neuter_status as enum ('yes', 'no', 'unknown');

alter table public.cats
  add column created_by uuid references public.profiles (id) on delete set null,
  add column is_friendly boolean not null default false,
  add column is_clingy boolean not null default false,
  add column is_playful boolean not null default false,
  add column neutered public.neuter_status not null default 'unknown';

create index cats_created_by_idx on public.cats (created_by);

-- ═══════════════ การเจอ: ผูกกับผู้ใช้ ═══════════════
alter table public.sightings
  add column user_id uuid references public.profiles (id) on delete set null;

create index sightings_user_cat_idx on public.sightings (user_id, cat_id, seen_at desc);

-- เรียกจาก frontend ได้โดยตรง (ต้องล็อกอิน) — กดเจอแมวตัวเดิมได้ 1 ครั้งต่อ 10 นาที
drop function public.record_sighting(uuid);
create function public.record_sighting(p_cat_id uuid)
returns table (sightings_count integer, last_seen_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'login_required';
  end if;
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

revoke execute on function public.record_sighting(uuid) from public, anon;
grant execute on function public.record_sighting(uuid) to authenticated, service_role;

-- ═══════════════ รีวิวความน่ารัก (อุ้งเท้า 1–5 + แนะนำ/ไม่แนะนำ) ═══════════════
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  paws smallint not null check (paws between 1 and 5),
  recommend boolean not null,
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 1 คนรีวิวแมว 1 ตัวได้ครั้งเดียว (แก้ไขทีหลังได้)
  unique (cat_id, user_id)
);

create index reviews_cat_idx on public.reviews (cat_id, created_at desc);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;
create policy "Anyone can view reviews" on public.reviews
  for select to anon, authenticated using (true);
create policy "Users can write own review" on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users can edit own review" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users or admins can delete reviews" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.reviews to anon, authenticated;
grant insert (cat_id, paws, recommend, comment) on public.reviews to authenticated;
grant update (paws, recommend, comment) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant all on public.reviews to service_role;

-- ═══════════════ รายงานปัญหาถึงเจ้าของแพลตฟอร์ม ═══════════════
create type public.report_status as enum ('open', 'resolved');

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  -- ไม่ล็อกอินก็รายงานได้ (เผื่อปัญหาคือล็อกอินไม่ได้)
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  page_url text check (char_length(page_url) <= 500),
  user_agent text check (char_length(user_agent) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create index bug_reports_status_idx on public.bug_reports (status, created_at desc);

alter table public.bug_reports enable row level security;
create policy "Anyone can send a report" on public.bug_reports
  for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));
create policy "Admins can view reports" on public.bug_reports
  for select to authenticated using ((select public.is_admin()));
create policy "Admins can update reports" on public.bug_reports
  for update to authenticated using ((select public.is_admin()));

grant insert (category, message, page_url, user_agent) on public.bug_reports to anon, authenticated;
grant select, update (status) on public.bug_reports to authenticated;
grant all on public.bug_reports to service_role;

-- ═══════════════ รายงานหมุดแมวที่ไม่เหมาะสม ═══════════════
create type public.cat_report_reason as enum (
  'not_cat',        -- ไม่ใช่แมว / ไม่เกี่ยวกับแมว
  'inappropriate',  -- รูปหรือข้อความไม่เหมาะสม
  'wrong_location', -- ปักผิดที่
  'duplicate',      -- ซ้ำกับหมุดอื่น
  'privacy',        -- เปิดเผยบ้าน/ข้อมูลส่วนตัว
  'other'
);

create table public.cat_reports (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason public.cat_report_reason not null,
  details text not null default '' check (char_length(details) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  -- 1 คนรายงานหมุดเดียวกันได้ครั้งเดียว กันการปั่นรายงาน
  unique (cat_id, user_id)
);

create index cat_reports_status_idx on public.cat_reports (status, created_at desc);

alter table public.cat_reports enable row level security;
create policy "Users can report cats" on public.cat_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Admins or reporter can view" on public.cat_reports
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins can update cat reports" on public.cat_reports
  for update to authenticated using ((select public.is_admin()));

grant insert (cat_id, reason, details) on public.cat_reports to authenticated;
grant select, update (status) on public.cat_reports to authenticated;
grant all on public.cat_reports to service_role;

-- ═══════════════ view สาธารณะ: เพิ่มนิสัย คนปักหมุด และสรุปรีวิว ═══════════════
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
  coalesce(r.recommend_count, 0)::integer as recommend_count
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
