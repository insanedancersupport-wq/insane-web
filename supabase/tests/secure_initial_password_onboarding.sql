begin;

select plan(23);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboarding-admin@example.test', 'initial-admin-password', now(), '{}'::jsonb, '{"full_name":"Onboarding Admin"}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboarding-trainer@example.test', 'initial-trainer-password', now(), '{}'::jsonb, '{"full_name":"Onboarding Trainer"}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboarding-incomplete@example.test', 'initial-incomplete-password', now(), '{}'::jsonb, '{"full_name":"Incomplete User"}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboarding-inactive@example.test', 'initial-inactive-password', now(), '{}'::jsonb, '{"full_name":"Inactive User"}'::jsonb, now(), now());

select ok(
  not exists (
    select 1
    from public.profiles
    where id in (
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002',
      '91000000-0000-4000-8000-000000000003',
      '91000000-0000-4000-8000-000000000004'
    )
      and onboarding_completed_at is not null
  ),
  'new Auth users remain incomplete until their password hash changes'
);

update public.profiles
set role = 'admin'
where id = '91000000-0000-4000-8000-000000000001';

update public.profiles
set active = false
where id = '91000000-0000-4000-8000-000000000004';

insert into public.trainers (id, profile_id, first_name, last_name)
values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'Onboarding', 'Trainer');

insert into public.rooms (id, name)
values ('93000000-0000-4000-8000-000000000001', 'Onboarding Room');

update auth.users
set
  encrypted_password = 'completed-admin-password',
  raw_app_meta_data = raw_app_meta_data || jsonb_build_object('initial_password_setup_nonce', 'admin-server-nonce')
where id = '91000000-0000-4000-8000-000000000001';

update auth.users
set
  encrypted_password = 'completed-trainer-password',
  raw_app_meta_data = raw_app_meta_data || jsonb_build_object('initial_password_setup_nonce', 'trainer-server-nonce')
where id = '91000000-0000-4000-8000-000000000002';

select ok(
  (select onboarding_completed_at is not null from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  'password hash change completes active admin onboarding'
);

select ok(
  (select onboarding_completed_at is not null from public.profiles where id = '91000000-0000-4000-8000-000000000002'),
  'password hash change completes active trainer onboarding'
);

select ok(
  (select onboarding_completed_at is null from public.profiles where id = '91000000-0000-4000-8000-000000000004'),
  'password hash change does not complete inactive user onboarding'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok((select private.is_active_user()), 'completed admin remains an active user');
select ok((select private.is_admin()), 'completed admin retains administrator authorization');
select is((select private.current_trainer_id()), null, 'completed admin has no trainer identifier');

reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select ok((select private.is_active_user()), 'completed trainer remains an active user');
select ok(not (select private.is_admin()), 'completed trainer is not an administrator');
select is(
  (select private.current_trainer_id()),
  '92000000-0000-4000-8000-000000000001'::uuid,
  'completed trainer retains trainer authorization'
);

reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
set local role authenticated;

select ok(not (select private.is_active_user()), 'incomplete user is not an active operational user');
select ok(not (select private.is_admin()), 'incomplete user is not an administrator');
select is((select private.current_trainer_id()), null, 'incomplete user has no trainer authorization');
select ok(
  (select onboarding_completed_at is null from public.profiles where id = (select auth.uid())),
  'incomplete user can read their own onboarding status'
);
select is((select count(*) from public.rooms), 0::bigint, 'incomplete user cannot read operational rooms');
select throws_ok(
  $$select * from public.get_student_attendance_report(current_date - 1, current_date)$$,
  '42501',
  'An active user is required.',
  'incomplete user cannot invoke reporting RPCs'
);

create function pg_temp.try_forge_completion()
returns text
language plpgsql
as $$
begin
  update public.profiles
  set onboarding_completed_at = now()
  where id = '91000000-0000-4000-8000-000000000003';
  return 'ok';
exception
  when others then return sqlstate;
end;
$$;

select is(
  pg_temp.try_forge_completion(),
  '42501',
  'incomplete user cannot directly forge onboarding completion'
);

reset role;
update auth.users
set raw_user_meta_data = jsonb_build_object('full_name', 'Incomplete User Updated')
where id = '91000000-0000-4000-8000-000000000003';

select ok(
  (select onboarding_completed_at is null from public.profiles where id = '91000000-0000-4000-8000-000000000003'),
  'unrelated Auth updates do not complete onboarding'
);

update auth.users
set encrypted_password = encrypted_password
where id = '91000000-0000-4000-8000-000000000003';

select ok(
  (select onboarding_completed_at is null from public.profiles where id = '91000000-0000-4000-8000-000000000003'),
  'no-op password-hash updates do not complete onboarding'
);

update auth.users
set encrypted_password = 'untrusted-password-change'
where id = '91000000-0000-4000-8000-000000000003';

select ok(
  (select onboarding_completed_at is null from public.profiles where id = '91000000-0000-4000-8000-000000000003'),
  'invitation acceptance or browser password changes without a server marker do not complete onboarding'
);

update auth.users
set
  encrypted_password = 'completed-incomplete-password',
  raw_app_meta_data = raw_app_meta_data || jsonb_build_object('initial_password_setup_nonce', 'incomplete-server-nonce')
where id = '91000000-0000-4000-8000-000000000003';

select ok(
  (select onboarding_completed_at is not null from public.profiles where id = '91000000-0000-4000-8000-000000000003'),
  'password hash change completes previously incomplete onboarding'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);

select is(
  pg_temp.try_forge_completion(),
  '42501',
  'completed user cannot directly alter onboarding completion'
);

reset role;
create temporary table onboarding_completion_snapshot as
select onboarding_completed_at
from public.profiles
where id = '91000000-0000-4000-8000-000000000003';

update auth.users
set encrypted_password = 'completed-incomplete-password-again'
where id = '91000000-0000-4000-8000-000000000003';

select is(
  (select profile.onboarding_completed_at from public.profiles as profile where profile.id = '91000000-0000-4000-8000-000000000003'),
  (select onboarding_completed_at from onboarding_completion_snapshot),
  'repeat password changes preserve the original completion timestamp'
);

select * from finish();

rollback;
