# Supabase

This folder holds the SQL migrations the Pokémon Booster Opener needs in your
Supabase project.

## One-time setup

1. **Enable Anonymous Sign-Ins**
   Authentication → Providers → Anonymous → toggle on.

2. **Run the migrations**, in order, in the SQL editor:
   - `migrations/0001_init.sql` — creates `public.profiles`, `public.collections`,
     enables RLS, and installs the `on_auth_user_created` trigger that
     auto-creates a profile row whenever a new auth user signs up.

3. **Set the Vite env vars** in `.env.local` at the repo root:

   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

4. **Restart the dev server** so Vite picks up `.env.local`.

## What gets stored

- `profiles` — one row per auth user. Holds `is_anonymous`, `display_name`,
  `created_at`, `last_active`. The frontend bumps `last_active` whenever the
  Supabase store is initialized.
- `collections` — one row per user. The whole collection (entries map +
  per-set stats) lives in a single `jsonb` column. Upserted on every booster.

Both tables have RLS policies so a user can only read/write their own row.

## Verifying it works

Open the browser devtools console with the app running. You should see logs
like:

```
[supabase] client initialized: https://<project>.supabase.co
[supabase] anonymous user signed in: <uuid>
[persistence] Supabase store ready
```

Open boosters; in the Supabase Table Editor, the `collections` row for that
user should update with the new `entries` and `bySet` keys.
