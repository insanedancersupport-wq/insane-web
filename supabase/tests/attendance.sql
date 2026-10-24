begin;

select plan(23);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('80000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'attendance-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Attendance Admin"}'::jsonb, now(), now()),
  ('80000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'responsible@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Responsible Trainer"}'::jsonb, now(), now()),
  ('80000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'assigned@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Assigned Trainer"}'::jsonb, now(), now()),
  ('80000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unrelated@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Unrelated Trainer"}'::jsonb, now(), now());

update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;

update public.profiles set role = 'admin'
where id = '80000000-0000-4000-8000-000000000001';

insert into public.trainers (id, profile_id, first_name, last_name)
values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'Responsible', 'Trainer'),
  ('81000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000003', 'Assigned', 'Trainer'),
  ('81000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000004', 'Unrelated', 'Trainer');

insert into public.groups (id, name)
values
  ('82000000-0000-4000-8000-000000000001', 'Own Group'),
  ('82000000-0000-4000-8000-000000000002', 'Other Group');

insert into public.rooms (id, name)
values ('83000000-0000-4000-8000-000000000001', 'Attendance Studio');

insert into public.group_trainers (group_id, trainer_id)
values
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002'),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000003');

insert into public.students (id, first_name, last_name)
values
  ('84000000-0000-4000-8000-000000000001', 'Own', 'Student'),
  ('84000000-0000-4000-8000-000000000002', 'Other', 'Student');

insert into public.student_groups (student_id, group_id)
values
  ('84000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002');

insert into public.schedule_entries (
  id, title, entry_type, group_id, trainer_id, room_id, starts_at, ends_at
)
values
  ('85000000-0000-4000-8000-000000000001', 'Own Class', 'class', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', date_trunc('day', now()) - interval '1 day' + interval '12 hours', date_trunc('day', now()) - interval '1 day' + interval '13 hours'),
  ('85000000-0000-4000-8000-000000000002', 'Other Class', 'class', '82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000003', '83000000-0000-4000-8000-000000000001', date_trunc('day', now()) - interval '1 day' + interval '10 hours', date_trunc('day', now()) - interval '1 day' + interval '11 hours'),
  ('85000000-0000-4000-8000-000000000003', 'Workshop', 'workshop', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', date_trunc('day', now()) - interval '1 day' + interval '8 hours', date_trunc('day', now()) - interval '1 day' + interval '9 hours'),
  ('85000000-0000-4000-8000-000000000004', 'Future Class', 'class', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', date_trunc('day', now()) + interval '1 day 12 hours', date_trunc('day', now()) + interval '1 day 13 hours'),
  ('85000000-0000-4000-8000-000000000005', 'Cancelled Class', 'class', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', date_trunc('day', now()) - interval '1 day' + interval '6 hours', date_trunc('day', now()) - interval '1 day' + interval '7 hours');

update public.schedule_entries
set status = 'cancelled'
where id = '85000000-0000-4000-8000-000000000005';

create function pg_temp.try_insert_attendance(
  target_entry_id uuid,
  target_student_id uuid,
  target_status public.attendance_status
)
returns text
language plpgsql
as $$
begin
  insert into public.attendance_records (schedule_entry_id, student_id, status)
  values (target_entry_id, target_student_id, target_status)
  on conflict (schedule_entry_id, student_id)
  do update set status = excluded.status;
  return 'ok';
exception
  when others then return sqlstate;
end;
$$;

create function pg_temp.update_attendance_status(
  target_entry_id uuid,
  target_student_id uuid,
  target_status public.attendance_status
)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  update public.attendance_records
  set status = target_status
  where schedule_entry_id = target_entry_id
    and student_id = target_student_id;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.try_delete_attendance(
  target_entry_id uuid,
  target_student_id uuid
)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  delete from public.attendance_records
  where schedule_entry_id = target_entry_id
    and student_id = target_student_id;

  get diagnostics affected_rows = row_count;
  return affected_rows;
exception
  when others then return -1;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'present'),
  'ok',
  'responsible trainer can mark an eligible student present'
);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'recovery'),
  'ok',
  'responsible trainer can update an eligible student to recovery'
);

select lives_ok(
  $$
    insert into public.attendance_records (
      schedule_entry_id,
      student_id,
      status,
      marked_by
    )
    values (
      '85000000-0000-4000-8000-000000000001',
      '84000000-0000-4000-8000-000000000001',
      'present',
      '80000000-0000-4000-8000-000000000001'
    )
    on conflict (schedule_entry_id, student_id)
    do update set
      status = excluded.status,
      marked_by = excluded.marked_by
  $$,
  'trainer can upsert attendance without supplying trusted marker metadata'
);

select is(
  (
    select marked_by
    from public.attendance_records
    where schedule_entry_id = '85000000-0000-4000-8000-000000000001'
  ),
  '80000000-0000-4000-8000-000000000002'::uuid,
  'client-supplied attendance marker is overwritten with the authenticated trainer'
);

select is(
  pg_temp.try_delete_attendance(
    '85000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'responsible trainer can clear attendance for their started class'
);

select is(
  (select count(*) from public.attendance_records where schedule_entry_id = '85000000-0000-4000-8000-000000000001'),
  0::bigint,
  'clearing attendance removes the persisted record'
);

select is(
  pg_temp.try_insert_attendance(
    '85000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001',
    'present'
  ),
  'ok',
  'responsible trainer can mark attendance again after clearing it'
);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000002', 'recovery'),
  '23514',
  'trainer cannot mark recovery for a student in an unrelated group'
);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000003', '84000000-0000-4000-8000-000000000001', 'present'),
  '23514',
  'trainer cannot mark attendance for a workshop'
);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000004', '84000000-0000-4000-8000-000000000001', 'present'),
  '23514',
  'trainer cannot mark attendance before a class starts'
);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000005', '84000000-0000-4000-8000-000000000001', 'present'),
  '23514',
  'trainer cannot mark attendance for a cancelled class'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'present'),
  '42501',
  'group-assigned but non-responsible trainer cannot mark attendance'
);

select is(
  pg_temp.try_delete_attendance(
    '85000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'group-assigned but non-responsible trainer cannot clear attendance'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    insert into public.attendance_records (schedule_entry_id, student_id, status)
    values (
      '85000000-0000-4000-8000-000000000002',
      '84000000-0000-4000-8000-000000000002',
      'absent'
    )
  $$,
  'admin can mark attendance for any eligible class'
);

select throws_ok(
  $$
    insert into public.attendance_records (schedule_entry_id, student_id, status)
    values (
      '85000000-0000-4000-8000-000000000002',
      '84000000-0000-4000-8000-000000000002',
      'present'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "attendance_records_schedule_entry_id_student_id_key"',
  'one attendance record exists per class occurrence and student'
);

select lives_ok(
  $$
    insert into public.attendance_records (schedule_entry_id, student_id, status)
    values (
      '85000000-0000-4000-8000-000000000001',
      '84000000-0000-4000-8000-000000000001',
      'absent'
    )
    on conflict (schedule_entry_id, student_id)
    do update set status = excluded.status
  $$,
  'admin can update an existing trainer attendance record'
);

select is(
  (
    select marked_by
    from public.attendance_records
    where schedule_entry_id = '85000000-0000-4000-8000-000000000001'
  ),
  '80000000-0000-4000-8000-000000000001'::uuid,
  'admin update records the admin as the attendance marker'
);

reset role;
delete from public.student_groups
where student_id = '84000000-0000-4000-8000-000000000001'
  and group_id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.attendance_records where schedule_entry_id = '85000000-0000-4000-8000-000000000001'),
  1::bigint,
  'attendance survives current membership removal'
);

select is(
  pg_temp.try_insert_attendance(
    '85000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001',
    'recovery'
  ),
  'ok',
  'responsible trainer can upsert persisted historical attendance'
);

select is(
  pg_temp.try_insert_attendance('85000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000002', 'present'),
  '23514',
  'trainer cannot create new attendance for a student outside the current group'
);

reset role;

select throws_ok(
  $$
    update public.schedule_entries
    set group_id = '82000000-0000-4000-8000-000000000002'
    where id = '85000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'Class type, group, and timing cannot change after attendance is recorded.',
  'attended class group cannot change'
);

select throws_ok(
  $$
    update public.schedule_entries
    set entry_type = 'workshop'
    where id = '85000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'Class type, group, and timing cannot change after attendance is recorded.',
  'attended class cannot become a workshop'
);

select is(
  (
    select marked_by
    from public.attendance_records
    where schedule_entry_id = '85000000-0000-4000-8000-000000000001'
  ),
  '80000000-0000-4000-8000-000000000002'::uuid,
  'attendance marker is derived from the authenticated trainer'
);

select * from finish();
rollback;
