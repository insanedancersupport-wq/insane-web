# First administrator bootstrap

Apply the migrations before creating the first application user. The `on_auth_user_created` trigger creates a matching `profiles` row with the safe default `trainer` role for every new Supabase Auth user.

1. In Supabase Dashboard, confirm **Authentication > Providers > Email** has public email sign-ups disabled. Create the initial user under **Authentication > Users** with their final email address and a temporary password.
2. In the Supabase SQL Editor, promote only that user's generated profile:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id
     from auth.users
     where email = 'admin@example.com'
   );
   ```

3. Confirm the statement changed exactly one row, then sign in through `/login` and replace the temporary password if required.

This procedure uses the Supabase Dashboard's privileged database access and does not expose a service-role key, secret key, or admin-creation capability to the browser. Trainer invitations and browser-accessible user administration are intentionally deferred to Milestone 3's secured `admin-users` Edge Function.
