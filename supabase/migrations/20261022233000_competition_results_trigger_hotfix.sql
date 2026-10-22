create or replace function private.validate_competition_result_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_result_ids uuid[];
  target_result_id uuid;
  target_result_type text;
  member_count integer;
begin
  if tg_table_name = 'competition_results' then
    target_result_ids := array[
      case when tg_op = 'DELETE' then old.id else new.id end
    ];
  elsif tg_table_name = 'competition_result_members' then
    target_result_ids := case
      when tg_op = 'INSERT' then array[new.result_id]
      when tg_op = 'DELETE' then array[old.result_id]
      else array[old.result_id, new.result_id]
    end;
  else
    raise exception 'Unsupported competition result member-count trigger table: %', tg_table_name
      using errcode = '23514';
  end if;

  foreach target_result_id in array target_result_ids loop
    select result.result_type
    into target_result_type
    from public.competition_results as result
    where result.id = target_result_id;

    if target_result_type is null then
      continue;
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
  end loop;

  return null;
end;
$$;

revoke execute on function private.validate_competition_result_member_count() from public, anon, authenticated;
