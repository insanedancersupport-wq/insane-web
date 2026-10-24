begin;

select plan(37);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reports-admin@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Reports Admin"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reports-trainer-one@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Reports Trainer One"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reports-trainer-two@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Reports Trainer Two"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reports-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{"full_name":"Reports Inactive"}'::jsonb, now(), now());

update public.profiles set role = 'admin'
where id = 'a1000000-0000-4000-8000-000000000001';

update public.profiles set active = false
where id = 'a1000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name, active)
values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Trainer', 'One', true),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', 'Trainer', 'Two', true),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', 'Trainer', 'Inactive', false);

insert into public.groups (id, name)
values
  ('a3000000-0000-4000-8000-000000000001', 'Alpha Group'),
  ('a3000000-0000-4000-8000-000000000002', 'Beta Group'),
  ('a3000000-0000-4000-8000-000000000003', 'Empty Group');

insert into public.rooms (id, name)
values ('a4000000-0000-4000-8000-000000000001', 'Reports Studio');

insert into public.group_trainers (group_id, trainer_id)
values
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002');

insert into public.students (id, first_name, last_name, status, email, phone, notes)
values
  ('a5000000-0000-4000-8000-000000000001', 'Alice', 'Historical', 'active', 'alice@example.test', '+40111111111', 'private note'),
  ('a5000000-0000-4000-8000-000000000002', 'Bob', 'Absent', 'active', 'bob@example.test', '+40222222222', 'private note'),
  ('a5000000-0000-4000-8000-000000000003', 'Cara', 'Inactive', 'inactive', 'cara@example.test', '+40333333333', 'private note'),
  ('a5000000-0000-4000-8000-000000000004', 'Dan', 'Shared', 'active', 'dan@example.test', '+40444444444', 'private note'),
  ('a5000000-0000-4000-8000-000000000005', 'Sam', 'Duplicate', 'active', 'sam-one@example.test', '+40555555555', 'private note'),
  ('a5000000-0000-4000-8000-000000000006', 'Sam', 'Duplicate', 'active', 'sam-two@example.test', '+40666666666', 'private note');

insert into public.student_groups (student_id, group_id)
values
  ('a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002'),
  ('a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000002'),
  ('a5000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000001');

insert into public.schedule_entries (
  id, title, entry_type, group_id, trainer_id, room_id, starts_at, ends_at, status
)
values
  (
    'a6000000-0000-4000-8000-000000000001', 'Alpha completed', 'class',
    'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date - 40 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 40 + time '11:00') at time zone 'Europe/Bucharest', 'completed'
  ),
  (
    'a6000000-0000-4000-8000-000000000002', 'Alpha started', 'class',
    'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date - 35 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 35 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'
  ),
  (
    'a6000000-0000-4000-8000-000000000003', 'Beta historical', 'class',
    'a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date - 30 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 30 + time '11:00') at time zone 'Europe/Bucharest', 'completed'
  ),
  (
    'a6000000-0000-4000-8000-000000000004', 'Empty started', 'class',
    'a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date - 20 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 20 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'
  ),
  (
    'a6000000-0000-4000-8000-000000000005', 'Cancelled class', 'class',
    'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date - 10 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date - 10 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'
  ),
  (
    'a6000000-0000-4000-8000-000000000006', 'Future class', 'class',
    'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
    ((now() at time zone 'Europe/Bucharest')::date + 1 + time '10:00') at time zone 'Europe/Bucharest',
    ((now() at time zone 'Europe/Bucharest')::date + 1 + time '11:00') at time zone 'Europe/Bucharest', 'scheduled'
  ),
  (
    'a6000000-0000-4000-8000-000000000007', 'DST boundary class', 'class',
    'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
    (date '2026-03-29' + time '12:00') at time zone 'Europe/Bucharest',
    (date '2026-03-29' + time '13:00') at time zone 'Europe/Bucharest', 'completed'
  );

insert into public.attendance_records (schedule_entry_id, student_id, status)
values
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'present'),
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'absent'),
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000004', 'recovery'),
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000005', 'present'),
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000006', 'present'),
  ('a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001', 'present'),
  ('a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000001', 'present'),
  ('a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000003', 'recovery'),
  ('a6000000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000001', 'present'),
  ('a6000000-0000-4000-8000-000000000007', 'a5000000-0000-4000-8000-000000000001', 'present');

update public.schedule_entries
set status = 'cancelled'
where id = 'a6000000-0000-4000-8000-000000000005';

delete from public.student_groups
where student_id = 'a5000000-0000-4000-8000-000000000001'
  and group_id = 'a3000000-0000-4000-8000-000000000002';

delete from public.group_trainers
where group_id = 'a3000000-0000-4000-8000-000000000001'
  and trainer_id = 'a2000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select student_display_name, group_name, present_count, absent_count, recovery_count, recorded_marks_count, attendance_rate
    from public.get_student_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date,
      null, null, 100
    )
    order by group_name, student_display_name$$,
  $$values
    ('Alice Historical', 'Alpha Group', 2::bigint, 0::bigint, 0::bigint, 2::bigint, 1::numeric),
    ('Bob Absent', 'Alpha Group', 0::bigint, 1::bigint, 0::bigint, 1::bigint, 0::numeric),
    ('Dan Shared', 'Alpha Group', 0::bigint, 0::bigint, 1::bigint, 1::bigint, null::numeric),
    ('Sam Duplicate', 'Alpha Group', 1::bigint, 0::bigint, 0::bigint, 1::bigint, 1::numeric),
    ('Sam Duplicate', 'Alpha Group', 1::bigint, 0::bigint, 0::bigint, 1::bigint, 1::numeric),
    ('Alice Historical', 'Beta Group', 1::bigint, 0::bigint, 0::bigint, 1::bigint, 1::numeric),
    ('Cara Inactive', 'Beta Group', 0::bigint, 0::bigint, 1::bigint, 1::bigint, null::numeric)$$,
  'student report aggregates persisted marks by historical class group and retains inactive or removed-membership students'
);

select results_eq(
  $$select group_name, current_active_students_count, historical_recorded_students_count,
      started_classes_count, status_completed_classes_count, present_count, absent_count, recovery_count, attendance_rate
    from public.get_group_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date
    )
    order by group_name$$,
  $$values
    ('Alpha Group', 5::bigint, 5::bigint, 2::bigint, 1::bigint, 4::bigint, 1::bigint, 1::bigint, 4::numeric / 5::numeric),
    ('Beta Group', 0::bigint, 2::bigint, 1::bigint, 1::bigint, 1::bigint, 0::bigint, 1::bigint, 1::numeric),
    ('Empty Group', 0::bigint, 0::bigint, 1::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, null::numeric)$$,
  'group report separates current active members, historical recorded students, started classes, and explicitly completed classes without join multiplication'
);

select results_eq(
  $$select bucket_start, present_count, absent_count, recovery_count, attendance_rate
    from public.get_attendance_trend_series(date '2026-03-01', date '2026-04-30')
    order by bucket_start$$,
  $$values
    (date '2026-03-01', 1::bigint, 0::bigint, 0::bigint, 1::numeric),
    (date '2026-04-01', 0::bigint, 0::bigint, 0::bigint, null::numeric)$$,
  'trend uses Bucharest-local monthly buckets across DST and emits zero-count months'
);

select is(
  (select count(*) from public.get_student_attendance_report(
    (now() at time zone 'Europe/Bucharest')::date - 60,
    (now() at time zone 'Europe/Bucharest')::date,
    null, null, 2
  )),
  2::bigint,
  'student report returns the requested first keyset page size'
);

select results_eq(
  $$with first_page as (
      select *
      from public.get_student_attendance_report(
        (now() at time zone 'Europe/Bucharest')::date - 60,
        (now() at time zone 'Europe/Bucharest')::date,
        null, null, 2
      )
    )
    select student_display_name, group_name
    from public.get_student_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date,
      null, null, 2,
      (select next_cursor from first_page order by group_name desc, student_display_name desc limit 1)
    )
    order by group_name, student_display_name$$,
  $$values
    ('Dan Shared', 'Alpha Group'),
    ('Sam Duplicate', 'Alpha Group')$$,
  'student report cursor continues final aggregate ordering without duplicates or skipped rows'
);

select ok(
  (select bool_and(has_more and next_cursor is not null)
   from public.get_student_attendance_report(
     (now() at time zone 'Europe/Bucharest')::date - 60,
     (now() at time zone 'Europe/Bucharest')::date,
     null, null, 2
   )),
  'first page returns a reusable cursor and has_more metadata'
);

select results_eq(
  $$with first_page as (
      select *
      from public.get_student_attendance_report(
        (now() at time zone 'Europe/Bucharest')::date - 60,
        (now() at time zone 'Europe/Bucharest')::date,
        null, null, 2
      )
    ),
    second_page as (
      select *
      from public.get_student_attendance_report(
        (now() at time zone 'Europe/Bucharest')::date - 60,
        (now() at time zone 'Europe/Bucharest')::date,
        null, null, 2,
        (select next_cursor from first_page
          order by group_name desc, student_display_name desc, group_id desc, student_id desc
          limit 1)
      )
    ),
    third_page as (
      select *
      from public.get_student_attendance_report(
        (now() at time zone 'Europe/Bucharest')::date - 60,
        (now() at time zone 'Europe/Bucharest')::date,
        null, null, 2,
        (select next_cursor from second_page
          order by group_name desc, student_display_name desc, group_id desc, student_id desc
          limit 1)
      )
    ),
    fourth_page as (
      select *
      from public.get_student_attendance_report(
        (now() at time zone 'Europe/Bucharest')::date - 60,
        (now() at time zone 'Europe/Bucharest')::date,
        null, null, 2,
        (select next_cursor from third_page
          order by group_name desc, student_display_name desc, group_id desc, student_id desc
          limit 1)
      )
    )
    select student_id, group_id
    from (
      select student_id, group_id from first_page
      union all
      select student_id, group_id from second_page
      union all
      select student_id, group_id from third_page
      union all
      select student_id, group_id from fourth_page
    ) as paged_rows
    order by group_id, student_id$$,
  $$select student_id, group_id
    from public.get_student_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date,
      null, null, 100
    )
    order by group_id, student_id$$,
  'UUID tie-breakers preserve every same-name and cross-group aggregate row across keyset pages'
);

select ok(
  (
    select bool_and(has_more is false and next_cursor is null)
    from public.get_student_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date,
      null, null, 100
    )
  ),
  'the final non-empty page has no next cursor and reports has_more false'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select group_name, present_count, absent_count, recovery_count
    from public.get_group_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date
    )
    order by group_name$$,
  $$values
    ('Alpha Group', 3::bigint, 1::bigint, 1::bigint),
    ('Beta Group', 1::bigint, 0::bigint, 1::bigint),
    ('Empty Group', 0::bigint, 0::bigint, 0::bigint)$$,
  'trainer sees only attendance from classes historically assigned to that trainer'
);

select is(
  (
    select current_active_students_count
    from public.get_group_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date,
      'a3000000-0000-4000-8000-000000000001'
    )
  ),
  5::bigint,
  'trainer retains historical class visibility and receives only the approved current aggregate after current group assignment removal'
);

select is(
  (
    select count(*)
    from public.group_trainers
    where group_id = 'a3000000-0000-4000-8000-000000000001'
      and trainer_id = 'a2000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'historical trainer report visibility does not depend on a current group_trainer row'
);

select is(
  (select count(*) from public.get_student_attendance_report(
    (now() at time zone 'Europe/Bucharest')::date - 60,
    (now() at time zone 'Europe/Bucharest')::date,
    'a3000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001'
  )),
  1::bigint,
  'trainer filters can narrow their authorized historical class scope'
);

select is(
  (select count(*) from public.get_student_attendance_report(
    (now() at time zone 'Europe/Bucharest')::date - 60,
    (now() at time zone 'Europe/Bucharest')::date,
    'a3000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000004'
  )),
  1::bigint,
  'trainer can see their own class recovery mark even when the student has shared-group access'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.get_student_attendance_report(
    (now() at time zone 'Europe/Bucharest')::date - 60,
    (now() at time zone 'Europe/Bucharest')::date,
    'a3000000-0000-4000-8000-000000000001'
  )),
  1::bigint,
  'other trainer cannot widen a group filter to see another trainer historical classes'
);

select is(
  (select count(*) from public.get_student_attendance_report(
    (now() at time zone 'Europe/Bucharest')::date - 60,
    (now() at time zone 'Europe/Bucharest')::date,
    null,
    'a5000000-0000-4000-8000-000000000002'
  )),
  0::bigint,
  'other trainer cannot widen a student filter to see another trainer historical classes'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.get_group_attendance_report(date '2026-01-01', date '2026-01-01')$$,
  '42501',
  'An active user is required.',
  'inactive users cannot retrieve attendance reports'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.get_attendance_trend_series(date '2026-01-01', date '2026-01-01')$$,
  '42501',
  'An active user is required.',
  'unauthenticated users cannot retrieve attendance reports'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.get_group_attendance_report(date '2026-10-24', date '2026-10-23')$$,
  '22007',
  'Provide a valid inclusive attendance date range.',
  'reports reject reversed date ranges'
);

select throws_ok(
  $$select * from public.get_group_attendance_report(date '2025-01-01', date '2026-01-02')$$,
  '22007',
  'Provide an inclusive attendance date range of no more than 366 days.',
  'reports reject inclusive ranges exceeding 366 days'
);

select throws_ok(
  $$select * from public.get_student_attendance_report(date '2026-01-01', date '2026-01-01', null, null, 101)$$,
  '22023',
  'Page size must be between 1 and 100.',
  'student report rejects oversized pages'
);

select throws_ok(
  $$select * from public.get_student_attendance_report(date '2026-01-01', date '2026-01-01', null, null, 25, 'not-a-cursor')$$,
  '22023',
  'Invalid attendance report cursor.',
  'student report rejects malformed cursors'
);

select throws_ok(
  $$select * from public.get_student_attendance_report(
      date '2026-01-01', date '2026-01-01', null, null, 25,
      encode(convert_to('not-json', 'utf8'), 'base64')
    )$$,
  '22023',
  'Invalid attendance report cursor.',
  'student report rejects base64 cursors with invalid JSON'
);

select throws_ok(
  $$select * from public.get_student_attendance_report(
      date '2026-01-01', date '2026-01-01', null, null, 25,
      encode(convert_to('{"group_name":"Alpha"}', 'utf8'), 'base64')
    )$$,
  '22023',
  'Invalid attendance report cursor.',
  'student report rejects cursor JSON with missing fields'
);

select throws_ok(
  $$select * from public.get_student_attendance_report(
      date '2026-01-01', date '2026-01-01', null, null, 25,
      encode(convert_to('{"group_name":"Alpha","student_display_name":"Student","group_id":"not-a-uuid","student_id":"not-a-uuid"}', 'utf8'), 'base64')
    )$$,
  '22023',
  'Invalid attendance report cursor.',
  'student report rejects cursor JSON with invalid UUID fields'
);

select throws_ok(
  $$select * from public.get_student_attendance_report(
      date '2026-01-01', date '2026-01-01', null, null, 25,
      encode(convert_to('{"group_name":null,"student_display_name":"Student","group_id":"a3000000-0000-4000-8000-000000000001","student_id":"a5000000-0000-4000-8000-000000000001"}', 'utf8'), 'base64')
    )$$,
  '22023',
  'Invalid attendance report cursor.',
  'student report rejects cursor JSON with explicit null fields'
);

select throws_ok(
  $$select * from public.get_attendance_trend_series(date '2026-01-01', date '2026-01-01', null, 'week')$$,
  '22023',
  'Only monthly attendance trend buckets are supported.',
  'trend report rejects unsupported bucket granularities'
);

select throws_ok(
  $$select * from public.get_attendance_trend_series(date '2026-01-31', date '2027-01-01')$$,
  '22007',
  'Attendance trend ranges may span at most 12 calendar months.',
  'trend report rejects ranges touching more than twelve months rather than truncating them'
);

select is(
  (select count(*) from public.get_student_attendance_report(date '2026-08-01', date '2026-08-31')),
  0::bigint,
  'student report returns an empty result for ranges without persisted marks'
);

select is(
  (
    select count(*)
    from public.get_student_attendance_report(
      (now() at time zone 'Europe/Bucharest')::date - 60,
      (now() at time zone 'Europe/Bucharest')::date,
      null, null, 25,
      encode(
        convert_to(
          '{"group_name":"zzzz","student_display_name":"zzzz","group_id":"ffffffff-ffff-ffff-ffff-ffffffffffff","student_id":"ffffffff-ffff-ffff-ffff-ffffffffffff"}',
          'utf8'
        ),
        'base64'
      )
    )
  ),
  0::bigint,
  'a valid cursor beyond the final row returns the terminal empty page'
);

select ok(
  pg_get_function_result('public.get_student_attendance_report(date, date, uuid, uuid, integer, text)'::regprocedure)
    !~ '(email|phone|birth|notes|auth)',
  'student report output exposes no student contact, birth, note, or authentication fields'
);

select ok(
  pg_get_function_result('public.get_group_attendance_report(date, date, uuid)'::regprocedure)
    !~ '(student_id|student_display_name|email|phone|birth|notes|auth)',
  'group report output exposes only approved aggregate fields'
);

select ok(
  pg_get_function_result('public.get_attendance_trend_series(date, date, uuid, text)'::regprocedure)
    !~ '(student_id|student_display_name|email|phone|birth|notes|auth)',
  'trend report output exposes only approved aggregate fields'
);

select is(
  pg_get_function_result('public.get_student_attendance_report(date, date, uuid, uuid, integer, text)'::regprocedure),
  'TABLE(student_id uuid, student_display_name text, group_id uuid, group_name text, present_count bigint, absent_count bigint, recovery_count bigint, recorded_marks_count bigint, attendance_rate numeric, next_cursor text, has_more boolean)',
  'student report output columns exactly match the approved contract'
);

select ok(
  (
    select bool_and(has_function_privilege('authenticated', report_function, 'execute'))
    from unnest(array[
      'public.get_student_attendance_report(date, date, uuid, uuid, integer, text)'::regprocedure,
      'public.get_group_attendance_report(date, date, uuid)'::regprocedure,
      'public.get_attendance_trend_series(date, date, uuid, text)'::regprocedure
    ]) as report_function
  ),
  'authenticated has execute permission for every attendance report RPC'
);

select ok(
  (
    select bool_and(not has_function_privilege('anon', report_function, 'execute'))
    from unnest(array[
      'public.get_student_attendance_report(date, date, uuid, uuid, integer, text)'::regprocedure,
      'public.get_group_attendance_report(date, date, uuid)'::regprocedure,
      'public.get_attendance_trend_series(date, date, uuid, text)'::regprocedure
    ]) as report_function
  ),
  'anon has no effective execute permission for any attendance report RPC'
);

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
      'public.get_student_attendance_report(date, date, uuid, uuid, integer, text)'::regprocedure,
      'public.get_group_attendance_report(date, date, uuid)'::regprocedure,
      'public.get_attendance_trend_series(date, date, uuid, text)'::regprocedure
    ]) as report_function
  ),
  'PUBLIC has no execute ACL entry for any attendance report RPC'
);

select ok(
  (
    select bool_and(not has_function_privilege('service_role', report_function, 'execute'))
    from unnest(array[
      'public.get_student_attendance_report(date, date, uuid, uuid, integer, text)'::regprocedure,
      'public.get_group_attendance_report(date, date, uuid)'::regprocedure,
      'public.get_attendance_trend_series(date, date, uuid, text)'::regprocedure
    ]) as report_function
  ),
  'local service_role has no effective execute permission for any attendance report RPC'
);

select * from finish();
rollback;
