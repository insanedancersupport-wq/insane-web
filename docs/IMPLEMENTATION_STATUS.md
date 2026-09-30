# Implementation status

## Current milestone

Milestone 4 — Complete

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

## Validation

- `npm run lint` passes with two existing Fast Refresh advisory warnings for the auth context module.
- `npm test` passes: 5 test files and 8 tests.
- `npm run build` passes. Vite reports its standard advisory that the current production JavaScript chunk exceeds 500 kB.
- Manual password-reset smoke test passed: forgot-password requests send an email, reset links reach `/reset-password`, and users can set a new password successfully.
- `npx supabase db lint --local` passes with no schema errors.
- `npx supabase test db --local supabase/tests/rls_policies.sql` passes all 31 pgTAP RLS, privilege, and relationship-reconciliation cases.
- Local `admin-users` Edge Function checks confirm unauthenticated callers receive `401`, trainers receive `403`, inactive admins receive `403`, nonexistent targets receive `404`, and active administrators can invite a user.
- Remote Milestone 3 smoke test passed: active admins can access user administration and invite users, invited users receive trainer profiles and can authenticate, and trainers are blocked from `/app/users` with “Administrator access required.”

## Known limitations

- The initial profile trigger assigns the safe `trainer` role. The first administrator must be promoted manually as documented.
- The Edge Function requires Supabase-managed `SUPABASE_URL` and `SUPABASE_SECRET_KEYS`. Secret keys must remain server-side and must never be configured as a `VITE_*` value.
- Group membership history and its use by attendance remain intentionally deferred to Milestone 6. The current UI manages only current memberships.

## Next milestone

Milestone 5 — Schedule and calendar management remains pending.
