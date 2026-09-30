create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter default privileges for role postgres in schema private
revoke execute on functions from public, anon, authenticated;

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active
      and profile.role = 'admin'
  );
$$;

create function private.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select trainer.id
  from public.trainers as trainer
  join public.profiles as profile on profile.id = trainer.profile_id
  where trainer.profile_id = (select auth.uid())
    and trainer.active
    and profile.active
  limit 1;
$$;

create function private.trainer_has_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_trainers as group_trainer
    where group_trainer.group_id = target_group_id
      and group_trainer.trainer_id = private.current_trainer_id()
  );
$$;

create function private.trainer_owns_schedule_entry(target_schedule_entry_id uuid)
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
      and schedule_entry.trainer_id = private.current_trainer_id()
  );
$$;

create function private.trainer_has_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_groups as student_group
    where student_group.student_id = target_student_id
      and private.trainer_has_group(student_group.group_id)
  );
$$;

create function private.trainer_has_competition(target_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_groups as competition_group
    where competition_group.competition_id = target_competition_id
      and private.trainer_has_group(competition_group.group_id)
  );
$$;

create function private.trainer_can_manage_attendance(
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
      and schedule_entry.trainer_id = private.current_trainer_id()
      and student_group.student_id = target_student_id
  );
$$;

revoke execute on function private.is_active_user() from public, anon, authenticated;
revoke execute on function private.is_admin() from public, anon, authenticated;
revoke execute on function private.current_trainer_id() from public, anon, authenticated;
revoke execute on function private.trainer_has_group(uuid) from public, anon, authenticated;
revoke execute on function private.trainer_owns_schedule_entry(uuid) from public, anon, authenticated;
revoke execute on function private.trainer_has_student(uuid) from public, anon, authenticated;
revoke execute on function private.trainer_has_competition(uuid) from public, anon, authenticated;
revoke execute on function private.trainer_can_manage_attendance(uuid, uuid) from public, anon, authenticated;

grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_trainer_id() to authenticated;
grant execute on function private.trainer_has_group(uuid) to authenticated;
grant execute on function private.trainer_owns_schedule_entry(uuid) to authenticated;
grant execute on function private.trainer_has_student(uuid) to authenticated;
grant execute on function private.trainer_has_competition(uuid) to authenticated;
grant execute on function private.trainer_can_manage_attendance(uuid, uuid) to authenticated;

grant update (full_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.trainers to authenticated;
grant select, insert, update, delete on table public.students to authenticated;
grant select, insert, update, delete on table public.rooms to authenticated;
grant select, insert, update, delete on table public.groups to authenticated;
grant select, insert, update, delete on table public.student_groups to authenticated;
grant select, insert, update, delete on table public.group_trainers to authenticated;
grant select, insert, update, delete on table public.competitions to authenticated;
grant select, insert, update, delete on table public.competition_groups to authenticated;
grant select, insert, update, delete on table public.schedule_entries to authenticated;
grant select, insert, update, delete on table public.attendance_records to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.school_settings to authenticated;

drop policy "Authenticated users can read their own profile" on public.profiles;

create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Active users can update their own profile name"
on public.profiles
for update
to authenticated
using (
  (select private.is_active_user())
  and (select auth.uid()) = id
)
with check (
  (select private.is_active_user())
  and (select auth.uid()) = id
);

create policy "Admins can manage trainers"
on public.trainers
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read their own trainer record"
on public.trainers
for select
to authenticated
using (
  (select private.is_active_user())
  and id = (select private.current_trainer_id())
);

create policy "Admins can manage students"
on public.students
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read students in their groups"
on public.students
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_has_student(id))
);

create policy "Admins can manage rooms"
on public.rooms
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Active users can read rooms"
on public.rooms
for select
to authenticated
using ((select private.is_active_user()));

create policy "Admins can manage groups"
on public.groups
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read their groups"
on public.groups
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_has_group(id))
);

create policy "Admins can manage student memberships"
on public.student_groups
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read memberships for their groups"
on public.student_groups
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_has_group(group_id))
);

create policy "Admins can manage trainer assignments"
on public.group_trainers
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read assignments for their groups"
on public.group_trainers
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_has_group(group_id))
);

create policy "Admins can manage competitions"
on public.competitions
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read relevant competitions"
on public.competitions
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_has_competition(id))
);

create policy "Admins can manage competition groups"
on public.competition_groups
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read competition groups for their groups"
on public.competition_groups
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_has_group(group_id))
);

create policy "Admins can manage schedule entries"
on public.schedule_entries
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read relevant schedule entries"
on public.schedule_entries
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    trainer_id = (select private.current_trainer_id())
    or (select private.trainer_has_group(group_id))
  )
);

create policy "Admins can manage attendance"
on public.attendance_records
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read attendance for their classes"
on public.attendance_records
for select
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_can_manage_attendance(schedule_entry_id, student_id))
);

create policy "Trainers can add attendance for their classes"
on public.attendance_records
for insert
to authenticated
with check (
  (select private.is_active_user())
  and marked_by = (select auth.uid())
  and (select private.trainer_can_manage_attendance(schedule_entry_id, student_id))
);

create policy "Trainers can update attendance for their classes"
on public.attendance_records
for update
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_can_manage_attendance(schedule_entry_id, student_id))
)
with check (
  (select private.is_active_user())
  and marked_by = (select auth.uid())
  and (select private.trainer_can_manage_attendance(schedule_entry_id, student_id))
);

create policy "Trainers can delete attendance for their classes"
on public.attendance_records
for delete
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_can_manage_attendance(schedule_entry_id, student_id))
);

create policy "Admins can manage tasks"
on public.tasks
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Trainers can read assigned tasks"
on public.tasks
for select
to authenticated
using (
  (select private.is_active_user())
  and assigned_to = (select auth.uid())
);

create policy "Admins can manage school settings"
on public.school_settings
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Active users can read school settings"
on public.school_settings
for select
to authenticated
using ((select private.is_active_user()));
