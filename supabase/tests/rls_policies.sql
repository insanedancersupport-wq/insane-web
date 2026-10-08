begin;

select plan(31);

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

insert into public.rooms (id, name)
values
  ('50000000-0000-4000-8000-000000000001', 'Trainer One Room'),
  ('50000000-0000-4000-8000-000000000002', 'Trainer Two Room');

insert into public.group_trainers (group_id, trainer_id)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003');

insert into public.students (id, first_name, last_name)
values
  ('30000000-0000-4000-8000-000000000001', 'Student', 'One'),
  ('30000000-0000-4000-8000-000000000002', 'Student', 'Two');

insert into public.student_groups (student_id, group_id, joined_on)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', date '2025-01-15'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null);

insert into public.schedule_entries (id, title, entry_type, group_id, trainer_id, room_id, starts_at, ends_at)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'Trainer One Class',
    'class',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '2026-01-12 16:00:00+00',
    '2026-01-12 17:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'Trainer Two Class',
    'class',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000002',
    '2026-01-12 16:00:00+00',
    '2026-01-12 17:00:00+00'
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

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    select public.reconcile_group_trainers(
      '20000000-0000-4000-8000-000000000001',
      array['10000000-0000-4000-8000-000000000002']::uuid[],
      '10000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'Administrator access is required.',
  'trainer cannot execute group trainer reconciliation'
);

reset role;
set local role anon;

select ok(
  not has_function_privilege(
    'anon',
    'public.reconcile_student_groups(uuid, uuid[])',
    'execute'
  ),
  'anonymous callers cannot execute student group reconciliation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    select public.reconcile_group_trainers(
      '20000000-0000-4000-8000-000000000001',
      array[
        '10000000-0000-4000-8000-000000000002',
        '90000000-0000-4000-8000-000000000001'
      ]::uuid[],
      '10000000-0000-4000-8000-000000000002'
    )
  $$,
  '23503',
  'One or more requested trainers do not exist.',
  'invalid trainer input is rejected'
);

select is(
  (
    select count(*)
    from public.group_trainers
    where group_id = '20000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'failed group trainer reconciliation leaves previous assignments intact'
);

select throws_ok(
  $$
    select public.reconcile_group_trainers(
      '20000000-0000-4000-8000-000000000001',
      array['10000000-0000-4000-8000-000000000002']::uuid[],
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  '22023',
  'The primary trainer must be assigned to the group.',
  'primary trainer must be in the selected trainer set'
);

select lives_ok(
  $$
    select public.reconcile_group_trainers(
      '20000000-0000-4000-8000-000000000001',
      array[
        '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003'
      ]::uuid[],
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'active admin can reconcile group trainers'
);

select is(
  (
    select count(*)
    from public.group_trainers
    where group_id = '20000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'group trainer reconciliation creates the exact unique trainer set'
);

select is(
  (
    select count(*)
    from public.group_trainers
    where group_id = '20000000-0000-4000-8000-000000000001'
      and is_primary
  ),
  1::bigint,
  'group trainer reconciliation results in at most one primary trainer'
);

select is(
  (
    select trainer_id
    from public.group_trainers
    where group_id = '20000000-0000-4000-8000-000000000001'
      and is_primary
  ),
  '10000000-0000-4000-8000-000000000003'::uuid,
  'requested trainer is set as primary'
);

select lives_ok(
  $$
    select public.reconcile_student_groups(
      '30000000-0000-4000-8000-000000000001',
      array[
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002'
      ]::uuid[]
    )
  $$,
  'active admin can reconcile student groups'
);

select is(
  (
    select joined_on
    from public.student_groups
    where student_id = '30000000-0000-4000-8000-000000000001'
      and group_id = '20000000-0000-4000-8000-000000000001'
  ),
  date '2025-01-15',
  'retained student membership preserves joined_on'
);

select is(
  (
    select count(*)
    from public.student_groups
    where student_id = '30000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'duplicate requested group IDs cannot create duplicate memberships'
);

select lives_ok(
  $$
    select public.reconcile_student_groups(
      '30000000-0000-4000-8000-000000000002',
      '{}'::uuid[]
    )
  $$,
  'active admin can remove current student memberships'
);

select is(
  (
    select count(*)
    from public.student_groups
    where student_id = '30000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'removed student membership is deleted'
);

select throws_ok(
  $$
    select public.reconcile_student_groups(
      '30000000-0000-4000-8000-000000000001',
      array[
        '20000000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-000000000002'
      ]::uuid[]
    )
  $$,
  '23503',
  'One or more requested groups do not exist.',
  'invalid group input is rejected'
);

select is(
  (
    select count(*)
    from public.student_groups
    where student_id = '30000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'failed student group reconciliation leaves previous memberships intact'
);

select * from finish();
rollback;
