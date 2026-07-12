# Render.com Deployment Plan — Expense Tracker

Deploy the app to **render.com** as a **Static Site** on the default `*.onrender.com` URL.

## Why a Static Site (not a Web Service)

This is a Vite + React 19 SPA. After `yarn build` it is nothing but static files in `dist/`.
All backend work (auth, database) is done by **Supabase** directly from the browser. There is
no Node server to host → use Render's **Static Site** type, which is free and correct for this app.

- **Repo:** https://github.com/truongqk1987/expense-tracker
- **Build:** `yarn build`  (`tsc -b && vite build`)
- **Publish dir:** `dist`
- **Env vars baked at build time:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **URL:** default Render subdomain (e.g. `https://expense-tracker-xxxx.onrender.com`)

---

## Step 0 — Push code to GitHub

Render deploys from a connected Git repo. The local project is **not yet a git repo**, so:

```bash
cd /Users/truongqk2302/Pets/expense-tracker
git init
git branch -M main
git add -A
git status                      # confirm .env.local is NOT listed (it's gitignored)
git commit -m "Initial commit"
git remote add origin https://github.com/truongqk1987/expense-tracker.git
git push -u origin main
```

**Before pushing, confirm secrets are not staged.** `.gitignore` already excludes
`node_modules`, `dist`, and `*.local` (which covers `.env.local`). Never commit real
Supabase credentials — they belong in Render's env-var settings instead.

---

## Step 1 — Add `render.yaml` (infrastructure-as-code)

Commit this file to the repo root so the config is version-controlled instead of only
living in the dashboard. It also encodes the SPA rewrite rule needed for react-router.

```yaml
# render.yaml
services:
  - type: web
    name: expense-tracker
    runtime: static
    buildCommand: yarn build
    staticPublishPath: ./dist
    pullRequestPreviewsEnabled: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: VITE_SUPABASE_URL
        sync: false            # value set in dashboard, never committed to git
      - key: VITE_SUPABASE_ANON_KEY
        sync: false
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

Then:

```bash
git add render.yaml
git commit -m "Add Render static site config"
git push
```

---

## Step 2 — Create the site on Render

1. Sign in at https://dashboard.render.com (sign in with GitHub for easiest repo access).
2. **New → Static Site** (if using `render.yaml`, you can instead use **New → Blueprint**
   and point it at the repo — Render reads `render.yaml` automatically).
3. Connect the `truongqk1987/expense-tracker` repo, branch `main`.
4. If not using the blueprint, set manually:
   - **Build Command:** `yarn build`
   - **Publish Directory:** `dist`
   Render auto-detects `yarn` from `yarn.lock` and runs `yarn install` first.

---

## Step 3 — Set environment variables

In the site's **Environment** tab, add (Static Sites expose only `VITE_`-prefixed vars to the
bundle at build time, so these must exist **before** the build runs):

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<your-anon-public-key>` |
| `NODE_VERSION` | `22` |

Get the URL and anon key from **Supabase Dashboard → Project Settings → API**.
The anon key is *designed* to ship to browsers — it is safe to expose **as long as RLS is on**
(see Step 5). Changing an env var triggers a rebuild, which is required since Vite inlines
these values into the JS bundle.

---

## Step 4 — Deploy

- Trigger the first deploy (automatic on blueprint creation, or **Manual Deploy → Deploy latest commit**).
- Every push to `main` auto-deploys thereafter.
- Watch the build log for a successful `vite build` and a green "Live" status.
- Note the assigned URL: `https://expense-tracker-<hash>.onrender.com`.

---

## Step 5 — Confirm Supabase RLS is enabled (critical)

Because the anon key is public, **Row Level Security is the only thing stopping any visitor from
reading/writing everyone's data.** The repo's `supabase/schema.sql` already enables RLS and adds
correct per-user policies. You must confirm that schema was actually applied to the live project.

### Verify in the dashboard
1. Supabase Dashboard → **Table Editor** → `expenses` table.
2. It should show a shield / **"RLS enabled"** badge. If it says *RLS disabled*, the schema
   was never applied (or was overridden).
3. Supabase Dashboard → **Authentication → Policies** → confirm 4 policies exist on
   `public.expenses` (view / insert / update / delete), each using `auth.uid() = user_id`.

### Or verify with SQL (Dashboard → SQL Editor)
```sql
-- Is RLS turned on?
select relname, relrowsecurity
from pg_class
where relname = 'expenses';          -- relrowsecurity should be true

-- What policies exist?
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'expenses';        -- expect 4 rows
```

### If RLS is NOT enabled
Run the repo's schema (idempotent — safe to re-run) in the **SQL Editor**:

```
Paste and run the full contents of supabase/schema.sql
```

That single file both enables RLS and (re)creates the policies. Do **not** deploy publicly until
`relrowsecurity` is `true` and the 4 policies are present.

---

## Step 6 — Point Supabase auth at the Render URL

Supabase blocks auth redirects to unlisted URLs, so email confirmation / login redirects will
fail until you register the deployed origin.

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://expense-tracker-<hash>.onrender.com`
- **Redirect URLs:** add the same origin (and `http://localhost:5173` for local dev).

---

## Step 7 — Post-deploy verification checklist

On the live Render URL:
- [ ] App loads (no blank page / console errors about missing env vars).
- [ ] **Sign up** a new account → confirm email flow works.
- [ ] **Log in** → land on the protected route.
- [ ] Add an expense → it persists (reload and it's still there).
- [ ] **Hard-refresh on a deep route** (e.g. `/login` or the dashboard) → loads instead of 404.
      If it 404s, the Step 1 rewrite rule is missing/misconfigured.
- [ ] Log in as a *second* user → you see only your own expenses (RLS working).

---

## Notes & gotchas

- **SPA routing:** the `/* → /index.html` rewrite is mandatory for react-router; without it,
  deep links and refreshes return 404.
- **Build-time vars:** editing `VITE_*` vars requires a redeploy to take effect (they're inlined).
- **Free tier:** Static Sites are free and served over Render's CDN with automatic HTTPS; there is
  no server to "spin down" (that limitation applies to free Web Services, which this is not).
- **Custom domain (later):** add it under the site's **Settings → Custom Domains** and update the
  Supabase Site URL / redirect list accordingly. Not needed for the default URL.
- **Yarn version:** Render honors `yarn.lock`. If the build fails on a Yarn/Node mismatch, pin
  `NODE_VERSION` (already set to `22` above) and, if needed, add a `.node-version` file.
```
