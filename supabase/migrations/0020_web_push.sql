-- MeowPin 0020: แจ้งเตือนเด้งบนมือถือ (Web Push)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0019

-- เครื่องที่เปิดรับแจ้งเตือน (1 คนมีได้หลายเครื่อง) — เขียนผ่าน backend เท่านั้น
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  -- ภาษาของข้อความแจ้งเตือน (ภาษาที่เลือกในแอปตอนเปิดรับ)
  lang text not null default 'th' check (lang in ('th', 'en')),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
grant all on public.push_subscriptions to service_role;

-- ส่งไปแล้วหรือยัง (กันส่งซ้ำ)
alter table public.notifications add column pushed_at timestamptz;
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

-- มีแจ้งเตือนใหม่ → บอก backend ให้ส่งทันที (ผ่าน pg_net)
-- ถ้าเรียกไม่ติด (เช่น server กำลังตื่น) backend จะเก็บตกทุกครั้งที่ cron ปลุก /health
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise warning 'เปิด pg_net ไม่ได้ (%): ไปเปิดที่ Database → Extensions แล้วรันไฟล์นี้อีกครั้ง — ระหว่างนี้แจ้งเตือนจะส่งช้าสุด 10 นาที', sqlerrm;
end;
$$;

create function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- URL ของ backend บน Render (เปลี่ยน service แล้วต้องแก้ตรงนี้ด้วย)
  perform net.http_post(
    url := 'https://meowpin-api.onrender.com/push/dispatch',
    body := jsonb_build_object('notification_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
  return new;
exception when others then
  -- ไม่มี pg_net / เรียกไม่ได้ → ปล่อยให้ backend เก็บตกภายหลัง ห้ามทำให้การแจ้งเตือนล้ม
  return new;
end;
$$;

create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push();
