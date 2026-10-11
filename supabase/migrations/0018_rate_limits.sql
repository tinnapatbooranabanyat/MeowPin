-- MeowPin 0018: จำกัดความถี่ (rate limit) ในฐานข้อมูล — ไม่รีเซ็ตทุกครั้งที่ server รีสตาร์ท
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0017

create table public.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits integer not null
);

-- ใช้ได้เฉพาะ backend (service role)
alter table public.rate_limits enable row level security;
grant all on public.rate_limits to service_role;

-- นับครั้งแบบหน้าต่างเวลาคงที่ทีเดียวจบ (ไม่มีจังหวะให้ request ที่มาพร้อมกันนับพลาด) — คืน true ถ้ายังไม่เกิน
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_s integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => p_window_s) then now() else r.window_start end,
        hits = case when r.window_start < now() - make_interval(secs => p_window_s) then 1 else r.hits + 1 end
  returning hits into n;
  -- เก็บกวาดแถวเก่าเป็นครั้งคราว (ไม่ต้องตั้งเวลาแยก)
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return n <= p_limit;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
