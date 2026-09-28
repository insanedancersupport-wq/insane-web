# Insane Dance Center Copilot Instructions

## Project and workflow

- This is a mobile-first internal management SPA for dance-school administrators and trainers. The approved scope is the MVP modules in `docs/INSANE_DANCE_CENTER_MASTER_IMPLEMENTATION_V1.md`; do not add excluded modules (for example, payments, chat, parent-facing features, marketing, or native apps).
- Treat `docs/INSANE_DANCE_CENTER_MASTER_IMPLEMENTATION_V1.md` as the implementation authority. Implement one milestone at a time, and update `docs/IMPLEMENTATION_STATUS.md` after completing a milestone.
- A completed milestone must pass `npm run lint`, `npm test`, and `npm run build` before its status is updated.
- The locked stack is React 19, Vite, JavaScript/JSX, React Router, TanStack Query, plain CSS, Supabase, and Netlify. Do not introduce another frontend framework, Tailwind, a large UI library, or a standalone backend without explicit approval.

## Commands

```bash
# Start the Vite development server
npm run dev

# Lint JavaScript and JSX
npm run lint

# Run all Vitest tests
npm test

# Run one test file
npm test -- src/app/App.test.jsx

# Create the production build
npm run build
```

Vitest configuration lives in `vite.config.js`: tests run in `jsdom` and load `src/test/setup.js`, which registers `@testing-library/jest-dom` matchers.

## Architecture

- `index.html` loads `src/main.jsx`, which installs global styles and wraps the application in `StrictMode`, the shared TanStack Query `QueryClientProvider`, and React Router's `RouterProvider`.
- Define browser routes centrally in `src/app/router.jsx` with `createBrowserRouter`; do not create feature-local router trees. The current wildcard route renders the application shell in `src/app/App.jsx`.
- Keep responsive navigation in the shared `AppShell`: the mobile shell uses bottom navigation and the desktop shell uses a persistent sidebar. Feature screens belong inside that shell rather than defining their own navigation.
- Use the singleton in `src/app/queryClient.js` for server state. Its defaults intentionally retry once and do not refetch on window focus; do not create feature-local query clients.
- `src/services/supabaseClient.js` is the only current backend client boundary. It exports `supabase` as `null` when public environment values are absent, so features must handle unconfigured local environments explicitly.
- Build new UI in the feature-oriented structure specified by the master plan: feature code under `src/features/`, reusable UI/layout/feedback/form elements under `src/components/`, shared hooks in `src/hooks/`, and domain-neutral helpers in `src/utils/`. Keep business logic out of presentational components.
- Supabase schema changes go in append-only migrations under `supabase/migrations/`. Privileged user-management work belongs in the server-side `supabase/functions/admin-users/` Edge Function, not the browser.

## UI and testing conventions

- Use the dark/orange visual system and CSS custom properties from `src/styles/tokens.css`; keep global foundations in `src/styles/globals.css`. Match the mobile-first responsive model: bottom navigation on mobile and a persistent sidebar on desktop.
- Use Poppins when available, with the existing dark surfaces and orange primary token family rather than introducing a separate visual system.
- Place tests next to the code they cover using `*.test.jsx`. Use React Testing Library and semantic, accessibility-oriented assertions such as `getByRole`, following `src/app/App.test.jsx`.
- ESLint covers `*.js` and `*.jsx`, enforces React Hooks rules, and allows JSX without importing React. `dist` and `coverage` are ignored.

## Supabase and security invariants

- Browser code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, as shown in `.env.example`. Never expose a service-role key or other privileged secret in client code or committed environment files.
- Supabase Row Level Security is the authorization boundary. Frontend visibility or route guards are not authorization, and trainer restrictions must be enforced by PostgreSQL/Supabase RLS.
- Model database tables with UUID primary keys, `created_at`/`updated_at` timestamps, lowercase `snake_case`, foreign keys, and database constraints. Store timestamps in UTC and use the school timezone setting for display.
- Do not duplicate server data in client state. Do not denormalize values such as group student counts or schedules when their relational source is authoritative.
