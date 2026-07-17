# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start dev server with HMR
yarn build      # Type-check + production build (output: dist/)
yarn lint       # Run ESLint
yarn preview    # Preview production build locally
```

Use `yarn` (not `npm`) — the repo has a `yarn.lock`.

## Architecture

This is a React 19 + TypeScript SPA built with Vite, backed directly by
Supabase (Auth + Postgres + Row Level Security — no custom backend).

- `index.html` → `src/main.tsx` → `src/App.tsx` (React root)
- `src/` holds all application source; `public/` holds static assets served as-is
- TypeScript is split into two configs: `tsconfig.app.json` (app code, ES2023 target) and `tsconfig.node.json` (Vite config); `tsconfig.json` references both
- ESLint uses the flat config format (`eslint.config.js`)

Two feature domains live under `src/features/`: `expenses/` (record, filter,
edit, delete expenses; category breakdown + spend-over-time charts via
Recharts) and `budgets/` (set a monthly budget per category and/or one overall
budget, with a spent-vs-budget progress bar). See `documents/architect.md` for
the full system map (directory layout, data model, data flow).
