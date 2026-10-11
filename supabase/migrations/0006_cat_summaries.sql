-- MeowPin 0006: สรุปแมวแต่ละตัวด้วย AI (Gemini) จากคำอธิบาย + รีวิว
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0005

-- เก็บผลไว้ ไม่เรียก AI ทุกครั้งที่เปิดหน้า — backend สร้างใหม่เฉพาะเมื่อข้อมูลเปลี่ยน (source_hash)
create table public.cat_summaries (
  cat_id uuid primary key references public.cats (id) on delete cascade,
  summary_th text not null check (char_length(summary_th) <= 1000),
  summary_en text not null check (char_length(summary_en) <= 1000),
  -- จำนวนรีวิวตอนสรุป (frontend ใช้ดูว่าล้าสมัยหรือยัง)
  review_count integer not null,
  source_hash text not null,
  model text not null,
  generated_at timestamptz not null default now()
);

alter table public.cat_summaries enable row level security;
create policy "Anyone can view cat summaries" on public.cat_summaries
  for select to anon, authenticated using (true);

grant select on public.cat_summaries to anon, authenticated;
grant all on public.cat_summaries to service_role;
