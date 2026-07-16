# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - start dev server at http://localhost:3000
- `npm test` - run all Jest tests
- `npm test -- --testPathPattern=<pattern>` - run tests matching pattern
- `npm run build` - production build
- `npm run lint` - ESLint check

## Architecture

Next.js 14 App Router project. Two pages: `/` (study) and `/history`. No database - all persistence via `localStorage`.

**Data flow for word generation:**
`page.tsx` -> `POST /api/generate-words` -> `lib/gemini.ts` -> Google Gemini API -> 5 words rendered as `<Flashcard>` components.

**Data flow for sentence generation:**
`Flashcard.tsx` (on flip) -> `POST /api/generate-sentence` -> `lib/gemini.ts` -> sentence shown on card back.

**Persistence:** `lib/storage.ts` wraps localStorage under the key `"learnedWords"`. Called from `Flashcard.tsx` (save) and `history/page.tsx` (read/delete).

## Key Constraint

`GEMINI_API_KEY` must stay server-side only. It is only imported in `src/lib/gemini.ts`, which is only called from API routes (`src/app/api/*/route.ts`), never from client components.
