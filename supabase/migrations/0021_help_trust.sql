-- MeowPin 0021: ความน่าเชื่อถือของเรื่อง "น้องต้องการความช่วยเหลือ"
--   1) แจ้งจากจุดที่เจอน้อง — ตอนแจ้ง/ยืนยัน ถ้า GPS ของคนแจ้งอยู่ใกล้หมุด ขึ้นป้ายให้คนอื่นเห็น
--   2) "ฉันก็เห็น" — คนอื่นช่วยยืนยันเรื่องที่แจ้งไว้
--   3) เรื่องค้างนาน — 7 วันไม่มีความเคลื่อนไหว ถามคนแจ้งว่ายังต้องการความช่วยเหลือไหม
--      ถามแล้วไม่มีใครตอบอีก 7 วัน (รวม 14 วัน) ปิดเรื่องเอง ป้ายแดงจะได้ไม่ค้างตลอดไป
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0020

-- ใกล้หมุดแค่ไหนถึงนับว่า "อยู่ที่น้อง": 300 ม. (หมุดน้องมีเจ้าของถูกขยับออก 50–100 ม. อยู่แล้ว) และ GPS แม่นไม่เกิน 150 ม.
-- เก็บแค่ใช่/ไม่ใช่ ไม่เก็บพิกัดของคนแจ้ง
create function public.is_near_cat(p_cat_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_lat is not null and p_lng is not null and p_accuracy is not null and p_accuracy <= 150
    and exists (
      select 1 from public.cats c
      where c.id = p_cat_id
        and extensions.st_dwithin(
          c.location,
          extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          300
        )
    ),
    false
  );
$$;

revoke execute on function public.is_near_cat(uuid, double precision, double precision, double precision) from public, anon, authenticated;

alter table public.cat_help_requests
  add column near_cat boolean not null default false,
  -- แจ้ง/ยืนยัน/ตอบว่ายังต้องการความช่วยเหลือ ล่าสุดเมื่อไหร่ (ใช้นับ 7 วัน)
  add column last_activity_at timestamptz,
  -- ส่งแจ้งเตือนถามคนแจ้งไปแล้วเมื่อไหร่ (null = ยังไม่ได้ถาม หรือมีความเคลื่อนไหวหลังจากถาม)
  add column reminded_at timestamptz;

update public.cat_help_requests set last_activity_at = created_at where last_activity_at is null;
alter table public.cat_help_requests alter column last_activity_at set default now(), alter column last_activity_at set not null;

create index cat_help_stale_idx on public.cat_help_requests (last_activity_at) where resolved_at is null;

-- ═══════════════ แจ้งเรื่อง (แทนการ insert ตรง เพื่อคำนวณ near_cat ฝั่ง server) ═══════════════
create function public.request_cat_help(
  p_cat_id uuid,
  p_kind public.help_kind,
  p_note text default '',
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null or not public.session_is_active() then
    raise exception 'login_required';
  end if;
  insert into public.cat_help_requests (cat_id, user_id, kind, note, near_cat)
  values (p_cat_id, uid, p_kind, left(coalesce(trim(p_note), ''), 300), public.is_near_cat(p_cat_id, p_lat, p_lng, p_accuracy))
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.request_cat_help(uuid, public.help_kind, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.request_cat_help(uuid, public.help_kind, text, double precision, double precision, double precision) to authenticated;

-- ═══════════════ "ฉันก็เห็น" ═══════════════
create table public.cat_help_confirmations (
  request_id uuid not null references public.cat_help_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  near_cat boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index cat_help_confirmations_user_idx on public.cat_help_confirmations (user_id);

-- ใครก็ดูได้ / ยืนยันผ่านฟังก์ชันเท่านั้น / ยกเลิกของตัวเองได้
alter table public.cat_help_confirmations enable row level security;
create policy "Anyone can view help confirmations" on public.cat_help_confirmations
  for select to anon, authenticated using (true);
create policy "Users remove own confirmation" on public.cat_help_confirmations
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Active session only" on public.cat_help_confirmations
  as restrictive for delete to authenticated using ((select public.session_is_active()));

grant select on public.cat_help_confirmations to anon, authenticated;
grant delete on public.cat_help_confirmations to authenticated;
grant all on public.cat_help_confirmations to service_role;

create function public.confirm_cat_help(
  p_request_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  req public.cat_help_requests;
  near boolean;
begin
  if uid is null or not public.session_is_active() then
    raise exception 'login_required';
  end if;
  select * into req from public.cat_help_requests where id = p_request_id;
  if req.id is null or req.resolved_at is not null then
    raise exception 'request_closed';
  end if;
  if req.user_id = uid then
    raise exception 'own_request';
  end if;
  near := public.is_near_cat(req.cat_id, p_lat, p_lng, p_accuracy);
  insert into public.cat_help_confirmations (request_id, user_id, near_cat)
  values (p_request_id, uid, near)
  on conflict (request_id, user_id) do update
    set near_cat = public.cat_help_confirmations.near_cat or excluded.near_cat, created_at = now();
  -- มีคนเห็นน้องอีก = เรื่องยังไม่เก่า เริ่มนับ 7 วันใหม่
  update public.cat_help_requests set last_activity_at = now(), reminded_at = null where id = p_request_id;
  perform public.log_activity(uid, 'help_confirm', req.cat_id, jsonb_build_object('kind', req.kind, 'near', near));
  return near;
end;
$$;

revoke execute on function public.confirm_cat_help(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.confirm_cat_help(uuid, double precision, double precision, double precision) to authenticated;

-- คนแจ้งตอบแจ้งเตือนว่า "น้องยังต้องการความช่วยเหลือ" → เริ่มนับ 7 วันใหม่
create function public.renew_cat_help(p_request_id uuid)
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
  update public.cat_help_requests
  set last_activity_at = now(), reminded_at = null
  where id = p_request_id and resolved_at is null
    and (user_id = uid or public.is_admin() or exists (
      select 1 from public.cats c where c.id = cat_id and c.created_by = uid
    ));
  if not found then
    raise exception 'not_allowed';
  end if;
end;
$$;

revoke execute on function public.renew_cat_help(uuid) from public, anon;
grant execute on function public.renew_cat_help(uuid) to authenticated;

-- ═══════════════ log + การแจ้งเตือน ═══════════════
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete', 'user_ban', 'user_unban', 'cat_verify',
  'review_reply', 'review_report', 'help_confirm', 'help_expire'
));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_review', 'help_request', 'help_resolved', 'not_seen', 'review_reply', 'help_check'));

-- ปิดเรื่องเพราะหมดอายุ (resolved_by = null) ไม่ใช่ "ช่วยน้องแล้ว" — ไม่ต้องแจ้งผู้ติดตาม
create or replace function public.notify_help_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_followers(new.cat_id, new.user_id, 'help_request', jsonb_build_object('help_kind', new.kind));
  elsif old.resolved_at is null and new.resolved_at is not null and new.resolved_by is not null then
    perform public.notify_followers(new.cat_id, new.resolved_by, 'help_resolved', '{}');
  end if;
  return new;
end;
$$;

-- ═══════════════ เรื่องค้างนาน (รันทุกวัน) ═══════════════
create function public.expire_stale_help()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  r record;
begin
  -- 1) ถามไปแล้ว 7 วัน ยังไม่มีใครยืนยันหรือตอบ → ปิดเรื่อง
  for r in
    update public.cat_help_requests
    set resolved_at = now(), resolved_by = null, resolution_note = 'auto_expired'
    where resolved_at is null and reminded_at is not null and reminded_at < now() - interval '7 days'
    returning cat_id, user_id, kind
  loop
    perform public.log_activity(r.user_id, 'help_expire', r.cat_id, jsonb_build_object('kind', r.kind));
    n := n + 1;
  end loop;

  -- 2) ไม่มีความเคลื่อนไหว 7 วัน → ถามคนแจ้ง (ครั้งเดียว จนกว่าจะมีความเคลื่อนไหวใหม่)
  with stale as (
    update public.cat_help_requests h
    set reminded_at = now()
    where h.resolved_at is null and h.reminded_at is null and h.last_activity_at < now() - interval '7 days'
    returning h.id, h.cat_id, h.user_id, h.kind
  )
  insert into public.notifications (user_id, kind, cat_id, data)
  select s.user_id, 'help_check', s.cat_id,
    jsonb_strip_nulls(jsonb_build_object(
      'cat_name', (select c.name from public.cats c where c.id = s.cat_id),
      'help_kind', s.kind,
      'request_id', s.id
    ))
  from stale s;

  return n;
end;
$$;

revoke execute on function public.expire_stale_help() from public, anon, authenticated;

-- รันทุกวัน 10:00 เวลาไทย ด้วย pg_cron
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('meowpin-expire-stale-help', '0 3 * * *', 'select public.expire_stale_help()');
exception when others then
  raise warning 'ตั้งเวลาด้วย pg_cron ไม่ได้ (%): ไปเปิด pg_cron ที่ Database → Extensions แล้วรันส่วนนี้อีกครั้ง', sqlerrm;
end;
$$;
