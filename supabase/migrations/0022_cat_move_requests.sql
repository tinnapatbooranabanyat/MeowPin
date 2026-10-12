-- MeowPin 0022: เสนอตำแหน่งใหม่ของหมุด (คนที่ไม่ใช่คนปักหมุด)
-- คนอื่นปักตำแหน่งที่ถูกไว้ → แจ้งเตือนคนปักหมุด → คนปักหมุด/ผู้ดูแลกด "ย้ายตามนี้" หรือ "ไม่ย้าย"
-- ย้ายจริงทำผ่าน backend (PATCH /cats/{id}/location) เพื่อใช้กติกาเดียวกับการย้ายเอง (ป้าย GPS, เบลอแมวมีเจ้าของ)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0021

create table public.cat_move_requests (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);

create index cat_move_pending_idx on public.cat_move_requests (cat_id) where status = 'pending';
-- 1 คนเสนอได้ 1 ตำแหน่งต่อหมุดระหว่างรอ (เสนอใหม่ = แก้ตำแหน่งเดิม)
create unique index cat_move_one_pending on public.cat_move_requests (cat_id, user_id) where status = 'pending';

-- เห็นได้เฉพาะคนเสนอ คนปักหมุด และผู้ดูแล (ตำแหน่งที่เสนออาจเป็นบ้านจริงของน้องมีเจ้าของ)
alter table public.cat_move_requests enable row level security;
create policy "Requester, pinner and admins see move requests" on public.cat_move_requests
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.cats c where c.id = cat_id and c.created_by = (select auth.uid()))
  );

grant select on public.cat_move_requests to authenticated;
grant all on public.cat_move_requests to service_role;

-- ── แจ้งเตือน + log ──
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'new_review', 'help_request', 'help_resolved', 'not_seen', 'review_reply', 'help_check', 'move_request', 'move_accepted'
));

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete', 'user_ban', 'user_unban', 'cat_verify',
  'review_reply', 'review_report', 'help_confirm', 'help_expire', 'move_request'
));

-- ── เสนอตำแหน่ง ──
create function public.request_cat_move(p_cat_id uuid, p_lat double precision, p_lng double precision, p_note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pinner uuid;
  req_id uuid;
begin
  if uid is null or not public.session_is_active() then
    raise exception 'login_required';
  end if;
  select c.created_by into pinner from public.cats c where c.id = p_cat_id;
  if not found then
    raise exception 'not_found';
  end if;
  if pinner = uid then
    raise exception 'own_cat';
  end if;

  insert into public.cat_move_requests (cat_id, user_id, lat, lng, note)
  values (p_cat_id, uid, p_lat, p_lng, left(coalesce(trim(p_note), ''), 200))
  on conflict (cat_id, user_id) where status = 'pending'
  do update set lat = excluded.lat, lng = excluded.lng, note = excluded.note, created_at = now()
  returning id into req_id;

  -- แจ้งคนปักหมุด (กันซ้ำ 10 นาที) — หมุดของทีมงาน (ไม่มีคนปัก) ผู้ดูแลเห็นในหน้าหมุดเอง
  if pinner is not null and not exists (
    select 1 from public.notifications n
    where n.user_id = pinner and n.cat_id = p_cat_id and n.kind = 'move_request' and n.created_at > now() - interval '10 minutes'
  ) then
    insert into public.notifications (user_id, kind, cat_id, data)
    values (pinner, 'move_request', p_cat_id, jsonb_strip_nulls(jsonb_build_object(
      'cat_name', (select c.name from public.cats c where c.id = p_cat_id),
      'actor_name', (select p.display_name from public.profiles p where p.id = uid)
    )));
  end if;
  perform public.log_activity(uid, 'move_request', p_cat_id, '{}');
  return req_id;
end;
$$;

revoke execute on function public.request_cat_move(uuid, double precision, double precision, text) from public, anon;
grant execute on function public.request_cat_move(uuid, double precision, double precision, text) to authenticated;

-- ── ไม่ย้าย (คนปักหมุดหรือผู้ดูแล) ──
create function public.reject_cat_move(p_request_id uuid)
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
  update public.cat_move_requests r
  set status = 'rejected', decided_at = now(), decided_by = uid
  where r.id = p_request_id and r.status = 'pending'
    and (public.is_admin() or exists (select 1 from public.cats c where c.id = r.cat_id and c.created_by = uid));
  if not found then
    raise exception 'not_allowed';
  end if;
end;
$$;

revoke execute on function public.reject_cat_move(uuid) from public, anon;
grant execute on function public.reject_cat_move(uuid) to authenticated;
