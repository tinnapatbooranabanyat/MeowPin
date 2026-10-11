-- MeowPin 0007: ยอมรับข้อกำหนดการใช้งานก่อนเริ่มใช้แอป
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0006

-- 0 = ยังไม่เคยยอมรับ — ถ้าแก้ข้อกำหนดแล้วเพิ่มเลขเวอร์ชันใน frontend ทุกคนจะต้องกดยอมรับใหม่
alter table public.profiles
  add column terms_version integer not null default 0,
  add column terms_accepted_at timestamptz;

-- ผู้ใช้แก้คอลัมน์นี้ตรงๆ ไม่ได้ (grant update มีแค่ display_name, avatar_path) — ต้องผ่านฟังก์ชันนี้เท่านั้น
create function public.accept_terms(version integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set terms_version = greatest(terms_version, version),
      terms_accepted_at = now()
  where id = (select auth.uid()) and version between 1 and 1000;
$$;

revoke execute on function public.accept_terms(integer) from public, anon;
grant execute on function public.accept_terms(integer) to authenticated;
