-- MeowPin 0003: รูปโปรไฟล์ที่ผู้ใช้อัปโหลดเอง (crop เป็นสี่เหลี่ยมจัตุรัสในแอปแล้ว)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0002

-- เก็บเป็น path ใน bucket avatars ไม่ใช่ URL เต็ม → ผู้ใช้ตั้งรูปเป็นลิงก์ภายนอก (เช่น รูปไม่เหมาะสม/ตัวติดตาม) ไม่ได้
-- null = ใช้รูปจาก Google (avatar_url เดิม)
alter table public.profiles
  add column avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[0-9]+\.webp$');

grant update (avatar_path) on public.profiles to authenticated;

-- path ต้องอยู่ในโฟลเดอร์ของตัวเองเท่านั้น
drop policy "Users can edit own profile" on public.profiles;
create policy "Users can edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (avatar_path is null or split_part(avatar_path, '/', 1) = (select auth.uid())::text)
  );

-- ที่เก็บรูปโปรไฟล์: ดูได้สาธารณะ, WebP ไม่เกิน 512 KB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp']);

-- อัปโหลด/ลบได้เฉพาะไฟล์ในโฟลเดอร์ {user id}/ ของตัวเอง
create policy "Users can view own avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
