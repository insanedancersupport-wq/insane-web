alter table public.tasks
  add column due_date date,
  add column priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high'));

update public.tasks
set due_date = (due_at at time zone private.authoritative_school_timezone())::date
where due_at is not null;

do $$
begin
  if exists (
    select 1
    from public.tasks
    where assigned_to is null
      or created_by is null
      or status not in ('todo', 'in_progress', 'done')
  ) then
    raise exception 'Existing tasks must have an assignee, creator, and supported status before task authorization can be enabled.';
  end if;
end;
$$;

alter table public.tasks
  drop constraint tasks_assigned_to_fkey,
  drop constraint tasks_created_by_fkey,
  drop column due_at,
  alter column assigned_to set not null,
  alter column created_by set not null,
  add constraint tasks_assigned_to_fkey
    foreign key (assigned_to) references public.profiles (id) on delete restrict,
  add constraint tasks_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete restrict,
  add constraint tasks_status_check
    check (status in ('todo', 'in_progress', 'done'));

drop index if exists public.tasks_due_at_idx;
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_assigned_to_status_idx on public.tasks (assigned_to, status);

create function private.is_active_task_assignee(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = target_profile_id
      and profile.active
      and profile.role in ('admin', 'trainer')
  );
$$;

create function private.validate_task_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  is_administrator boolean := private.is_admin();
begin
  if tg_op = 'INSERT' and authenticated_user_id is not null then
    new.created_by := authenticated_user_id;
  end if;

  if not private.is_active_task_assignee(new.assigned_to) then
    raise exception 'Tasks can be assigned only to active users.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'Task creator cannot be changed.'
        using errcode = '23514';
    end if;

    if not is_administrator then
      if new.assigned_to is distinct from old.assigned_to then
        raise exception 'Trainers cannot reassign tasks.'
          using errcode = '23514';
      end if;

      if new.status is distinct from old.status
        and old.assigned_to is distinct from authenticated_user_id then
        raise exception 'Only the assigned trainer can change task status.'
          using errcode = '23514';
      end if;

      if (
        new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.due_date is distinct from old.due_date
        or new.priority is distinct from old.priority
      )
      and old.created_by is distinct from authenticated_user_id then
        raise exception 'Only the task creator can edit task details.'
          using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.is_active_task_assignee(uuid) from public, anon, authenticated;
grant execute on function private.is_active_task_assignee(uuid) to authenticated;
revoke execute on function private.validate_task_write() from public, anon, authenticated;

create trigger tasks_validate_write
before insert or update on public.tasks
for each row execute function private.validate_task_write();

drop policy "Trainers can read assigned tasks" on public.tasks;

create policy "Trainers can read assigned or created tasks"
on public.tasks
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  )
);

create policy "Trainers can create self-assigned tasks"
on public.tasks
for insert
to authenticated
with check (
  (select private.is_active_user())
  and assigned_to = (select auth.uid())
  and created_by = (select auth.uid())
);

create policy "Trainers can update assigned or created tasks"
on public.tasks
for update
to authenticated
using (
  (select private.is_active_user())
  and (
    assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  )
)
with check (
  (select private.is_active_user())
  and (
    assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  )
);

create policy "Trainers can delete created tasks"
on public.tasks
for delete
to authenticated
using (
  (select private.is_active_user())
  and created_by = (select auth.uid())
);
