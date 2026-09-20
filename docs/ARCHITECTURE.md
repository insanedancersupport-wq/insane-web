# Architecture

The application is a responsive React/Vite single-page application deployed to Netlify. It will use the Supabase JavaScript client with public environment values for authentication and PostgreSQL access. Row Level Security will authorize all application data access, and privileged user administration will run in a Supabase Edge Function.
