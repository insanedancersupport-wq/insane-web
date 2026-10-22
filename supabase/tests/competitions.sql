begin;

select plan(39);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'competition-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Competition Admin"}'::jsonb, now(), now()),
  ('c1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'responsible@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Responsible Trainer"}'::jsonb, now(), now()),
  ('c1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Other Trainer"}'::jsonb, now(), now()),
  ('c1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Inactive Trainer"}'::jsonb, now(), now());

update public.profiles set role = 'admin'
where id = 'c1000000-0000-4000-8000-000000000001';

update public.profiles set active = false
where id = 'c1000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name)
values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'Responsible', 'Trainer'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 'Other', 'Trainer'),
  ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000004', 'Inactive', 'Trainer');

insert into public.groups (id, name)
values
  ('c3000000-0000-4000-8000-000000000001', 'Competition Group'),
  ('c3000000-0000-4000-8000-000000000002', 'Second Group');

insert into public.students (id, first_name, last_name, status)
values
  ('c4000000-0000-4000-8000-000000000001', 'Active', 'One', 'active'),
  ('c4000000-0000-4000-8000-000000000002', 'Active', 'Two', 'active'),
  ('c4000000-0000-4000-8000-000000000003', 'Inactive', 'Student', 'inactive');

insert into public.student_groups (student_id, group_id)
values
  ('c4000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001'),
  ('c4000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000001'),
  ('c4000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000001');

create function pg_temp.try_competition_insert(target_name text, target_creator uuid)
returns text
language plpgsql
as $$
begin
  insert into public.competitions (name, competition_date, created_by)
  values (target_name, date '2026-12-01', target_creator);
  return 'ok';
exception
  when others then return sqlstate;
end;
$$;

create function pg_temp.competition_update_count(target_id uuid)
returns bigint
language plpgsql
as $$
declare affected_rows bigint;
begin
  update public.competitions set location = 'Updated venue' where id = target_id;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.competition_status_update_count(
  target_id uuid,
  target_status public.competition_status
)
returns bigint
language plpgsql
as $$
declare affected_rows bigint;
begin
  update public.competitions set status = target_status where id = target_id;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.competition_delete_count(target_id uuid)
returns bigint
language plpgsql
as $$
declare affected_rows bigint;
begin
  delete from public.competitions where id = target_id;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.try_competition_insert('Winter Open', 'c1000000-0000-4000-8000-000000000002'),
  'ok',
  'admin can create a competition'
);

select is(
  (select created_by from public.competitions where name = 'Winter Open'),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'competition creator is derived from the authenticated admin'
);

select is(
  pg_temp.competition_update_count((select id from public.competitions where name = 'Winter Open')),
  1::bigint,
  'admin can edit competition details'
);

select lives_ok(
  $$insert into public.competition_trainers (competition_id, trainer_id)
    select id, 'c2000000-0000-4000-8000-000000000001'::uuid from public.competitions where name = 'Winter Open'$$,
  'admin can assign a responsible trainer'
);

select throws_ok(
  $$insert into public.competition_trainers (competition_id, trainer_id)
    select id, 'c2000000-0000-4000-8000-000000000001'::uuid from public.competitions where name = 'Winter Open'$$,
  '23505',
  'duplicate key value violates unique constraint "competition_trainers_pkey"',
  'duplicate responsible trainer assignment is rejected'
);

select lives_ok(
  $$insert into public.competition_groups (competition_id, group_id)
    select id, 'c3000000-0000-4000-8000-000000000001'::uuid from public.competitions where name = 'Winter Open'$$,
  'admin can associate a competition group'
);

select throws_ok(
  $$insert into public.competition_groups (competition_id, group_id)
    select id, 'c3000000-0000-4000-8000-000000000001'::uuid from public.competitions where name = 'Winter Open'$$,
  '23505',
  'duplicate key value violates unique constraint "competition_groups_pkey"',
  'duplicate competition group is rejected'
);

select lives_ok(
  $$insert into public.competition_participants (competition_id, student_id)
    select id, 'c4000000-0000-4000-8000-000000000001'::uuid from public.competitions where name = 'Winter Open'$$,
  'admin can enroll an active individual student'
);

select throws_ok(
  $$insert into public.competition_participants (competition_id, student_id)
    select id, 'c4000000-0000-4000-8000-000000000001'::uuid from public.competitions where name = 'Winter Open'$$,
  '23505',
  'duplicate key value violates unique constraint "competition_participants_competition_id_student_id_key"',
  'duplicate competition participant is rejected'
);

select throws_ok(
  $$insert into public.competition_participants (competition_id, student_id)
    select id, 'c4000000-0000-4000-8000-000000000003'::uuid from public.competitions where name = 'Winter Open'$$,
  '23514',
  'Only active students can be enrolled.',
  'inactive student enrollment is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.competitions), 1::bigint, 'trainer can view all competitions');
select is((select count(*) from public.competition_groups), 1::bigint, 'trainer can view competition groups');
select is((select count(*) from public.competition_participants), 1::bigint, 'trainer can view participants');

select is(
  pg_temp.try_competition_insert('Unauthorized Open', 'c1000000-0000-4000-8000-000000000002'),
  '42501',
  'trainer cannot create competitions'
);

select is(
  pg_temp.competition_update_count((select id from public.competitions where name = 'Winter Open')),
  0::bigint,
  'trainer cannot edit competition details'
);

select is(
  pg_temp.competition_status_update_count(
    (select id from public.competitions where name = 'Winter Open'),
    'completed'
  ),
  0::bigint,
  'trainer cannot change competition status'
);

select is(
  pg_temp.competition_delete_count((select id from public.competitions where name = 'Winter Open')),
  0::bigint,
  'trainer cannot delete competitions'
);

select lives_ok(
  $$insert into public.competition_groups (competition_id, group_id)
    select id, 'c3000000-0000-4000-8000-000000000002'::uuid from public.competitions where name = 'Winter Open'$$,
  'responsible trainer can associate groups'
);

select is(
  public.enroll_competition_group(
    (select id from public.competitions where name = 'Winter Open'),
    'c3000000-0000-4000-8000-000000000001'
  ),
  1,
  'responsible trainer atomically enrolls remaining active group students'
);

select is(
  public.enroll_competition_group(
    (select id from public.competitions where name = 'Winter Open'),
    'c3000000-0000-4000-8000-000000000001'
  ),
  0,
  'group enrollment is idempotent'
);

delete from public.student_groups
where student_id = 'c4000000-0000-4000-8000-000000000002'
  and group_id = 'c3000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.competition_participants where student_id = 'c4000000-0000-4000-8000-000000000002'),
  1::bigint,
  'competition enrollment survives group membership removal'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$insert into public.competition_participants (competition_id, student_id)
    select id, 'c4000000-0000-4000-8000-000000000002'::uuid from public.competitions where name = 'Winter Open'$$,
  '42501',
  'new row violates row-level security policy for table "competition_participants"',
  'unassigned trainer cannot manage participants'
);

select throws_ok(
  $$insert into public.competition_groups (competition_id, group_id)
    select id, 'c3000000-0000-4000-8000-000000000002'::uuid from public.competitions where name = 'Winter Open'$$,
  '42501',
  'new row violates row-level security policy for table "competition_groups"',
  'unassigned trainer cannot manage competition groups'
);

select throws_ok(
  $$select public.enroll_competition_group(
    (select id from public.competitions where name = 'Winter Open'),
    'c3000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'Competition responsibility is required.',
  'unassigned trainer cannot use group enrollment RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.try_competition_insert('Inactive Open', 'c1000000-0000-4000-8000-000000000004'),
  '42501',
  'inactive trainer cannot create competitions'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$update public.competitions
    set created_by = 'c1000000-0000-4000-8000-000000000002'
    where name = 'Winter Open'$$,
  '23514',
  'Competition creator cannot be changed.',
  'competition creator metadata is immutable'
);

select is(
  pg_temp.competition_status_update_count(
    (select id from public.competitions where name = 'Winter Open'),
    'completed'
  ),
  1::bigint,
  'admin can set competition status to completed'
);

select is(
  pg_temp.competition_status_update_count(
    (select id from public.competitions where name = 'Winter Open'),
    'cancelled'
  ),
  1::bigint,
  'admin can set competition status to cancelled'
);

select throws_ok(
  $$update public.competitions set status = 'active' where name = 'Winter Open'$$,
  '23514',
  'new row for relation "competitions" violates check constraint "competitions_supported_status_check"',
  'unsupported competition status is rejected'
);

select throws_ok(
  $$update public.competition_participants
    set student_id = 'c4000000-0000-4000-8000-000000000003'
    where student_id = 'c4000000-0000-4000-8000-000000000001'$$,
  '23514',
  'Competition participants cannot be moved.',
  'relationship key manipulation is not permitted'
);

select throws_ok(
  $$delete from public.competitions where name = 'Winter Open'$$,
  '23514',
  'A competition with participant enrollments cannot be deleted. Remove all participants first.',
  'admin cannot delete a competition with participants'
);

select is((select count(*) from public.competition_participants), 2::bigint, 'rejected deletion preserves participant records');
select is((select count(*) from public.competition_groups), 2::bigint, 'rejected deletion preserves group links');
select is((select count(*) from public.competition_trainers), 1::bigint, 'rejected deletion preserves trainer links');

delete from public.competition_participants;
delete from public.competitions where name = 'Winter Open';

select is((select count(*) from public.competitions), 0::bigint, 'admin can delete competitions');
select is((select count(*) from public.competition_participants), 0::bigint, 'competition deletion removes its enrollment rows');
select is((select count(*) from public.students), 3::bigint, 'competition deletion does not modify student records');

select lives_ok(
  $$insert into public.competitions (name, competition_date, created_by)
    values ('Empty Open', date '2026-12-02', 'c1000000-0000-4000-8000-000000000002')$$,
  'admin can create an empty competition eligible for deletion'
);

delete from public.competitions where name = 'Empty Open';

select is((select count(*) from public.competitions), 0::bigint, 'admin can delete a competition without participants');

select * from finish();
rollback;
