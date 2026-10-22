create function public.get_competition_trainer_display(
  target_competition_id uuid
)
returns table (
  trainer_id uuid,
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
    competition_trainer.trainer_id,
    trainer.first_name,
    trainer.last_name
  from public.competition_trainers as competition_trainer
  join public.trainers as trainer on trainer.id = competition_trainer.trainer_id
  where competition_trainer.competition_id = target_competition_id
  order by trainer.last_name, trainer.first_name;
end;
$$;

create function public.get_competition_group_display(
  target_competition_id uuid
)
returns table (
  group_id uuid,
  name text
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
    competition_group.group_id,
    dance_group.name
  from public.competition_groups as competition_group
  join public.groups as dance_group on dance_group.id = competition_group.group_id
  where competition_group.competition_id = target_competition_id
  order by dance_group.name;
end;
$$;

create function public.get_competition_participant_display(
  target_competition_id uuid
)
returns table (
  participant_id uuid,
  student_id uuid,
  first_name text,
  last_name text,
  enrolled_at timestamptz
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
    participant.id,
    participant.student_id,
    student.first_name,
    student.last_name,
    participant.created_at
  from public.competition_participants as participant
  join public.students as student on student.id = participant.student_id
  where participant.competition_id = target_competition_id
  order by participant.created_at;
end;
$$;

revoke execute on function public.get_competition_trainer_display(uuid) from public, anon;
revoke execute on function public.get_competition_group_display(uuid) from public, anon;
revoke execute on function public.get_competition_participant_display(uuid) from public, anon;
grant execute on function public.get_competition_trainer_display(uuid) to authenticated;
grant execute on function public.get_competition_group_display(uuid) to authenticated;
grant execute on function public.get_competition_participant_display(uuid) to authenticated;
