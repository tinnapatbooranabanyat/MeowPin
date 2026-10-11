-- MeowPin 0011: แจ้งว่าน้องต้องการความช่วยเหลือ (บาดเจ็บ / ป่วย / ผอมมาก / ยังไม่ทำหมัน)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0010

create type public.help_kind as enum ('injured', 'sick', 'thin', 'not_neutered', 'other');

create table public.cat_help_requests (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.help_kind not null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 300)
);

create index cat_help_open_idx on public.cat_help_requests (cat_id) where resolved_at is null;
-- 1 คนแจ้งเรื่องเดียวกันซ้ำไม่ได้ ระหว่างที่ยังไม่มีใครปิดเรื่อง
create unique index cat_help_one_open_per_user on public.cat_help_requests (cat_id, user_id, kind) where resolved_at is null;

-- ใครก็ดูได้ (มูลนิธิ/อาสาไม่ต้องล็อกอินก็เห็น) / แจ้งได้เมื่อล็อกอิน / ปิดเรื่องผ่านฟังก์ชันเท่านั้น
alter table public.cat_help_requests enable row level security;
create policy "Anyone can view help requests" on public.cat_help_requests
  for select to anon, authenticated using (true);
create policy "Users can request help" on public.cat_help_requests
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Active session only" on public.cat_help_requests
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant select on public.cat_help_requests to anon, authenticated;
grant insert (cat_id, kind, note) on public.cat_help_requests to authenticated;
grant all on public.cat_help_requests to service_role;

-- ปิดเรื่อง (ช่วยแล้ว/หายดีแล้ว): admin, คนปักหมุด หรือคนที่แจ้งเอง — ปิดทุกเรื่องที่ค้างของน้องตัวนี้ทีเดียว
create function public.resolve_cat_help(p_cat_id uuid, p_note text default '')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null or not public.session_is_active() then
    raise exception 'login_required';
  end if;
  if not (
    public.is_admin()
    or exists (select 1 from public.cats c where c.id = p_cat_id and c.created_by = uid)
    or exists (select 1 from public.cat_help_requests h where h.cat_id = p_cat_id and h.user_id = uid and h.resolved_at is null)
  ) then
    raise exception 'not_allowed';
  end if;
  update public.cat_help_requests
  set resolved_at = now(), resolved_by = uid, resolution_note = left(nullif(trim(p_note), ''), 300)
  where cat_id = p_cat_id and resolved_at is null;
  get diagnostics n = row_count;
  if n > 0 then
    perform public.log_activity(uid, 'help_resolve', p_cat_id, jsonb_build_object('count', n));
  end if;
  return n;
end;
$$;

revoke execute on function public.resolve_cat_help(uuid, text) from public, anon;
grant execute on function public.resolve_cat_help(uuid, text) to authenticated;

-- ── log กิจกรรม: แจ้ง/ปิดเรื่อง ──
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve'
));

create function public.log_help_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.user_id, 'help_request', new.cat_id, jsonb_build_object('kind', new.kind));
  return new;
end;
$$;

create trigger cat_help_log_insert
  after insert on public.cat_help_requests
  for each row execute function public.log_help_request();

-- ── view สาธารณะ: เรื่องที่ยังค้าง (ขึ้นป้ายแดง + ตัวกรอง "ต้องการความช่วยเหลือ") ──
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
  c.cat_check,
  coalesce(h.kinds, '{}') as help_kinds
from public.cats c
left join public.profiles p on p.id = c.created_by
left join lateral (
  select
    count(*) as review_count,
    round(avg(rv.paws)::numeric, 1)::double precision as paw_avg,
    count(*) filter (where rv.recommend) as recommend_count
  from public.reviews rv
  where rv.cat_id = c.id
) r on true
left join lateral (
  select array_agg(distinct hr.kind order by hr.kind) as kinds
  from public.cat_help_requests hr
  where hr.cat_id = c.id and hr.resolved_at is null
) h on true;

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
