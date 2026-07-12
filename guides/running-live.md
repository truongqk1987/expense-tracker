# Running the Expense Tracker Live

This guide walks you from a fresh clone to a working app backed by your own
Supabase project. It takes ~10 minutes.

## Prerequisites

- **Node.js** 20+ and **Yarn** (the repo uses `yarn.lock` — don't use npm)
- A free **Supabase** account: https://supabase.com

## 1. Install dependencies

```bash
yarn install
```

## 2. Create a Supabase project

1. Go to https://supabase.com/dashboard and click **New project**.
2. Give it a name, set a database password, and pick a region close to you.
3. Wait for provisioning to finish (~2 minutes).

## 3. Provision the database schema

The repo ships the full schema — the `expenses` table **and** the Row Level
Security policies that keep each user's data private.

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Copy the entire contents of [`supabase/schema.sql`](../supabase/schema.sql)
   into the editor.
3. Click **Run**.

You should see the `expenses` table under **Table Editor**, and under
**Authentication → Policies** four policies scoped to `auth.uid() = user_id`.

> **Why this matters:** RLS is the security backbone. Because every query is
> filtered to the logged-in user at the database level, the client never has to
> pass a `user_id` filter and no custom backend is needed.

## 4. Configure environment variables

1. In the dashboard, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** API key.
3. In the project root, create `.env.local` (already gitignored) — you can copy
   the template:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in your values:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

> The anon key is safe to expose in the browser — RLS is what protects the data,
> not key secrecy. Never put the **service_role** key in a client `.env`.

## 5. Configure auth (email/password)

The app uses email + password sign-up.

1. Go to **Authentication → Sign In / Providers** and make sure **Email** is
   enabled.
2. **For quick local testing**, go to **Authentication → Sign In / Providers →
   Email** and turn **Confirm email** *off*. This lets you sign up and land
   straight in the app without clicking a confirmation link.
   - If you leave confirmation **on**, sign-up will send a verification email and
     redirect you to the login page; confirm via the email, then sign in.

## 6. Run the dev server

```bash
yarn dev
```

Open the printed URL (default http://localhost:5173). You should see the login
screen. Click **Sign up**, create an account, and you'll land on the dashboard.

## 7. Try it out

- Click **Add expense** (top-right on desktop, the floating **+** button on
  mobile) to create an expense.
- Edit or delete via the icons on each row.
- Use the **Filters** panel to narrow by category or date range.
- The summary cards update from cached data as you add expenses.
- Open the app in a second account — you'll see none of the first account's
  expenses, confirming RLS is working.

## Production build

```bash
yarn build      # type-check + build into dist/
yarn preview    # serve the built app locally
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare
Pages, etc.). Set the same two `VITE_SUPABASE_*` variables in the host's
environment settings — they're inlined at build time, so rebuild after changing
them.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Banner: "Supabase isn't configured yet" | `.env.local` is missing or empty. Add both `VITE_*` values and restart `yarn dev`. |
| Env changes not picked up | Vite only reads env at startup — stop and re-run `yarn dev`. |
| Sign-up succeeds but can't log in | Email confirmation is on — confirm via the email, or disable it (step 5). |
| Login works but the list stays empty / errors | The schema/RLS policies didn't run. Re-run `supabase/schema.sql` (step 3). |
| `401` / permission errors on save | You're signed out or RLS policies are missing. Check **Authentication → Policies**. |
| Wrong Supabase project | Double-check the URL/key belong to the project where you ran the schema. |
