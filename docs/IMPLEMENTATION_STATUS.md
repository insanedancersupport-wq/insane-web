# Implementation status

## Current milestone

Milestone 2 — Complete (migration review and manual deployment pending)

## Decisions

- The frontend is React + Vite + JavaScript with plain CSS.
- Supabase and Netlify are the approved backend and hosting platforms.
- The supplied dark/orange mobile design references are the visual source for the responsive application shell.
- The browser Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It remains `null` until both are configured.
- The Milestone 2 migration creates the complete approved relational schema, but feature-table browser access remains unavailable until Milestone 3 introduces reviewed RLS policies.
- The only Milestone 2 Data API grant/policy lets authenticated users read their own profile, which is required to restore a session and expose the current role.
- The first administrator is promoted manually through the Supabase Dashboard SQL Editor after their Auth user and default trainer profile exist. Browser-based user administration is deferred to Milestone 3.

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

## Validation

- `npm run lint` passes with two existing Fast Refresh advisory warnings for the auth context module.
- `npm test` passes: 3 test files and 5 tests.
- `npm run build` passes. Vite reports its standard advisory that the current production JavaScript chunk exceeds 500 kB.
- `npx supabase migration list` confirms `20260928234000_initial_foundation.sql` is local only and has not been applied to the linked remote project.

## Known limitations

- No migration has been pushed to Supabase, so remote schema/auth smoke testing has not yet been performed.
- The initial profile trigger assigns the safe `trainer` role. The first administrator must be promoted manually as documented.
- RLS policies and explicit browser privileges for feature data, the secure `admin-users` Edge Function, invitations, and user management are intentionally deferred to Milestone 3.

## Next milestone

Review and manually apply the Milestone 2 migration, bootstrap the first administrator, and smoke-test authentication before beginning Milestone 3 — RLS + secure user administration.
