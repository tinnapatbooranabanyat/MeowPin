-- MeowPin 0019: ถูกใจ / ตอบกลับ / รายงานรีวิว
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0018

-- ═══════════════ ถูกใจรีวิว ═══════════════
create table public.review_likes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.review_likes enable row level security;
create policy "Anyone can view likes" on public.review_likes for select to anon, authenticated using (true);
create policy "Users like reviews" on public.review_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unlike reviews" on public.review_likes
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Active session only" on public.review_likes
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant select on public.review_likes to anon, authenticated;
grant insert (review_id), delete on public.review_likes to authenticated;
grant all on public.review_likes to service_role;

-- ═══════════════ ตอบกลับรีวิว ═══════════════
create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index review_replies_review_idx on public.review_replies (review_id, created_at);

alter table public.review_replies enable row level security;
create policy "Anyone can view replies" on public.review_replies for select to anon, authenticated using (true);
create policy "Users reply to reviews" on public.review_replies
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Author or admin deletes replies" on public.review_replies
  for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Active session only" on public.review_replies
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant select on public.review_replies to anon, authenticated;
grant insert (review_id, body), delete on public.review_replies to authenticated;
grant all on public.review_replies to service_role;

-- ═══════════════ รายงานรีวิว ═══════════════
create type public.review_report_reason as enum ('spam', 'inappropriate', 'harassment', 'false_info', 'other');

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason public.review_report_reason not null,
  details text not null default '' check (char_length(details) <= 300),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index review_reports_status_idx on public.review_reports (status, created_at desc);

alter table public.review_reports enable row level security;
create policy "Users report reviews" on public.review_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Admins or reporter can view review reports" on public.review_reports
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins update review reports" on public.review_reports
  for update to authenticated using ((select public.is_admin()));
create policy "Active session only" on public.review_reports
  as restrictive for insert to authenticated with check ((select public.session_is_active()));

grant insert (review_id, reason, details) on public.review_reports to authenticated;
grant select, update (status) on public.review_reports to authenticated;
grant all on public.review_reports to service_role;

-- ═══════════════ แจ้งเตือนคนเขียนรีวิวเมื่อมีคนตอบกลับ ═══════════════
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_review', 'help_request', 'help_resolved', 'not_seen', 'review_reply'));

create function public.notify_review_reply()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  rv record;
begin
  select r.user_id, r.cat_id into rv from public.reviews r where r.id = new.review_id;
  if rv.user_id is not null and rv.user_id <> new.user_id then
    insert into public.notifications (user_id, kind, cat_id, data)
    values (rv.user_id, 'review_reply', rv.cat_id, jsonb_build_object(
      'cat_name', (select c.name from public.cats c where c.id = rv.cat_id),
      'actor_name', (select p.display_name from public.profiles p where p.id = new.user_id),
      'body', left(new.body, 120)
    ));
  end if;
  perform public.log_activity(new.user_id, 'review_reply', rv.cat_id, '{}');
  return new;
exception when others then
  return new;
end;
$$;

create trigger review_replies_notify
  after insert on public.review_replies
  for each row execute function public.notify_review_reply();

create function public.log_review_report()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.user_id, 'review_report', (select r.cat_id from public.reviews r where r.id = new.review_id),
    jsonb_build_object('reason', new.reason));
  return new;
end;
$$;

create trigger review_reports_log
  after insert on public.review_reports
  for each row execute function public.log_review_report();

-- ── log กิจกรรม ──
alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report', 'help_request', 'help_resolve', 'feeding',
  'post_create', 'post_resolve', 'post_delete', 'user_ban', 'user_unban', 'cat_verify',
  'review_reply', 'review_report'
));
