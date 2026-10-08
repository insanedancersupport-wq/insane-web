# Implementation status

## Current milestone

Milestone 5 — Complete locally; remote migration review/apply pending

## Decisions

- The frontend is React + Vite + JavaScript with plain CSS.
- Supabase and Netlify are the approved backend and hosting platforms.
- The supplied dark/orange mobile design references are the visual source for the responsive application shell.
- The browser Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It remains `null` until both are configured.
- The Milestone 2 migration creates the complete approved relational schema, but feature-table browser access remains unavailable until Milestone 3 introduces reviewed RLS policies.
- The only Milestone 2 Data API grant/policy lets authenticated users read their own profile, which is required to restore a session and expose the current role.
- The first administrator is promoted manually through the Supabase Dashboard SQL Editor after their Auth user and default trainer profile exist. Browser-based user administration is deferred to Milestone 3.
- Milestone 3 uses explicit authenticated table grants combined with RLS policies. Grants alone do not authorize access.
- Milestone 3 authorization helpers are `SECURITY DEFINER` functions in the non-Data-API `private` schema. The schema grants authenticated callers only the usage and helper execution needed for RLS evaluation.
- The `admin-users` Edge Function validates the caller's JWT and independently checks for an active administrator profile before using a server-side client configured from `SUPABASE_SECRET_KEYS`.
- Student-group junction rows represent current membership in Milestone 4. Removing a student from a group deletes the row; the existing `joined_on` and `left_on` columns remain unchanged and have no new historical semantics.
- Group-trainer and student-group changes use reviewed public RPCs so exact-set reconciliation is atomic. The RPCs retain the existing database constraints and do not expose the private RLS helper schema.
- Milestone 5 establishes an authoritative single-row `school_settings` record. The forward-only migration refuses to choose among duplicate settings rows, bootstraps Insane Dance Center with `Europe/Bucharest` only when no row exists, validates the configured IANA timezone, and prevents future duplicate settings rows.
- The follow-up Milestone 5 settings-lifecycle migration prevents deletion of the authoritative settings row, validates every future timezone write against PostgreSQL timezone names, and locks timezone changes once schedule data exists.
- Calendar conversions are centralized in `src/utils/scheduleDateTime.js`. The configured authoritative school timezone controls display and school-local date/time conversion; browser-local date parsing is not used as the conversion authority.
- Calendar entry values that fall in DST spring-forward gaps or fall-back repeated intervals are rejected with actionable feedback. Schedule entries must begin and end on the same local school date.
- Concrete `class` entries require a group, responsible trainer, and room through both frontend validation and the `schedule_entries_class_requires_references` database check. Other entry types may omit those relationships.
- Room and trainer conflicts are enforced by distinct partial PostgreSQL exclusion constraints using half-open `tstzrange` intervals. Cancelled entries do not block slots; adjacent entries remain valid.

## Completed work

- Milestone 0: created the Vite React application with React Router and TanStack Query.
- Added the feature-oriented foundation (`src/app`, `src/services`, `src/styles`, and test setup).
- Added public Supabase environment template, secret-safe git ignores, Netlify SPA redirects, and placeholder Supabase migration/Edge Function directories.
- Added ESLint, Vitest, React Testing Library, a minimal application shell, design tokens, and foundation architecture/security/implementation documentation.
- Milestone 1: added shared buttons, inputs, cards, badges, dialog, and loading/error/empty-state primitives.
- Added a responsive shell with mobile bottom navigation, desktop sidebar, top header, and dark/orange design-system styling.
- Milestone 2: added `supabase/migrations/20260928234000_initial_foundation.sql`, including all approved enums, relational tables, foreign keys, checks, indexes, `updated_at` triggers, the Auth-user profile trigger, and RLS enabled on every application table.
- Added the minimum explicit Data API privileges for `profiles`: authenticated users can select only their own `id`, `full_name`, `role`, and `active` fields. No feature tables have browser grants or RLS policies yet.
- Replaced the retired anon-key environment contract with the Supabase publishable-key model in `.env.example` and the frontend client.
- Added session restoration, profile loading, email/password sign-in, logout, password-reset request and update flows, public-route redirects, and protected `/app/*` routes.
- Kept the Milestone 1 responsive shell and added authenticated profile/role feedback plus sign-out handling.
- Added first-admin bootstrap documentation in `docs/SUPABASE_ADMIN_BOOTSTRAP.md`.
- Added focused tests for Supabase session/profile restoration and protected/public route behavior.
- Milestone 3: added `supabase/migrations/20260929231500_rls_and_secure_user_administration.sql` with private-schema active-user/admin/trainer authorization helpers, explicit helper-function privileges, authenticated table grants, and the approved RLS permission matrix.
- Added RLS policies that limit trainers to their own trainer record, groups, group memberships, students, relevant schedules/competitions, assigned tasks, and attendance for their responsible classes. Inactive users cannot access operational data.
- Added `supabase/functions/admin-users/index.ts` for server-verified administrator invitations, role changes, activation/deactivation, and account deletion.
- Added `supabase/migrations/20260930195000_admin_users_service_role_profiles.sql`, granting the Edge Function's `service_role` only public-schema usage plus `profiles` SELECT and UPDATE access to `full_name`, `role`, and `active`.
- Added the admin-only `/app/users` UI, with server-side Edge Function mutations and client-side route visibility as a UX complement to database/server authorization.
- Added pgTAP authorization tests and admin-route denial coverage.
- Milestone 4: added Trainers, Rooms, Groups, and Students list, create, edit, detail, and operational deactivation experiences using feature-local Supabase APIs, React Hook Form, Zod, and TanStack Query.
- Added the protected routes `/app/trainers`, `/app/trainers/:trainerId`, `/app/rooms`, `/app/groups`, `/app/groups/:groupId`, `/app/students`, and `/app/students/:studentId`, with role-aware navigation that preserves the responsive application shell.
- Added `supabase/migrations/20260930203000_atomic_membership_reconciliation.sql` with admin-only, `SECURITY DEFINER` public RPCs for atomic group-trainer and student-group exact-set reconciliation. Both functions have an empty `search_path`, use schema-qualified relations, call `private.is_admin()`, validate referenced records, and execute atomically.
- Added pgTAP coverage for membership reconciliation authorization, invalid references, primary-trainer validation, rollback behavior, exact-set results, preserved `joined_on`, and removal of current student memberships.
- Added focused frontend API tests verifying that group-trainer and student-group changes invoke their respective reconciliation RPCs.
- Completed the Milestone 4 group-list requirements: cards show assigned trainers, identify the primary trainer, show the default room, and derive active student counts from `student_groups` and `students` without storing a duplicate count.
- Completed the Milestone 4 student-list requirements: cards show current group memberships and support combined status/group filtering.
- Added permanent Student deletion for administrators from Student details. It requires typing `DELETE`, explains related database cascade effects, invalidates relevant queries, and returns to the list with success feedback.
- Updated Trainer profile linking so active and inactive application profiles of either `admin` or `trainer` role can be linked, while the existing unique `profile_id` constraint and `ON DELETE SET NULL` relationship remain authoritative.
- Added actionable feedback for Group and Student saves where scalar data succeeds but subsequent relationship reconciliation fails. The UI does not report full success, refreshes the affected entity data, and directs the administrator to retry assignment through Edit.
- Milestone 5: added `supabase/migrations/20261001223000_schedule_conflicts_and_weekly_creation.sql`. It creates the authoritative school-settings mechanism, validates existing class/conflict data before adding new constraints, enables `btree_gist`, adds named room/trainer exclusion constraints, validates local-day schedule bounds, and creates the authenticated/admin-only `create_weekly_schedule_entries` RPC.
- Added the Calendar route and responsive dark/orange Day and Week views. Desktop Day view uses room-oriented lanes and Week view uses seven columns; mobile uses stacked room lanes and a compact selected-day week strip.
- Added bounded Calendar range queries with trainer/group/room/type filters, relationship display joins, admin create/edit/cancel/delete controls, trainer read-only details, and cancelled-entry presentation.
- Added admin weekly concrete-entry creation through the atomic `create_weekly_schedule_entries` RPC. The RPC uses `SECURITY DEFINER`, an empty `search_path`, schema-qualified references, `private.is_admin()`, the authoritative timezone, caller-derived `created_by`, input/reference validation, and explicit execution grants.
- Added `supabase/migrations/20261001230500_protect_authoritative_school_settings.sql`. It replaces the school-settings admin `FOR ALL` policy with separate admin INSERT/UPDATE policies, leaves active-user reads intact, and uses private-schema triggers to enforce timezone validity, prevent timezone reinterpretation after schedules exist, and reject deletion of the singleton row.

## Validation

- `npm run lint` passes with two existing Fast Refresh advisory warnings for the auth context module.
- `npm test` passes: 14 test files and 40 tests.
- `npm run build` passes. Vite reports its standard advisory that the current production JavaScript chunk exceeds 500 kB.
- Manual password-reset smoke test passed: forgot-password requests send an email, reset links reach `/reset-password`, and users can set a new password successfully.
- `npx supabase db lint --local` passes with no schema errors.
- `npx supabase test db --local supabase/tests/rls_policies.sql` passes all 31 pgTAP RLS, privilege, and relationship-reconciliation cases.
- `npx supabase test db --local supabase/tests/schedule_conflicts.sql` passes all 29 pgTAP calendar cases, including authoritative timezone handling, class completeness, overlap/re-adjacency behavior, cancellation/reactivation, DST invalid-time rejection, RLS-protected bulk creation, and batch rollback.
- `npx supabase test db --local supabase/tests/school_settings_lifecycle.sql` passes all 14 pgTAP settings-lifecycle cases, including RLS and trigger delete protection, singleton enforcement, future timezone validation, timezone locking, and continued schedule writes.
- Milestone 5 migrations `20261001223000_schedule_conflicts_and_weekly_creation.sql` and `20261001230500_protect_authoritative_school_settings.sql` have been applied and tested only in the local Supabase environment. Neither has been pushed or applied to the remote project.
- Local `admin-users` Edge Function checks confirm unauthenticated callers receive `401`, trainers receive `403`, inactive admins receive `403`, nonexistent targets receive `404`, and active administrators can invite a user.
- Remote Milestone 3 smoke test passed: active admins can access user administration and invite users, invited users receive trainer profiles and can authenticate, and trainers are blocked from `/app/users` with “Administrator access required.”
- Remote Milestone 4 smoke test passed: Trainers support create/edit, activation changes, optional profile linking, and profile unlinking on User deletion; Rooms support CRUD and activation changes; Groups support default rooms, multiple trainers, primary-trainer changes, and persisted RPC reconciliation; Students support multiple current memberships, membership removal, and current-group details.
- Final Milestone 4 RLS smoke test passed: a trainer linked only to CataGroup sees only CataGroup and its allowed students, cannot see unrelated groups/students, and does not see Trainers, Rooms, or Users navigation. Existing admin-only user-route denial remains confirmed.
- Remote migration status: `20260930203000_atomic_membership_reconciliation.sql` is operating in the cloud project as confirmed by the successful remote `reconcile_group_trainers` and `reconcile_student_groups` smoke tests. No migration was created for the final Milestone 4 fixes.

## Known limitations

- The initial profile trigger assigns the safe `trainer` role. The first administrator must be promoted manually as documented.
- The Edge Function requires Supabase-managed `SUPABASE_URL` and `SUPABASE_SECRET_KEYS`. Secret keys must remain server-side and must never be configured as a `VITE_*` value.
- Group membership history and its use by attendance remain intentionally deferred to Milestone 6. The current UI manages only current memberships.
- Before remote Milestone 5 use, review and apply both Milestone 5 migrations. The first intentionally stops if duplicate `school_settings`, incomplete existing classes, or existing non-cancelled room/trainer overlaps require manual correction; the second hardens the authoritative settings lifecycle required by Calendar.

## Next milestone

Milestone 5 — Schedule and calendar management is complete locally. Milestone 6 has not started.
