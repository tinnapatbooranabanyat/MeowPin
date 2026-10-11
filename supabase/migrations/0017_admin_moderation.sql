-- MeowPin 0017: เครื่องมือผู้ดูแล — ระงับบัญชี + ยืนยันหมุดที่ "ยังไม่ยืนยันว่าเป็นแมว"
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0016

-- ═══════════════ ระงับบัญชี ═══════════════
alter table public.profiles
  add column banned_at timestamptz,
  add column ban_reason text check (char_length(ban_reason) <= 200);

-- ทุก policy/ฟังก์ชันที่ใช้ session_is_active() (รีวิว รายงาน รูป ติดตาม ให้อาหาร ฯลฯ) จะกันบัญชีที่ถูกระงับไปด้วย
create or replace function public.session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.sessions where id = public.current_session_id())
    and not exists (select 1 from public.profiles where id = (select auth.uid()) and banned_at is not null);
$$;

-- กดเจอน้อง: เดิมไม่ได้เช็ก session/การระงับ
create or replace function public.record_sighting(p_cat_id uuid)
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

-- เฉพาะ admin — ระงับแล้วออกจากระบบทุกเครื่องของคนนั้นทันที / ระงับ admin ไม่ได้
create function public.set_user_ban(p_user_id uuid, p_banned boolean, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not public.is_admin() or not public.session_is_active() then
    raise exception 'not_allowed';
  end if;
  if p_banned and exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'cannot_ban_admin';
  end if;
  update public.profiles
  set banned_at = case when p_banned then now() else null end,
      ban_reason = case when p_banned then left(nullif(trim(p_reason), ''), 200) else null end
  where id = p_user_id;
  if p_banned then
    delete from auth.sessions where user_id = p_user_id;
  end if;
  perform public.log_activity(uid, case when p_banned then 'user_ban' else 'user_unban' end, null,
    jsonb_build_object('target_id', p_user_id, 'target_name', (select display_name from public.profiles where id = p_user_id)));
end;
$$;

revoke execute on function public.set_user_ban(uuid, boolean, text) from public, anon;
grant execute on function public.set_user_ban(uuid, boolean, text) to authenticated;

-- ═══════════════ ผู้ดูแลยืนยันว่าเป็นแมว ═══════════════
alter table public.cats drop constraint cats_cat_check_check;
alter table public.cats add constraint cats_cat_check_check check (cat_check in ('model', 'ai', 'user', 'admin'));
alter table public.cat_photos drop constraint cat_photos_cat_check_check;
alter table public.cat_photos add constraint cat_photos_cat_check_check check (cat_check in ('model', 'ai', 'user', 'admin'));

-- ── log กิจกรรม ──
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete', 'user_ban', 'user_unban', 'cat_verify'
));
