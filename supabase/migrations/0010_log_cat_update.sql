-- MeowPin 0010: บันทึกกิจกรรม "แก้ไขหมุด" (คนปักหมุดแก้รายละเอียดหมุดของตัวเองได้แล้ว)
-- รันใน Supabase Dashboard → SQL Editor หลังจาก 0009

alter table public.activity_log drop constraint activity_log_action_check;
alter table public.activity_log add constraint activity_log_action_check check (action in (
  'sign_in', 'cat_create', 'cat_update', 'cat_delete', 'review_create', 'review_update', 'review_delete',
  'photo_add', 'sighting', 'bug_report', 'cat_report'
));
