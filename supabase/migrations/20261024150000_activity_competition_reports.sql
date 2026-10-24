create function public.get_trainer_activity_report(
  target_start_date date,
  target_end_date date,
  target_trainer_id uuid default null
)
returns table (
  trainer_id uuid,
  trainer_display_name text,
  started_classes_count bigint,
  status_completed_classes_count bigint,
  future_scheduled_classes_count bigint,
  cancelled_classes_count bigint,
  distinct_groups_taught_count bigint,
  recorded_attendance_marks_count bigint,
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
  qualifying_trainer_count integer;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.' using errcode = '42501';
  end if;

  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive activity date range.' using errcode = '22007';
  end if;

  if target_end_date - target_start_date > 365 then
    raise exception 'Provide an inclusive activity date range of no more than 366 days.' using errcode = '22007';
  end if;

  if not is_administrator then
    authenticated_trainer_id := private.current_trainer_id();
    if authenticated_trainer_id is null then
      raise exception 'An active trainer profile is required.' using errcode = '42501';
    end if;
  end if;

  configured_timezone := private.authoritative_school_timezone();
  lower_boundary := target_start_date::timestamp without time zone at time zone configured_timezone;
  upper_boundary := (target_end_date + 1)::timestamp without time zone at time zone configured_timezone;

  select count(distinct schedule_entry.trainer_id)
  into qualifying_trainer_count
  from public.schedule_entries as schedule_entry
  where schedule_entry.entry_type = 'class'
    and schedule_entry.trainer_id is not null
    and schedule_entry.starts_at >= lower_boundary
    and schedule_entry.starts_at < upper_boundary
    and (is_administrator or schedule_entry.trainer_id = authenticated_trainer_id)
    and (target_trainer_id is null or schedule_entry.trainer_id = target_trainer_id);

  if qualifying_trainer_count > 50 then
    raise exception 'Trainer activity reports support at most 50 qualifying trainers. Filter by trainer or narrow the date range.'
      using errcode = '22023';
  end if;

  return query
  with qualifying_classes as (
    select schedule_entry.id, schedule_entry.trainer_id, schedule_entry.group_id, schedule_entry.status, schedule_entry.starts_at
    from public.schedule_entries as schedule_entry
    where schedule_entry.entry_type = 'class'
      and schedule_entry.trainer_id is not null
      and schedule_entry.starts_at >= lower_boundary
      and schedule_entry.starts_at < upper_boundary
      and (is_administrator or schedule_entry.trainer_id = authenticated_trainer_id)
      and (target_trainer_id is null or schedule_entry.trainer_id = target_trainer_id)
  ),
  class_aggregates as (
    select
      qualifying_classes.trainer_id,
      count(*) filter (where qualifying_classes.starts_at <= now() and qualifying_classes.status <> 'cancelled') as started_classes_count,
      count(*) filter (where qualifying_classes.starts_at <= now() and qualifying_classes.status = 'completed') as status_completed_classes_count,
      count(*) filter (where qualifying_classes.starts_at > now() and qualifying_classes.status <> 'cancelled') as future_scheduled_classes_count,
      count(*) filter (where qualifying_classes.status = 'cancelled') as cancelled_classes_count,
      count(distinct qualifying_classes.group_id) filter (
        where qualifying_classes.starts_at <= now() and qualifying_classes.status <> 'cancelled'
      ) as distinct_groups_taught_count
    from qualifying_classes
    group by qualifying_classes.trainer_id
  ),
  attendance_aggregates as (
    select
      qualifying_classes.trainer_id,
      count(*) as recorded_attendance_marks_count,
      count(*) filter (where attendance_record.status = 'present') as present_count,
      count(*) filter (where attendance_record.status = 'absent') as absent_count,
      count(*) filter (where attendance_record.status = 'recovery') as recovery_count
    from qualifying_classes
    join public.attendance_records as attendance_record on attendance_record.schedule_entry_id = qualifying_classes.id
    where qualifying_classes.starts_at <= now()
      and qualifying_classes.status <> 'cancelled'
    group by qualifying_classes.trainer_id
  )
  select
    class_aggregates.trainer_id,
    trainer.first_name || ' ' || trainer.last_name,
    class_aggregates.started_classes_count,
    class_aggregates.status_completed_classes_count,
    class_aggregates.future_scheduled_classes_count,
    class_aggregates.cancelled_classes_count,
    class_aggregates.distinct_groups_taught_count,
    coalesce(attendance_aggregates.recorded_attendance_marks_count, 0),
    coalesce(attendance_aggregates.present_count, 0),
    coalesce(attendance_aggregates.absent_count, 0),
    coalesce(attendance_aggregates.recovery_count, 0),
    case
      when coalesce(attendance_aggregates.present_count, 0) + coalesce(attendance_aggregates.absent_count, 0) = 0 then null
      else attendance_aggregates.present_count::numeric
        / (attendance_aggregates.present_count + attendance_aggregates.absent_count)
    end
  from class_aggregates
  join public.trainers as trainer on trainer.id = class_aggregates.trainer_id
  left join attendance_aggregates on attendance_aggregates.trainer_id = class_aggregates.trainer_id
  order by trainer.last_name, trainer.first_name, trainer.id;
end;
$$;

create function public.get_competition_results_report(
  target_start_date date,
  target_end_date date,
  target_competition_id uuid default null,
  target_status text default null,
  target_result_type text default null,
  page_size integer default 25,
  after_cursor text default null
)
returns table (
  competition_id uuid,
  competition_name text,
  competition_date date,
  competition_status text,
  unique_enrolled_participants_count bigint,
  result_id uuid,
  result_type text,
  category text,
  team_name text,
  placement integer,
  award text,
  result_member_count bigint,
  result_member_display_names jsonb,
  next_cursor text,
  has_more boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_trainer_id uuid;
  is_administrator boolean := private.is_admin();
  cursor_data jsonb;
  cursor_competition_date date;
  cursor_competition_id uuid;
  cursor_has_result boolean;
  cursor_result_id uuid;
  cursor_result_sort_id uuid;
  zero_uuid constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.' using errcode = '42501';
  end if;

  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive competition date range.' using errcode = '22007';
  end if;

  if target_end_date - target_start_date > 365 then
    raise exception 'Provide an inclusive competition date range of no more than 366 days.' using errcode = '22007';
  end if;

  if page_size is null or page_size < 1 or page_size > 100 then
    raise exception 'Page size must be between 1 and 100.' using errcode = '22023';
  end if;

  if target_status is not null and target_status not in ('upcoming', 'completed', 'cancelled') then
    raise exception 'Invalid competition status filter.' using errcode = '22023';
  end if;

  if target_result_type is not null and target_result_type not in ('individual', 'team') then
    raise exception 'Invalid competition result type filter.' using errcode = '22023';
  end if;

  if not is_administrator then
    authenticated_trainer_id := private.current_trainer_id();
    if authenticated_trainer_id is null then
      raise exception 'An active trainer profile is required.' using errcode = '42501';
    end if;
  end if;

  if after_cursor is not null then
    begin
      cursor_data := convert_from(decode(after_cursor, 'base64'), 'utf8')::jsonb;
      cursor_competition_date := (cursor_data ->> 'competition_date')::date;
      cursor_competition_id := (cursor_data ->> 'competition_id')::uuid;
      cursor_has_result := (cursor_data ->> 'has_result')::boolean;
      cursor_result_id := case when cursor_has_result then (cursor_data ->> 'result_id')::uuid else null end;
    exception when others then
      raise exception 'Invalid competition report cursor.' using errcode = '22023';
    end;

    if cursor_competition_date is null
      or cursor_competition_id is null
      or cursor_has_result is null
      or (cursor_has_result and cursor_result_id is null)
      or (not cursor_has_result and cursor_data ->> 'result_id' is not null) then
      raise exception 'Invalid competition report cursor.' using errcode = '22023';
    end if;
  end if;

  cursor_result_sort_id := coalesce(cursor_result_id, zero_uuid);

  return query
  with authorized_competitions as (
    select competition.id, competition.name, competition.competition_date, competition.status
    from public.competitions as competition
    where competition.competition_date >= target_start_date
      and competition.competition_date <= target_end_date
      and (target_competition_id is null or competition.id = target_competition_id)
      and (target_status is null or competition.status::text = target_status)
      and (
        is_administrator
        or exists (
          select 1
          from public.competition_trainers as competition_trainer
          where competition_trainer.competition_id = competition.id
            and competition_trainer.trainer_id = authenticated_trainer_id
        )
      )
  ),
  enrollment_aggregates as (
    select participant.competition_id, count(distinct participant.student_id) as unique_enrolled_participants_count
    from public.competition_participants as participant
    join authorized_competitions on authorized_competitions.id = participant.competition_id
    group by participant.competition_id
  ),
  member_counts as (
    select member.result_id, count(*) as result_member_count
    from public.competition_result_members as member
    join authorized_competitions on authorized_competitions.id = member.competition_id
    group by member.result_id
  ),
  bounded_member_names as (
    select ranked.result_id,
      jsonb_agg(
        jsonb_build_object('student_id', ranked.student_id, 'display_name', ranked.display_name)
        order by ranked.display_name, ranked.student_id
      ) as result_member_display_names
    from (
      select
        member.result_id,
        member.student_id,
        student.first_name || ' ' || student.last_name as display_name,
        row_number() over (
          partition by member.result_id
          order by student.first_name, student.last_name, member.student_id
        ) as member_rank
      from public.competition_result_members as member
      join authorized_competitions on authorized_competitions.id = member.competition_id
      join public.students as student on student.id = member.student_id
    ) as ranked
    where ranked.member_rank <= 50
    group by ranked.result_id
  ),
  report_rows as (
    select
      authorized_competitions.id as competition_id,
      authorized_competitions.name as competition_name,
      authorized_competitions.competition_date,
      authorized_competitions.status::text as competition_status,
      coalesce(enrollment_aggregates.unique_enrolled_participants_count, 0) as unique_enrolled_participants_count,
      result.id as result_id,
      result.result_type,
      result.category,
      result.team_name,
      result.placement,
      result.award,
      coalesce(member_counts.result_member_count, 0) as result_member_count,
      coalesce(bounded_member_names.result_member_display_names, '[]'::jsonb) as result_member_display_names
    from authorized_competitions
    left join enrollment_aggregates on enrollment_aggregates.competition_id = authorized_competitions.id
    left join public.competition_results as result on result.competition_id = authorized_competitions.id
    left join member_counts on member_counts.result_id = result.id
    left join bounded_member_names on bounded_member_names.result_id = result.id
    where target_result_type is null or result.result_type = target_result_type
  ),
  cursor_filtered as (
    select *
    from report_rows
    where after_cursor is null
      or (
        report_rows.competition_date,
        report_rows.competition_id,
        (report_rows.result_id is not null),
        coalesce(report_rows.result_id, zero_uuid)
      ) > (
        cursor_competition_date,
        cursor_competition_id,
        cursor_has_result,
        cursor_result_sort_id
      )
  ),
  limited as (
    select *
    from cursor_filtered
    order by
      cursor_filtered.competition_date,
      cursor_filtered.competition_id,
      (cursor_filtered.result_id is not null),
      coalesce(cursor_filtered.result_id, zero_uuid)
    limit page_size + 1
  ),
  page as (
    select *
    from limited
    order by
      limited.competition_date,
      limited.competition_id,
      (limited.result_id is not null),
      coalesce(limited.result_id, zero_uuid)
    limit page_size
  ),
  page_metadata as (
    select exists (select 1 from limited offset page_size) as has_more
  )
  select
    page.competition_id,
    page.competition_name,
    page.competition_date,
    page.competition_status,
    page.unique_enrolled_participants_count,
    page.result_id,
    page.result_type,
    page.category,
    page.team_name,
    page.placement,
    page.award,
    page.result_member_count,
    page.result_member_display_names,
    case when page_metadata.has_more then encode(
      convert_to(
        jsonb_build_object(
          'competition_date', page.competition_date,
          'competition_id', page.competition_id,
          'has_result', page.result_id is not null,
          'result_id', page.result_id
        )::text,
        'utf8'
      ),
      'base64'
    ) else null end,
    page_metadata.has_more
  from page
  cross join page_metadata
  order by page.competition_date, page.competition_id, (page.result_id is not null), coalesce(page.result_id, zero_uuid);
end;
$$;

create function public.get_competition_participation_series(
  target_start_date date,
  target_end_date date,
  target_status text default null
)
returns table (
  bucket_start date,
  competitions_count bigint,
  unique_enrolled_participants_count bigint,
  result_entries_count bigint,
  individual_results_count bigint,
  team_results_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_trainer_id uuid;
  is_administrator boolean := private.is_admin();
  month_count integer;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.' using errcode = '42501';
  end if;

  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive competition date range.' using errcode = '22007';
  end if;

  if target_end_date - target_start_date > 365 then
    raise exception 'Provide an inclusive competition date range of no more than 366 days.' using errcode = '22007';
  end if;

  if target_status is not null and target_status not in ('upcoming', 'completed', 'cancelled') then
    raise exception 'Invalid competition status filter.' using errcode = '22023';
  end if;

  month_count := (
    extract(year from target_end_date)::integer * 12 + extract(month from target_end_date)::integer
  ) - (
    extract(year from target_start_date)::integer * 12 + extract(month from target_start_date)::integer
  ) + 1;

  if month_count > 12 then
    raise exception 'Competition participation ranges may span at most 12 calendar months.' using errcode = '22007';
  end if;

  if not is_administrator then
    authenticated_trainer_id := private.current_trainer_id();
    if authenticated_trainer_id is null then
      raise exception 'An active trainer profile is required.' using errcode = '42501';
    end if;
  end if;

  return query
  with buckets as (
    select generated_month::date as bucket_start
    from generate_series(
      date_trunc('month', target_start_date::timestamp without time zone),
      date_trunc('month', target_end_date::timestamp without time zone),
      interval '1 month'
    ) as generated_month
  ),
  authorized_competitions as (
    select competition.id, competition.competition_date
    from public.competitions as competition
    where competition.competition_date >= target_start_date
      and competition.competition_date <= target_end_date
      and (target_status is null or competition.status::text = target_status)
      and (
        is_administrator
        or exists (
          select 1
          from public.competition_trainers as competition_trainer
          where competition_trainer.competition_id = competition.id
            and competition_trainer.trainer_id = authenticated_trainer_id
        )
      )
  ),
  competition_aggregates as (
    select date_trunc('month', authorized_competitions.competition_date::timestamp)::date as bucket_start,
      count(*) as competitions_count
    from authorized_competitions
    group by date_trunc('month', authorized_competitions.competition_date::timestamp)::date
  ),
  participant_aggregates as (
    select date_trunc('month', authorized_competitions.competition_date::timestamp)::date as bucket_start,
      count(distinct participant.student_id) as unique_enrolled_participants_count
    from authorized_competitions
    join public.competition_participants as participant on participant.competition_id = authorized_competitions.id
    group by date_trunc('month', authorized_competitions.competition_date::timestamp)::date
  ),
  result_aggregates as (
    select date_trunc('month', authorized_competitions.competition_date::timestamp)::date as bucket_start,
      count(*) as result_entries_count,
      count(*) filter (where result.result_type = 'individual') as individual_results_count,
      count(*) filter (where result.result_type = 'team') as team_results_count
    from authorized_competitions
    join public.competition_results as result on result.competition_id = authorized_competitions.id
    group by date_trunc('month', authorized_competitions.competition_date::timestamp)::date
  )
  select
    buckets.bucket_start,
    coalesce(competition_aggregates.competitions_count, 0),
    coalesce(participant_aggregates.unique_enrolled_participants_count, 0),
    coalesce(result_aggregates.result_entries_count, 0),
    coalesce(result_aggregates.individual_results_count, 0),
    coalesce(result_aggregates.team_results_count, 0)
  from buckets
  left join competition_aggregates on competition_aggregates.bucket_start = buckets.bucket_start
  left join participant_aggregates on participant_aggregates.bucket_start = buckets.bucket_start
  left join result_aggregates on result_aggregates.bucket_start = buckets.bucket_start
  order by buckets.bucket_start;
end;
$$;

revoke execute on function public.get_trainer_activity_report(date, date, uuid) from public, anon, service_role;
revoke execute on function public.get_competition_results_report(date, date, uuid, text, text, integer, text) from public, anon, service_role;
revoke execute on function public.get_competition_participation_series(date, date, text) from public, anon, service_role;

grant execute on function public.get_trainer_activity_report(date, date, uuid) to authenticated;
grant execute on function public.get_competition_results_report(date, date, uuid, text, text, integer, text) to authenticated;
grant execute on function public.get_competition_participation_series(date, date, text) to authenticated;
