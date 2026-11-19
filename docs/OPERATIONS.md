# Operations runbook

This runbook covers diagnosis of the deployed Insane Dance Center frontend and its Supabase services. It does not replace database backup or recovery procedures.

## First response

Record the UTC time, affected URL, user-visible symptom, browser, and the Netlify deploy currently serving the site. Do not copy passwords, access tokens, refresh tokens, service-role keys, invitation links, full personal records, or raw request/response payloads into tickets or logs.

Use a private browser window to reproduce authentication problems without changing application data. Check the browser developer console and Network panel only for sanitized status codes, endpoint names, and request timing. Redact email addresses, authorization headers, cookies, query values, and response bodies before sharing diagnostics.

## Identify the failing layer

| Symptom | Likely layer | First checks |
| --- | --- | --- |
| Blank page or "application could not continue" | Frontend runtime | Browser console, Network panel, current Netlify deploy |
| Build failed or deploy is missing | Netlify | Deploy log, build command, publish directory, environment-variable presence |
| Login, logout, reset, or session refresh fails | Supabase Auth or frontend | Browser Network status, Supabase Auth logs, Site URL and redirect configuration |
| Invitation or password setup fails | Edge Function or Auth | Function invocation logs, function response status, Auth logs, configured function secrets |
| Data load or save returns an error | Supabase API/RLS/RPC/database | Browser request status, Supabase Postgres logs, RLS/RPC error context |

Frontend errors are intentionally not collected remotely. Netlify build logs describe builds and deploys, not browser runtime failures.

## Netlify

For a failed build or deploy, open the site in the Netlify dashboard and inspect the failed deploy's deploy log. Verify the configured build command is `npm run build`, the publish directory is `dist`, and required `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables are present without copying their values into tickets.

For a deployed frontend issue, compare the affected URL with the deploy's generated preview URL and inspect the deploy metadata for its commit or deploy identifier. Confirm that `public/_redirects` and `public/_headers` were included in the generated `dist` output.

To roll back the frontend, use Netlify's deploy list to publish a previously successful deploy. Confirm the restored deploy serves the expected commit and test login and protected-route behavior. This changes only the frontend deployment; it does not roll back Supabase migrations or data.

## Supabase

Use the Supabase project dashboard for Auth logs, Edge Function invocation logs, and Postgres logs. Match entries by the UTC time window and function or endpoint name. The Edge Functions return safe client messages; use server-side logs for operational detail rather than exposing database or provider errors to users.

When investigating a data failure, distinguish:

- `401` or `403`: authentication, inactive-account, onboarding, or authorization/RLS path.
- `400` or `409`: validation or domain conflict handled by the application.
- `5xx`: service configuration, Edge Function, RPC, or unexpected server failure.

Do not retry destructive operations blindly. Confirm whether a mutation succeeded before attempting it again, especially for invitations, user administration, schedule changes, and competition results.

## Deployed version and escalation

The application does not currently expose a public build-version screen. Identify the deployed version from the Netlify deploy's commit/deploy metadata and record the affected hostname, deploy identifier, UTC time, browser, route, sanitized status codes, and reproduction steps.

Escalate with sanitized evidence only: symptom, timestamps, route, deploy identifier, browser, relevant status codes, and whether the issue reproduces in a private window. Never include credentials, tokens, cookies, invitation URLs, privileged keys, passwords, or raw personal/database records.
