create or replace function private.complete_initial_password_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.encrypted_password is not distinct from new.encrypted_password then
    return new;
  end if;

  if old.raw_app_meta_data ->> 'initial_password_setup_nonce'
    is not distinct from new.raw_app_meta_data ->> 'initial_password_setup_nonce'
    or nullif(new.raw_app_meta_data ->> 'initial_password_setup_nonce', '') is null then
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

update public.profiles as profile
set onboarding_completed_at = null
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.onboarding_completed_at is not null
  and auth_user.invited_at is not null
  and auth_user.confirmed_at is not null
  and profile.onboarding_completed_at <= auth_user.confirmed_at + interval '1 minute';
