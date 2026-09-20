# Security

- Frontend code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Supabase Row Level Security is the authorization boundary for application data.
- Privileged Supabase Auth operations belong in server-side Edge Functions.
- Secrets must be configured in Supabase or Netlify and must not be committed.
