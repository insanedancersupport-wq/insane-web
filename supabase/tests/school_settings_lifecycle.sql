begin;

select plan(14);

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
values (
  '70000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'settings-admin@example.test',
  'not-used-in-tests',
  now(),
  '{}'::jsonb,
  '{"full_name":"Settings Admin"}'::jsonb,
  now(),
  now()
);

update public.profiles
set role = 'admin'
where id = '70000000-0000-4000-8000-000000000001';

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

create function pg_temp.delete_settings_row()
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  delete from public.school_settings;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

select is(
  (select count(*) from public.school_settings where is_authoritative),
  1::bigint,
  'exactly one authoritative school settings row exists'
);

select is(
  (select private.authoritative_school_timezone()),
  'Europe/Bucharest',
  'the authoritative helper returns the configured timezone'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.delete_settings_row(),
  0::bigint,
  'an administrator cannot delete the authoritative settings row through RLS'
);

reset role;

select is(
  pg_temp.sqlstate_of($$
    delete from public.school_settings
  $$),
  '23514',
  'the database delete trigger protects the authoritative settings row'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($$
    update public.school_settings
    set is_authoritative = false
  $$),
  '23514',
  'the authoritative settings row cannot be made non-authoritative'
);

select is(
  pg_temp.sqlstate_of($$
    insert into public.school_settings (school_name, timezone)
    values ('Another school', 'Europe/Bucharest')
  $$),
  '23505',
  'a second school settings row is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    update public.school_settings
    set timezone = 'Invalid/Timezone'
  $$),
  '22023',
  'an invalid IANA timezone is rejected'
);

select is(
  pg_temp.sqlstate_of($$
    update public.school_settings
    set timezone = 'Europe/Paris'
  $$),
  '00000',
  'a valid timezone change is allowed before schedule entries exist'
);

reset role;

select is(
  (select private.authoritative_school_timezone()),
  'Europe/Paris',
  'the helper reflects a valid timezone update'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($$
    update public.school_settings
    set timezone = 'Europe/Bucharest'
  $$),
  '00000',
  'the test restores the configured timezone before schedule setup'
);

insert into public.schedule_entries (title, entry_type, starts_at, ends_at)
values (
  'Timezone lock test',
  'meeting',
  '2026-01-12 16:00:00+00',
  '2026-01-12 17:00:00+00'
);

select is(
  pg_temp.sqlstate_of($$
    update public.school_settings
    set timezone = 'Europe/Paris'
  $$),
  '23514',
  'the timezone is locked after schedule entries exist'
);

select is(
  pg_temp.sqlstate_of($$
    update public.school_settings
    set phone = '+40 700 000 000'
  $$),
  '00000',
  'unrelated school settings remain editable after schedule entries exist'
);

reset role;

select is(
  (select private.authoritative_school_timezone()),
  'Europe/Bucharest',
  'the protected settings row still supplies the schedule timezone'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($$
    insert into public.schedule_entries (title, entry_type, starts_at, ends_at)
    values ('Protected settings schedule', 'meeting', '2026-01-12 17:00:00+00', '2026-01-12 18:00:00+00')
  $$),
  '00000',
  'schedule operations continue with the protected settings row'
);

select * from finish();

rollback;
