create function private.trainer_can_read_attendance(
  target_schedule_entry_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_entries as schedule_entry
    where schedule_entry.id = target_schedule_entry_id
      and schedule_entry.entry_type = 'class'
      and schedule_entry.trainer_id = private.current_trainer_id()
  );
$$;

create function private.trainer_can_write_attendance(
  target_schedule_entry_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_entries as schedule_entry
    where schedule_entry.id = target_schedule_entry_id
      and schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and schedule_entry.trainer_id = private.current_trainer_id()
  );
$$;

create function private.trainer_can_create_attendance(
  target_schedule_entry_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_entries as schedule_entry
    join public.student_groups as student_group
      on student_group.group_id = schedule_entry.group_id
    where schedule_entry.id = target_schedule_entry_id
      and student_group.student_id = target_student_id
      and schedule_entry.entry_type = 'class'
      and schedule_entry.status <> 'cancelled'
      and schedule_entry.starts_at <= now()
      and schedule_entry.trainer_id = private.current_trainer_id()
  );
$$;

create function private.validate_attendance_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_record record;
  authenticated_user_id uuid := auth.uid();
begin
  if tg_op = 'UPDATE'
    and (
      new.schedule_entry_id is distinct from old.schedule_entry_id
      or new.student_id is distinct from old.student_id
    ) then
    raise exception 'Attendance records cannot be moved to another class or student.'
      using errcode = '23514';
  end if;

  select
    schedule_entry.entry_type,
    schedule_entry.group_id,
    schedule_entry.starts_at,
    schedule_entry.status
  into schedule_record
  from public.schedule_entries as schedule_entry
  where schedule_entry.id = new.schedule_entry_id;

  if not found then
    raise exception 'The scheduled class does not exist.'
      using errcode = '23503';
  end if;

  if schedule_record.entry_type <> 'class' then
    raise exception 'Attendance is available only for class entries.'
      using errcode = '23514';
  end if;

  if schedule_record.status = 'cancelled' then
    raise exception 'Attendance cannot be changed for a cancelled class.'
      using errcode = '23514';
  end if;

  if schedule_record.starts_at > now() then
    raise exception 'Attendance can be marked only after the class has started.'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT'
    and not exists (
      select 1
      from public.student_groups as student_group
      where student_group.group_id = schedule_record.group_id
        and student_group.student_id = new.student_id
    ) then
    raise exception 'The student is not currently assigned to this class group.'
      using errcode = '23514';
  end if;

  if authenticated_user_id is not null then
    new.marked_by := authenticated_user_id;
    new.marked_at := now();
  end if;

  return new;
end;
$$;

create function private.protect_attended_schedule_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.attendance_records as attendance_record
    where attendance_record.schedule_entry_id = old.id
  )
  and (
    new.entry_type is distinct from old.entry_type
    or new.group_id is distinct from old.group_id
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
  ) then
    raise exception 'Class type, group, and timing cannot change after attendance is recorded.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.trainer_can_read_attendance(uuid) from public, anon, authenticated;
revoke execute on function private.trainer_can_write_attendance(uuid) from public, anon, authenticated;
revoke execute on function private.trainer_can_create_attendance(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.validate_attendance_record() from public, anon, authenticated;
revoke execute on function private.protect_attended_schedule_entry() from public, anon, authenticated;

grant execute on function private.trainer_can_read_attendance(uuid) to authenticated;
grant execute on function private.trainer_can_write_attendance(uuid) to authenticated;
grant execute on function private.trainer_can_create_attendance(uuid, uuid) to authenticated;

create trigger attendance_records_validate_integrity
before insert or update on public.attendance_records
for each row execute function private.validate_attendance_record();

create trigger schedule_entries_protect_attendance_integrity
before update on public.schedule_entries
for each row execute function private.protect_attended_schedule_entry();

drop policy "Trainers can read attendance for their classes" on public.attendance_records;
drop policy "Trainers can add attendance for their classes" on public.attendance_records;
drop policy "Trainers can update attendance for their classes" on public.attendance_records;
drop policy "Trainers can delete attendance for their classes" on public.attendance_records;

create policy "Trainers can read attendance for their responsible classes"
on public.attendance_records
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_can_read_attendance(schedule_entry_id))
);

create policy "Trainers can add attendance for their responsible classes"
on public.attendance_records
for insert
to authenticated
with check (
  (select private.is_active_user())
  and (select private.trainer_can_create_attendance(schedule_entry_id, student_id))
);

create policy "Trainers can update attendance for their responsible classes"
on public.attendance_records
for update
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_can_write_attendance(schedule_entry_id))
)
with check (
  (select private.is_active_user())
  and (select private.trainer_can_write_attendance(schedule_entry_id))
);

create policy "Trainers can read students for their responsible classes"
on public.students
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.schedule_entries as schedule_entry
    join public.student_groups as student_group
      on student_group.group_id = schedule_entry.group_id
    where schedule_entry.entry_type = 'class'
      and schedule_entry.trainer_id = private.current_trainer_id()
      and student_group.student_id = students.id
  )
);

create policy "Trainers can read historical attendance students"
on public.students
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.attendance_records as attendance_record
    join public.schedule_entries as schedule_entry
      on schedule_entry.id = attendance_record.schedule_entry_id
    where attendance_record.student_id = students.id
      and schedule_entry.entry_type = 'class'
      and schedule_entry.trainer_id = private.current_trainer_id()
  )
);

create policy "Trainers can read class rosters they are responsible for"
on public.student_groups
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.schedule_entries as schedule_entry
    where schedule_entry.entry_type = 'class'
      and schedule_entry.group_id = student_groups.group_id
      and schedule_entry.trainer_id = private.current_trainer_id()
  )
);
