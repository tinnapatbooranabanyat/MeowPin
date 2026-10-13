-- MeowPin 0028: อันดับหลายหมวด หลายช่วงเวลา (ตามโซน หรือทั้งประเทศ) + แชมป์ประจำสัปดาห์ + เหรียญเจอครบโซน
-- หมวด: total (แต้มรวม) / collector (น้องที่เจอครั้งแรก) / explorer (ปักน้องตัวใหม่) / kind (วันที่ให้อาหาร)
--       hero (ช่วยน้องสำเร็จ + ยืนยันเรื่อง) / photographer (หัวใจที่รูปได้รับ)
-- ช่วงเวลา: week (เริ่มทุกวันจันทร์ 00:00 เวลาไทย) / month / all
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0027

-- ── จุดเริ่มของช่วงเวลา (เวลาไทย) ──
create function public.period_start(p_period text, p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'week' then date_trunc('week', p_at at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
    when 'month' then date_trunc('month', p_at at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
    else '-infinity'::timestamptz
  end;
$$;

-- ── คะแนนของทุกคนในหมวด/ช่วงเวลา/โซน (ภายใน) — p_zone_key = null คือทั้งประเทศ ──
create function public.leaderboard_window(p_category text, p_from timestamptz, p_to timestamptz, p_zone_key text)
returns table (user_id uuid, score integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_category = 'collector' then
    -- น้องที่เจอครั้งแรกในช่วงนี้ (ตัวละ 1)
    return query
      select f.user_id, count(*)::integer from (
        select t.user_id, t.cat_id, min(t.at) as first_at
        from public.cat_touches t where t.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key)
        group by t.user_id, t.cat_id
      ) f
      where f.first_at >= p_from and f.first_at < p_to
      group by f.user_id;
  elsif p_category = 'explorer' then
    return query
      select c.created_by, count(*)::integer from public.cats c
      where c.id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and c.created_by is not null and c.created_at >= p_from and c.created_at < p_to
      group by c.created_by;
  elsif p_category = 'kind' then
    -- นับเป็นวัน×ตัว ไม่ใช่มื้อ (ให้เยอะไม่ได้เปรียบ)
    return query
      select f.user_id, count(*)::integer from (
        select distinct fe.user_id, fe.cat_id, (fe.fed_at at time zone 'Asia/Bangkok')::date
        from public.feedings fe
        where fe.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and fe.user_id is not null and fe.near_cat is not false
          and fe.fed_at >= p_from and fe.fed_at < p_to
      ) f
      group by f.user_id;
  elsif p_category = 'hero' then
    return query
      select h.uid, sum(h.pts)::integer from (
        select r.user_id as uid, 3 as pts from public.help_rescues r
        where r.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and r.resolved_at >= p_from and r.resolved_at < p_to
        union all
        select c.user_id, case when c.near_cat then 2 else 1 end
        from public.cat_help_confirmations c join public.cat_help_requests q on q.id = c.request_id
        where q.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and c.created_at >= p_from and c.created_at < p_to
      ) h
      group by h.uid;
  elsif p_category = 'photographer' then
    -- หัวใจที่ได้จากคนอื่น (รูปในอัลบั้ม → คนอัปโหลด / รูปหลัก → คนปักหมุด)
    return query
      select o.owner_id, count(*)::integer from (
        select case when l.photo_ref = 'main' then c.created_by else p.user_id end as owner_id, l.user_id as liker
        from public.cat_photo_likes l
        join public.cats c on c.id = l.cat_id
        left join public.cat_photos p on l.photo_ref <> 'main' and p.id::text = l.photo_ref
        where l.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and l.created_at >= p_from and l.created_at < p_to
      ) o
      where o.owner_id is not null and o.owner_id <> o.liker
      group by o.owner_id;
  else
    -- total: แต้มรวม (กติกาเดียวกับ 0026)
    return query
      select a.uid, sum(a.pts)::integer from (
        select c.created_by as uid, 5 as pts from public.cats c
        where c.id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and c.created_at >= p_from and c.created_at < p_to
        union all
        select rv.user_id, 3 from public.reviews rv
        where rv.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and rv.created_at >= p_from and rv.created_at < p_to
        union all
        select x.user_id, 2 from (
          select ph.user_id, row_number() over (
            partition by ph.user_id, ph.cat_id, (ph.created_at at time zone 'Asia/Bangkok')::date order by ph.created_at
          ) as rn
          from public.cat_photos ph
          where ph.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and ph.user_id is not null and ph.created_at >= p_from and ph.created_at < p_to
        ) x where x.rn <= 3
        union all
        select s.user_id, 1 from (
          select distinct si.user_id, si.cat_id, (si.seen_at at time zone 'Asia/Bangkok')::date
          from public.sightings si
          where si.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and si.user_id is not null and si.seen_at >= p_from and si.seen_at < p_to
        ) s
        union all
        select f.user_id, 1 from (
          select distinct fe.user_id, fe.cat_id, (fe.fed_at at time zone 'Asia/Bangkok')::date
          from public.feedings fe
          where fe.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and fe.user_id is not null and fe.fed_at >= p_from and fe.fed_at < p_to
        ) f
        union all
        select c.user_id, case when c.near_cat then 2 else 1 end
        from public.cat_help_confirmations c join public.cat_help_requests q on q.id = c.request_id
        where q.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and c.created_at >= p_from and c.created_at < p_to
        union all
        select r.user_id, 8 from public.help_rescues r
        where r.cat_id in (select sc.id from public.cats sc where p_zone_key is null or sc.zone_key = p_zone_key) and r.resolved_at >= p_from and r.resolved_at < p_to
      ) a
      where a.uid is not null
      group by a.uid;
  end if;
end;
$$;

revoke execute on function public.leaderboard_window(text, timestamptz, timestamptz, text) from public, anon, authenticated;

-- ── อันดับที่หน้าเว็บเรียก ──
create function public.leaderboard(p_category text, p_period text, p_zone_key text default null)
returns table (user_id uuid, display_name text, avatar_url text, avatar_path text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url, p.avatar_path, w.score
  from public.leaderboard_window(p_category, public.period_start(p_period), 'infinity'::timestamptz, nullif(p_zone_key, '')) w
  join public.profiles p on p.id = w.user_id
  where w.score > 0
  order by w.score desc, p.display_name
  limit 20;
$$;

revoke execute on function public.leaderboard(text, text, text) from public;
grant execute on function public.leaderboard(text, text, text) to anon, authenticated;

-- ═══════════════ แชมป์ประจำสัปดาห์ ═══════════════
-- zone_key = '' คือทั้งประเทศ
create table public.weekly_champions (
  week_start date not null,
  zone_key text not null default '',
  category text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null,
  created_at timestamptz not null default now(),
  primary key (week_start, zone_key, category)
);

create index weekly_champions_user_idx on public.weekly_champions (user_id, week_start desc);

alter table public.weekly_champions enable row level security;
create policy "Anyone can view weekly champions" on public.weekly_champions for select to anon, authenticated using (true);
grant select on public.weekly_champions to anon, authenticated;
grant all on public.weekly_champions to service_role;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'new_review', 'help_request', 'help_resolved', 'not_seen', 'review_reply', 'help_check', 'move_request', 'move_accepted',
  'help_nearby', 'help_on_way', 'weekly_champion'
));

-- สรุปแชมป์ของสัปดาห์ที่เพิ่งจบ (ทุกโซนที่มีหมุด + ทั้งประเทศ × ทุกหมวด) แล้วแจ้งเตือนคนที่ได้
create function public.record_weekly_champions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_to timestamptz := public.period_start('week');
  t_from timestamptz := t_to - interval '7 days';
  wk date := (t_from at time zone 'Asia/Bangkok')::date;
  z record;
  cat text;
  top record;
  n integer := 0;
begin
  for z in select '' as key union all select distinct c.zone_key from public.cats c where c.zone_key is not null loop
    foreach cat in array array['total', 'collector', 'explorer', 'kind', 'hero', 'photographer'] loop
      select w.user_id, w.score into top
      from public.leaderboard_window(cat, t_from, t_to, nullif(z.key, '')) w
      where w.score > 0
      order by w.score desc
      limit 1;
      if top.user_id is null then
        continue;
      end if;
      insert into public.weekly_champions (week_start, zone_key, category, user_id, score)
      values (wk, z.key, cat, top.user_id, top.score)
      on conflict do nothing;
      if found then
        n := n + 1;
        insert into public.notifications (user_id, kind, data)
        values (top.user_id, 'weekly_champion', jsonb_strip_nulls(jsonb_build_object(
          'category', cat,
          'score', top.score,
          'zone_th', (select zz.name_th from public.zones zz where zz.key = z.key),
          'zone_en', (select zz.name_en from public.zones zz where zz.key = z.key)
        )));
      end if;
      top := null;
    end loop;
  end loop;
  return n;
end;
$$;

revoke execute on function public.record_weekly_champions() from public, anon, authenticated;

-- ทุกวันจันทร์ 00:05 เวลาไทย (= อาทิตย์ 17:05 UTC)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('meowpin-weekly-champions', '5 17 * * 0', 'select public.record_weekly_champions()');
exception when others then
  raise warning 'ตั้งเวลาด้วย pg_cron ไม่ได้ (%): ไปเปิด pg_cron ที่ Database → Extensions แล้วรันส่วนนี้อีกครั้ง', sqlerrm;
end;
$$;

-- ── ฉายาแชมป์ของผู้ใช้ (8 ครั้งล่าสุด) ──
create function public.user_champion_titles(p_user_id uuid)
returns table (week_start date, category text, score integer, zone_th text, zone_en text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week_start, w.category, w.score, z.name_th, z.name_en
  from public.weekly_champions w
  left join public.zones z on z.key = w.zone_key
  where w.user_id = p_user_id
  order by w.week_start desc, (w.zone_key = '') desc
  limit 8;
$$;

revoke execute on function public.user_champion_titles(uuid) from public;
grant execute on function public.user_champion_titles(uuid) to anon, authenticated;

-- ── สมุดสะสม: เพิ่มรายชื่อโซนที่เจอครบ (เหรียญเจอครบโซน) ──
create or replace function public.user_collection_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select distinct t.cat_id, c.zone_key
    from public.cat_touches t
    join public.cats c on c.id = t.cat_id
    where t.user_id = p_user_id
  ),
  zone_totals as (
    select zone_key, count(*)::integer as total from public.cats where zone_key is not null group by zone_key
  ),
  my_zones as (
    select m.zone_key, count(*)::integer as collected from mine m where m.zone_key is not null group by m.zone_key
  ),
  done as (
    select z.zone_key from my_zones z join zone_totals t using (zone_key) where z.collected >= t.total
  )
  select jsonb_build_object(
    'cats', (select count(*) from mine),
    'zones', (select count(*) from my_zones),
    'completed', (select count(*) from done),
    'completed_zones', coalesce((
      select jsonb_agg(jsonb_build_object('key', zz.key, 'th', zz.name_th, 'en', zz.name_en) order by zz.name_th)
      from done d join public.zones zz on zz.key = d.zone_key
    ), '[]'::jsonb),
    'mayor', coalesce((
      select jsonb_agg(jsonb_build_object('key', z.key, 'th', z.name_th, 'en', z.name_en) order by z.name_th)
      from public.zone_mayors() m join public.zones z on z.key = m.zone_key
      where m.user_id = p_user_id
    ), '[]'::jsonb)
  );
$$;
