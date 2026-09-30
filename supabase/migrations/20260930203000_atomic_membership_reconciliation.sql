create function public.reconcile_group_trainers(
  target_group_id uuid,
  selected_trainer_ids uuid[],
  primary_trainer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_trainer_ids uuid[] := coalesce(selected_trainer_ids, '{}'::uuid[]);
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if target_group_id is null or not exists (
    select 1
    from public.groups as group_record
    where group_record.id = target_group_id
  ) then
    raise exception 'The requested group does not exist.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from unnest(normalized_trainer_ids) as selected_trainer(id)
    where not exists (
      select 1
      from public.trainers as trainer
      where trainer.id = selected_trainer.id
    )
  ) then
    raise exception 'One or more requested trainers do not exist.'
      using errcode = '23503';
  end if;

  if primary_trainer_id is not null
    and not primary_trainer_id = any(normalized_trainer_ids) then
    raise exception 'The primary trainer must be assigned to the group.'
      using errcode = '22023';
  end if;

  update public.group_trainers
  set is_primary = false
  where group_id = target_group_id;

  delete from public.group_trainers
  where group_id = target_group_id
    and not trainer_id = any(normalized_trainer_ids);

  insert into public.group_trainers (group_id, trainer_id, is_primary)
  select target_group_id, selected_trainer.id, false
  from (
    select distinct id
    from unnest(normalized_trainer_ids) as selected_trainer(id)
  ) as selected_trainer
  on conflict (group_id, trainer_id) do nothing;

  if primary_trainer_id is not null then
    update public.group_trainers
    set is_primary = true
    where group_id = target_group_id
      and trainer_id = primary_trainer_id;
  end if;
end;
$$;

create function public.reconcile_student_groups(
  target_student_id uuid,
  selected_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_group_ids uuid[] := coalesce(selected_group_ids, '{}'::uuid[]);
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if target_student_id is null or not exists (
    select 1
    from public.students as student
    where student.id = target_student_id
  ) then
    raise exception 'The requested student does not exist.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from unnest(normalized_group_ids) as selected_group(id)
    where not exists (
      select 1
      from public.groups as group_record
      where group_record.id = selected_group.id
    )
  ) then
    raise exception 'One or more requested groups do not exist.'
      using errcode = '23503';
  end if;

  delete from public.student_groups
  where student_id = target_student_id
    and not group_id = any(normalized_group_ids);

  insert into public.student_groups (student_id, group_id)
  select target_student_id, selected_group.id
  from (
    select distinct id
    from unnest(normalized_group_ids) as selected_group(id)
  ) as selected_group
  on conflict (student_id, group_id) do nothing;
end;
$$;

revoke execute on function public.reconcile_group_trainers(uuid, uuid[], uuid) from public, anon, service_role, authenticated;
revoke execute on function public.reconcile_student_groups(uuid, uuid[]) from public, anon, service_role, authenticated;

grant execute on function public.reconcile_group_trainers(uuid, uuid[], uuid) to authenticated;
grant execute on function public.reconcile_student_groups(uuid, uuid[]) to authenticated;
