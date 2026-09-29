create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'trainer');
create type public.student_status as enum ('active', 'trial', 'inactive');
create type public.schedule_entry_type as enum ('class', 'workshop', 'meeting', 'event', 'unavailable');
create type public.schedule_status as enum ('scheduled', 'completed', 'cancelled');
create type public.attendance_status as enum ('present', 'absent', 'recovery');
create type public.competition_status as enum ('upcoming', 'active', 'completed', 'cancelled');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) > 0),
  role public.user_role not null default 'trainer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trainers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  phone text,
  email text,
  birth_date date,
  notes text,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  category text,
  level text,
  default_room_id uuid references public.rooms (id) on delete set null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_groups (
  student_id uuid not null references public.students (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  joined_on date,
  left_on date,
  created_at timestamptz not null default now(),
  primary key (student_id, group_id),
  check (left_on is null or joined_on is null or left_on >= joined_on)
);

create table public.group_trainers (
  group_id uuid not null references public.groups (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (group_id, trainer_id)
);

create unique index group_trainers_one_primary_per_group
  on public.group_trainers (group_id)
  where is_primary;

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  location text,
  starts_on date not null,
  ends_on date,
  status public.competition_status not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.competition_groups (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (competition_id, group_id)
);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  entry_type public.schedule_entry_type not null,
  group_id uuid references public.groups (id) on delete set null,
  trainer_id uuid references public.trainers (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.schedule_status not null default 'scheduled',
  is_extra boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  schedule_entry_id uuid not null references public.schedule_entries (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attendance_status not null,
  notes text,
  marked_by uuid references public.profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_entry_id, student_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  assigned_to uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  status public.task_status not null default 'todo',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_settings (
  id uuid primary key default gen_random_uuid(),
  school_name text not null check (char_length(trim(school_name)) > 0),
  timezone text not null check (char_length(trim(timezone)) > 0),
  phone text,
  email text,
  address text,
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index trainers_active_idx on public.trainers (active);
create index students_status_idx on public.students (status);
create index rooms_active_idx on public.rooms (active);
create index groups_default_room_id_idx on public.groups (default_room_id);
create index groups_active_idx on public.groups (active);
create index student_groups_group_id_idx on public.student_groups (group_id);
create index group_trainers_trainer_id_idx on public.group_trainers (trainer_id);
create index competitions_starts_on_idx on public.competitions (starts_on);
create index competitions_status_idx on public.competitions (status);
create index competition_groups_group_id_idx on public.competition_groups (group_id);
create index schedule_entries_group_id_idx on public.schedule_entries (group_id);
create index schedule_entries_trainer_id_idx on public.schedule_entries (trainer_id);
create index schedule_entries_room_id_idx on public.schedule_entries (room_id);
create index schedule_entries_starts_at_idx on public.schedule_entries (starts_at);
create index schedule_entries_status_idx on public.schedule_entries (status);
create index schedule_entries_created_by_idx on public.schedule_entries (created_by);
create index attendance_records_student_id_idx on public.attendance_records (student_id);
create index attendance_records_marked_by_idx on public.attendance_records (marked_by);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_at_idx on public.tasks (due_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'User'
    )
  );

  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter default privileges for role postgres in schema public
revoke execute on functions from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trainers_set_updated_at
before update on public.trainers
for each row execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function public.set_updated_at();

create trigger schedule_entries_set_updated_at
before update on public.schedule_entries
for each row execute function public.set_updated_at();

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger school_settings_set_updated_at
before update on public.school_settings
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.trainers enable row level security;
alter table public.students enable row level security;
alter table public.rooms enable row level security;
alter table public.groups enable row level security;
alter table public.student_groups enable row level security;
alter table public.group_trainers enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_groups enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tasks enable row level security;
alter table public.school_settings enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select (id, full_name, role, active) on table public.profiles to authenticated;

create policy "Authenticated users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
