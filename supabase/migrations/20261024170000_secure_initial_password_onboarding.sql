alter table public.profiles
add column onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = now()
from auth.users as auth_user
where profiles.id = auth_user.id
  and profiles.onboarding_completed_at is null
  and nullif(auth_user.encrypted_password, '') is not null;

create or replace function private.is_active_user()
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
      and profile.onboarding_completed_at is not null
  );
$$;

create or replace function private.is_admin()
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
      and profile.onboarding_completed_at is not null
      and profile.role = 'admin'
  );
$$;

create or replace function private.current_trainer_id()
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
    and profile.onboarding_completed_at is not null
  limit 1;
$$;

create function private.complete_initial_password_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.encrypted_password is not distinct from new.encrypted_password then
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

revoke execute on function private.complete_initial_password_on_password_change()
from public, anon, authenticated;

create trigger on_auth_user_password_changed
after update of encrypted_password on auth.users
for each row
when (old.encrypted_password is distinct from new.encrypted_password)
execute function private.complete_initial_password_on_password_change();

grant select (onboarding_completed_at) on table public.profiles to authenticated;
