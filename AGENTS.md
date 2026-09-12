# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Codebase Reference

**Read `CONTEXT.md` at the start of every session.** It contains the full reference for pages, API routes, data models, localStorage keys, provider system, Supabase sync, components, and key constraints — so you don't need to re-read the source files.

**When you add or significantly change any of the following, update `CONTEXT.md` before finishing:**
- A page (`src/app/*/page.tsx`)
- An API route (`src/app/api/*/route.ts`)
- A component (`src/components/*.tsx`)
- A data model or localStorage key (`src/lib/storage.ts`, `src/lib/*.ts`)
- The provider system (`src/lib/providers/`)
- Supabase tables (`supabase/migrations/`)
- Context providers (`src/contexts/`)

## Commands

- `npm run dev` - start dev server at http://localhost:3000
- `npm test` - run all Jest tests
- `npm test -- --testPathPattern=<pattern>` - run tests matching pattern
- `npm run build` - production build
- `npm run lint` - ESLint check

## Key Constraint

API keys must stay server-side only. Never import `src/lib/providers/` or any AI client from client components — only from API routes (`src/app/api/*/route.ts`).
