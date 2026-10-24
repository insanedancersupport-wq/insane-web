create function public.get_admin_dashboard_summary(
  target_start_date date,
  target_end_date date
)
returns table (
  active_students bigint,
  active_trainers bigint,
  active_groups bigint,
  today_scheduled_classes bigint,
  attendance_present_count bigint,
  attendance_recorded_count bigint,
  attendance_rate numeric,
  upcoming_competitions bigint,
  pending_tasks bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_timezone text;
  business_today date;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if not private.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if target_start_date is null
    or target_end_date is null
    or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive attendance date range.'
      using errcode = '22007';
  end if;

  configured_timezone := private.authoritative_school_timezone();
  business_today := (now() at time zone configured_timezone)::date;

  return query
  with attendance_summary as (
    select
      count(*) filter (where attendance_record.status = 'present') as present_count,
      count(*) as recorded_count
    from public.attendance_records as attendance_record
    join public.schedule_entries as schedule_entry
      on schedule_entry.id = attendance_record.schedule_entry_id
    where schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and (schedule_entry.starts_at at time zone configured_timezone)::date
        between target_start_date and target_end_date
      and attendance_record.status in ('present', 'absent')
  )
  select
    (select count(*) from public.students as student where student.status = 'active'),
    (select count(*) from public.trainers as trainer where trainer.active),
    (select count(*) from public.groups as group_record where group_record.active),
    (
      select count(*)
      from public.schedule_entries as schedule_entry
      where schedule_entry.entry_type = 'class'
        and schedule_entry.status <> 'cancelled'
        and (schedule_entry.starts_at at time zone configured_timezone)::date = business_today
    ),
    attendance_summary.present_count,
    attendance_summary.recorded_count,
    case
      when attendance_summary.recorded_count = 0 then null
      else attendance_summary.present_count::numeric / attendance_summary.recorded_count
    end,
    (
      select count(*)
      from public.competitions as competition
      where competition.status = 'upcoming'
        and competition.competition_date >= business_today
    ),
    (
      select count(*)
      from public.tasks as task
      where task.status in ('todo', 'in_progress')
    )
  from attendance_summary;
end;
$$;

create function public.get_trainer_dashboard_summary(
  target_start_date date,
  target_end_date date
)
returns table (
  active_groups bigint,
  active_students bigint,
  today_scheduled_classes bigint,
  attendance_present_count bigint,
  attendance_recorded_count bigint,
  attendance_rate numeric,
  pending_tasks bigint,
  upcoming_competitions bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_trainer_id uuid;
  configured_timezone text;
  business_today date;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.active
      and profile.role = 'trainer'
  ) then
    raise exception 'Trainer access is required.'
      using errcode = '42501';
  end if;

  authenticated_trainer_id := private.current_trainer_id();

  if authenticated_trainer_id is null then
    raise exception 'An active trainer profile is required.'
      using errcode = '42501';
  end if;

  if target_start_date is null
    or target_end_date is null
    or target_end_date < target_start_date then
    raise exception 'Provide a valid inclusive attendance date range.'
      using errcode = '22007';
  end if;

  configured_timezone := private.authoritative_school_timezone();
  business_today := (now() at time zone configured_timezone)::date;

  return query
  with attendance_summary as (
    select
      count(*) filter (where attendance_record.status = 'present') as present_count,
      count(*) as recorded_count
    from public.attendance_records as attendance_record
    join public.schedule_entries as schedule_entry
      on schedule_entry.id = attendance_record.schedule_entry_id
    where schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and schedule_entry.trainer_id = authenticated_trainer_id
      and (schedule_entry.starts_at at time zone configured_timezone)::date
        between target_start_date and target_end_date
      and attendance_record.status in ('present', 'absent')
  )
  select
    (
      select count(*)
      from public.group_trainers as group_trainer
      join public.groups as group_record on group_record.id = group_trainer.group_id
      where group_trainer.trainer_id = authenticated_trainer_id
        and group_record.active
    ),
    (
      select count(distinct student_group.student_id)
      from public.group_trainers as group_trainer
      join public.student_groups as student_group
        on student_group.group_id = group_trainer.group_id
      join public.students as student on student.id = student_group.student_id
      join public.groups as group_record on group_record.id = group_trainer.group_id
      where group_trainer.trainer_id = authenticated_trainer_id
        and group_record.active
        and student.status = 'active'
    ),
    (
      select count(*)
      from public.schedule_entries as schedule_entry
      where schedule_entry.entry_type = 'class'
        and schedule_entry.status <> 'cancelled'
        and schedule_entry.trainer_id = authenticated_trainer_id
        and (schedule_entry.starts_at at time zone configured_timezone)::date = business_today
    ),
    attendance_summary.present_count,
    attendance_summary.recorded_count,
    case
      when attendance_summary.recorded_count = 0 then null
      else attendance_summary.present_count::numeric / attendance_summary.recorded_count
    end,
    (
      select count(*)
      from public.tasks as task
      where task.assigned_to = auth.uid()
        and task.status in ('todo', 'in_progress')
    ),
    (
      select count(*)
      from public.competition_trainers as competition_trainer
      join public.competitions as competition
        on competition.id = competition_trainer.competition_id
      where competition_trainer.trainer_id = authenticated_trainer_id
        and competition.status = 'upcoming'
        and competition.competition_date >= business_today
    )
  from attendance_summary;
end;
$$;

revoke execute on function public.get_admin_dashboard_summary(date, date)
  from public, anon, service_role;
revoke execute on function public.get_trainer_dashboard_summary(date, date)
  from public, anon, service_role;

grant execute on function public.get_admin_dashboard_summary(date, date) to authenticated;
grant execute on function public.get_trainer_dashboard_summary(date, date) to authenticated;
