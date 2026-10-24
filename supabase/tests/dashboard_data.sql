begin;

select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dashboard-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Dashboard Admin"}'::jsonb, now(), now()),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dashboard-trainer-one@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Dashboard Trainer One"}'::jsonb, now(), now()),
  ('f1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dashboard-trainer-two@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Dashboard Trainer Two"}'::jsonb, now(), now()),
  ('f1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dashboard-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Dashboard Inactive"}'::jsonb, now(), now());

update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;

update public.profiles
set role = 'admin'
where id = 'f1000000-0000-4000-8000-000000000001';

update public.profiles
set active = false
where id = 'f1000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name, active)
values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'Trainer', 'One', true),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'Trainer', 'Two', true),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000004', 'Trainer', 'Inactive', false);

insert into public.rooms (id, name)
values
  ('f3000000-0000-4000-8000-000000000001', 'Dashboard Room One'),
  ('f3000000-0000-4000-8000-000000000002', 'Dashboard Room Two'),
  ('f3000000-0000-4000-8000-000000000003', 'Dashboard Room Three');

insert into public.groups (id, name, active)
values
  ('f4000000-0000-4000-8000-000000000001', 'Dashboard Group One', true),
  ('f4000000-0000-4000-8000-000000000002', 'Dashboard Group Two', true),
  ('f4000000-0000-4000-8000-000000000003', 'Dashboard Group Inactive', false);

insert into public.group_trainers (group_id, trainer_id)
values
  ('f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001'),
  ('f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002');

insert into public.students (id, first_name, last_name, status)
values
  ('f5000000-0000-4000-8000-000000000001', 'Student', 'Present', 'active'),
  ('f5000000-0000-4000-8000-000000000002', 'Student', 'Absent', 'active'),
  ('f5000000-0000-4000-8000-000000000003', 'Student', 'Recovery', 'active'),
  ('f5000000-0000-4000-8000-000000000004', 'Student', 'Other Trainer', 'active'),
  ('f5000000-0000-4000-8000-000000000005', 'Student', 'Inactive', 'inactive');

insert into public.student_groups (student_id, group_id)
values
  ('f5000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001'),
  ('f5000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001'),
  ('f5000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000001'),
  ('f5000000-0000-4000-8000-000000000004', 'f4000000-0000-4000-8000-000000000002'),
  ('f5000000-0000-4000-8000-000000000005', 'f4000000-0000-4000-8000-000000000002');

insert into public.schedule_entries (
  id, title, entry_type, group_id, trainer_id, room_id, starts_at, ends_at, status
)
values
  (
    'f6000000-0000-4000-8000-000000000001', 'Past first class', 'class',
    'f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date - 1 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 1 + time '11:00') at time zone 'Europe/Bucharest', 'completed'
  ),
  (
    'f6000000-0000-4000-8000-000000000002', 'Past second class', 'class',
    'f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000002',
    ((now() at time zone 'Europe/Bucharest')::date - 1 + time '12:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 1 + time '13:00') at time zone 'Europe/Bucharest', 'completed'
  ),
  (
    'f6000000-0000-4000-8000-000000000003', 'Today class', 'class',
    'f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000003',
    ((now() at time zone 'Europe/Bucharest')::date + time '18:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date + time '19:00') at time zone 'Europe/Bucharest', 'scheduled'
  ),
  (
    'f6000000-0000-4000-8000-000000000004', 'Cancelled class', 'class',
    'f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000003',
    ((now() at time zone 'Europe/Bucharest')::date - 2 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 2 + time '11:00') at time zone 'Europe/Bucharest', 'completed'
  ),
  (
    'f6000000-0000-4000-8000-000000000005', 'Tomorrow class', 'class',
    'f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000003',
    ((now() at time zone 'Europe/Bucharest')::date + 1 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date + 1 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'
  );

insert into public.attendance_records (schedule_entry_id, student_id, status)
values
  ('f6000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'present'),
  ('f6000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002', 'absent'),
  ('f6000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000003', 'recovery'),
  ('f6000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000004', 'present'),
  ('f6000000-0000-4000-8000-000000000004', 'f5000000-0000-4000-8000-000000000001', 'present');

update public.schedule_entries
set status = 'cancelled'
where id = 'f6000000-0000-4000-8000-000000000004';

insert into public.tasks (id, title, assigned_to, created_by, status)
values
  ('f7000000-0000-4000-8000-000000000001', 'Admin pending', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'todo'),
  ('f7000000-0000-4000-8000-000000000002', 'Trainer one pending', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'in_progress'),
  ('f7000000-0000-4000-8000-000000000003', 'Trainer two pending', 'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'todo'),
  ('f7000000-0000-4000-8000-000000000004', 'Trainer one done', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'done');

insert into public.competitions (id, name, competition_date, status, created_by)
values
  ('f8000000-0000-4000-8000-000000000001', 'Trainer one upcoming', (now() at time zone 'Europe/Bucharest')::date + 1, 'upcoming', 'f1000000-0000-4000-8000-000000000001'),
  ('f8000000-0000-4000-8000-000000000002', 'Trainer two upcoming', (now() at time zone 'Europe/Bucharest')::date + 2, 'upcoming', 'f1000000-0000-4000-8000-000000000001'),
  ('f8000000-0000-4000-8000-000000000003', 'Past competition', (now() at time zone 'Europe/Bucharest')::date - 1, 'upcoming', 'f1000000-0000-4000-8000-000000000001');

insert into public.competition_trainers (competition_id, trainer_id)
values
  ('f8000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001'),
  ('f8000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002'),
  ('f8000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select active_students, active_trainers, active_groups, today_scheduled_classes,
      attendance_present_count, attendance_recorded_count, attendance_rate,
      upcoming_competitions, pending_tasks
    from public.get_admin_dashboard_summary(
      (now() at time zone 'Europe/Bucharest')::date - 1,
      (now() at time zone 'Europe/Bucharest')::date
    )$$,
  $$values (4::bigint, 2::bigint, 2::bigint, 1::bigint, 2::bigint, 3::bigint, 2::numeric / 3::numeric, 2::bigint, 3::bigint)$$,
  'admin receives school-wide aggregates with normal recorded attendance only'
);

select throws_ok(
  $$select * from public.get_admin_dashboard_summary(date '2026-10-23', date '2026-10-22')$$,
  '22007',
  'Provide a valid inclusive attendance date range.',
  'admin dashboard rejects reversed attendance date ranges'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select active_groups, active_students, today_scheduled_classes,
      attendance_present_count, attendance_recorded_count, attendance_rate,
      pending_tasks, upcoming_competitions
    from public.get_trainer_dashboard_summary(
      (now() at time zone 'Europe/Bucharest')::date - 1,
      (now() at time zone 'Europe/Bucharest')::date
    )$$,
  $$values (1::bigint, 3::bigint, 1::bigint, 1::bigint, 2::bigint, 1::numeric / 2::numeric, 1::bigint, 1::bigint)$$,
  'trainer receives only their groups, students, classes, attendance, tasks, and competitions'
);

select throws_ok(
  $$select * from public.get_admin_dashboard_summary(date '2026-10-22', date '2026-10-22')$$,
  '42501',
  'Administrator access is required.',
  'trainer cannot retrieve admin dashboard metrics'
);

select throws_ok(
  $$select * from public.get_trainer_dashboard_summary(date '2026-10-23', date '2026-10-22')$$,
  '22007',
  'Provide a valid inclusive attendance date range.',
  'trainer dashboard rejects reversed attendance date ranges'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.get_admin_dashboard_summary(date '2026-10-22', date '2026-10-22')$$,
  '42501',
  'An active user is required.',
  'inactive users cannot retrieve admin dashboard metrics'
);

select throws_ok(
  $$select * from public.get_trainer_dashboard_summary(date '2026-10-22', date '2026-10-22')$$,
  '42501',
  'An active user is required.',
  'inactive users cannot retrieve trainer dashboard metrics'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.get_admin_dashboard_summary(date '2026-10-22', date '2026-10-22')$$,
  '42501',
  'An active user is required.',
  'unauthenticated users cannot retrieve admin dashboard metrics'
);

select throws_ok(
  $$select * from public.get_trainer_dashboard_summary(date '2026-10-22', date '2026-10-22')$$,
  '42501',
  'An active user is required.',
  'unauthenticated users cannot retrieve trainer dashboard metrics'
);

select ok(
  pg_get_function_result('public.get_admin_dashboard_summary(date, date)'::regprocedure)
    !~ '(student_id|first_name|last_name|email|phone|notes)',
  'admin summary exposes aggregate fields only'
);

select ok(
  pg_get_function_result('public.get_trainer_dashboard_summary(date, date)'::regprocedure)
    !~ '(student_id|first_name|last_name|email|phone|notes)',
  'trainer summary exposes aggregate fields only'
);

select * from finish();
rollback;
