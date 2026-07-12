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

This is a React 19 + TypeScript SPA built with Vite.

- `index.html` → `src/main.tsx` → `src/App.tsx` (React root)
- `src/` holds all application source; `public/` holds static assets served as-is
- TypeScript is split into two configs: `tsconfig.app.json` (app code, ES2023 target) and `tsconfig.node.json` (Vite config); `tsconfig.json` references both
- ESLint uses the flat config format (`eslint.config.js`)

The project is a fresh Vite template scaffold — the actual expense-tracker UI and logic are yet to be built into `src/App.tsx` and sibling files.
