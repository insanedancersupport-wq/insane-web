create table public.competition_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete restrict,
  result_type text not null check (result_type in ('individual', 'team')),
  category text not null check (char_length(trim(category)) > 0),
  team_name text check (team_name is null or char_length(trim(team_name)) > 0),
  placement integer check (placement is null or placement > 0),
  award text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, competition_id)
);

create table public.competition_result_members (
  result_id uuid not null,
  competition_id uuid not null,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (result_id, student_id),
  foreign key (result_id, competition_id)
    references public.competition_results (id, competition_id) on delete cascade,
  foreign key (competition_id, student_id)
    references public.competition_participants (competition_id, student_id) on delete restrict
);

create index competition_results_competition_id_idx on public.competition_results (competition_id);
create index competition_result_members_competition_student_idx
  on public.competition_result_members (competition_id, student_id);

create function private.validate_competition_result_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;

  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'Competition result creator cannot be changed.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.competition_id is distinct from old.competition_id then
    raise exception 'Competition results cannot be moved to another competition.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.validate_competition_result_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_result_id uuid := case when tg_op = 'DELETE' then old.result_id else new.result_id end;
  target_result_type text;
  member_count integer;
begin
  select result.result_type
  into target_result_type
  from public.competition_results as result
  where result.id = target_result_id;

  if target_result_type is null then
    return null;
  end if;

  select count(*)
  into member_count
  from public.competition_result_members as member
  where member.result_id = target_result_id;

  if target_result_type = 'individual' and member_count <> 1 then
    raise exception 'Individual competition results require exactly one member.'
      using errcode = '23514';
  end if;

  if target_result_type = 'team' and member_count < 2 then
    raise exception 'Team competition results require at least two members.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create function public.save_competition_result(
  target_result_id uuid,
  target_competition_id uuid,
  target_result_type text,
  target_category text,
  target_team_name text,
  target_placement integer,
  target_award text,
  target_notes text,
  target_student_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_competition_id uuid;
  normalized_student_ids uuid[];
  member_count integer;
  saved_result_id uuid;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  if target_result_type not in ('individual', 'team') then
    raise exception 'Competition results must be individual or team.'
      using errcode = '23514';
  end if;

  if char_length(trim(coalesce(target_category, ''))) = 0 then
    raise exception 'Competition result category is required.'
      using errcode = '23514';
  end if;

  if target_placement is not null and target_placement <= 0 then
    raise exception 'Competition result placement must be positive.'
      using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct student_id order by student_id), '{}'::uuid[])
  into normalized_student_ids
  from unnest(coalesce(target_student_ids, '{}'::uuid[])) as selected(student_id);

  if cardinality(coalesce(target_student_ids, '{}'::uuid[])) <> cardinality(normalized_student_ids) then
    raise exception 'Each student can appear only once in a competition result.'
      using errcode = '23514';
  end if;

  member_count := cardinality(normalized_student_ids);

  if target_result_type = 'individual' and member_count <> 1 then
    raise exception 'Individual competition results require exactly one member.'
      using errcode = '23514';
  end if;

  if target_result_type = 'team' and member_count < 2 then
    raise exception 'Team competition results require at least two members.'
      using errcode = '23514';
  end if;

  if target_result_id is null then
    if not exists (
      select 1
      from public.competitions as competition
      where competition.id = target_competition_id
    ) then
      raise exception 'Competition does not exist.'
        using errcode = '23514';
    end if;
  else
    select result.competition_id
    into existing_competition_id
    from public.competition_results as result
    where result.id = target_result_id;

    if existing_competition_id is null then
      raise exception 'Competition result does not exist.'
        using errcode = '23514';
    end if;

    if existing_competition_id is distinct from target_competition_id then
      raise exception 'Competition results cannot be moved to another competition.'
        using errcode = '23514';
    end if;
  end if;

  if not private.is_admin()
    and not private.trainer_is_competition_responsible(target_competition_id) then
    raise exception 'Competition responsibility is required.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(normalized_student_ids) as selected(student_id)
    left join public.competition_participants as participant
      on participant.competition_id = target_competition_id
      and participant.student_id = selected.student_id
    where participant.id is null
  ) then
    raise exception 'Every result member must be enrolled in this competition.'
      using errcode = '23514';
  end if;

  if target_result_id is null then
    insert into public.competition_results (
      competition_id,
      result_type,
      category,
      team_name,
      placement,
      award,
      notes
    )
    values (
      target_competition_id,
      target_result_type,
      target_category,
      nullif(trim(target_team_name), ''),
      target_placement,
      nullif(trim(target_award), ''),
      nullif(trim(target_notes), '')
    )
    returning id into saved_result_id;
  else
    update public.competition_results
    set
      result_type = target_result_type,
      category = target_category,
      team_name = nullif(trim(target_team_name), ''),
      placement = target_placement,
      award = nullif(trim(target_award), ''),
      notes = nullif(trim(target_notes), '')
    where id = target_result_id
    returning id into saved_result_id;
  end if;

  delete from public.competition_result_members
  where result_id = saved_result_id;

  insert into public.competition_result_members (result_id, competition_id, student_id)
  select saved_result_id, target_competition_id, selected.student_id
  from unnest(normalized_student_ids) as selected(student_id);

  return saved_result_id;
end;
$$;

create function public.delete_competition_result(target_result_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_competition_id uuid;
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  select result.competition_id
  into target_competition_id
  from public.competition_results as result
  where result.id = target_result_id;

  if target_competition_id is null then
    raise exception 'Competition result does not exist.'
      using errcode = '23514';
  end if;

  if not private.is_admin()
    and not private.trainer_is_competition_responsible(target_competition_id) then
    raise exception 'Competition responsibility is required.'
      using errcode = '42501';
  end if;

  delete from public.competition_results where id = target_result_id;
end;
$$;

create function public.get_competition_result_member_display(
  target_competition_id uuid
)
returns table (
  result_id uuid,
  student_id uuid,
  first_name text,
  last_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'An active user is required.'
      using errcode = '42501';
  end if;

  return query
  select
    member.result_id,
    member.student_id,
    student.first_name,
    student.last_name
  from public.competition_result_members as member
  join public.students as student on student.id = member.student_id
  where member.competition_id = target_competition_id
  order by member.result_id, student.last_name, student.first_name;
end;
$$;

create or replace function private.prevent_competition_delete_with_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.competition_results as result
    where result.competition_id = old.id
  ) then
    raise exception 'A competition with results cannot be deleted. Remove all results first.'
      using errcode = '23514';
  end if;

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

revoke execute on function private.validate_competition_result_write() from public, anon, authenticated;
revoke execute on function private.validate_competition_result_member_count() from public, anon, authenticated;
revoke execute on function public.save_competition_result(uuid, uuid, text, text, text, integer, text, text, uuid[]) from public, anon;
revoke execute on function public.delete_competition_result(uuid) from public, anon;
revoke execute on function public.get_competition_result_member_display(uuid) from public, anon;
grant execute on function public.save_competition_result(uuid, uuid, text, text, text, integer, text, text, uuid[]) to authenticated;
grant execute on function public.delete_competition_result(uuid) to authenticated;
grant execute on function public.get_competition_result_member_display(uuid) to authenticated;

create trigger competition_results_validate_write
before insert or update on public.competition_results
for each row execute function private.validate_competition_result_write();

create trigger competition_results_set_updated_at
before update on public.competition_results
for each row execute function public.set_updated_at();

create constraint trigger competition_results_require_valid_member_count
after insert or update or delete on public.competition_results
deferrable initially deferred
for each row execute function private.validate_competition_result_member_count();

create constraint trigger competition_result_members_require_valid_member_count
after insert or update or delete on public.competition_result_members
deferrable initially deferred
for each row execute function private.validate_competition_result_member_count();

alter table public.competition_results enable row level security;
alter table public.competition_result_members enable row level security;

grant select on table public.competition_results to authenticated;
grant select on table public.competition_result_members to authenticated;

create policy "Active users can read competition results"
on public.competition_results
for select
to authenticated
using ((select private.is_active_user()));

create policy "Active users can read competition result members"
on public.competition_result_members
for select
to authenticated
using ((select private.is_active_user()));
