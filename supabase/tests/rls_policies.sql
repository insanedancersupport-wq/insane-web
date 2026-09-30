begin;

select plan(15);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.test',
    'not-used-in-tests',
    now(),
    '{}'::jsonb,
    '{"full_name":"Admin User"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'trainer-one@example.test',
    'not-used-in-tests',
    now(),
    '{}'::jsonb,
    '{"full_name":"Trainer One"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'trainer-two@example.test',
    'not-used-in-tests',
    now(),
    '{}'::jsonb,
    '{"full_name":"Trainer Two"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000000001';

insert into public.trainers (id, profile_id, first_name, last_name)
values
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Trainer', 'One'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'Trainer', 'Two');

insert into public.groups (id, name)
values
  ('20000000-0000-4000-8000-000000000001', 'Trainer One Group'),
  ('20000000-0000-4000-8000-000000000002', 'Trainer Two Group');

insert into public.group_trainers (group_id, trainer_id)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003');

insert into public.students (id, first_name, last_name)
values
  ('30000000-0000-4000-8000-000000000001', 'Student', 'One'),
  ('30000000-0000-4000-8000-000000000002', 'Student', 'Two');

insert into public.student_groups (student_id, group_id)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002');

insert into public.schedule_entries (id, title, entry_type, group_id, trainer_id, starts_at, ends_at)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'Trainer One Class',
    'class',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    now(),
    now() + interval '1 hour'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'Trainer Two Class',
    'class',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    now(),
    now() + interval '1 hour'
  );

insert into public.attendance_records (schedule_entry_id, student_id, status, marked_by)
values
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'present',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    'absent',
    '00000000-0000-4000-8000-000000000002'
  );

create function pg_temp.update_schedule_title(target_id uuid, target_title text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  update public.schedule_entries
  set title = target_title
  where id = target_id;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.insert_attendance(
  target_schedule_entry_id uuid,
  target_student_id uuid,
  target_marked_by uuid
)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  insert into public.attendance_records (schedule_entry_id, student_id, status, marked_by)
  values (target_schedule_entry_id, target_student_id, 'present', target_marked_by);

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.update_attendance_status(target_schedule_entry_id uuid)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  update public.attendance_records
  set status = 'absent'
  where schedule_entry_id = target_schedule_entry_id;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.groups),
  1::bigint,
  'trainer cannot read unrelated groups'
);

select is(
  (select count(*) from public.students),
  1::bigint,
  'trainer cannot read unrelated students'
);

select is(
  pg_temp.update_schedule_title(
    '40000000-0000-4000-8000-000000000002',
    'Unauthorized change'
  ),
  0::bigint,
  'trainer cannot alter schedule entries'
);

select is(
  pg_temp.insert_attendance(
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'trainer can add attendance for an authorized class'
);

select is(
  pg_temp.update_attendance_status('40000000-0000-4000-8000-000000000002'),
  0::bigint,
  'trainer cannot modify attendance for an unauthorized class'
);

select is(
  (
    select count(*)
    from public.attendance_records
    where schedule_entry_id = '40000000-0000-4000-8000-000000000001'
      and student_id = '30000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'trainer cannot read attendance for a student outside the scheduled group'
);

select throws_ok(
  $$
    update public.profiles
    set role = 'admin'
    where id = '00000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  'permission denied for table profiles',
  'trainer cannot promote their own role'
);

select throws_ok(
  $$
    update public.profiles
    set active = false
    where id = '00000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  'permission denied for table profiles',
  'trainer cannot change their own active status'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.update_schedule_title(
    '40000000-0000-4000-8000-000000000002',
    'Admin change'
  ),
  1::bigint,
  'active admin can manage schedule entries'
);

reset role;
update public.profiles
set active = false
where id = '00000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.groups),
  0::bigint,
  'inactive trainer cannot access groups'
);

reset role;

select ok(
  has_schema_privilege('service_role', 'public', 'usage'),
  'service_role can use the public schema'
);

select ok(
  has_table_privilege('service_role', 'public.profiles', 'select'),
  'service_role can select profiles'
);

select ok(
  has_column_privilege('service_role', 'public.profiles', 'full_name', 'update'),
  'service_role can update profile full_name'
);

select ok(
  has_column_privilege('service_role', 'public.profiles', 'role', 'update'),
  'service_role can update profile role'
);

select ok(
  has_column_privilege('service_role', 'public.profiles', 'active', 'update'),
  'service_role can update profile active'
);

select * from finish();
rollback;
