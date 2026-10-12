-- MeowPin 0023: กดหัวใจรูป + รายงานรูปที่ไม่เหมาะสม
-- photo_ref = id ของรูปในอัลบั้ม (cat_photos.id) หรือ 'main' = รูปหลักตอนปักหมุด (เก็บอยู่ใน cats.photo_path)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0022

-- ═══════════════ หัวใจ ═══════════════
create table public.cat_photo_likes (
  cat_id uuid not null references public.cats (id) on delete cascade,
  photo_ref text not null check (photo_ref = 'main' or photo_ref ~ '^[0-9a-f-]{36}$'),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cat_id, photo_ref, user_id)
);

alter table public.cat_photo_likes enable row level security;
create policy "Anyone can view photo likes" on public.cat_photo_likes
  for select to anon, authenticated using (true);
create policy "Users like photos" on public.cat_photo_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unlike photos" on public.cat_photo_likes
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Active session only" on public.cat_photo_likes
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant select on public.cat_photo_likes to anon, authenticated;
grant insert (cat_id, photo_ref), delete on public.cat_photo_likes to authenticated;
grant all on public.cat_photo_likes to service_role;

-- ═══════════════ รายงานรูป ═══════════════
create table public.cat_photo_reports (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  photo_ref text not null check (photo_ref = 'main' or photo_ref ~ '^[0-9a-f-]{36}$'),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('not_this_cat', 'not_cat', 'inappropriate', 'privacy', 'other')),
  details text not null default '' check (char_length(details) <= 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index cat_photo_reports_open_idx on public.cat_photo_reports (created_at desc) where status = 'open';
-- 1 คนรายงานรูปเดียวกันซ้ำไม่ได้ระหว่างที่ยังไม่มีใครตรวจ
create unique index cat_photo_reports_one_open on public.cat_photo_reports (cat_id, photo_ref, user_id) where status = 'open';

-- คนรายงานเห็นของตัวเอง ผู้ดูแลเห็นทั้งหมดและปิดรายงานได้
alter table public.cat_photo_reports enable row level security;
create policy "Users report photos" on public.cat_photo_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Active session only" on public.cat_photo_reports
  as restrictive for insert to authenticated with check ((select public.session_is_active()));
create policy "Reporter or admin can view photo reports" on public.cat_photo_reports
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins update photo reports" on public.cat_photo_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.cat_photo_reports to authenticated;
grant insert (cat_id, photo_ref, reason, details) on public.cat_photo_reports to authenticated;
grant update (status) on public.cat_photo_reports to authenticated;
grant all on public.cat_photo_reports to service_role;

-- ลบรูปในอัลบั้ม → ล้างหัวใจและรายงานของรูปนั้นด้วย
create function public.cleanup_photo_refs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.cat_photo_likes where cat_id = old.cat_id and photo_ref = old.id::text;
  delete from public.cat_photo_reports where cat_id = old.cat_id and photo_ref = old.id::text;
  return old;
end;
$$;

create trigger cat_photos_cleanup_refs
  after delete on public.cat_photos
  for each row execute function public.cleanup_photo_refs();

-- ── log ──
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete', 'user_ban', 'user_unban', 'cat_verify',
  'review_reply', 'review_report', 'help_confirm', 'help_expire', 'move_request', 'photo_report', 'photo_delete'
));

create function public.log_photo_report()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.user_id, 'photo_report', new.cat_id, jsonb_build_object('reason', new.reason));
  return new;
end;
$$;

create trigger cat_photo_reports_log
  after insert on public.cat_photo_reports
  for each row execute function public.log_photo_report();
