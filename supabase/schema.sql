-- Expense Tracker — database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL) to provision the backend.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  amount     numeric(12, 2) not null check (amount >= 0),
  category   text not null,
  note       text,
  spent_at   date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_id_spent_at_idx
  on public.expenses (user_id, spent_at desc);

-- 2. Row Level Security ------------------------------------------------------
-- The security backbone: every row is owned by a user, and policies ensure a
-- user can only ever read/write their own rows. No custom backend required.
alter table public.expenses enable row level security;

drop policy if exists "Users can view their own expenses" on public.expenses;
create policy "Users can view their own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own expenses" on public.expenses;
create policy "Users can insert their own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own expenses" on public.expenses;
create policy "Users can update their own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own expenses" on public.expenses;
create policy "Users can delete their own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);
