# INSANE DANCE CENTER — MASTER IMPLEMENTATION PLAN v1.0

**Status:** Approved baseline for implementation  
**Product type:** Responsive internal web application  
**Primary users:** Administrator and Trainers  
**Primary objective:** Replace paper / fragmented internal organization with one fast, simple, centralized management application.

---

## 0. AGENT DIRECTIVE — READ THIS FIRST

This document is the implementation authority for the Insane Dance Center project.

### Locked decisions

- Build a **responsive web application**, NOT native Android/iOS apps.
- The application must be **mobile-first**, while remaining fully usable on tablet and desktop.
- Frontend: **React + Vite + JavaScript**.
- Styling: **plain CSS**, CSS variables/design tokens, component/page styles as needed.
- Hosting/deployment: **Netlify**.
- Database: **PostgreSQL via Supabase**.
- Authentication: **Supabase Auth**.
- Authorization: **Supabase Row Level Security (RLS)**.
- Server-side privileged operations: **Supabase Edge Functions** or an equivalent secure server-side function. Never expose privileged keys in browser code.
- Do NOT introduce Next.js, Angular, Vue, React Native, Flutter, Spring Boot, another database, Tailwind, or a large UI framework unless explicitly approved.
- The dark/orange Insane Dance Center mockups define the final **visual design direction**.
- The white calendar mockup is **FUNCTIONAL REFERENCE ONLY**. Do not copy its visual style.
- Do not implement excluded modules listed in this document.
- Work **milestone by milestone**. Do not attempt to generate the whole application in one uncontrolled pass.
- Before changing architecture, database relationships, security rules, or dependencies, explain the reason first.

### Coding rules

1. Prefer clear, maintainable code over clever abstractions.
2. Keep business logic out of presentational components.
3. Do not duplicate server data unnecessarily in client state.
4. Validate input both in the UI and, where relevant, at the database/API boundary.
5. Never rely on hidden buttons or route guards as authorization. RLS is mandatory.
6. Never put `SUPABASE_SERVICE_ROLE_KEY` or any privileged secret in frontend environment variables.
7. Database migrations are append-only once applied. Do not rewrite old applied migrations.
8. After each milestone:
   - run lint;
   - run tests;
   - run production build;
   - fix errors;
   - summarize changed files;
   - update `docs/IMPLEMENTATION_STATUS.md`.
9. Do not silently invent product requirements. If a requirement is missing, use the defaults explicitly stated in this document or flag it.
10. No mock values may remain in production screens after the corresponding backend milestone is complete.

---

# 1. PRODUCT SCOPE

Insane Dance Center is an **internal management system** for the dance school.

It is not a client-facing or parent-facing application.

The application has two primary roles:

### Administrator

Has complete access to the application and can:

- create, edit, and delete information;
- manage users;
- manage trainers;
- manage students;
- manage groups;
- manage rooms;
- manage schedules;
- manage attendance;
- manage competitions;
- manage tasks;
- view reports/statistics;
- manage school settings.

### Trainer

Has restricted access and can:

- view only groups assigned to them;
- view the schedule relevant to their groups/classes;
- view students from their groups;
- complete attendance for classes they are responsible for;
- view tasks assigned to them;
- view relevant competition information when one of their groups participates.

Trainer permissions must be enforced in PostgreSQL/Supabase RLS, not only in the frontend.

---

# 2. MVP MODULES

The MVP contains:

1. Authentication
2. Dashboard
3. Calendar / Schedule
4. Groups
5. Students
6. Trainers
7. Rooms
8. Attendance
9. Competitions
10. Tasks
11. Reports
12. Users / Settings
13. Profile / Logout

---

# 3. EXCLUDED FROM MVP

Do NOT implement:

- Chat
- Parent module
- Payments
- Invoices
- Marketing
- Live streaming
- Photo gallery
- Announcements/news feed
- Native Android app
- Native iOS app

Do not reproduce menu items from visual mockups that conflict with these exclusions.

For example, do not add invoice, chat/message, or announcement modules simply because they appear in a visual reference.

---

# 4. FUTURE / POST-MVP FEATURES

The architecture should not block these, but they are NOT part of MVP unless explicitly requested later:

- QR-code attendance
- push notifications
- PDF exports
- Excel exports
- advanced competition calendar
- automated cloud backup workflow
- audit log / change history
- advanced student/group search and filtering
- installable PWA behavior
- offline mode

Do not implement these prematurely.

---

# 5. TECHNOLOGY STACK

## Frontend

- React
- Vite
- JavaScript
- React Router
- CSS
- CSS custom properties for design tokens
- Supabase JavaScript client

Recommended focused dependencies:

- `react-router-dom`
- `@supabase/supabase-js`
- `@tanstack/react-query`
- `react-hook-form`
- `zod`
- `@hookform/resolvers`
- `date-fns`
- `lucide-react`

Avoid adding dependencies when a small internal utility is sufficient.

## Backend platform

Supabase:

- PostgreSQL
- Auth
- RLS
- SQL migrations
- Edge Functions for privileged operations

## Hosting

Netlify:

- static React/Vite production build;
- SPA fallback routing;
- environment variables;
- preview deployments.

---

# 6. HIGH-LEVEL ARCHITECTURE

```text
Browser
   |
   v
React + Vite
Hosted on Netlify
   |
   | Supabase client using public anon key
   v
Supabase
   |
   +-- Auth
   |
   +-- PostgreSQL
   |    +-- relational domain model
   |    +-- constraints
   |    +-- RLS
   |    +-- views/RPC where useful
   |
   +-- Edge Functions
        +-- privileged user administration
        +-- operations requiring service-role privileges
```

There is no standalone Spring Boot backend in MVP.

---

# 7. FRONTEND PROJECT STRUCTURE

Use a feature-oriented structure.

```text
src/
  app/
    App.jsx
    router.jsx
    queryClient.js

  components/
    ui/
    layout/
    feedback/
    forms/

  features/
    auth/
    dashboard/
    calendar/
    groups/
    students/
    trainers/
    rooms/
    attendance/
    competitions/
    tasks/
    reports/
    settings/

  hooks/

  services/
    supabaseClient.js

  utils/
    dates.js
    permissions.js
    validation.js

  styles/
    tokens.css
    globals.css
    layout.css

supabase/
  migrations/
  functions/
    admin-users/

docs/
  REQUIREMENTS.md
  ARCHITECTURE.md
  DATABASE.md
  SECURITY.md
  DESIGN_SYSTEM.md
  IMPLEMENTATION_PLAN.md
  IMPLEMENTATION_STATUS.md
```

Do not create dozens of generic abstractions before they are needed.

---

# 8. DESIGN SYSTEM

The dark/orange Insane Dance Center references are the visual source of truth.

## Core visual direction

- dark interface;
- black/dark graphite background;
- orange primary accent;
- modern/street-dance visual identity;
- minimal interface;
- strong readability;
- rounded cards;
- line-style icons;
- mobile-first.

## Design tokens

Start with these values and centralize them in `tokens.css`.

```css
:root {
  --color-primary: #ff8a00;
  --color-primary-light: #ffb347;
  --color-primary-dark: #e66a00;

  --color-bg: #0f1115;
  --color-surface: #16181d;
  --color-surface-elevated: #1b1e24;
  --color-border: #23262d;

  --color-text: #ffffff;
  --color-text-muted: #a9adb5;

  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

Fine-tuning visual values against the supplied mockups is allowed.

## Typography

Use **Poppins**.

Suggested scale:

- H1: 24 / 32, bold
- H2: 20 / 28, semibold
- H3: 16 / 24, semibold
- Body: 14 / 20
- Caption: 12 / 16

## UX principles

- Phone first
- Simple navigation
- Important actions reachable with very few interactions
- No unnecessary functions
- Existing information should be reused rather than re-entered
- Clear loading, empty, success, warning, and error states
- Forms should preserve unsaved data when validation fails

---

# 9. RESPONSIVE NAVIGATION

## Mobile

Use bottom navigation based on the latest dark mockup:

1. Home
2. Calendar
3. Groups
4. Students
5. More

This is an intentional design decision even though the initial requirements document listed four bottom-navigation items.

`More` contains:

- Attendance
- Competitions
- Tasks
- Reports (admin only)
- Trainers (admin only)
- Rooms (admin only)
- Users (admin only)
- Settings
- Profile
- Logout

## Desktop

Use:

- persistent left sidebar;
- top page header;
- main content area;
- responsive content widths.

Do not display a mobile phone frame in the actual product.

---

# 10. AUTHENTICATION

The application is invite-only.

## Rules

- No public self-registration.
- Users authenticate through Supabase Auth.
- Supported MVP auth:
  - email/password;
  - reset password.
- Admin creates/invites trainer accounts.
- User role is stored in application data and enforced with RLS.

## Privileged user creation

Creating or deleting Supabase Auth users must NOT be performed directly from browser code with the service-role key.

Implement a secure server-side function, preferably:

```text
supabase/functions/admin-users/
```

Responsibilities:

- verify caller is an authenticated admin;
- create/invite user;
- update permitted account metadata;
- disable/delete account when requested;
- never return or expose service-role credentials.

---

# 11. DATABASE CONVENTIONS

Use:

- UUID primary keys;
- `created_at timestamptz`;
- `updated_at timestamptz`;
- lowercase snake_case;
- foreign keys everywhere relationships exist;
- database constraints for invariants whenever practical;
- UTC storage for timestamps;
- school timezone from settings for display/business interpretation.

Default school timezone for initial setup may be `Europe/Bucharest`, but store this as configuration rather than scattering it through the code.

---

# 12. ENUMS

Recommended PostgreSQL enums:

```text
user_role:
- admin
- trainer

student_status:
- active
- trial
- inactive

schedule_entry_type:
- class
- workshop
- meeting
- event
- unavailable

schedule_status:
- scheduled
- completed
- cancelled

attendance_status:
- present
- absent
- recovery

competition_status:
- upcoming
- active
- completed
- cancelled

task_status:
- todo
- in_progress
- done
- cancelled
```

Do not add enum values casually once production data exists; migrations must be deliberate.

---

# 13. CORE DATA MODEL

## 13.1 profiles

Application identity linked to Supabase Auth.

```text
profiles
--------
id uuid PK -> auth.users.id
full_name text not null
role user_role not null
active boolean not null default true
created_at timestamptz
updated_at timestamptz
```

A profile is an application user.

---

## 13.2 trainers

Represents a trainer as a school/domain entity.

A trainer may optionally be linked to a login profile.

```text
trainers
--------
id uuid PK
profile_id uuid UNIQUE nullable -> profiles.id
first_name text not null
last_name text not null
phone text nullable
email text nullable
notes text nullable
active boolean not null default true
created_at timestamptz
updated_at timestamptz
```

Why separate `trainers` from `profiles`:

- a trainer is a business entity;
- a login account is an authentication identity;
- it permits trainer records before/without login;
- an administrator could also be represented as a trainer if needed.

---

## 13.3 students

```text
students
--------
id uuid PK
first_name text not null
last_name text not null
phone text nullable
email text nullable
birth_date date nullable
notes text nullable
status student_status not null default 'active'
created_at timestamptz
updated_at timestamptz
```

Administrator must have an explicit **permanent delete** action.

Permanent delete must require strong confirmation because related membership/attendance data may also be removed depending on FK behavior.

Normal operational removal should generally use `status = inactive`.

---

## 13.4 rooms

```text
rooms
-----
id uuid PK
name text UNIQUE not null
description text nullable
active boolean not null default true
created_at timestamptz
updated_at timestamptz
```

Examples:

- Sala 1
- Sala 2

---

## 13.5 groups

```text
groups
------
id uuid PK
name text UNIQUE not null
category text nullable
level text nullable
default_room_id uuid nullable -> rooms.id
description text nullable
active boolean not null default true
created_at timestamptz
updated_at timestamptz
```

Do NOT store `student_count` as a duplicated field.

Calculate it from membership.

Do NOT store a free-text duplicated "program" when schedule entries are the source of truth.

---

# 14. MANY-TO-MANY RELATIONSHIPS

`N:M` means **many-to-many**.

## 14.1 Students <-> Groups

A student can belong to multiple groups.

A group can contain multiple students.

```text
student_groups
--------------
student_id uuid -> students.id
group_id uuid -> groups.id
joined_on date nullable
left_on date nullable
created_at timestamptz

PK (student_id, group_id)
```

---

## 14.2 Trainers <-> Groups

A trainer can teach multiple groups.

A group can have multiple trainers.

```text
group_trainers
--------------
group_id uuid -> groups.id
trainer_id uuid -> trainers.id
is_primary boolean not null default false
created_at timestamptz

PK (group_id, trainer_id)
```

Business rule:

- zero or one trainer may be marked primary per group;
- multiple assistant/additional trainers are allowed.

---

## 14.3 Competitions <-> Groups

A competition can involve many groups.

A group can participate in many competitions.

```text
competition_groups
------------------
competition_id uuid -> competitions.id
group_id uuid -> groups.id

PK (competition_id, group_id)
```

---

# 15. SCHEDULE / CALENDAR MODEL

The calendar is a core module.

Use concrete schedule entries.

```text
schedule_entries
----------------
id uuid PK
title text not null
entry_type schedule_entry_type not null
group_id uuid nullable -> groups.id
trainer_id uuid nullable -> trainers.id
room_id uuid nullable -> rooms.id
starts_at timestamptz not null
ends_at timestamptz not null
status schedule_status not null default 'scheduled'
is_extra boolean not null default false
notes text nullable
created_by uuid -> profiles.id
created_at timestamptz
updated_at timestamptz
```

Rules:

- `ends_at > starts_at`
- normal dance classes should have:
  - group;
  - trainer;
  - room;
  - time interval.
- non-class activities may omit one of those references if appropriate.
- cancelled items remain visible where useful but do not block schedule conflicts.

## Recurring classes

For MVP, recurring creation may generate concrete weekly `schedule_entries` across a selected date range.

Do NOT build a complex recurrence engine unless needed.

Example admin action:

```text
Create weekly class
Monday
18:00-19:30
Group: Insane Crew
Trainer: Dari
Room: Sala 1
Repeat until: <date>
```

The UI creates the concrete future entries.

This keeps:

- attendance simple;
- exceptions simple;
- cancellations simple;
- reporting simple.

---

# 16. SCHEDULE CONFLICT DETECTION

The system must prevent overlapping use of:

1. the same room;
2. the same trainer.

Conflict detection must exist at the database level, not just through a frontend warning.

Recommended PostgreSQL approach:

- enable `btree_gist`;
- use exclusion constraints based on:
  - `room_id`;
  - `trainer_id`;
  - `tstzrange(starts_at, ends_at, '[)')`.

Conceptually:

```sql
EXCLUDE USING gist (
  room_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
)
WHERE (status <> 'cancelled' AND room_id IS NOT NULL);
```

and separately for `trainer_id`.

Use `[)` semantics so:

```text
17:00-18:00
18:00-19:00
```

do NOT conflict.

The frontend must catch constraint failures and display a readable message such as:

```text
Sala 1 is already occupied between 18:00 and 19:00.
```

or:

```text
Trainer Dari already has another activity during this interval.
```

Never rely only on a "check then insert" client flow because concurrent requests could bypass it.

---

# 17. ATTENDANCE MODEL

Attendance is linked to actual scheduled class occurrences.

```text
attendance_records
------------------
id uuid PK
schedule_entry_id uuid -> schedule_entries.id
student_id uuid -> students.id
status attendance_status not null
notes text nullable
marked_by uuid -> profiles.id
marked_at timestamptz not null
created_at timestamptz
updated_at timestamptz

UNIQUE (schedule_entry_id, student_id)
```

Only students associated with the scheduled group should be selectable for attendance.

The UI must support the requested monthly matrix:

```text
             01   03   05   08   10 ...
Student A     P    P    A    P    R
Student B     P    A    P    P    P
Student C     R    P    P    A    P
```

Statuses:

- Present
- Absent
- Recovery

Statistics are calculated from attendance records.

Do not duplicate monthly totals into mutable columns unless profiling later proves this necessary.

---

# 18. COMPETITIONS

```text
competitions
------------
id uuid PK
name text not null
location text nullable
starts_on date not null
ends_on date nullable
status competition_status not null
notes text nullable
created_at timestamptz
updated_at timestamptz
```

Groups are associated through `competition_groups`.

Admin:

- create;
- edit;
- delete;
- associate groups.

Trainer:

- read-only access to competitions involving groups assigned to them.

---

# 19. TASKS

```text
tasks
-----
id uuid PK
title text not null
description text nullable
assigned_to uuid nullable -> profiles.id
due_at timestamptz nullable
status task_status not null default 'todo'
created_by uuid -> profiles.id
created_at timestamptz
updated_at timestamptz
```

Admin:

- full CRUD.

Trainer:

- sees tasks assigned to own profile.

The original requirement explicitly confirms viewing assigned tasks but does not clearly grant trainers editing rights.

Therefore MVP default:

- trainer tasks are read-only;
- admin updates task state.

If product owner later confirms trainers should mark their own tasks complete, add a narrowly scoped RLS update policy.

---

# 20. SCHOOL SETTINGS

Use a small settings table.

```text
school_settings
---------------
id uuid PK
school_name text not null
timezone text not null
phone text nullable
email text nullable
address text nullable
updated_at timestamptz
```

For MVP one active row is enough.

Admin may edit.

Trainer may read only what is needed.

---

# 21. RELATIONSHIP SUMMARY

```text
auth.users
   1
   |
   1
profiles
   |
   | 0..1
   v
trainers

students N --- M groups
        student_groups

trainers N --- M groups
        group_trainers

competitions N --- M groups
             competition_groups

groups    1 --- N schedule_entries
trainers  1 --- N schedule_entries
rooms     1 --- N schedule_entries

schedule_entries 1 --- N attendance_records
students         1 --- N attendance_records

profiles 1 --- N tasks (assigned_to)
profiles 1 --- N tasks (created_by)
```

---

# 22. RLS / AUTHORIZATION MODEL

RLS must be enabled on every application table containing non-public data.

Create reusable SQL helper functions carefully.

Examples:

```text
is_admin()
current_trainer_id()
trainer_has_group(group_id)
trainer_owns_schedule_entry(schedule_entry_id)
```

Security-definer functions must:

- use explicit `search_path`;
- expose only required behavior;
- not allow privilege escalation.

## Permission matrix

| Resource | Admin | Trainer |
|---|---|---|
| Own profile | Full | Read/update allowed profile fields |
| Users | Full | No |
| Trainers | Full | Own trainer record / limited read |
| Students | Full | Read students in own groups |
| Groups | Full | Read own groups |
| Memberships | Full | Read own-group memberships |
| Rooms | Full | Read |
| Schedule | Full CRUD | Read relevant entries |
| Attendance | Full | Read/write for own class/group |
| Competitions | Full CRUD | Read competitions for own groups |
| Tasks | Full CRUD | Read assigned tasks |
| Reports | Full | No global reports |
| Settings | Full | Limited read |

Frontend navigation must reflect permissions, but RLS remains authoritative.

---

# 23. ROUTES

Recommended routes:

```text
/login

/app
/app/dashboard
/app/calendar

/app/groups
/app/groups/:groupId

/app/students
/app/students/:studentId

/app/attendance
/app/attendance/:groupId

/app/competitions
/app/competitions/:competitionId

/app/tasks

/app/trainers
/app/trainers/:trainerId

/app/rooms

/app/reports

/app/users
/app/settings
/app/profile
```

Admin-only routes:

- trainers management;
- rooms management;
- global reports;
- users;
- school settings.

Use route guards for UX, while RLS provides real security.

---

# 24. DASHBOARD

## Administrator dashboard

Show:

- today's activities;
- active groups;
- active students;
- today's attendance percentage;
- next activity;
- quick task list;
- upcoming competitions;
- attention items.

Do NOT include an announcements/news feed.

Attention items can be derived from real data, such as:

- overdue tasks;
- upcoming competition;
- missing attendance for completed class;
- inactive/unlinked account conditions where relevant.

Do not invent a social/news module.

## Trainer dashboard

Show only trainer-relevant data:

- today's own classes;
- next class;
- assigned tasks;
- own groups;
- relevant upcoming competitions;
- attendance actions requiring attention.

---

# 25. CALENDAR UX

The white reference image provides functional inspiration only.

The final calendar must use the dark/orange Insane design system.

## Views

Required:

- Day
- Week

## Filters

Provide practical filters:

- trainer;
- group;
- room;
- type.

Admin sees all values.

Trainer filters are restricted to data they may access.

## Desktop behavior

A useful day view may show rooms as columns:

```text
           Sala 1          Sala 2
17:00      Class A         Class C
18:00      Class B         Class D
...
```

## Mobile behavior

Do not squeeze multiple room columns into an unreadable width.

Use one of:

- selected room + horizontal room switcher;
- vertically stacked room sections;
- horizontally scrollable room columns when usable.

Prioritize readability and fast actions.

## Calendar entry interaction

Admin:

- tap/click -> details;
- create;
- edit;
- cancel/delete.

Trainer:

- tap/click -> read details;
- navigate to attendance if authorized.

---

# 26. GROUPS

## Group list

Display:

- name;
- category;
- level;
- trainers;
- default room;
- schedule summary;
- active student count.

## Group detail

Tabs/sections:

1. Overview
2. Students
3. Schedule
4. Attendance history

Admin actions:

- edit group;
- manage trainers;
- manage students;
- deactivate/delete.

Trainer:

- read own group information;
- access students;
- access relevant schedule and attendance.

---

# 27. STUDENTS

## Student list

Display/search:

- first name;
- last name;
- status;
- groups;
- phone/email where appropriate.

Use filters:

- status;
- group.

Advanced filtering can remain post-MVP.

## Student detail

Show:

- first name;
- last name;
- phone;
- email;
- date of birth;
- notes;
- status;
- group memberships;
- attendance summary.

Admin:

- create/edit;
- assign to groups;
- change status;
- permanent delete with explicit confirmation.

Trainer:

- read only if student belongs to one of trainer's groups.

---

# 28. ATTENDANCE UX

Required core UI:

- select group;
- select month;
- table/matrix;
- students vertically;
- class dates horizontally;
- status per cell;
- automatic statistics.

For narrow mobile screens:

- sticky student-name column;
- horizontally scrollable dates;
- sticky date header where practical.

Trainer must only be able to modify attendance for authorized sessions/groups.

Admin can modify all.

---

# 29. COMPETITIONS UX

Competition list/card:

- name;
- date;
- location;
- status;
- participating groups.

Competition detail:

- all above fields;
- notes;
- associated groups.

Dashboard should surface near-future competitions.

---

# 30. TASK UX

Task fields:

- title;
- description;
- responsible user;
- deadline;
- status.

Admin dashboard should show urgent/current tasks.

Trainer dashboard should show tasks assigned to the current trainer account.

Do not implement chat/comments on tasks in MVP.

---

# 31. REPORTS

Admin-only.

Required reporting areas:

- total/active students;
- attendance;
- group activity;
- useful summary statistics.

MVP reports should be generated from live database queries.

Possible filters:

- date range;
- group;
- trainer where meaningful.

PDF/Excel export is post-MVP.

Do not build a BI platform.

---

# 32. SEARCH

MVP search can be focused and local to modules.

At minimum:

- students by name;
- groups by name;
- trainers by name.

Global search is optional.

Advanced filtering is future scope.

---

# 33. FORMS & VALIDATION

All forms should:

- display inline validation;
- disable duplicate submits;
- show saving state;
- show success/error feedback;
- preserve user-entered data after validation errors.

Examples:

- email format;
- end time after start time;
- required title/name fields;
- valid date ranges;
- unique room/group names where required.

Database errors must be translated into user-readable messages.

Never expose raw SQL/Postgres errors directly in UI.

---

# 34. DATA FETCHING

Use TanStack Query for server state.

Guidelines:

- one query-key namespace per feature;
- invalidate only relevant queries after mutations;
- avoid manual global state for database rows;
- Auth/session state may use React Context/provider.

Do not introduce Redux for MVP.

---

# 35. LOADING / EMPTY / ERROR STATES

Every server-backed screen must define:

- loading state;
- empty state;
- error state;
- normal state.

Examples:

```text
No groups have been created yet.
No classes scheduled for today.
No tasks assigned to you.
No attendance data for this month.
```

Avoid blank screens.

---

# 36. ACCESSIBILITY

Minimum expectations:

- semantic buttons/links;
- keyboard access;
- visible focus;
- meaningful labels;
- form labels;
- sufficient contrast;
- touch targets suitable for phone use;
- icons should not be the only indication of important state.

---

# 37. SECURITY REQUIREMENTS

Mandatory:

- RLS enabled;
- anon key only in frontend;
- service-role only server-side;
- no secrets committed;
- `.env` ignored;
- validate privileged calls server-side;
- verify admin role in privileged Edge Functions;
- no authorization based only on route visibility;
- no raw user-controlled SQL;
- sanitize/validate inputs appropriately.

Add `.env.example`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Privileged secrets belong in Supabase/Netlify server-side secret configuration, never `VITE_*`.

---

# 38. NETLIFY

Expected build configuration:

```text
Build command: npm run build
Publish directory: dist
```

Configure SPA fallback:

```text
/* /index.html 200
```

Use either:

- `public/_redirects`, or
- `netlify.toml`.

Never hardcode production URLs in source.

---

# 39. ENVIRONMENTS

Prefer:

- local development;
- production;
- optional preview/staging as project grows.

Do not use production data for automated tests.

Seed/demo data should be clearly separated from production migrations.

---

# 40. TESTING STRATEGY

Use:

- Vitest
- React Testing Library

Prioritize tests for:

- auth route guards;
- role-based visible actions;
- form validation;
- schedule conflict error handling;
- attendance status changes;
- key data transformations.

Database/security tests must cover at least:

1. trainer cannot read unrelated groups;
2. trainer cannot read unrelated students;
3. trainer cannot alter schedule;
4. trainer can modify authorized attendance;
5. trainer cannot modify unauthorized attendance;
6. admin can manage all required records;
7. overlapping room schedule is rejected;
8. overlapping trainer schedule is rejected;
9. adjacent non-overlapping entries are accepted.

RLS tests are more important than pixel-perfect component tests.

---

# 41. MVP MILESTONES

Do not implement future milestones before the current one passes its acceptance criteria.

---

## MILESTONE 0 — Repository foundation

Create:

- React/Vite project;
- dependencies;
- folder structure;
- linting;
- environment template;
- React Router;
- Query Client;
- base CSS/tokens;
- Netlify SPA configuration;
- documentation skeleton.

### Acceptance criteria

- `npm install` succeeds;
- `npm run dev` starts;
- `npm run build` succeeds;
- navigation shell renders;
- no business data is hardcoded as production behavior.

---

## MILESTONE 1 — Design system + application shell

Implement:

- Poppins;
- color tokens;
- buttons;
- inputs;
- cards;
- badges;
- modal/dialog primitive;
- loading/error/empty components;
- mobile bottom navigation;
- desktop sidebar;
- top header;
- responsive layout.

Use supplied Insane mockups as visual reference.

### Acceptance criteria

- looks coherent with dark/orange reference;
- phone layout usable at ~360px width;
- desktop layout usable at common widths;
- no white-calendar visual styling copied.

---

## MILESTONE 2 — Supabase foundation + authentication

Implement:

- initial SQL migrations;
- enums;
- tables;
- relationships;
- updated-at handling;
- Supabase client;
- login;
- logout;
- session restore;
- password reset;
- route guards;
- initial admin bootstrap strategy.

### Acceptance criteria

- admin login works;
- trainer login works;
- unauthenticated user cannot access `/app/*`;
- role available to UI;
- no service-role key in browser bundle.

---

## MILESTONE 3 — RLS + secure user administration

Implement:

- helper authorization functions;
- RLS policies;
- secure admin user Edge Function;
- Users page for admin.

### Acceptance criteria

Run security tests demonstrating role isolation.

Do not proceed until trainer access to unrelated records is proven blocked at database level.

---

## MILESTONE 4 — Trainers, Rooms, Groups, Students

Implement CRUD in this order:

1. trainers
2. rooms
3. groups
4. trainer/group assignment
5. students
6. student/group assignment

Implement detail screens.

### Acceptance criteria

- admin CRUD works;
- trainer sees only authorized groups/students;
- many-to-many relationships work;
- counts are derived correctly;
- forms have validation and feedback.

---

## MILESTONE 5 — Calendar / Schedule

Implement:

- day view;
- week view;
- filters;
- create activity;
- edit activity;
- cancel/delete activity;
- optional bulk weekly creation;
- room conflict protection;
- trainer conflict protection;
- responsive mobile behavior.

### Acceptance criteria

- overlapping room booking rejected;
- overlapping trainer booking rejected;
- back-to-back events accepted;
- trainer schedule is read-only;
- calendar uses Insane dark theme.

---

## MILESTONE 6 — Attendance

Implement:

- group/month selection;
- monthly matrix;
- present/absent/recovery;
- persistence;
- permission enforcement;
- statistics;
- group attendance history.

### Acceptance criteria

- one attendance record per student/session;
- trainer can edit only authorized attendance;
- admin can edit all;
- monthly table remains usable on phone.

---

## MILESTONE 7 — Tasks + Competitions

Implement task CRUD and competition CRUD.

Implement competition/group association.

Integrate relevant items into dashboard.

### Acceptance criteria

- admin manages both modules;
- trainer sees assigned tasks;
- trainer sees relevant competitions;
- no excluded chat/announcement functionality added.

---

## MILESTONE 8 — Dashboard + Reports

Replace placeholders with live queries.

Implement:

- today's activities;
- active groups;
- active students;
- attendance summary;
- next activity;
- quick tasks;
- upcoming competition;
- attention items;
- admin reports.

### Acceptance criteria

- zero hardcoded KPI values;
- role-specific dashboards;
- reports match underlying records.

---

## MILESTONE 9 — Production hardening + Netlify

Perform:

- responsive QA;
- accessibility pass;
- security review;
- RLS re-test;
- error-state review;
- loading-state review;
- production build;
- Netlify deployment;
- environment configuration;
- basic production smoke test.

### Acceptance criteria

- production site loads directly on nested routes;
- auth survives refresh;
- restricted data remains inaccessible;
- no secrets exposed;
- no console-breaking errors;
- primary mobile workflows work end-to-end.

---

# 42. MVP USER FLOWS

## Admin — create a new group

```text
Login
-> Groups
-> Add Group
-> enter details
-> assign room
-> assign one or more trainers
-> Save
-> optionally add students
-> optionally create schedule
```

## Admin — add student

```text
Students
-> Add Student
-> enter details/status
-> Save
-> assign one or more groups
```

## Admin — schedule class

```text
Calendar
-> Add
-> Class
-> select group
-> select trainer
-> select room
-> date/start/end
-> Save

Database validates trainer and room conflict.
```

## Trainer — mark attendance

```text
Login
-> Dashboard / Calendar
-> class
-> Attendance
-> mark students
-> Save
```

## Admin — competition

```text
Competitions
-> Add
-> name/location/date/status/notes
-> select groups
-> Save
```

## Admin — task

```text
Tasks
-> Add
-> title/description/responsible/deadline/status
-> Save
```

---

# 43. IMPORTANT PRODUCT DECISIONS / ASSUMPTIONS

These decisions resolve areas not fully specified in the original requirement document.

### A. Web instead of Android/iOS

Final decision:

**responsive web app**.

Native apps are not part of this project.

### B. Mobile navigation

Use the five-item navigation shown in the latest dark mockup:

- Home
- Calendar
- Groups
- Students
- More

### C. Visual references

- dark/orange mockups = visual source;
- white calendar = functional inspiration only.

### D. Group-to-trainer relation

Many-to-many.

A group can have multiple trainers.

A trainer can have multiple groups.

### E. Student-to-group relation

Many-to-many.

### F. Competition-to-group relation

Many-to-many.

### G. One trainer per concrete scheduled entry

Although a group can have multiple trainers, one concrete `schedule_entry` has one responsible trainer in MVP.

This keeps:

- responsibility clear;
- attendance authorization clear;
- trainer conflict validation enforceable.

If co-teaching per single session is needed later, extend with a `schedule_entry_trainers` junction table.

### H. Trainer task editing

Original requirements clearly grant trainers task visibility but do not explicitly grant editing.

MVP default: read-only for trainer.

### I. Announcements

Omitted even though a mockup visually contains an announcement area, because the functional requirements explicitly exclude announcements.

### J. Schedule recurrence

MVP may use bulk generation of concrete weekly occurrences rather than a complex recurrence engine.

---

# 44. DATA THAT MUST NOT BE DUPLICATED

Avoid fields like:

- `groups.student_count`;
- textual duplicated schedule in `groups`;
- manually maintained attendance percentage;
- manually maintained report totals.

Derive these values from relational source data.

This prevents stale data.

---

# 45. PERFORMANCE EXPECTATIONS

This is an internal studio application, so optimize for correctness and usability before premature scale engineering.

Still:

- index foreign keys;
- index common filters;
- index `starts_at`;
- index status fields when useful;
- index junction-table foreign keys;
- paginate long student lists if needed;
- avoid N+1 query patterns;
- fetch only fields needed by list screens.

Do not introduce microservices.

---

# 46. AGENT WORKFLOW

For every milestone, the coding agent must follow this process:

### Step 1 — Inspect

Read:

- this master plan;
- current repository;
- existing migrations;
- `IMPLEMENTATION_STATUS.md`.

### Step 2 — Plan

Before coding, state:

- goal;
- files to create/change;
- migrations required;
- dependencies required;
- risks/assumptions.

### Step 3 — Implement

Implement only the current milestone.

Do not refactor unrelated areas.

### Step 4 — Verify

Run:

```bash
npm run lint
npm test
npm run build
```

and any Supabase/database tests relevant to the milestone.

### Step 5 — Report

Return:

- what changed;
- migrations added;
- tests run;
- remaining warnings;
- next recommended milestone.

### Step 6 — Update status

Update:

```text
docs/IMPLEMENTATION_STATUS.md
```

with completed work and decisions.

---

# 47. AGENT PROHIBITIONS

The agent must NOT:

- convert project to TypeScript without approval;
- migrate from Vite to Next.js;
- replace CSS with Tailwind without approval;
- introduce a separate Java/Spring backend;
- expose service-role credentials;
- disable RLS to make queries easier;
- implement admin permissions only in React;
- create native mobile projects;
- implement excluded modules;
- copy the white calendar's visual design;
- hardcode sample KPI values after backend integration;
- silently change table relationships;
- silently add paid third-party services;
- rewrite already-applied migrations;
- build all milestones at once.

---

# 48. DEFINITION OF MVP DONE

The MVP is complete when an administrator can:

1. log in;
2. manage trainers;
3. manage rooms;
4. manage groups;
5. manage students;
6. assign trainers to groups;
7. assign students to groups;
8. create and manage the schedule;
9. receive blocking feedback for trainer/room conflicts;
10. record/manage attendance;
11. manage competitions;
12. manage tasks;
13. view live dashboard information;
14. view reports;
15. manage users/settings.

And when a trainer can:

1. log in;
2. see only authorized groups;
3. see students in those groups;
4. see relevant schedule;
5. enter authorized attendance;
6. see assigned tasks;
7. see relevant competition information.

And all of this is:

- responsive;
- usable on mobile;
- visually aligned with Insane Dance Center;
- deployed on Netlify;
- backed by Supabase/PostgreSQL;
- protected by RLS;
- free of exposed privileged secrets.

---

# 49. FIRST IMPLEMENTATION COMMAND

When starting from an empty repository, do NOT ask the agent to build the entire product.

Use this instruction:

> Read `docs/MASTER_IMPLEMENTATION_V1.md` completely. Treat it as the authoritative product and architecture specification. Implement **Milestone 0 only**. Before modifying files, inspect the repository and provide a concise implementation plan. Do not implement later milestones. Do not change any locked technology decision. After implementation, run lint, tests if configured, and the production build, then summarize all changed files and update `docs/IMPLEMENTATION_STATUS.md`.

After review, continue with Milestone 1, then Milestone 2, and so on.

---

# 50. SOURCE REQUIREMENTS SUMMARY

The plan above is based on the supplied Insane Dance Center requirements and visual references.

Core source requirements preserved:

- internal-only management application;
- administrator and trainer roles;
- dashboard;
- day/week schedule;
- room/trainer conflict detection;
- groups;
- group details;
- students and statuses;
- monthly attendance matrix;
- competitions;
- tasks;
- reports;
- settings;
- PostgreSQL-oriented relational structure;
- future QR/push/export/audit possibilities;
- intentionally excluded chat/gallery/parents/payments/invoices/marketing/live streaming/announcements.

The implementation plan intentionally changes only the earlier platform decision from native Android+iOS to a responsive web application, as agreed by the product owner.
