begin;

select plan(29);

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
    '60000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'schedule-admin@example.test',
    'not-used-in-tests',
    now(),
    '{}'::jsonb,
    '{"full_name":"Schedule Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'schedule-trainer@example.test',
    'not-used-in-tests',
    now(),
    '{}'::jsonb,
    '{"full_name":"Schedule Trainer"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set role = 'admin'
where id = '60000000-0000-4000-8000-000000000001';

insert into public.rooms (id, name)
values
  ('61000000-0000-4000-8000-000000000001', 'Studio One'),
  ('61000000-0000-4000-8000-000000000002', 'Studio Two'),
  ('61000000-0000-4000-8000-000000000003', 'Studio Three');

insert into public.trainers (id, profile_id, first_name, last_name)
values
  ('62000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 'Schedule', 'Trainer'),
  ('62000000-0000-4000-8000-000000000002', null, 'Second', 'Trainer'),
  ('62000000-0000-4000-8000-000000000003', null, 'Third', 'Trainer');

insert into public.groups (id, name)
values
  ('63000000-0000-4000-8000-000000000001', 'Schedule Group');

create function pg_temp.sqlstate_of(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return '00000';
exception
  when others then
    return sqlstate;
end;
$$;

insert into public.schedule_entries (
  id,
  title,
  entry_type,
  room_id,
  trainer_id,
  starts_at,
  ends_at
)
values (
  '64000000-0000-4000-8000-000000000001',
  'Base booking',
  'meeting',
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  '2026-10-05 15:00:00+00',
  '2026-10-05 16:00:00+00'
);

select is(
  (select count(*) from public.school_settings),
  1::bigint,
  'exactly one authoritative school settings row exists'
);

select is(
  (select timezone from public.school_settings where is_authoritative),
  'Europe/Bucharest',
  'the authoritative school timezone is Europe/Bucharest'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.school_settings (school_name, timezone)
    values ('Duplicate school', 'Europe/Bucharest')
  $$),
  '23505',
  'a second school settings row is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, trainer_id, room_id, starts_at, ends_at
    ) values (
      'Missing group', 'class',
      '62000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000002',
      '2026-10-06 15:00:00+00', '2026-10-06 16:00:00+00'
    )
  $$),
  '23514',
  'a class without a group is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, group_id, room_id, starts_at, ends_at
    ) values (
      'Missing trainer', 'class',
      '63000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000002',
      '2026-10-06 15:00:00+00', '2026-10-06 16:00:00+00'
    )
  $$),
  '23514',
  'a class without a trainer is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, group_id, trainer_id, starts_at, ends_at
    ) values (
      'Missing room', 'class',
      '63000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      '2026-10-06 15:00:00+00', '2026-10-06 16:00:00+00'
    )
  $$),
  '23514',
  'a class without a room is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (title, entry_type, starts_at, ends_at)
    values ('Roomless meeting', 'meeting', '2026-10-06 15:00:00+00', '2026-10-06 16:00:00+00')
  $$),
  '00000',
  'non-class entries may omit group, trainer, and room'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, room_id, trainer_id, starts_at, ends_at
    ) values (
      'Room conflict', 'meeting',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      '2026-10-05 15:30:00+00', '2026-10-05 16:30:00+00'
    )
  $$),
  '23P01',
  'overlapping entries in the same room are rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, room_id, trainer_id, starts_at, ends_at
    ) values (
      'Trainer conflict', 'meeting',
      '61000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000001',
      '2026-10-05 15:30:00+00', '2026-10-05 16:30:00+00'
    )
  $$),
  '23P01',
  'overlapping entries for the same trainer are rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, room_id, trainer_id, starts_at, ends_at
    ) values (
      'Adjacent booking', 'meeting',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      '2026-10-05 16:00:00+00', '2026-10-05 17:00:00+00'
    )
  $$),
  '00000',
  'back-to-back room and trainer entries are accepted'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, room_id, starts_at, ends_at
    ) values (
      'Different room', 'meeting',
      '61000000-0000-4000-8000-000000000002',
      '2026-10-05 15:00:00+00', '2026-10-05 16:00:00+00'
    )
  $$),
  '00000',
  'different rooms and trainers may overlap'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, trainer_id, starts_at, ends_at
    ) values (
      'Different trainer', 'meeting',
      '62000000-0000-4000-8000-000000000002',
      '2026-10-05 15:00:00+00', '2026-10-05 16:00:00+00'
    )
  $$),
  '00000',
  'different trainers may overlap'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, room_id, trainer_id, status, starts_at, ends_at
    ) values (
      'Cancelled booking', 'meeting',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      'cancelled',
      '2026-10-05 15:00:00+00', '2026-10-05 16:00:00+00'
    )
  $$),
  '00000',
  'a cancelled entry does not block a room or trainer'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (title, entry_type, starts_at, ends_at)
    values ('Null resources', 'event', '2026-10-07 15:00:00+00', '2026-10-07 16:00:00+00')
  $$),
  '00000',
  'null room and trainer values do not create a conflict'
);

insert into public.schedule_entries (
  id,
  title,
  entry_type,
  room_id,
  trainer_id,
  starts_at,
  ends_at
)
values (
  '64000000-0000-4000-8000-000000000002',
  'Entry to edit',
  'meeting',
  '61000000-0000-4000-8000-000000000002',
  '62000000-0000-4000-8000-000000000002',
  '2026-10-08 15:00:00+00',
  '2026-10-08 16:00:00+00'
);

select is(
  pg_temp.sqlstate_of($$
    update public.schedule_entries
    set room_id = '61000000-0000-4000-8000-000000000001',
        trainer_id = '62000000-0000-4000-8000-000000000001',
        starts_at = '2026-10-05 15:30:00+00',
        ends_at = '2026-10-05 16:30:00+00'
    where id = '64000000-0000-4000-8000-000000000002'
  $$),
  '23P01',
  'editing an entry into a room or trainer conflict is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (title, entry_type, starts_at, ends_at)
    values ('Overnight', 'event', '2026-10-07 20:00:00+00', '2026-10-07 22:30:00+00')
  $$),
  '23514',
  'entries that cross a local school date are rejected'
);

set local role anon;
select ok(
  not has_function_privilege(
    'anon',
    'public.create_weekly_schedule_entries(text, public.schedule_entry_type, uuid, uuid, uuid, date, date, integer, time without time zone, time without time zone, boolean, text)',
    'execute'
  ),
  'anonymous callers cannot execute weekly schedule creation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($$
    select *
    from public.create_weekly_schedule_entries(
      'Trainer weekly class',
      'class',
      '63000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000002',
      date '2026-10-12',
      date '2026-10-12',
      1,
      time '18:00',
      time '19:00'
    )
  $$),
  '42501',
  'trainers cannot execute weekly schedule creation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($$
    select *
    from public.create_weekly_schedule_entries(
      'Weekly class',
      'class',
      '63000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000002',
      date '2026-10-12',
      date '2026-10-19',
      1,
      time '18:00',
      time '19:00'
    )
  $$),
  '00000',
  'an administrator can create weekly concrete entries'
);

select is(
  (
    select count(*)
    from public.schedule_entries
    where title = 'Weekly class'
  ),
  2::bigint,
  'the weekly RPC creates every matching date in the inclusive range'
);

select is(
  (
    select created_by
    from public.schedule_entries
    where title = 'Weekly class'
    limit 1
  ),
  '60000000-0000-4000-8000-000000000001'::uuid,
  'weekly entries derive created_by from the authenticated admin'
);

select is(
  pg_temp.sqlstate_of($$
    select *
    from public.create_weekly_schedule_entries(
      'Missing class reference',
      'class',
      null,
      '62000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000002',
      date '2026-10-26',
      date '2026-10-26',
      1,
      time '18:00',
      time '19:00'
    )
  $$),
  '23514',
  'the weekly RPC rejects incomplete classes'
);

select is(
  pg_temp.sqlstate_of($$
    select *
    from public.create_weekly_schedule_entries(
      'Invalid spring time',
      'meeting',
      null,
      null,
      null,
      date '2026-03-29',
      date '2026-03-29',
      7,
      time '03:30',
      time '04:30'
    )
  $$),
  '22007',
  'the weekly RPC rejects nonexistent DST local times'
);

select is(
  pg_temp.sqlstate_of($$
    select *
    from public.create_weekly_schedule_entries(
      'Ambiguous fall time',
      'meeting',
      null,
      null,
      null,
      date '2026-10-25',
      date '2026-10-25',
      7,
      time '03:30',
      time '04:30'
    )
  $$),
  '22007',
  'the weekly RPC rejects ambiguous DST local times'
);

insert into public.schedule_entries (
  title,
  entry_type,
  room_id,
  trainer_id,
  starts_at,
  ends_at
)
values (
  'Bulk conflict',
  'meeting',
  '61000000-0000-4000-8000-000000000003',
  '62000000-0000-4000-8000-000000000003',
  '2026-11-09 16:00:00+00',
  '2026-11-09 17:00:00+00'
);

select is(
  pg_temp.sqlstate_of($$
    select *
    from public.create_weekly_schedule_entries(
      'Atomic weekly class',
      'class',
      '63000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000003',
      '61000000-0000-4000-8000-000000000003',
      date '2026-11-02',
      date '2026-11-09',
      1,
      time '18:00',
      time '19:00'
    )
  $$),
  '23P01',
  'a conflicting weekly occurrence rejects the batch'
);

select is(
  (
    select count(*)
    from public.schedule_entries
    where title = 'Atomic weekly class'
  ),
  0::bigint,
  'a failed weekly batch leaves no partial schedule entries'
);

select is(
  pg_temp.sqlstate_of($$
    update public.schedule_entries
    set status = 'cancelled'
    where id = '64000000-0000-4000-8000-000000000001'
  $$),
  '00000',
  'cancelling an existing entry is allowed'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (
      title, entry_type, room_id, trainer_id, starts_at, ends_at
    ) values (
      'Replacement booking', 'meeting',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      '2026-10-05 15:00:00+00', '2026-10-05 16:00:00+00'
    )
  $$),
  '00000',
  'a cancelled entry releases its room and trainer slot'
);

select is(
  pg_temp.sqlstate_of($$
    update public.schedule_entries
    set status = 'scheduled'
    where id = '64000000-0000-4000-8000-000000000001'
  $$),
  '23P01',
  'reactivating a cancelled entry is rejected when its slot is occupied'
);

select * from finish();

rollback;
