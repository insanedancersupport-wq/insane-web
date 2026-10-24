create function public.get_student_attendance_report(
  target_start_date date,
  target_end_date date,
  target_group_id uuid default null,
  target_student_id uuid default null,
  page_size integer default 25,
  after_cursor text default null
)
returns table (
  student_id uuid,
  student_display_name text,
  group_id uuid,
  group_name text,
  present_count bigint,
  absent_count bigint,
  recovery_count bigint,
  recorded_marks_count bigint,
  attendance_rate numeric,
  next_cursor text,
  has_more boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
  lower_boundary timestamptz;
  upper_boundary timestamptz;
  authenticated_trainer_id uuid;
  cursor_data jsonb;
  cursor_group_name text;
  cursor_student_display_name text;
  cursor_group_id uuid;
  cursor_student_id uuid;
  is_administrator boolean := private.is_admin();
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive attendance date range.'
      using errcode = '22007';
  end if;

  if target_end_date - target_start_date > 365 then
    raise exception 'Provide an inclusive attendance date range of no more than 366 days.'
      using errcode = '22007';
  end if;

  if page_size is null or page_size < 1 or page_size > 100 then
    raise exception 'Page size must be between 1 and 100.'
      using errcode = '22023';
  end if;

  if not is_administrator then
    authenticated_trainer_id := private.current_trainer_id();

    if authenticated_trainer_id is null then
      raise exception 'An active trainer profile is required.'
        using errcode = '42501';
    end if;
  end if;

  if after_cursor is not null then
    begin
      cursor_data := convert_from(decode(after_cursor, 'base64'), 'utf8')::jsonb;
      cursor_group_name := cursor_data ->> 'group_name';
      cursor_student_display_name := cursor_data ->> 'student_display_name';
      cursor_group_id := (cursor_data ->> 'group_id')::uuid;
      cursor_student_id := (cursor_data ->> 'student_id')::uuid;
    exception
      when others then
        raise exception 'Invalid attendance report cursor.'
          using errcode = '22023';
    end;

    if cursor_group_name is null
      or cursor_student_display_name is null
      or cursor_group_id is null
      or cursor_student_id is null then
      raise exception 'Invalid attendance report cursor.'
        using errcode = '22023';
    end if;
  end if;

  configured_timezone := private.authoritative_school_timezone();
  lower_boundary := target_start_date::timestamp without time zone at time zone configured_timezone;
  upper_boundary := (target_end_date + 1)::timestamp without time zone at time zone configured_timezone;

  return query
  with qualifying_marks as (
    select
      attendance_record.student_id,
      student.first_name || ' ' || student.last_name as student_display_name,
      schedule_entry.group_id,
      group_record.name as group_name,
      attendance_record.status
    from public.attendance_records as attendance_record
    join public.schedule_entries as schedule_entry
      on schedule_entry.id = attendance_record.schedule_entry_id
    join public.students as student on student.id = attendance_record.student_id
    join public.groups as group_record on group_record.id = schedule_entry.group_id
    where schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and schedule_entry.starts_at >= lower_boundary
      and schedule_entry.starts_at < upper_boundary
      and (is_administrator or schedule_entry.trainer_id = authenticated_trainer_id)
      and (target_group_id is null or schedule_entry.group_id = target_group_id)
      and (target_student_id is null or attendance_record.student_id = target_student_id)
  ),
  aggregated as (
    select
      qualifying_marks.student_id,
      qualifying_marks.student_display_name,
      qualifying_marks.group_id,
      qualifying_marks.group_name,
      count(*) filter (where qualifying_marks.status = 'present') as present_count,
      count(*) filter (where qualifying_marks.status = 'absent') as absent_count,
      count(*) filter (where qualifying_marks.status = 'recovery') as recovery_count,
      count(*) as recorded_marks_count
    from qualifying_marks
    group by
      qualifying_marks.student_id,
      qualifying_marks.student_display_name,
      qualifying_marks.group_id,
      qualifying_marks.group_name
  ),
  cursor_filtered as (
    select *
    from aggregated
    where after_cursor is null
      or (
        aggregated.group_name,
        aggregated.student_display_name,
        aggregated.group_id,
        aggregated.student_id
      ) > (
        cursor_group_name,
        cursor_student_display_name,
        cursor_group_id,
        cursor_student_id
      )
  ),
  limited as (
    select *
    from cursor_filtered
    order by
      cursor_filtered.group_name,
      cursor_filtered.student_display_name,
      cursor_filtered.group_id,
      cursor_filtered.student_id
    limit page_size + 1
  ),
  page as (
    select *
    from limited
    order by group_name, student_display_name, group_id, student_id
    limit page_size
  ),
  page_metadata as (
    select exists (
      select 1
      from limited
      offset page_size
    ) as has_more
  )
  select
    page.student_id,
    page.student_display_name,
    page.group_id,
    page.group_name,
    page.present_count,
    page.absent_count,
    page.recovery_count,
    page.recorded_marks_count,
    case
      when page.present_count + page.absent_count = 0 then null
      else page.present_count::numeric / (page.present_count + page.absent_count)
    end,
    case
      when page_metadata.has_more then encode(
        convert_to(
          jsonb_build_object(
            'group_name', page.group_name,
            'student_display_name', page.student_display_name,
            'group_id', page.group_id,
            'student_id', page.student_id
          )::text,
          'utf8'
        ),
        'base64'
      )
      else null
    end,
    page_metadata.has_more
  from page
  cross join page_metadata
  order by page.group_name, page.student_display_name, page.group_id, page.student_id;
end;
$$;

create function public.get_group_attendance_report(
  target_start_date date,
  target_end_date date,
  target_group_id uuid default null
)
returns table (
  group_id uuid,
  group_name text,
  current_active_students_count bigint,
  historical_recorded_students_count bigint,
  started_classes_count bigint,
  status_completed_classes_count bigint,
  present_count bigint,
  absent_count bigint,
  recovery_count bigint,
  attendance_rate numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
  lower_boundary timestamptz;
  upper_boundary timestamptz;
  authenticated_trainer_id uuid;
  is_administrator boolean := private.is_admin();
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive attendance date range.'
      using errcode = '22007';
  end if;

  if target_end_date - target_start_date > 365 then
    raise exception 'Provide an inclusive attendance date range of no more than 366 days.'
      using errcode = '22007';
  end if;

  if not is_administrator then
    authenticated_trainer_id := private.current_trainer_id();

    if authenticated_trainer_id is null then
      raise exception 'An active trainer profile is required.'
        using errcode = '42501';
    end if;
  end if;

  configured_timezone := private.authoritative_school_timezone();
  lower_boundary := target_start_date::timestamp without time zone at time zone configured_timezone;
  upper_boundary := (target_end_date + 1)::timestamp without time zone at time zone configured_timezone;

  return query
  with qualifying_classes as (
    select
      schedule_entry.id,
      schedule_entry.group_id,
      schedule_entry.status
    from public.schedule_entries as schedule_entry
    where schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and schedule_entry.starts_at >= lower_boundary
      and schedule_entry.starts_at < upper_boundary
      and (is_administrator or schedule_entry.trainer_id = authenticated_trainer_id)
      and (target_group_id is null or schedule_entry.group_id = target_group_id)
  ),
  class_aggregates as (
    select
      qualifying_classes.group_id,
      count(*) as started_classes_count,
      count(*) filter (where qualifying_classes.status = 'completed') as status_completed_classes_count
    from qualifying_classes
    group by qualifying_classes.group_id
  ),
  attendance_aggregates as (
    select
      qualifying_classes.group_id,
      count(distinct attendance_record.student_id) as historical_recorded_students_count,
      count(*) filter (where attendance_record.status = 'present') as present_count,
      count(*) filter (where attendance_record.status = 'absent') as absent_count,
      count(*) filter (where attendance_record.status = 'recovery') as recovery_count
    from qualifying_classes
    join public.attendance_records as attendance_record
      on attendance_record.schedule_entry_id = qualifying_classes.id
    group by qualifying_classes.group_id
  ),
  current_active_students as (
    select
      student_group.group_id,
      count(*) as current_active_students_count
    from public.student_groups as student_group
    join public.students as student on student.id = student_group.student_id
    where student.status = 'active'
    group by student_group.group_id
  )
  select
    class_aggregates.group_id,
    group_record.name,
    coalesce(current_active_students.current_active_students_count, 0),
    coalesce(attendance_aggregates.historical_recorded_students_count, 0),
    class_aggregates.started_classes_count,
    class_aggregates.status_completed_classes_count,
    coalesce(attendance_aggregates.present_count, 0),
    coalesce(attendance_aggregates.absent_count, 0),
    coalesce(attendance_aggregates.recovery_count, 0),
    case
      when coalesce(attendance_aggregates.present_count, 0)
        + coalesce(attendance_aggregates.absent_count, 0) = 0 then null
      else attendance_aggregates.present_count::numeric
        / (attendance_aggregates.present_count + attendance_aggregates.absent_count)
    end
  from class_aggregates
  join public.groups as group_record on group_record.id = class_aggregates.group_id
  left join current_active_students on current_active_students.group_id = class_aggregates.group_id
  left join attendance_aggregates on attendance_aggregates.group_id = class_aggregates.group_id
  order by group_record.name, class_aggregates.group_id;
end;
$$;

create function public.get_attendance_trend_series(
  target_start_date date,
  target_end_date date,
  target_group_id uuid default null,
  bucket_granularity text default 'month'
)
returns table (
  bucket_start date,
  present_count bigint,
  absent_count bigint,
  recovery_count bigint,
  attendance_rate numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
  lower_boundary timestamptz;
  upper_boundary timestamptz;
  authenticated_trainer_id uuid;
  month_count integer;
  is_administrator boolean := private.is_admin();
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive attendance date range.'
      using errcode = '22007';
  end if;

  if target_end_date - target_start_date > 365 then
    raise exception 'Provide an inclusive attendance date range of no more than 366 days.'
      using errcode = '22007';
  end if;

  if bucket_granularity is distinct from 'month' then
    raise exception 'Only monthly attendance trend buckets are supported.'
      using errcode = '22023';
  end if;

  month_count := (
    extract(year from target_end_date)::integer * 12
    + extract(month from target_end_date)::integer
  ) - (
    extract(year from target_start_date)::integer * 12
    + extract(month from target_start_date)::integer
  ) + 1;

  if month_count > 12 then
    raise exception 'Attendance trend ranges may span at most 12 calendar months.'
      using errcode = '22007';
  end if;

  if not is_administrator then
    authenticated_trainer_id := private.current_trainer_id();

    if authenticated_trainer_id is null then
      raise exception 'An active trainer profile is required.'
        using errcode = '42501';
    end if;
  end if;

  configured_timezone := private.authoritative_school_timezone();
  lower_boundary := target_start_date::timestamp without time zone at time zone configured_timezone;
  upper_boundary := (target_end_date + 1)::timestamp without time zone at time zone configured_timezone;

  return query
  with buckets as (
    select generated_month::date as bucket_start
    from generate_series(
      date_trunc('month', target_start_date::timestamp without time zone),
      date_trunc('month', target_end_date::timestamp without time zone),
      interval '1 month'
    ) as generated_month
  ),
  attendance_aggregates as (
    select
      date_trunc('month', schedule_entry.starts_at at time zone configured_timezone)::date as bucket_start,
      count(*) filter (where attendance_record.status = 'present') as present_count,
      count(*) filter (where attendance_record.status = 'absent') as absent_count,
      count(*) filter (where attendance_record.status = 'recovery') as recovery_count
    from public.attendance_records as attendance_record
    join public.schedule_entries as schedule_entry
      on schedule_entry.id = attendance_record.schedule_entry_id
    where schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and schedule_entry.starts_at >= lower_boundary
      and schedule_entry.starts_at < upper_boundary
      and (is_administrator or schedule_entry.trainer_id = authenticated_trainer_id)
      and (target_group_id is null or schedule_entry.group_id = target_group_id)
    group by date_trunc('month', schedule_entry.starts_at at time zone configured_timezone)::date
  )
  select
    buckets.bucket_start,
    coalesce(attendance_aggregates.present_count, 0),
    coalesce(attendance_aggregates.absent_count, 0),
    coalesce(attendance_aggregates.recovery_count, 0),
    case
      when coalesce(attendance_aggregates.present_count, 0)
        + coalesce(attendance_aggregates.absent_count, 0) = 0 then null
      else attendance_aggregates.present_count::numeric
        / (attendance_aggregates.present_count + attendance_aggregates.absent_count)
    end
  from buckets
  left join attendance_aggregates on attendance_aggregates.bucket_start = buckets.bucket_start
  order by buckets.bucket_start;
end;
$$;

revoke execute on function public.get_student_attendance_report(date, date, uuid, uuid, integer, text)
  from public, anon, service_role;
revoke execute on function public.get_group_attendance_report(date, date, uuid)
  from public, anon, service_role;
revoke execute on function public.get_attendance_trend_series(date, date, uuid, text)
  from public, anon, service_role;

grant execute on function public.get_student_attendance_report(date, date, uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.get_group_attendance_report(date, date, uuid)
  to authenticated;
grant execute on function public.get_attendance_trend_series(date, date, uuid, text)
  to authenticated;
