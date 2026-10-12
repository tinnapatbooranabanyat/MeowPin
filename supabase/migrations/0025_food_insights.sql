-- MeowPin 0025: อาหารของน้อง
--   1) ตัวกรอง "ยังไม่ได้กินวันนี้" บนแผนที่
--   2) บอกว่าน้องกินแค่ไหน (กินหมด / กินนิดหน่อย / ไม่กิน) → สรุปว่าน้องชอบอาหารแบบไหนจริงๆ
--   3) ข้อควรระวังเรื่องอาหาร (แพ้ / ห้ามให้) — คนปักหมุดหรือผู้ดูแลตั้งได้ ขึ้นเตือนก่อนให้อาหาร
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0024

alter table public.feedings
  add column eaten text check (eaten in ('all', 'some', 'none'));

alter table public.cats
  add column food_notes text not null default '' check (char_length(food_notes) <= 200);

-- ── 1) น้องตัวไหนในรายการนี้ได้กินแล้ววันนี้ (เวลาไทย) — ไม่บอกว่าใครให้ ──
create function public.cat_ids_fed_today(p_cat_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct f.cat_id
  from public.feedings f
  where f.cat_id = any (p_cat_ids[1:1000])
    and f.fed_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
$$;

revoke execute on function public.cat_ids_fed_today(uuid[]) from public;
grant execute on function public.cat_ids_fed_today(uuid[]) to anon, authenticated;

-- ── 2) น้องกินแค่ไหน (อัปเดตการให้อาหารครั้งล่าสุดของเราภายใน 6 ชม.) ──
create function public.set_feeding_reaction(p_cat_id uuid, p_eaten text)
returns void
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
  if p_eaten not in ('all', 'some', 'none') then
    raise exception 'bad_value';
  end if;
  update public.feedings f
  set eaten = p_eaten
  where f.id = (
    select f2.id from public.feedings f2
    where f2.cat_id = p_cat_id and f2.user_id = uid and f2.fed_at > now() - interval '6 hours'
    order by f2.fed_at desc
    limit 1
  );
  if not found then
    raise exception 'no_recent_feeding';
  end if;
end;
$$;

revoke execute on function public.set_feeding_reaction(uuid, text) from public, anon;
grant execute on function public.set_feeding_reaction(uuid, text) to authenticated;

-- ── สรุปอาหารของน้อง: ข้อควรระวัง + แต่ละประเภทให้ไปกี่ครั้ง/กินหมดกี่ครั้ง (90 วันล่าสุด) ──
create function public.cat_food_info(p_cat_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'notes', coalesce((select c.food_notes from public.cats c where c.id = p_cat_id), ''),
    'foods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'food', s.food, 'total', s.total, 'all', s.eaten_all, 'some', s.eaten_some, 'none', s.eaten_none
      ) order by s.total desc)
      from (
        select f.food,
          count(*)::integer as total,
          count(*) filter (where f.eaten = 'all')::integer as eaten_all,
          count(*) filter (where f.eaten = 'some')::integer as eaten_some,
          count(*) filter (where f.eaten = 'none')::integer as eaten_none
        from public.feedings f
        where f.cat_id = p_cat_id and f.fed_at > now() - interval '90 days'
        group by f.food
      ) s
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.cat_food_info(uuid) from public;
grant execute on function public.cat_food_info(uuid) to anon, authenticated;
