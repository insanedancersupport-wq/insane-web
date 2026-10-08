create function private.validate_authoritative_school_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_authoritative is not true then
    raise exception 'The school settings row must remain authoritative.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names as timezone_name
    where timezone_name.name = new.timezone
  ) then
    raise exception 'The school timezone must be a valid IANA timezone name.'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
    and old.timezone is distinct from new.timezone
    and exists (
      select 1
      from public.schedule_entries
    ) then
    raise exception 'The school timezone cannot be changed after schedule entries exist.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.prevent_authoritative_school_settings_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'The authoritative school settings row cannot be deleted.'
    using errcode = '23514';
end;
$$;

revoke execute on function private.validate_authoritative_school_settings() from public, anon, authenticated;
revoke execute on function private.prevent_authoritative_school_settings_delete() from public, anon, authenticated;

create trigger school_settings_validate_authoritative_row
before insert or update on public.school_settings
for each row execute function private.validate_authoritative_school_settings();

create trigger school_settings_prevent_delete
before delete on public.school_settings
for each row execute function private.prevent_authoritative_school_settings_delete();

drop policy "Admins can manage school settings" on public.school_settings;

create policy "Admins can insert school settings"
on public.school_settings
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update school settings"
on public.school_settings
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
