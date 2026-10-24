create or replace function private.complete_initial_password_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.raw_app_meta_data ->> 'initial_password_setup_nonce'
    is not distinct from new.raw_app_meta_data ->> 'initial_password_setup_nonce'
    or nullif(new.raw_app_meta_data ->> 'initial_password_setup_nonce', '') is null
    or nullif(new.encrypted_password, '') is null then
    return new;
  end if;

  update public.profiles
  set onboarding_completed_at = now()
  where id = new.id
    and active
    and onboarding_completed_at is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;

create trigger on_auth_user_initial_password_completed
after update of raw_app_meta_data on auth.users
for each row
execute function private.complete_initial_password_on_password_change();
