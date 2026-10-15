create function private.validate_attendance_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_record record;
begin
  select
    schedule_entry.entry_type,
    schedule_entry.starts_at,
    schedule_entry.status
  into schedule_record
  from public.schedule_entries as schedule_entry
  where schedule_entry.id = old.schedule_entry_id;

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

  return old;
end;
$$;

revoke execute on function private.validate_attendance_delete() from public, anon, authenticated;

create policy "Trainers can delete attendance for their responsible classes"
on public.attendance_records
for delete
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_can_write_attendance(schedule_entry_id))
);

create trigger attendance_records_validate_delete
before delete on public.attendance_records
for each row execute function private.validate_attendance_delete();
