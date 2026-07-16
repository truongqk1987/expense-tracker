---
name: add-supabase-table
description: Add a new Postgres table to supabase/schema.sql with Row Level Security wired the project's way — four auth.uid()=user_id policies (select/insert/update/delete) plus a (user_id, sort desc) index. Use whenever a feature needs a new user-owned table. RLS is the security backbone; never ship a table without it.
---

# Add a Supabase table (RLS-safe)

RLS is this project's **only** data-isolation mechanism — there is no backend
that filters by user. A table without the four policies leaks every user's rows
to every other user. Follow this exactly.

## Steps

1. **Append the table to `supabase/schema.sql`** (do not create a new file —
   the whole schema lives in one file, run as one script in the Supabase SQL
   editor). Mirror the `expenses` block:

   - `id uuid primary key default gen_random_uuid()`
   - `user_id uuid not null references auth.users (id) on delete cascade`
   - your domain columns (money → `numeric(12,2) not null check (... >= 0)`,
     dates → `date not null default current_date`)
   - `created_at timestamptz not null default now()`

2. **Add the list index** on `(user_id, <primary_sort_column> desc)` — matches
   how the list query will order rows.

3. **Enable RLS and add all four policies**, each keyed on
   `auth.uid() = user_id`. `select`/`delete`/`update` use `using (...)`;
   `insert`/`update` use `with check (...)`. Use `drop policy if exists` before
   each `create policy` so the script is re-runnable.

4. **Tell the user to run the updated `schema.sql`** in the Supabase SQL editor —
   schema changes are not applied automatically by the app.

5. Next: generate the client types with `add-db-column`'s type step (or
   `add-feature-domain` if this table is a new domain).

## Template

Replace `things` / `label` with your table + columns.

```sql
-- N. <Things> ---------------------------------------------------------------
create table if not exists public.things (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null,
  amount     numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists things_user_id_created_at_idx
  on public.things (user_id, created_at desc);

alter table public.things enable row level security;

drop policy if exists "Users can view their own things" on public.things;
create policy "Users can view their own things"
  on public.things for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own things" on public.things;
create policy "Users can insert their own things"
  on public.things for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own things" on public.things;
create policy "Users can update their own things"
  on public.things for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own things" on public.things;
create policy "Users can delete their own things"
  on public.things for delete
  using (auth.uid() = user_id);
```

## Checklist

- [ ] `user_id` FK to `auth.users` with `on delete cascade`
- [ ] `(user_id, sort desc)` index
- [ ] `enable row level security`
- [ ] all **four** policies present, each `auth.uid() = user_id`
- [ ] insert + update carry `with check`
- [ ] script is re-runnable (`if not exists` / `drop policy if exists`)
- [ ] user reminded to run it in the Supabase SQL editor
