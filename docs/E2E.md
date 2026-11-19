# End-to-end testing

Playwright tests live under `e2e/` and use the `.pw.js` suffix. The default command runs only read-only smoke tests across Chromium, Firefox, WebKit, mobile Chromium, and mobile WebKit:

```bash
npm run test:e2e
```

Run discovery without executing tests, all E2E tests, or one browser project with:

```bash
npx playwright test --list
npm run test:e2e:all
npx playwright test e2e/smoke.pw.js --project=chromium
```

Reliability and mobile checks are in `e2e/reliability-mobile.pw.js`. They cover failed and disconnected authentication requests, profile/API failures, logout protection, mobile page overflow, and calendar date/time picker interactions:

```bash
npx playwright test e2e/reliability-mobile.pw.js --project=chromium --project=mobile-chromium
```

The critical Admin/Trainer workflows use the isolated local Supabase stack and are opt-in:

```bash
npx supabase start
E2E_ALLOW_MUTATIONS=true \
E2E_SUPABASE_URL=http://127.0.0.1:54321 \
E2E_SUPABASE_PUBLISHABLE_KEY=... \
E2E_SUPABASE_SERVICE_ROLE_KEY=... \
npx playwright test e2e/critical-flows.pw.js --project=chromium
```

The fixture creates synthetic, run-scoped Admin and Trainer accounts plus students, groups, rooms, schedule entries, tasks, competitions, and related records. Credentials are generated at runtime. Account onboarding uses the existing nonce-gated database trigger; it does not write `onboarding_completed_at` directly. Each fixture removes its dependent records and users after the test. Reset the local database with `npx supabase db reset --local` when recovering from an interrupted run.

The Playwright config starts Vite on `http://127.0.0.1:4173` when `E2E_APP_URL` is not set. Its server environment uses a synthetic local Supabase URL and publishable key, so smoke tests do not connect to a hosted project. Set `E2E_APP_URL` only when intentionally testing an isolated non-production deployment.

The authenticated navigation smoke test seeds a synthetic browser session and intercepts the profile request. It does not create users or write to Supabase.

## Mutating invitation lifecycle test

The invitation lifecycle test is opt-in and requires a running local Supabase stack plus Inbucket. It fails before creating clients unless all of the following are true:

- `E2E_ALLOW_MUTATIONS=true`
- `E2E_APP_URL` is a local URL served by the separately running Vite app
- `E2E_SUPABASE_URL` points to `localhost`, `127.0.0.1`, or `::1`
- `E2E_SUPABASE_PUBLISHABLE_KEY` is set
- `E2E_SUPABASE_SERVICE_ROLE_KEY` is set

Run it only against the local isolated stack:

```bash
# In a separate terminal, use the same URL as E2E_APP_URL:
npm run dev -- --host 127.0.0.1 --port 3000

E2E_ALLOW_MUTATIONS=true \
E2E_APP_URL=http://127.0.0.1:3000 \
E2E_SUPABASE_URL=http://127.0.0.1:54321 \
E2E_INBUCKET_URL=http://127.0.0.1:54324 \
E2E_SUPABASE_PUBLISHABLE_KEY=... \
E2E_SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:e2e:invitation
```

The test creates uniquely named temporary local users and currently relies on the local Supabase/Inbucket lifecycle. A dedicated hosted non-production project is not enabled by this guard; support for one requires an explicit allowlist and cleanup contract before mutating tests can use it.

## Failure artifacts and browser prerequisites

Screenshots and traces are retained for failed tests. The HTML report is written to `playwright-report/` and can be opened with:

```bash
npx playwright show-report
```

Install the Playwright browser binaries when a project reports that its executable is missing:

```bash
npx playwright install chromium firefox webkit
```

On Linux, WebKit may additionally require:

```bash
sudo apt-get install libavif16
```

The current environment has Chromium available. Firefox is not installed and WebKit/mobile WebKit cannot start until the host dependency above is available, so those projects are reported as blocked rather than silently skipped.
