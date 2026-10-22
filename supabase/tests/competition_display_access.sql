begin;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'display-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Display Admin"}'::jsonb, now(), now()),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'display-responsible@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Display Responsible"}'::jsonb, now(), now()),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'display-unassigned@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Display Unassigned"}'::jsonb, now(), now()),
  ('d1000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'display-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Display Inactive"}'::jsonb, now(), now());

update public.profiles set role = 'admin'
where id = 'd1000000-0000-4000-8000-000000000001';

update public.profiles set active = false
where id = 'd1000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name)
values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'Responsible', 'Trainer'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003', 'Unassigned', 'Trainer'),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000004', 'Inactive', 'Trainer');

insert into public.groups (id, name)
values
  ('d3000000-0000-4000-8000-000000000001', 'Display Group'),
  ('d3000000-0000-4000-8000-000000000002', 'Private Group');

insert into public.students (id, first_name, last_name, email, phone, status)
values
  ('d4000000-0000-4000-8000-000000000001', 'Visible', 'Student', 'private@example.test', '0700000000', 'active');

insert into public.competitions (id, name, competition_date, created_by)
values ('d5000000-0000-4000-8000-000000000001', 'Display Open', date '2026-12-01', 'd1000000-0000-4000-8000-000000000001');

insert into public.competition_trainers (competition_id, trainer_id)
values ('d5000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001');

insert into public.competition_groups (competition_id, group_id)
values ('d5000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001');

insert into public.competition_participants (competition_id, student_id)
values ('d5000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select trainer_id, first_name, last_name from public.get_competition_trainer_display('d5000000-0000-4000-8000-000000000001')$$,
  $$values ('d2000000-0000-4000-8000-000000000001'::uuid, 'Responsible'::text, 'Trainer'::text)$$,
  'admin sees responsible trainer display names'
);

select results_eq(
  $$select group_id, name from public.get_competition_group_display('d5000000-0000-4000-8000-000000000001')$$,
  $$values ('d3000000-0000-4000-8000-000000000001'::uuid, 'Display Group'::text)$$,
  'admin sees participating group display names'
);

select results_eq(
  $$select student_id, first_name, last_name from public.get_competition_participant_display('d5000000-0000-4000-8000-000000000001')$$,
  $$values ('d4000000-0000-4000-8000-000000000001'::uuid, 'Visible'::text, 'Student'::text)$$,
  'admin sees participant display names'
);

select ok(
  pg_get_function_result('public.get_competition_participant_display(uuid)'::regprocedure) !~ '(email|phone|notes)',
  'participant display function exposes no private contact fields'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select first_name, last_name from public.get_competition_trainer_display('d5000000-0000-4000-8000-000000000001')$$,
  $$values ('Responsible'::text, 'Trainer'::text)$$,
  'responsible trainer sees associated trainer names'
);

select results_eq(
  $$select name from public.get_competition_group_display('d5000000-0000-4000-8000-000000000001')$$,
  $$values ('Display Group'::text)$$,
  'responsible trainer sees associated group names'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select first_name, last_name from public.get_competition_participant_display('d5000000-0000-4000-8000-000000000001')$$,
  $$values ('Visible'::text, 'Student'::text)$$,
  'unassigned trainer sees associated participant names'
);

select is(
  (select count(*) from public.students where id = 'd4000000-0000-4000-8000-000000000001'),
  0::bigint,
  'unassigned trainer retains no direct student access'
);

select throws_ok(
  $$insert into public.competition_groups (competition_id, group_id)
    values ('d5000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002')$$,
  '42501',
  'new row violates row-level security policy for table "competition_groups"',
  'unassigned trainer cannot modify competition groups'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.get_competition_participant_display('d5000000-0000-4000-8000-000000000001')$$,
  '42501',
  'An active user is required.',
  'inactive users cannot access competition display data'
);

select * from finish();
rollback;
