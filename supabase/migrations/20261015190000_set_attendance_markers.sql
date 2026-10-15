create function private.set_attendance_markers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
begin
  if authenticated_user_id is not null then
    new.marked_by := authenticated_user_id;
    new.marked_at := now();
  end if;

  return new;
end;
$$;

revoke execute on function private.set_attendance_markers() from public, anon, authenticated;

create or replace function private.validate_attendance_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_record record;
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
      from public.attendance_records as attendance_record
      where attendance_record.schedule_entry_id = new.schedule_entry_id
        and attendance_record.student_id = new.student_id
    )
    and not exists (
      select 1
      from public.student_groups as student_group
      where student_group.group_id = schedule_record.group_id
        and student_group.student_id = new.student_id
    ) then
    raise exception 'The student is not currently assigned to this class group.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.trainer_can_upsert_attendance(
  target_schedule_entry_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.trainer_can_create_attendance(
    target_schedule_entry_id,
    target_student_id
  )
  or (
    private.trainer_can_write_attendance(target_schedule_entry_id)
    and exists (
      select 1
      from public.attendance_records as attendance_record
      where attendance_record.schedule_entry_id = target_schedule_entry_id
        and attendance_record.student_id = target_student_id
    )
  );
$$;

revoke execute on function private.validate_attendance_record() from public, anon, authenticated;
revoke execute on function private.trainer_can_upsert_attendance(uuid, uuid) from public, anon, authenticated;
grant execute on function private.trainer_can_upsert_attendance(uuid, uuid) to authenticated;

drop policy "Trainers can add attendance for their responsible classes" on public.attendance_records;

create policy "Trainers can add attendance for their responsible classes"
on public.attendance_records
for insert
to authenticated
with check (
  (select private.is_active_user())
  and (select private.trainer_can_upsert_attendance(schedule_entry_id, student_id))
);

create trigger attendance_records_set_markers
before insert or update on public.attendance_records
for each row execute function private.set_attendance_markers();
