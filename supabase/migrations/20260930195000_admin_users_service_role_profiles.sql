grant usage on schema public to service_role;
grant select on table public.profiles to service_role;
grant update (full_name, role, active) on table public.profiles to service_role;
