-- MeowPin 0005: อัลบั้มรูปของแมวแต่ละตัว (รูปที่แนบมากับรีวิว)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0004

create table public.cat_photos (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  -- ลบรีวิว → รูปที่แนบกับรีวิวนั้นหายไปด้วย
  review_id uuid references public.reviews (id) on delete cascade,
  -- path ใน bucket cat-photos (album/{cat_id}/{uuid}.webp)
  photo_path text not null,
  cat_confidence real not null check (cat_confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create index cat_photos_cat_idx on public.cat_photos (cat_id, created_at desc);
create index cat_photos_review_idx on public.cat_photos (review_id);

-- ใครก็ดูได้ / อัปโหลดได้เฉพาะผ่าน backend (ตรวจว่าเป็นแมว + ลบ EXIF) / ลบได้เฉพาะคนอัปโหลดหรือ admin
alter table public.cat_photos enable row level security;
create policy "Anyone can view cat photos" on public.cat_photos
  for select to anon, authenticated using (true);
create policy "Uploader or admin can delete cat photos" on public.cat_photos
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.cat_photos to anon, authenticated;
grant delete on public.cat_photos to authenticated;
grant all on public.cat_photos to service_role;
