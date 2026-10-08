create extension if not exists btree_gist;

do $$
declare
  settings_count integer;
  setting_record record;
begin
  select count(*)
  into settings_count
  from public.school_settings;

  if settings_count > 1 then
    raise exception
      'Cannot establish an authoritative school setting because % rows exist. Resolve duplicate school_settings rows before applying this migration.',
      settings_count;
  end if;

  if settings_count = 0 then
    insert into public.school_settings (school_name, timezone)
    values ('Insane Dance Center', 'Europe/Bucharest');
  end if;

  for setting_record in
    select timezone
    from public.school_settings
  loop
    begin
      perform timezone(setting_record.timezone, now());
    exception
      when invalid_parameter_value then
        raise exception 'School timezone "%" is not a valid IANA timezone.', setting_record.timezone
          using errcode = '22023';
    end;
  end loop;
end;
$$;

alter table public.school_settings
  add column is_authoritative boolean not null default true;

alter table public.school_settings
  add constraint school_settings_must_be_authoritative
  check (is_authoritative);

create unique index school_settings_one_authoritative_row
  on public.school_settings (is_authoritative);

do $$
begin
  if exists (
    select 1
    from public.schedule_entries as schedule_entry
    where schedule_entry.entry_type = 'class'
      and (
        schedule_entry.group_id is null
        or schedule_entry.trainer_id is null
        or schedule_entry.room_id is null
      )
  ) then
    raise exception
      'Cannot enforce class schedule requirements because existing class entries are missing a group, trainer, or room.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.schedule_entries as first_entry
    join public.schedule_entries as second_entry
      on first_entry.id < second_entry.id
      and first_entry.room_id = second_entry.room_id
      and tstzrange(first_entry.starts_at, first_entry.ends_at, '[)')
        && tstzrange(second_entry.starts_at, second_entry.ends_at, '[)')
    where first_entry.status <> 'cancelled'
      and second_entry.status <> 'cancelled'
      and first_entry.room_id is not null
  ) then
    raise exception
      'Cannot add the room conflict constraint because existing non-cancelled room bookings overlap. Resolve the conflicts before applying this migration.'
      using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.schedule_entries as first_entry
    join public.schedule_entries as second_entry
      on first_entry.id < second_entry.id
      and first_entry.trainer_id = second_entry.trainer_id
      and tstzrange(first_entry.starts_at, first_entry.ends_at, '[)')
        && tstzrange(second_entry.starts_at, second_entry.ends_at, '[)')
    where first_entry.status <> 'cancelled'
      and second_entry.status <> 'cancelled'
      and first_entry.trainer_id is not null
  ) then
    raise exception
      'Cannot add the trainer conflict constraint because existing non-cancelled trainer bookings overlap. Resolve the conflicts before applying this migration.'
      using errcode = '23P01';
  end if;
end;
$$;

alter table public.schedule_entries
  add constraint schedule_entries_class_requires_references
  check (
    entry_type <> 'class'
    or (
      group_id is not null
      and trainer_id is not null
      and room_id is not null
    )
  );

alter table public.schedule_entries
  add constraint schedule_entries_no_room_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled' and room_id is not null);

alter table public.schedule_entries
  add constraint schedule_entries_no_trainer_overlap
  exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled' and trainer_id is not null);

create function private.authoritative_school_timezone()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
begin
  select school_setting.timezone
  into configured_timezone
  from public.school_settings as school_setting
  where school_setting.is_authoritative;

  if configured_timezone is null then
    raise exception 'The authoritative school timezone is not configured.'
      using errcode = '23514';
  end if;

  return configured_timezone;
end;
$$;

create function private.schedule_local_time_to_timestamptz(
  target_date date,
  target_time time without time zone,
  target_timezone text
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_timestamp timestamp without time zone;
  matching_instant timestamptz;
  matching_count integer;
begin
  if target_date is null or target_time is null or target_timezone is null then
    raise exception 'A date, time, and school timezone are required.'
      using errcode = '22023';
  end if;

  local_timestamp := target_date + target_time;

  select count(*), min(candidate.instant)
  into matching_count, matching_instant
  from generate_series(
    (local_timestamp - interval '15 hours') at time zone 'UTC',
    (local_timestamp + interval '15 hours') at time zone 'UTC',
    interval '1 minute'
  ) as candidate(instant)
  where candidate.instant at time zone target_timezone = local_timestamp;

  if matching_count = 0 then
    raise exception 'The selected local time does not exist in the school timezone. Choose a different time.'
      using errcode = '22007';
  end if;

  if matching_count > 1 then
    raise exception 'The selected local time is ambiguous in the school timezone. Choose a non-ambiguous time.'
      using errcode = '22007';
  end if;

  return matching_instant;
end;
$$;

create function private.validate_schedule_entry_local_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
begin
  configured_timezone := private.authoritative_school_timezone();

  if (new.starts_at at time zone configured_timezone)::date
    <> (new.ends_at at time zone configured_timezone)::date then
    raise exception 'Schedule entries must start and end on the same local school date.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.authoritative_school_timezone() from public, anon, authenticated;
revoke execute on function private.schedule_local_time_to_timestamptz(date, time without time zone, text) from public, anon, authenticated;
revoke execute on function private.validate_schedule_entry_local_day() from public, anon, authenticated;

create trigger schedule_entries_validate_local_day
before insert or update on public.schedule_entries
for each row execute function private.validate_schedule_entry_local_day();

create function public.create_weekly_schedule_entries(
  target_title text,
  target_entry_type public.schedule_entry_type,
  target_group_id uuid,
  target_trainer_id uuid,
  target_room_id uuid,
  first_date date,
  last_date date,
  target_iso_weekday integer,
  target_start_time time without time zone,
  target_end_time time without time zone,
  target_is_extra boolean default false,
  target_notes text default null
)
returns setof public.schedule_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if target_title is null or char_length(trim(target_title)) = 0 then
    raise exception 'A schedule title is required.'
      using errcode = '22023';
  end if;

  if target_entry_type is null then
    raise exception 'A schedule entry type is required.'
      using errcode = '22023';
  end if;

  if first_date is null or last_date is null or last_date < first_date then
    raise exception 'Provide a valid inclusive date range.'
      using errcode = '22007';
  end if;

  if target_iso_weekday not between 1 and 7 then
    raise exception 'The weekly day must be between 1 and 7.'
      using errcode = '22023';
  end if;

  if target_start_time is null or target_end_time is null or target_end_time <= target_start_time then
    raise exception 'Schedule entries must end after they start on the same local school date.'
      using errcode = '22007';
  end if;

  if target_entry_type = 'class'
    and (target_group_id is null or target_trainer_id is null or target_room_id is null) then
    raise exception 'Classes require a group, responsible trainer, and room.'
      using errcode = '23514';
  end if;

  if target_group_id is not null and not exists (
    select 1
    from public.groups as group_record
    where group_record.id = target_group_id
  ) then
    raise exception 'The requested group does not exist.'
      using errcode = '23503';
  end if;

  if target_trainer_id is not null and not exists (
    select 1
    from public.trainers as trainer_record
    where trainer_record.id = target_trainer_id
  ) then
    raise exception 'The requested trainer does not exist.'
      using errcode = '23503';
  end if;

  if target_room_id is not null and not exists (
    select 1
    from public.rooms as room_record
    where room_record.id = target_room_id
  ) then
    raise exception 'The requested room does not exist.'
      using errcode = '23503';
  end if;

  configured_timezone := private.authoritative_school_timezone();

  return query
  insert into public.schedule_entries (
    title,
    entry_type,
    group_id,
    trainer_id,
    room_id,
    starts_at,
    ends_at,
    status,
    is_extra,
    notes,
    created_by
  )
  select
    trim(target_title),
    target_entry_type,
    target_group_id,
    target_trainer_id,
    target_room_id,
    private.schedule_local_time_to_timestamptz(occurrence.occurs_on, target_start_time, configured_timezone),
    private.schedule_local_time_to_timestamptz(occurrence.occurs_on, target_end_time, configured_timezone),
    'scheduled',
    coalesce(target_is_extra, false),
    target_notes,
    auth.uid()
  from (
    select generated_day::date as occurs_on
    from generate_series(
      first_date::timestamp without time zone,
      last_date::timestamp without time zone,
      interval '1 day'
    ) as generated_day
    where extract(isodow from generated_day) = target_iso_weekday
  ) as occurrence
  returning public.schedule_entries.*;
end;
$$;

revoke execute on function public.create_weekly_schedule_entries(
  text,
  public.schedule_entry_type,
  uuid,
  uuid,
  uuid,
  date,
  date,
  integer,
  time without time zone,
  time without time zone,
  boolean,
  text
) from public, anon, service_role, authenticated;

grant execute on function public.create_weekly_schedule_entries(
  text,
  public.schedule_entry_type,
  uuid,
  uuid,
  uuid,
  date,
  date,
  integer,
  time without time zone,
  time without time zone,
  boolean,
  text
) to authenticated;
