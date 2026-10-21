alter table public.competitions
  rename column starts_on to competition_date;

alter table public.competitions
  rename column notes to description;

alter table public.competitions
  add column created_by uuid references public.profiles (id) on delete restrict;

do $$
begin
  if exists (
    select 1
    from public.competitions
    where created_by is null
  ) then
    raise exception 'Existing competitions must have a creator before competition authorization can be enabled.';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.competitions
    where status not in ('upcoming', 'completed', 'cancelled')
  ) then
    raise exception 'Existing competitions must use upcoming, completed, or cancelled status before competition authorization can be enabled.';
  end if;
end;
$$;

alter table public.competitions
  alter column created_by set not null,
  alter column status set default 'upcoming',
  add constraint competitions_supported_status_check
    check (status in ('upcoming', 'completed', 'cancelled'));

alter table public.competition_groups
  add column created_at timestamptz not null default now();

alter table public.competition_groups
  drop constraint competition_groups_group_id_fkey,
  add constraint competition_groups_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete restrict;

create table public.competition_trainers (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (competition_id, trainer_id)
);

create table public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (competition_id, student_id)
);

create index competitions_created_by_idx on public.competitions (created_by);
create index competition_trainers_trainer_id_idx on public.competition_trainers (trainer_id);
create index competition_participants_competition_id_idx on public.competition_participants (competition_id);
create index competition_participants_student_id_idx on public.competition_participants (student_id);

create function private.trainer_is_competition_responsible(
  target_competition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_trainers as competition_trainer
    where competition_trainer.competition_id = target_competition_id
      and competition_trainer.trainer_id = private.current_trainer_id()
  );
$$;

create function private.validate_competition_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;

  if tg_op = 'UPDATE'
    and new.created_by is distinct from old.created_by then
    raise exception 'Competition creator cannot be changed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.validate_competition_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (
      new.competition_id is distinct from old.competition_id
      or new.student_id is distinct from old.student_id
    ) then
    raise exception 'Competition participants cannot be moved.'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT'
    and not exists (
      select 1
      from public.students as student
      where student.id = new.student_id
        and student.status = 'active'
    ) then
    raise exception 'Only active students can be enrolled.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.prevent_competition_delete_with_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.competition_participants as participant
    where participant.competition_id = old.id
  ) then
    raise exception 'A competition with participant enrollments cannot be deleted. Remove all participants first.'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

create function public.enroll_competition_group(
  target_competition_id uuid,
  target_group_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if not private.is_admin()
    and not private.trainer_is_competition_responsible(target_competition_id) then
    raise exception 'Competition responsibility is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.competition_groups as competition_group
    where competition_group.competition_id = target_competition_id
      and competition_group.group_id = target_group_id
  ) then
    raise exception 'The group is not associated with this competition.'
      using errcode = '23514';
  end if;

  insert into public.competition_participants (competition_id, student_id)
  select target_competition_id, student_group.student_id
  from public.student_groups as student_group
  join public.students as student on student.id = student_group.student_id
  where student_group.group_id = target_group_id
    and student.status = 'active'
  on conflict (competition_id, student_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function private.trainer_is_competition_responsible(uuid) from public, anon, authenticated;
grant execute on function private.trainer_is_competition_responsible(uuid) to authenticated;
revoke execute on function private.validate_competition_write() from public, anon, authenticated;
revoke execute on function private.validate_competition_participant() from public, anon, authenticated;
revoke execute on function private.prevent_competition_delete_with_participants() from public, anon, authenticated;
revoke execute on function public.enroll_competition_group(uuid, uuid) from public, anon;
grant execute on function public.enroll_competition_group(uuid, uuid) to authenticated;

create trigger competitions_validate_write
before insert or update on public.competitions
for each row execute function private.validate_competition_write();

create trigger competition_participants_validate_integrity
before insert or update on public.competition_participants
for each row execute function private.validate_competition_participant();

create trigger competitions_prevent_delete_with_participants
before delete on public.competitions
for each row execute function private.prevent_competition_delete_with_participants();

alter table public.competition_trainers enable row level security;
alter table public.competition_participants enable row level security;

grant select, insert, delete on table public.competition_trainers to authenticated;
grant select, insert, delete on table public.competition_participants to authenticated;
revoke update on table public.competition_groups from authenticated;

drop policy "Trainers can read relevant competitions" on public.competitions;
drop policy "Trainers can read competition groups for their groups" on public.competition_groups;

create policy "Active users can read competitions"
on public.competitions
for select
to authenticated
using ((select private.is_active_user()));

create policy "Active users can read competition groups"
on public.competition_groups
for select
to authenticated
using ((select private.is_active_user()));

create policy "Responsible trainers can manage competition groups"
on public.competition_groups
for all
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_is_competition_responsible(competition_id))
)
with check (
  (select private.is_active_user())
  and (select private.trainer_is_competition_responsible(competition_id))
);

create policy "Active users can read competition trainers"
on public.competition_trainers
for select
to authenticated
using ((select private.is_active_user()));

create policy "Admins can manage competition trainers"
on public.competition_trainers
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Active users can read competition participants"
on public.competition_participants
for select
to authenticated
using ((select private.is_active_user()));

create policy "Admins can manage competition participants"
on public.competition_participants
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Responsible trainers can manage competition participants"
on public.competition_participants
for all
to authenticated
using (
  (select private.is_active_user())
  and (select private.trainer_is_competition_responsible(competition_id))
)
with check (
  (select private.is_active_user())
  and (select private.trainer_is_competition_responsible(competition_id))
);
