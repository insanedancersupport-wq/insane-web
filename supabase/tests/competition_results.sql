begin;

select plan(44);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'results-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Results Admin"}'::jsonb, now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'results-responsible@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Results Responsible"}'::jsonb, now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'results-unassigned@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Results Unassigned"}'::jsonb, now(), now()),
  ('e1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'results-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Results Inactive"}'::jsonb, now(), now());

update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;

update public.profiles set role = 'admin'
where id = 'e1000000-0000-4000-8000-000000000001';

update public.profiles set active = false
where id = 'e1000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name)
values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'Responsible', 'Results'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', 'Unassigned', 'Results'),
  ('e2000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000004', 'Inactive', 'Results');

insert into public.students (id, first_name, last_name, email, phone, status)
values
  ('e3000000-0000-4000-8000-000000000001', 'Solo', 'One', 'solo@example.test', '0700000001', 'active'),
  ('e3000000-0000-4000-8000-000000000002', 'Team', 'Two', 'team@example.test', '0700000002', 'active'),
  ('e3000000-0000-4000-8000-000000000003', 'Team', 'Three', 'team@example.test', '0700000003', 'active'),
  ('e3000000-0000-4000-8000-000000000004', 'Unenrolled', 'Four', 'unregistered@example.test', '0700000004', 'active');

insert into public.competitions (id, name, competition_date, created_by)
values ('e4000000-0000-4000-8000-000000000001', 'Results Open', date '2026-12-01', 'e1000000-0000-4000-8000-000000000001');

insert into public.competition_trainers (competition_id, trainer_id)
values ('e4000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001');

insert into public.competition_participants (competition_id, student_id)
values
  ('e4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001'),
  ('e4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002'),
  ('e4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  public.save_competition_result(
    null,
    'e4000000-0000-4000-8000-000000000001',
    'individual',
    'Solo',
    null,
    1,
    'Gold',
    null,
    array['e3000000-0000-4000-8000-000000000001'::uuid]
  ) is not null,
  'admin creates an individual result'
);

select is(
  (select created_by from public.competition_results where category = 'Solo'),
  'e1000000-0000-4000-8000-000000000001'::uuid,
  'result creator is derived from the authenticated user'
);

select is(
  (select count(*) from public.competition_result_members where result_id = (select id from public.competition_results where category = 'Solo')),
  1::bigint,
  'individual result has exactly one member'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger validates an RPC-created individual result at commit'
);
set constraints all deferred;

select ok(
  public.save_competition_result(
    null,
    'e4000000-0000-4000-8000-000000000001',
    'team',
    'Duo',
    'Fire Duo',
    2,
    null,
    null,
    array[
      'e3000000-0000-4000-8000-000000000002'::uuid,
      'e3000000-0000-4000-8000-000000000003'::uuid
    ]
  ) is not null,
  'admin creates a team result'
);

select is(
  (select count(*) from public.competition_result_members where result_id = (select id from public.competition_results where category = 'Duo')),
  2::bigint,
  'team result records participating students only'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger validates an RPC-created team result at commit'
);
set constraints all deferred;

select throws_ok(
  $$select public.save_competition_result(
    null, 'e4000000-0000-4000-8000-000000000001', 'individual', 'Invalid solo', null, null, null, null, '{}'::uuid[]
  )$$,
  '23514',
  'Individual competition results require exactly one member.',
  'individual result rejects zero members'
);

select throws_ok(
  $$select public.save_competition_result(
    null, 'e4000000-0000-4000-8000-000000000001', 'team', 'Invalid duo', null, null, null, null,
    array['e3000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  '23514',
  'Team competition results require at least two members.',
  'team result rejects one member'
);

select throws_ok(
  $$select public.save_competition_result(
    null, 'e4000000-0000-4000-8000-000000000001', 'team', 'Duplicate members', null, null, null, null,
    array['e3000000-0000-4000-8000-000000000001'::uuid, 'e3000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  '23514',
  'Each student can appear only once in a competition result.',
  'duplicate result members are rejected'
);

select throws_ok(
  $$select public.save_competition_result(
    null, 'e4000000-0000-4000-8000-000000000001', 'individual', 'Unenrolled', null, null, null, null,
    array['e3000000-0000-4000-8000-000000000004'::uuid]
  )$$,
  '23514',
  'Every result member must be enrolled in this competition.',
  'result members must be enrolled in the competition'
);

select ok(
  public.save_competition_result(
    null,
    'e4000000-0000-4000-8000-000000000001',
    'individual',
    'Solo improv',
    null,
    null,
    'Participation',
    null,
    array['e3000000-0000-4000-8000-000000000001'::uuid]
  ) is not null,
  'a student may receive multiple category results'
);

select is(
  (select count(*) from public.competition_result_members where student_id = 'e3000000-0000-4000-8000-000000000001'),
  2::bigint,
  'multiple category results preserve both member records'
);

select ok(
  public.save_competition_result(
    (select id from public.competition_results where category = 'Solo'),
    'e4000000-0000-4000-8000-000000000001',
    'individual',
    'Solo',
    null,
    3,
    'Bronze',
    'Updated result',
    array['e3000000-0000-4000-8000-000000000001'::uuid]
  ) = (select id from public.competition_results where category = 'Solo'),
  'admin edits an existing result'
);

select is(
  (select placement from public.competition_results where category = 'Solo'),
  3,
  'admin result edit persists'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger validates an RPC-updated result at commit'
);
set constraints all deferred;

select lives_ok(
  $$select public.save_competition_result(
    (select id from public.competition_results where category = 'Duo'),
    'e4000000-0000-4000-8000-000000000001',
    'team',
    'Duo',
    'Fire Duo',
    2,
    null,
    null,
    array[
      'e3000000-0000-4000-8000-000000000001'::uuid,
      'e3000000-0000-4000-8000-000000000002'::uuid
    ]
  )$$,
  'admin replaces every team member through the result RPC'
);

select results_eq(
  $$select student_id from public.competition_result_members
    where result_id = (select id from public.competition_results where category = 'Duo')
    order by student_id$$,
  $$values
    ('e3000000-0000-4000-8000-000000000001'::uuid),
    ('e3000000-0000-4000-8000-000000000002'::uuid)$$,
  'team member reconciliation persists the complete submitted set'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger validates a changed team-member set at commit'
);
set constraints all deferred;

select lives_ok(
  $$select public.save_competition_result(
    (select id from public.competition_results where category = 'Solo'),
    'e4000000-0000-4000-8000-000000000001',
    'team',
    'Solo crew',
    'Solo Crew',
    3,
    'Bronze',
    'Converted to a team result',
    array[
      'e3000000-0000-4000-8000-000000000001'::uuid,
      'e3000000-0000-4000-8000-000000000002'::uuid
    ]
  )$$,
  'admin converts an individual result to a team result'
);

select is(
  (select result_type from public.competition_results where category = 'Solo crew'),
  'team',
  'individual-to-team conversion persists the result type'
);

select is(
  (select count(*) from public.competition_result_members
    where result_id = (select id from public.competition_results where category = 'Solo crew')),
  2::bigint,
  'individual-to-team conversion persists two members'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger validates an individual-to-team conversion at commit'
);
set constraints all deferred;

select lives_ok(
  $$select public.save_competition_result(
    (select id from public.competition_results where category = 'Duo'),
    'e4000000-0000-4000-8000-000000000001',
    'individual',
    'Duo solo',
    null,
    1,
    null,
    null,
    array['e3000000-0000-4000-8000-000000000002'::uuid]
  )$$,
  'admin converts a team result to an individual result'
);

select is(
  (select result_type from public.competition_results where category = 'Duo solo'),
  'individual',
  'team-to-individual conversion persists the result type'
);

select is(
  (select count(*) from public.competition_result_members
    where result_id = (select id from public.competition_results where category = 'Duo solo')),
  1::bigint,
  'team-to-individual conversion persists one member'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger validates a team-to-individual conversion at commit'
);
set constraints all deferred;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  public.save_competition_result(
    null,
    'e4000000-0000-4000-8000-000000000001',
    'individual',
    'Responsible solo',
    null,
    null,
    null,
    null,
    array['e3000000-0000-4000-8000-000000000002'::uuid]
  ) is not null,
  'responsible trainer creates a result'
);

select lives_ok(
  $$select public.save_competition_result(
    (select id from public.competition_results where category = 'Responsible solo'),
    'e4000000-0000-4000-8000-000000000001',
    'individual',
    'Responsible solo',
    null,
    1,
    null,
    null,
    array['e3000000-0000-4000-8000-000000000002'::uuid]
  )$$,
  'responsible trainer edits an assigned competition result'
);

select lives_ok(
  $$select public.delete_competition_result((select id from public.competition_results where category = 'Responsible solo'))$$,
  'responsible trainer deletes an assigned competition result'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.competition_results),
  3::bigint,
  'unassigned trainer can read competition results'
);

select throws_ok(
  $$select public.save_competition_result(
    null, 'e4000000-0000-4000-8000-000000000001', 'individual', 'Unauthorized', null, null, null, null,
    array['e3000000-0000-4000-8000-000000000001'::uuid]
  )$$,
  '42501',
  'Competition responsibility is required.',
  'unassigned trainer cannot create results'
);

select throws_ok(
  $$select public.delete_competition_result((select id from public.competition_results where category = 'Solo crew'))$$,
  '42501',
  'Competition responsibility is required.',
  'unassigned trainer cannot delete results'
);

select results_eq(
  $$select first_name, last_name from public.get_competition_result_member_display('e4000000-0000-4000-8000-000000000001')
    where result_id = (select id from public.competition_results where category = 'Solo crew')$$,
  $$values
    ('Solo'::text, 'One'::text),
    ('Team'::text, 'Two'::text)$$,
  'unassigned trainer sees result member display names'
);

select ok(
  pg_get_function_result('public.get_competition_result_member_display(uuid)'::regprocedure) !~ '(email|phone|notes)',
  'result member display function exposes no private student fields'
);

select throws_ok(
  $$insert into public.competition_results (competition_id, result_type, category, created_by)
    values ('e4000000-0000-4000-8000-000000000001', 'individual', 'Spoofed creator', 'e1000000-0000-4000-8000-000000000001')$$,
  '42501',
  'new row violates row-level security policy for table "competition_results"',
  'direct result writes cannot spoof creator metadata'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$delete from public.competition_participants
    where competition_id = 'e4000000-0000-4000-8000-000000000001'
      and student_id = 'e3000000-0000-4000-8000-000000000001'$$,
  '23503',
  NULL,
  'referenced competition participant cannot be removed'
);

select throws_ok(
  $$delete from public.competitions where id = 'e4000000-0000-4000-8000-000000000001'$$,
  '23514',
  'A competition with results cannot be deleted. Remove all results first.',
  'competition deletion is blocked while results exist'
);

select lives_ok(
  $$select public.delete_competition_result((select id from public.competition_results where category = 'Solo crew'))$$,
  'admin deletes a result'
);

select lives_ok(
  $$set constraints all immediate$$,
  'deferred trigger permits an RPC result deletion after cascade member cleanup'
);
set constraints all deferred;

select is(
  (select count(*) from public.students where id = 'e3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'deleting a result does not delete its student'
);

select is(
  (select count(*) from public.competition_participants
    where competition_id = 'e4000000-0000-4000-8000-000000000001'
      and student_id = 'e3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'deleting a result does not delete competition enrollment'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.competition_results), 0::bigint, 'inactive user cannot read competition results');

select throws_ok(
  $$select * from public.get_competition_result_member_display('e4000000-0000-4000-8000-000000000001')$$,
  '42501',
  'An active user is required.',
  'inactive user cannot use result member display access'
);

select * from finish();
rollback;
