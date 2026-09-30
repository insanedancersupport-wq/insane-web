# Implementation status

## Current milestone

Milestone 3 — Complete (remote migration and Edge Function deployment pending review)

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
- Added the admin-only `/app/users` UI, with server-side Edge Function mutations and client-side route visibility as a UX complement to database/server authorization.
- Added pgTAP authorization tests and admin-route denial coverage.

## Validation

- `npm run lint` passes with two existing Fast Refresh advisory warnings for the auth context module.
- `npm test` passes: 3 test files and 5 tests.
- `npm run build` passes. Vite reports its standard advisory that the current production JavaScript chunk exceeds 500 kB.
- Manual password-reset smoke test passed: forgot-password requests send an email, reset links reach `/reset-password`, and users can set a new password successfully.
- `npx supabase db lint --local` passes with no schema errors.
- `npx supabase test db --local supabase/tests/rls_policies.sql` passes all 9 pgTAP RLS cases.
- Local `admin-users` Edge Function checks confirm unauthenticated callers receive `401`, trainers receive `403`, inactive admins receive `403`, nonexistent targets receive `404`, and active administrators can invite a user.

## Known limitations

- The initial profile trigger assigns the safe `trainer` role. The first administrator must be promoted manually as documented.
- The Milestone 3 migration and `admin-users` Edge Function have not been applied or deployed to the remote project pending review.
- The Edge Function requires Supabase-managed `SUPABASE_URL` and `SUPABASE_SECRET_KEYS`. Secret keys must remain server-side and must never be configured as a `VITE_*` value.

## Next milestone

Review and manually deploy Milestone 3, including `supabase db push` and `supabase functions deploy admin-users`; retain Edge Function JWT verification, the private helper schema outside Data API schemas, the `SUPABASE_SECRET_KEYS` secret configuration, and public email-signup disablement. Milestone 4 — Trainers, Rooms, Groups, and Students remains pending and has not been started.
