begin;

select plan(31);

select is(
  (
    '2026-01-15 22:30:00+00'::timestamptz
    at time zone private.authoritative_school_timezone()
  )::date,
  date '2026-01-16',
  'legacy due timestamps convert using the authoritative Europe/Bucharest calendar date'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Tasks Admin"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-creator@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Task Creator"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-assignee@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Task Assignee"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-unrelated@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Unrelated Trainer"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Inactive Trainer"}'::jsonb, now(), now());

update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;

update public.profiles
set role = 'admin'
where id = 'a1000000-0000-4000-8000-000000000001';

update public.profiles
set active = false
where id = 'a1000000-0000-4000-8000-000000000005';

create function pg_temp.task_insert(
  target_title text,
  target_assigned_to uuid,
  target_created_by uuid,
  target_priority text default 'medium',
  target_status public.task_status default 'todo'
)
returns text
language plpgsql
as $$
begin
  insert into public.tasks (title, assigned_to, created_by, priority, status)
  values (target_title, target_assigned_to, target_created_by, target_priority, target_status);
  return 'ok';
exception
  when others then return sqlstate;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.task_insert('Creator task', 'a1000000-0000-4000-8000-000000000099', 'a1000000-0000-4000-8000-000000000001'),
  '23514',
  'invalid assignee is rejected'
);

select is(
  pg_temp.task_insert('Creator task', 'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001'),
  'ok',
  'trainer can create a self-assigned task'
);

select is(
  (select created_by from public.tasks where title = 'Creator task'),
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'creator metadata is derived from the authenticated trainer'
);

select is(
  pg_temp.task_insert('Other task', 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002'),
  '42501',
  'trainer cannot assign a new task to another trainer'
);

select is((select count(*) from public.tasks), 1::bigint, 'trainer can view their self-assigned task');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.task_insert('Admin assigned task', 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 'high', 'todo'),
  'ok',
  'admin can create a task for an active eligible user'
);

select is(
  (select created_by from public.tasks where title = 'Admin assigned task'),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'admin creator metadata is derived from the authenticated admin'
);

update public.tasks
set assigned_to = 'a1000000-0000-4000-8000-000000000003'
where title = 'Creator task';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.tasks), 1::bigint, 'creator can view a task after an admin reassigns it');

select throws_ok(
  $$update public.tasks set status = 'done' where title = 'Creator task'$$,
  '23514',
  'Only the assigned trainer can change task status.',
  'creator cannot change status after reassignment'
);

select lives_ok(
  $$update public.tasks set title = 'Updated creator task', description = 'Updated details', due_date = date '2026-11-01', priority = 'high' where title = 'Creator task'$$,
  'creator can edit descriptive fields after reassignment'
);

select throws_ok(
  $$update public.tasks set assigned_to = 'a1000000-0000-4000-8000-000000000004' where title = 'Updated creator task'$$,
  '23514',
  'Trainers cannot reassign tasks.',
  'trainer cannot reassign a task'
);

select throws_ok(
  $$update public.tasks set created_by = 'a1000000-0000-4000-8000-000000000004' where title = 'Updated creator task'$$,
  '23514',
  'Task creator cannot be changed.',
  'trainer cannot change task creator metadata'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.tasks), 2::bigint, 'assignee can view assigned tasks');

select lives_ok(
  $$update public.tasks set status = 'in_progress' where title = 'Updated creator task'$$,
  'assigned trainer can update task status'
);

select throws_ok(
  $$update public.tasks set title = 'Unauthorized title' where title = 'Updated creator task'$$,
  '23514',
  'Only the task creator can edit task details.',
  'assigned non-creator cannot edit task details'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.tasks), 0::bigint, 'unrelated trainer cannot view tasks');

select is(
  (select count(*) from public.tasks where title = 'Updated creator task'),
  0::bigint,
  'unrelated trainer cannot select a task to update'
);

create function pg_temp.task_delete(target_title text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  delete from public.tasks where title = target_title;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

select is(
  pg_temp.task_delete('Updated creator task'),
  0::bigint,
  'unrelated trainer cannot delete a task'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.tasks where title = 'Updated creator task'),
  1::bigint,
  'creator can still access their reassigned task'
);

select is(
  (select count(*) from public.tasks where title = 'Admin assigned task'),
  0::bigint,
  'creator cannot view unrelated tasks'
);

select is(
  (select count(*) from public.tasks where title = 'Updated creator task'),
  1::bigint,
  'creator can delete only their task'
);

delete from public.tasks where title = 'Updated creator task';

select is((select count(*) from public.tasks), 0::bigint, 'creator can delete their created task');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.task_insert('Inactive task', 'a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005'),
  '23514',
  'inactive trainer cannot create tasks'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.task_insert('   ', 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001'),
  '23514',
  'empty task title is rejected'
);

select is(
  pg_temp.task_insert('Invalid priority', 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'urgent'),
  '23514',
  'invalid task priority is rejected'
);

select is(
  pg_temp.task_insert('Invalid status', 'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'medium', 'cancelled'),
  '23514',
  'unsupported task status is rejected'
);

select is(
  pg_temp.task_insert('Inactive assignee', 'a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001'),
  '23514',
  'admin cannot assign a task to an inactive user'
);

select is((select count(*) from public.tasks), 1::bigint, 'admin can read remaining tasks');

reset role;

select throws_ok(
  $$delete from public.profiles where id = 'a1000000-0000-4000-8000-000000000003'$$,
  '23503',
  'update or delete on table "profiles" violates foreign key constraint "tasks_assigned_to_fkey" on table "tasks"',
  'profile deletion cannot cascade-delete task history'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

delete from public.tasks where title = 'Admin assigned task';

select is((select count(*) from public.tasks), 0::bigint, 'admin can delete tasks');

select * from finish();
rollback;
