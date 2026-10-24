begin;

select plan(40);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'activity-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Activity Admin"}'::jsonb, now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'activity-one@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Activity One"}'::jsonb, now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'activity-two@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Activity Two"}'::jsonb, now(), now()),
  ('b1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'activity-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Activity Inactive"}'::jsonb, now(), now());

update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;

update public.profiles set role = 'admin'
where id = 'b1000000-0000-4000-8000-000000000001';
update public.profiles set active = false
where id = 'b1000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name, active)
values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Activity', 'One', true),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003', 'Activity', 'Two', true),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004', 'Former', 'Trainer', false);

insert into public.groups (id, name)
values
  ('b3000000-0000-4000-8000-000000000001', 'Activity Alpha'),
  ('b3000000-0000-4000-8000-000000000002', 'Activity Beta');

insert into public.rooms (id, name)
values ('b4000000-0000-4000-8000-000000000001', 'Activity Studio');

insert into public.group_trainers (group_id, trainer_id)
values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001');

insert into public.students (id, first_name, last_name, email, phone, notes)
values
  ('b5000000-0000-4000-8000-000000000001', 'Alex', 'Duplicate', 'alex-one@example.test', '0700000001', 'private'),
  ('b5000000-0000-4000-8000-000000000002', 'Alex', 'Duplicate', 'alex-two@example.test', '0700000002', 'private'),
  ('b5000000-0000-4000-8000-000000000003', 'Casey', 'Recovery', 'casey@example.test', '0700000003', 'private');

insert into public.student_groups (student_id, group_id)
values
  ('b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001'),
  ('b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002'),
  ('b5000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001'),
  ('b5000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000001');

insert into public.schedule_entries (
  id, title, entry_type, group_id, trainer_id, room_id, starts_at, ends_at, status
)
values
  ('b6000000-0000-4000-8000-000000000001', 'One completed', 'class', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', ((now() at time zone 'Europe/Bucharest')::date - 20 + time '10:00') at time zone 'Europe/Bucharest', ((now() at time zone 'Europe/Bucharest')::date - 20 + time '11:00') at time zone 'Europe/Bucharest', 'completed'),
  ('b6000000-0000-4000-8000-000000000002', 'One started', 'class', 'b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', ((now() at time zone 'Europe/Bucharest')::date - 18 + time '10:00') at time zone 'Europe/Bucharest', ((now() at time zone 'Europe/Bucharest')::date - 18 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'),
  ('b6000000-0000-4000-8000-000000000003', 'Two completed', 'class', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', ((now() at time zone 'Europe/Bucharest')::date - 15 + time '10:00') at time zone 'Europe/Bucharest', ((now() at time zone 'Europe/Bucharest')::date - 15 + time '11:00') at time zone 'Europe/Bucharest', 'completed'),
  ('b6000000-0000-4000-8000-000000000004', 'One future', 'class', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', ((now() at time zone 'Europe/Bucharest')::date + 3 + time '10:00') at time zone 'Europe/Bucharest', ((now() at time zone 'Europe/Bucharest')::date + 3 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'),
  ('b6000000-0000-4000-8000-000000000005', 'One cancelled', 'class', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', ((now() at time zone 'Europe/Bucharest')::date - 10 + time '10:00') at time zone 'Europe/Bucharest', ((now() at time zone 'Europe/Bucharest')::date - 10 + time '11:00') at time zone 'Europe/Bucharest', 'cancelled'),
  ('b6000000-0000-4000-8000-000000000006', 'Former started', 'class', 'b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000001', ((now() at time zone 'Europe/Bucharest')::date - 12 + time '10:00') at time zone 'Europe/Bucharest', ((now() at time zone 'Europe/Bucharest')::date - 12 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled');

insert into public.attendance_records (schedule_entry_id, student_id, status)
values
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'present'),
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002', 'absent'),
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000003', 'recovery'),
  ('b6000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000001', 'present'),
  ('b6000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000001', 'present');

insert into public.competitions (id, name, competition_date, status, created_by)
values
  ('b7000000-0000-4000-8000-000000000001', 'October Results', date '2026-10-01', 'completed', 'b1000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000002', 'October Empty', date '2026-10-15', 'upcoming', 'b1000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000003', 'September Results', date '2026-09-01', 'cancelled', 'b1000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000004', 'October Admin Only', date '2026-10-20', 'upcoming', 'b1000000-0000-4000-8000-000000000001');

insert into public.competition_trainers (competition_id, trainer_id)
values
  ('b7000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002'),
  ('b7000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001');

insert into public.competition_participants (competition_id, student_id)
values
  ('b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002'),
  ('b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000003'),
  ('b7000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000003'),
  ('b7000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000003');

insert into public.competition_results (id, competition_id, result_type, category, placement, created_by)
values
  ('b8000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'individual', 'Solo', 1, 'b1000000-0000-4000-8000-000000000001'),
  ('b8000000-0000-4000-8000-000000000002', 'b7000000-0000-4000-8000-000000000001', 'team', 'Duo', 2, 'b1000000-0000-4000-8000-000000000001'),
  ('b8000000-0000-4000-8000-000000000003', 'b7000000-0000-4000-8000-000000000003', 'individual', 'September', 3, 'b1000000-0000-4000-8000-000000000001');

insert into public.competition_result_members (result_id, competition_id, student_id)
values
  ('b8000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001'),
  ('b8000000-0000-4000-8000-000000000002', 'b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001'),
  ('b8000000-0000-4000-8000-000000000002', 'b7000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002'),
  ('b8000000-0000-4000-8000-000000000003', 'b7000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000003');

delete from public.group_trainers
where group_id = 'b3000000-0000-4000-8000-000000000001'
  and trainer_id = 'b2000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select trainer_display_name, started_classes_count, status_completed_classes_count, future_scheduled_classes_count,
      cancelled_classes_count, distinct_groups_taught_count, recorded_attendance_marks_count,
      present_count, absent_count, recovery_count, attendance_rate
    from public.get_trainer_activity_report(
      (now() at time zone 'Europe/Bucharest')::date - 30,
      (now() at time zone 'Europe/Bucharest')::date + 5
    ) order by trainer_display_name$$,
  $$values
    ('Activity One', 2::bigint, 1::bigint, 1::bigint, 1::bigint, 2::bigint, 4::bigint, 2::bigint, 1::bigint, 1::bigint, 2::numeric / 3::numeric),
    ('Activity Two', 1::bigint, 1::bigint, 0::bigint, 0::bigint, 1::bigint, 1::bigint, 1::bigint, 0::bigint, 0::bigint, 1::numeric),
    ('Former Trainer', 1::bigint, 0::bigint, 0::bigint, 0::bigint, 1::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, null::numeric)$$,
  'admin receives historical activity for active and inactive trainers without multiplying attendance'
);

select is((select count(*) from public.group_trainers where trainer_id = 'b2000000-0000-4000-8000-000000000001' and group_id = 'b3000000-0000-4000-8000-000000000001'), 0::bigint, 'fixture removes current group assignment for historical trainer');

select results_eq(
  $$select competition_name, competition_date, unique_enrolled_participants_count, result_type, result_member_count
    from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 100)
    order by competition_date, competition_id, result_id$$,
  $$values
    ('October Results', date '2026-10-01', 3::bigint, 'individual', 1::bigint),
    ('October Results', date '2026-10-01', 3::bigint, 'team', 2::bigint),
    ('October Empty', date '2026-10-15', 2::bigint, null::text, 0::bigint),
    ('October Admin Only', date '2026-10-20', 0::bigint, null::text, 0::bigint)$$,
  'competition detail preserves one row per result and one null-result row for competitions without results'
);

select is(
  (select jsonb_array_length(result_member_display_names)
   from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', 'b7000000-0000-4000-8000-000000000001', null, 'team', 25)),
  2,
  'team member JSON retains both duplicate-display-name students as distinct IDs'
);

select results_eq(
  $$select bucket_start, competitions_count, unique_enrolled_participants_count, result_entries_count, individual_results_count, team_results_count
    from public.get_competition_participation_series(date '2026-09-01', date '2026-11-30')
    order by bucket_start$$,
  $$values
    (date '2026-09-01', 1::bigint, 1::bigint, 1::bigint, 1::bigint, 0::bigint),
    (date '2026-10-01', 3::bigint, 3::bigint, 2::bigint, 1::bigint, 1::bigint),
    (date '2026-11-01', 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint)$$,
  'participation trend counts distinct students per month and emits zero-count months'
);

select is((select count(*) from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, 'completed', null, 25)), 2::bigint, 'status filtering preserves matching competition result rows');
select is((select count(*) from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, 'team', 25)), 1::bigint, 'result-type filtering excludes no-result competitions');

select ok(
  (select bool_and(has_more is false and next_cursor is null)
   from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 100)),
  'final competition report page is explicitly terminal'
);

select results_eq(
  $$with first_page as (
      select *
      from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 1)
    )
    select result_id
    from public.get_competition_results_report(
      date '2026-10-01', date '2026-10-31', null, null, null, 1,
      (select next_cursor from first_page
       order by competition_date desc, competition_id desc, (result_id is not null) desc, result_id desc
       limit 1)
    )$$,
  $$values ('b8000000-0000-4000-8000-000000000002'::uuid)$$,
  'competition pagination continues by the final-row cursor without repeating the first result'
);

select is(
  (select count(*) from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 25,
    encode(convert_to('{"competition_date":"2026-10-31","competition_id":"ffffffff-ffff-ffff-ffff-ffffffffffff","has_result":false,"result_id":null}', 'utf8'), 'base64'))),
  0::bigint,
  'a valid exhausted competition cursor returns an empty terminal page'
);

select throws_ok(
  $$select * from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 25, 'invalid')$$,
  '22023', 'Invalid competition report cursor.', 'competition report rejects malformed cursors'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select trainer_id, started_classes_count, future_scheduled_classes_count
    from public.get_trainer_activity_report((now() at time zone 'Europe/Bucharest')::date - 30, (now() at time zone 'Europe/Bucharest')::date + 5)$$,
  $$values ('b2000000-0000-4000-8000-000000000001'::uuid, 2::bigint, 1::bigint)$$,
  'trainer sees only their historical class activity after current group assignment removal'
);

select is((select count(*) from public.get_trainer_activity_report((now() at time zone 'Europe/Bucharest')::date - 30, (now() at time zone 'Europe/Bucharest')::date + 5, 'b2000000-0000-4000-8000-000000000002')), 0::bigint, 'trainer cannot widen activity report with a peer trainer filter');
select is((select count(*) from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 25)), 2::bigint, 'responsible trainer sees only their competition result entries');
select is((select count(*) from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', 'b7000000-0000-4000-8000-000000000002', null, null, 25)), 0::bigint, 'trainer cannot reveal an unauthorized competition through its ID filter');
select is((select competitions_count from public.get_competition_participation_series(date '2026-10-01', date '2026-10-31')), 1::bigint, 'trainer trend includes only responsible competitions');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, null, null, 25)), 1::bigint, 'second responsible trainer sees their no-result competition only');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok($$select * from public.get_trainer_activity_report(date '2026-10-01', date '2026-10-01')$$, '42501', 'An active user is required.', 'inactive users cannot retrieve reports');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.get_competition_participation_series(date '2026-10-01', date '2026-10-01')$$, '42501', 'An active user is required.', 'unauthenticated users cannot retrieve reports');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok($$select * from public.get_trainer_activity_report(date '2026-10-02', date '2026-10-01')$$, '22007', 'Provide a valid inclusive activity date range.', 'activity report rejects reversed ranges');
select throws_ok($$select * from public.get_trainer_activity_report(null, date '2026-10-01')$$, '22007', 'Provide a valid inclusive activity date range.', 'activity report requires both dates');
select throws_ok($$select * from public.get_competition_results_report(date '2025-01-01', date '2026-01-02')$$, '22007', 'Provide an inclusive competition date range of no more than 366 days.', 'competition report rejects oversized ranges');
select throws_ok($$select * from public.get_competition_participation_series(date '2026-01-31', date '2027-01-01')$$, '22007', 'Competition participation ranges may span at most 12 calendar months.', 'trend rejects ranges touching more than twelve months');
select throws_ok($$select * from public.get_competition_results_report(date '2026-10-01', date '2026-10-31', null, 'unknown')$$, '22023', 'Invalid competition status filter.', 'competition report validates status filters');

select ok(pg_get_function_result('public.get_trainer_activity_report(date, date, uuid)'::regprocedure) !~ '(student|email|phone|birth|notes|auth)', 'activity output contains no student identity or contact fields');
select ok(pg_get_function_result('public.get_competition_results_report(date, date, uuid, text, text, integer, text)'::regprocedure) !~ '(email|phone|birth|notes|auth)', 'competition detail output contains no contact or authentication fields');
select ok(pg_get_function_result('public.get_competition_participation_series(date, date, text)'::regprocedure) !~ '(student_id|email|phone|birth|notes|auth)', 'competition trend output contains no student identity or contact fields');

select ok((select bool_and(has_function_privilege('authenticated', report_function, 'execute')) from unnest(array[
  'public.get_trainer_activity_report(date, date, uuid)'::regprocedure,
  'public.get_competition_results_report(date, date, uuid, text, text, integer, text)'::regprocedure,
  'public.get_competition_participation_series(date, date, text)'::regprocedure
]) as report_function), 'authenticated can execute every new report RPC');

select ok((select bool_and(not has_function_privilege('anon', report_function, 'execute')) from unnest(array[
  'public.get_trainer_activity_report(date, date, uuid)'::regprocedure,
  'public.get_competition_results_report(date, date, uuid, text, text, integer, text)'::regprocedure,
  'public.get_competition_participation_series(date, date, text)'::regprocedure
]) as report_function), 'anon cannot execute new report RPCs');

select ok((select bool_and(not has_function_privilege('service_role', report_function, 'execute')) from unnest(array[
  'public.get_trainer_activity_report(date, date, uuid)'::regprocedure,
  'public.get_competition_results_report(date, date, uuid, text, text, integer, text)'::regprocedure,
  'public.get_competition_participation_series(date, date, text)'::regprocedure
]) as report_function), 'local service_role has no effective execute permission for new report RPCs');

select ok(
  (
    select bool_and(
      not exists (
        select 1
        from pg_catalog.pg_proc as procedure
        cross join lateral pg_catalog.aclexplode(
          coalesce(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
        ) as privilege
        where procedure.oid = report_function
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      )
    )
    from unnest(array[
      'public.get_trainer_activity_report(date, date, uuid)'::regprocedure,
      'public.get_competition_results_report(date, date, uuid, text, text, integer, text)'::regprocedure,
      'public.get_competition_participation_series(date, date, text)'::regprocedure
    ]) as report_function
  ),
  'PUBLIC has no execute ACL for any new report RPC'
);

reset role;

insert into public.competitions (id, name, competition_date, status, created_by)
values
  ('b7000000-0000-4000-8000-000000000000', 'October Same-Day Empty', date '2026-10-01', 'upcoming', 'b1000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000005', 'Large Team Competition', date '2026-10-25', 'completed', 'b1000000-0000-4000-8000-000000000001');

insert into public.students (id, first_name, last_name)
select
  ('b9000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid,
  'Member',
  lpad(member_number::text, 2, '0')
from generate_series(1, 51) as member_number;

insert into public.competition_participants (competition_id, student_id)
select
  'b7000000-0000-4000-8000-000000000005'::uuid,
  ('b9000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid
from generate_series(1, 51) as member_number;

insert into public.competition_results (id, competition_id, result_type, category, team_name, created_by)
values (
  'b8000000-0000-4000-8000-000000000004',
  'b7000000-0000-4000-8000-000000000005',
  'team',
  'Large Team',
  'Fifty One',
  'b1000000-0000-4000-8000-000000000001'
);

insert into public.competition_result_members (result_id, competition_id, student_id)
select
  'b8000000-0000-4000-8000-000000000004'::uuid,
  'b7000000-0000-4000-8000-000000000005'::uuid,
  ('b9000000-0000-4000-8000-' || lpad(member_number::text, 12, '0'))::uuid
from generate_series(1, 51) as member_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select result_member_count
    from public.get_competition_results_report(
      date '2026-10-25', date '2026-10-25',
      'b7000000-0000-4000-8000-000000000005', null, 'team', 25
    )
  ),
  51::bigint,
  'the authoritative member count includes all fifty-one result members'
);

select is(
  (
    select jsonb_array_length(result_member_display_names)
    from public.get_competition_results_report(
      date '2026-10-25', date '2026-10-25',
      'b7000000-0000-4000-8000-000000000005', null, 'team', 25
    )
  ),
  50,
  'member JSON is capped at fifty entries'
);

select is(
  (
    select count(distinct member ->> 'student_id')
    from public.get_competition_results_report(
      date '2026-10-25', date '2026-10-25',
      'b7000000-0000-4000-8000-000000000005', null, 'team', 25
    ) as report_row
    cross join lateral jsonb_array_elements(report_row.result_member_display_names) as member
  ),
  50::bigint,
  'capped member JSON retains fifty distinct student IDs'
);

select ok(
  (
    select
      result_member_display_names -> 0 ->> 'student_id' = 'b9000000-0000-4000-8000-000000000001'
      and bool_and(
        jsonb_typeof(member) = 'object'
        and member ? 'student_id'
        and member ? 'display_name'
        and (select count(*) from jsonb_object_keys(member)) = 2
      )
    from public.get_competition_results_report(
      date '2026-10-25', date '2026-10-25',
      'b7000000-0000-4000-8000-000000000005', null, 'team', 25
    ) as report_row
    cross join lateral jsonb_array_elements(report_row.result_member_display_names) as member
    group by report_row.result_member_display_names
  ),
  'member JSON ordering is deterministic and exposes only approved fields'
);

select results_eq(
  $$with first_page as (
      select *
      from public.get_competition_results_report(date '2026-10-01', date '2026-10-01', null, null, null, 1)
    ),
    second_page as (
      select *
      from public.get_competition_results_report(
        date '2026-10-01', date '2026-10-01', null, null, null, 1,
        (select next_cursor from first_page
          order by competition_date desc, competition_id desc, (result_id is not null) desc, result_id desc
          limit 1)
      )
    ),
    third_page as (
      select *
      from public.get_competition_results_report(
        date '2026-10-01', date '2026-10-01', null, null, null, 1,
        (select next_cursor from second_page
          order by competition_date desc, competition_id desc, (result_id is not null) desc, result_id desc
          limit 1)
      )
    )
    select competition_id, result_id
    from (
      select competition_id, result_id, competition_date from first_page
      union all
      select competition_id, result_id, competition_date from second_page
      union all
      select competition_id, result_id, competition_date from third_page
    ) as pages
    order by competition_date, competition_id, (result_id is not null), result_id$$,
  $$values
    ('b7000000-0000-4000-8000-000000000000'::uuid, null::uuid),
    ('b7000000-0000-4000-8000-000000000001'::uuid, 'b8000000-0000-4000-8000-000000000001'::uuid),
    ('b7000000-0000-4000-8000-000000000001'::uuid, 'b8000000-0000-4000-8000-000000000002'::uuid)$$,
  'same-date no-result and multi-result competition rows paginate once in stable order'
);

select ok(
  (
    with first_page as (
      select *
      from public.get_competition_results_report(date '2026-10-01', date '2026-10-01', null, null, null, 1)
    ),
    second_page as (
      select *
      from public.get_competition_results_report(
        date '2026-10-01', date '2026-10-01', null, null, null, 1,
        (select next_cursor from first_page
          order by competition_date desc, competition_id desc, (result_id is not null) desc, result_id desc
          limit 1)
      )
    ),
    third_page as (
      select *
      from public.get_competition_results_report(
        date '2026-10-01', date '2026-10-01', null, null, null, 1,
        (select next_cursor from second_page
          order by competition_date desc, competition_id desc, (result_id is not null) desc, result_id desc
          limit 1)
      )
    )
    select bool_and(has_more is false and next_cursor is null)
    from third_page
  ),
  'final same-date pagination page is terminal after a null-result cursor boundary'
);

reset role;

insert into public.trainers (id, first_name, last_name)
select
  ('c2000000-0000-4000-8000-' || lpad(trainer_number::text, 12, '0'))::uuid,
  'Limit',
  lpad(trainer_number::text, 2, '0')
from generate_series(1, 51) as trainer_number;

insert into public.rooms (id, name)
select
  ('c3000000-0000-4000-8000-' || lpad(trainer_number::text, 12, '0'))::uuid,
  'Limit Room ' || lpad(trainer_number::text, 2, '0')
from generate_series(1, 51) as trainer_number;

insert into public.schedule_entries (
  id, title, entry_type, group_id, trainer_id, room_id, starts_at, ends_at, status
)
select
  ('c4000000-0000-4000-8000-' || lpad(trainer_number::text, 12, '0'))::uuid,
  'Limit class ' || lpad(trainer_number::text, 2, '0'),
  'class',
  'b3000000-0000-4000-8000-000000000001'::uuid,
  ('c2000000-0000-4000-8000-' || lpad(trainer_number::text, 12, '0'))::uuid,
  ('c3000000-0000-4000-8000-' || lpad(trainer_number::text, 12, '0'))::uuid,
  (
    case when trainer_number <= 50 then date '2026-06-01' else date '2026-06-02' end
    + time '10:00'
  ) at time zone 'Europe/Bucharest',
  (
    case when trainer_number <= 50 then date '2026-06-01' else date '2026-06-02' end
    + time '11:00'
  ) at time zone 'Europe/Bucharest',
  'completed'
from generate_series(1, 51) as trainer_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.get_trainer_activity_report(date '2026-06-01', date '2026-06-01')),
  50::bigint,
  'the fifty-trainer boundary succeeds'
);

select lives_ok(
  $$select * from public.get_trainer_activity_report(
      date '2026-06-01',
      date '2026-06-02',
      'c2000000-0000-4000-8000-000000000051'
    )$$,
  'filtering to one trainer succeeds after date and trainer filters are applied'
);

select throws_ok(
  $$select * from public.get_trainer_activity_report(date '2026-06-01', date '2026-06-02')$$,
  '22023',
  'Trainer activity reports support at most 50 qualifying trainers. Filter by trainer or narrow the date range.',
  'fifty-one qualifying trainers produce the controlled limit error'
);

select * from finish();
rollback;
