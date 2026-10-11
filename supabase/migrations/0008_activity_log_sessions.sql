-- MeowPin 0008: บันทึกกิจกรรมของผู้ใช้ (ให้ admin ดู) + อุปกรณ์ที่เข้าสู่ระบบ (ผู้ใช้ดูและสั่งออกจากระบบได้เอง)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0007

-- ═══════════════ บันทึกกิจกรรม ═══════════════
create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'sign_in', 'cat_create', 'cat_delete', 'review_create', 'review_update', 'review_delete',
    'photo_add', 'sighting', 'bug_report', 'cat_report'
  )),
  -- ไม่ผูก FK กับ cats: หมุดถูกลบไปแล้ว log ยังต้องอยู่ (ชื่อแมวเก็บไว้ใน detail.cat_name)
  cat_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_user_idx on public.activity_log (user_id, created_at desc);
create index activity_log_action_idx on public.activity_log (action, created_at desc);

-- อ่านได้เฉพาะ admin / เขียนได้เฉพาะ trigger และ backend
alter table public.activity_log enable row level security;
create policy "Admins can view activity" on public.activity_log
  for select to authenticated using ((select public.is_admin()));

grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;

-- บันทึกไม่สำเร็จต้องไม่ทำให้การกระทำของผู้ใช้ (รวมถึงการล็อกอิน) ล้มตาม
create function public.log_activity(p_user uuid, p_action text, p_cat uuid, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (user_id, action, cat_id, detail)
  values (
    p_user,
    p_action,
    p_cat,
    coalesce(p_detail, '{}') || jsonb_strip_nulls(jsonb_build_object(
      'cat_name', (select c.name from public.cats c where c.id = p_cat)
    ))
  );
exception when others then
  raise warning 'activity log failed: %', sqlerrm;
end;
$$;

revoke execute on function public.log_activity(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.log_activity(uuid, text, uuid, jsonb) to service_role;

-- ── หมุดใหม่ (ลบหมุดบันทึกจาก backend เพราะต้องรู้ว่า admin คนไหนลบ)
create function public.log_cat_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.created_by, 'cat_create', new.id, jsonb_build_object('cat_name', new.name));
  return new;
end;
$$;

create trigger cats_log_insert
  after insert on public.cats
  for each row execute function public.log_cat_insert();

-- ── รีวิว
create function public.log_review_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    -- ลบตามหมุดที่ถูกลบ (cascade) ไม่ต้องบันทึกทีละรีวิว
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    perform public.log_activity(
      coalesce(actor, old.user_id), 'review_delete', old.cat_id,
      jsonb_build_object('paws', old.paws, 'owner_id', old.user_id, 'by_other', actor is distinct from old.user_id)
    );
    return old;
  end if;
  perform public.log_activity(
    new.user_id,
    case tg_op when 'INSERT' then 'review_create' else 'review_update' end,
    new.cat_id,
    jsonb_build_object('paws', new.paws, 'recommend', new.recommend)
  );
  return new;
end;
$$;

create trigger reviews_log_change
  after insert or update or delete on public.reviews
  for each row execute function public.log_review_change();

-- ── รูปในอัลบั้ม
create function public.log_photo_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.user_id, 'photo_add', new.cat_id, jsonb_build_object('review_id', new.review_id));
  return new;
end;
$$;

create trigger cat_photos_log_insert
  after insert on public.cat_photos
  for each row execute function public.log_photo_insert();

-- ── กดเจอน้อง
create function public.log_sighting_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.user_id, 'sighting', new.cat_id, '{}');
  return new;
end;
$$;

create trigger sightings_log_insert
  after insert on public.sightings
  for each row execute function public.log_sighting_insert();

-- ── รายงานปัญหา / รายงานหมุด
create function public.log_report_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'bug_reports' then
    perform public.log_activity(new.user_id, 'bug_report', null, jsonb_build_object('category', new.category));
  else
    perform public.log_activity(new.user_id, 'cat_report', new.cat_id, jsonb_build_object('reason', new.reason));
  end if;
  return new;
end;
$$;

create trigger bug_reports_log_insert
  after insert on public.bug_reports
  for each row execute function public.log_report_insert();
create trigger cat_reports_log_insert
  after insert on public.cat_reports
  for each row execute function public.log_report_insert();

-- ── เข้าสู่ระบบ: ทุกครั้งที่ล็อกอินใหม่ Supabase สร้างแถวใน auth.sessions (ต่ออายุ token ไม่นับ)
create function public.log_sign_in()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.log_activity(new.user_id, 'sign_in', null, jsonb_strip_nulls(jsonb_build_object(
    'session_id', new.id,
    'ip', host(new.ip),
    'user_agent', left(new.user_agent, 300)
  )));
  return new;
exception when others then
  -- ห้ามทำให้ล็อกอินไม่ได้เด็ดขาด
  return new;
end;
$$;

-- บางโปรเจกต์ไม่ให้สร้าง trigger บนตารางของ auth — ถ้าไม่ได้ ส่วนอื่นยังติดตั้งต่อได้ (แค่ไม่มี log ตอนล็อกอิน)
do $$
begin
  create trigger sessions_log_sign_in
    after insert on auth.sessions
    for each row execute function public.log_sign_in();
exception when insufficient_privilege then
  raise warning 'สร้าง trigger บน auth.sessions ไม่ได้ (%): จะไม่มี log การเข้าสู่ระบบ', sqlerrm;
end;
$$;

-- ═══════════════ อุปกรณ์ที่เข้าสู่ระบบ ═══════════════
-- ตำแหน่งโดยประมาณของแต่ละ session (frontend ถาม Vercel ว่า IP นี้อยู่เมืองไหน แล้วบันทึกครั้งเดียวต่อ session)
create table public.session_locations (
  session_id uuid primary key references auth.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  city text check (char_length(city) <= 80),
  region text check (char_length(region) <= 80),
  country text check (char_length(country) <= 2),
  created_at timestamptz not null default now()
);

-- ไม่มี policy เลย: อ่าน/เขียนผ่านฟังก์ชันด้านล่างเท่านั้น
alter table public.session_locations enable row level security;
grant all on public.session_locations to service_role;

-- session ที่ใช้อยู่ตอนนี้ (Supabase ใส่ session_id ไว้ใน access token)
create function public.current_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
$$;

create function public.tag_session_location(p_city text, p_region text, p_country text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  sid uuid := public.current_session_id();
  v_city text := left(nullif(trim(p_city), ''), 80);
  v_region text := left(nullif(trim(p_region), ''), 80);
  v_country text := upper(left(nullif(trim(p_country), ''), 2));
begin
  if uid is null or sid is null or not exists (select 1 from auth.sessions where id = sid and user_id = uid) then
    return;
  end if;
  insert into public.session_locations (session_id, user_id, city, region, country)
  values (sid, uid, v_city, v_region, v_country)
  on conflict (session_id) do nothing;
  if found then
    update public.activity_log
    set detail = detail || jsonb_strip_nulls(jsonb_build_object('city', v_city, 'region', v_region, 'country', v_country))
    where action = 'sign_in' and user_id = uid and detail ->> 'session_id' = sid::text;
  end if;
end;
$$;

create function public.my_sessions()
returns table (
  id uuid,
  user_agent text,
  ip text,
  created_at timestamptz,
  last_active_at timestamptz,
  city text,
  region text,
  country text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_agent,
    host(s.ip),
    s.created_at,
    greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC'),
    l.city,
    l.region,
    l.country,
    s.id is not distinct from public.current_session_id()
  from auth.sessions s
  left join public.session_locations l on l.session_id = s.id
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by s.id is not distinct from public.current_session_id() desc,
    greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') desc;
$$;

-- ลบ session = refresh token ของเครื่องนั้นใช้ไม่ได้ทันที (refresh_tokens ลบตาม cascade)
create function public.revoke_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where id = p_session_id and user_id = (select auth.uid());
  return found;
end;
$$;

create function public.revoke_other_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.sessions
  where user_id = (select auth.uid()) and id is distinct from public.current_session_id();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- access token ของเครื่องที่ถูกสั่งออกยังไม่หมดอายุ (สูงสุด 1 ชม.) — กันไม่ให้ใช้เขียนข้อมูลต่อได้
create function public.session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.sessions where id = public.current_session_id());
$$;

revoke execute on function public.tag_session_location(text, text, text) from public, anon;
revoke execute on function public.my_sessions() from public, anon;
revoke execute on function public.revoke_session(uuid) from public, anon;
revoke execute on function public.revoke_other_sessions() from public, anon;
revoke execute on function public.session_is_active() from public, anon;
grant execute on function public.tag_session_location(text, text, text) to authenticated;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_session(uuid) to authenticated;
grant execute on function public.revoke_other_sessions() to authenticated;
grant execute on function public.session_is_active() to authenticated;

-- restrictive = ต้องผ่านเงื่อนไขนี้ด้วยเสมอ (นอกจาก policy เดิม) — มีผลเฉพาะการเขียน ไม่กระทบการอ่าน
create policy "Active session only" on public.reviews
  as restrictive for insert to authenticated with check ((select public.session_is_active()));
create policy "Active session only (update)" on public.reviews
  as restrictive for update to authenticated using ((select public.session_is_active()));
create policy "Active session only (delete)" on public.reviews
  as restrictive for delete to authenticated using ((select public.session_is_active()));
create policy "Active session only (update)" on public.profiles
  as restrictive for update to authenticated using ((select public.session_is_active()));
create policy "Active session only" on public.cat_reports
  as restrictive for insert to authenticated with check ((select public.session_is_active()));
create policy "Active session only" on public.bug_reports
  as restrictive for insert to authenticated with check ((select public.session_is_active()));
create policy "Active session only (delete)" on public.cat_photos
  as restrictive for delete to authenticated using ((select public.session_is_active()));
create policy "Active session only (avatar upload)" on storage.objects
  as restrictive for insert to authenticated with check ((select public.session_is_active()));
create policy "Active session only (avatar delete)" on storage.objects
  as restrictive for delete to authenticated using ((select public.session_is_active()));
