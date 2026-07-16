---
name: add-db-column
description: Add or change a column on an existing table across all four places that must stay in sync — supabase/schema.sql, src/lib/database.types.ts (Row/Insert/Update), the feature's input type, and the Zod form schema. Use for any column add/rename/type change. Doing only some of the four is the common bug this prevents.
---

# Add / change a DB column

A column touches four files in a required order. `database.types.ts` is the
**single source of truth** for row shapes (`Expense` is derived from it), and the
Zod schema is the single source of truth for form rules — skip either and the
types silently drift from the database.

## Order matters — do all four

1. **`supabase/schema.sql`** — add the column to the `create table`. Pick a
   `default` or `not null`/nullable deliberately (a `not null` column with no
   default breaks existing rows). Remind the user this file must be **run in the
   Supabase SQL editor** — the app does not migrate automatically. For an
   existing deployed table also give them the `alter table` statement:
   `alter table public.expenses add column if not exists <col> <type> ...;`

2. **`src/lib/database.types.ts`** — add the field to **all three** shapes of the
   table: `Row` (required as stored), `Insert` (optional `?` if it has a DB
   default), and `Update` (always optional `?`). This mirrors the SQL by hand;
   keep nullability identical (`text` nullable → `<col>: string | null`).

3. **The feature input type** (e.g. `src/features/expenses/types.ts`
   `ExpenseInput`) — add the field if the user supplies it on create/edit. Omit
   it if it's server-managed (like `created_at`).

4. **The Zod form schema** (e.g.
   `src/features/expenses/components/ExpenseForm.schema.ts`) — add a validation
   rule; the form's TS type is `z.infer` of this, so this is what wires the field
   into the form. Reuse shared lists (`CATEGORY_VALUES`) rather than re-listing
   literals.

Then update the form UI (`ExpenseForm.tsx`) to render the new field, and add/adjust
a colocated test (see the `write-colocated-test` conventions).

## Nullability cheat-sheet

| SQL                         | Row              | Insert / Update      |
| --------------------------- | ---------------- | -------------------- |
| `text not null default ...` | `col: string`    | `col?: string`       |
| `text not null` (no default)| `col: string`    | `col: string` (Insert), `col?: string` (Update) |
| `text` (nullable)           | `col: string \| null` | `col?: string \| null` |

## Checklist

- [ ] `schema.sql` updated **and** an `alter table` given for the live DB
- [ ] `database.types.ts`: added to `Row`, `Insert`, `Update` with correct `?`/`| null`
- [ ] feature input type updated (unless server-managed)
- [ ] Zod schema updated; form type still `z.infer<typeof schema>`
- [ ] form UI renders the field
- [ ] colocated test updated; `yarn test` green
- [ ] user reminded to apply the SQL in Supabase
