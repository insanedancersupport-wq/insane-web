# Security

- Frontend code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Publishable keys are safe for browser use; service-role keys and other secret keys must remain server-side.
- Supabase Row Level Security is the authorization boundary for application data.
- Privileged Supabase Auth operations belong in server-side Edge Functions.
- Service-role and secret keys must be configured only in Supabase Edge Functions or server-side Netlify configuration and must never be committed or exposed through `VITE_*` variables.
- Netlify currently uses the same Supabase production environment in all deployment contexts. Deploy Previews must not be used for destructive testing against production.
- Isolated hosted preview testing requires a dedicated non-production Supabase project; local E2E mutation tests use the guarded local Supabase environment documented in `docs/E2E.md`.

## Netlify response headers

`public/_headers` applies the baseline production headers:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- A restrictive `Permissions-Policy` disabling unnecessary browser capabilities

The Content Security Policy is currently `Content-Security-Policy-Report-Only`, allowing compatibility validation without blocking the SPA, Supabase connections, or Google Fonts. It does not configure a reporting endpoint, so violations are visible only through browser developer tools. The policy must be validated against the deployed production hostname before enforcement is considered.

HSTS is intentionally not configured in the repository. It should be added only after the canonical production hostname, HTTPS-only behavior, and subdomain policy have been explicitly verified; preload and `includeSubDomains` are not enabled.
