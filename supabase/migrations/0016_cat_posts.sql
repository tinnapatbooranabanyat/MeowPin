-- MeowPin 0016: ประกาศแมวหาย / หาบ้าน
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0015

create type public.post_kind as enum ('lost', 'adoption');
create type public.post_status as enum ('open', 'resolved');

create table public.cat_posts (
  id uuid primary key default gen_random_uuid(),
  kind public.post_kind not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  description text not null default '' check (char_length(description) <= 800),
  fur_color public.fur_color not null,
  fur_color_custom text check (fur_color_custom is null or char_length(fur_color_custom) between 1 and 30),
  -- ช่องทางติดต่อที่ผู้ประกาศยินยอมให้เห็นสาธารณะ (เช่น LINE ID)
  contact text not null check (char_length(contact) between 1 and 100),
  -- ตำแหน่งที่ backend เบลอแล้ว (แมวหาย 30–80 ม. / หาบ้าน 200–400 ม.)
  location extensions.geography(point, 4326) not null,
  photo_path text,
  status public.post_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index cat_posts_location_idx on public.cat_posts using gist (location);
create index cat_posts_open_idx on public.cat_posts (kind, created_at desc) where status = 'open';

-- อ่านได้ทุกคน / สร้าง แก้ ลบ ผ่าน backend เท่านั้น (ต้องตรวจรูปและเบลอตำแหน่ง)
alter table public.cat_posts enable row level security;
create policy "Anyone can view posts" on public.cat_posts for select to anon, authenticated using (true);
grant select on public.cat_posts to anon, authenticated;
grant all on public.cat_posts to service_role;

create view public.cat_posts_public with (security_invoker = true) as
select
  cp.id,
  cp.kind,
  cp.user_id,
  p.display_name as user_name,
  cp.title,
  cp.description,
  cp.fur_color,
  cp.fur_color_custom,
  cp.contact,
  extensions.st_y(cp.location::extensions.geometry) as lat,
  extensions.st_x(cp.location::extensions.geometry) as lng,
  cp.photo_path,
  cp.status,
  cp.created_at,
  cp.resolved_at
from public.cat_posts cp
left join public.profiles p on p.id = cp.user_id;

grant select on public.cat_posts_public to anon, authenticated, service_role;

-- ประกาศที่ยังเปิดอยู่ในกรอบแผนที่ (ใหม่สุดก่อน)
create function public.posts_in_view(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns setof public.cat_posts_public
language sql
stable
set search_path = ''
as $$
  select v.*
  from public.cat_posts_public v
  where v.status = 'open'
    and v.id in (
      select cp.id from public.cat_posts cp
      where cp.location operator(extensions.&&)
        extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography
    )
  order by v.created_at desc
  limit 100;
$$;

grant execute on function public.posts_in_view(double precision, double precision, double precision, double precision)
  to anon, authenticated;

-- ── log กิจกรรม ──
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete'
));
