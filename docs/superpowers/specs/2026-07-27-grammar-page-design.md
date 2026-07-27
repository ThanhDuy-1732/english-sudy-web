# Grammar Page Design Spec

**Date**: 2026-07-27  
**Route**: `/grammar`  
**Status**: Approved

---

## Overview

A new page for English grammar reference and practice. Content is hybrid: 8 built-in grammar topics are hardcoded; users can request AI to generate additional topics which are persisted in localStorage and synced to Supabase. Within any topic, users can ask AI to generate more examples or mini exercises.

---

## Layout

Two-column layout:

- **Left sidebar (280px, sticky)**: vertically scrollable list of grammar topics. Each item shows the topic name and sub-rule count. At the bottom of the sidebar is an `+ Thêm chủ đề mới` input — user types a topic name or description, presses Enter, AI generates the topic and appends it to the list.
- **Right content area**: displays the selected topic's full detail — sub-rules, formulas, explanations, examples, and AI action buttons.

**Mobile**: sidebar collapses; replaced by a dropdown/select at the top of the page to choose the active topic.

---

## Static Grammar Topics

Hardcoded in `src/lib/grammar-data.ts`. Eight default topics:

| Topic | Example Sub-rules |
|---|---|
| Tenses | Present Simple, Present Continuous, Past Simple, Past Perfect, Future Simple, Future Perfect |
| Modal Verbs | can/could, may/might, must/have to, should, would |
| Conditionals | Type 0, Type 1, Type 2, Type 3, Mixed Conditionals |
| Passive Voice | Simple Passive, Continuous Passive, Perfect Passive |
| Relative Clauses | who/which/that, defining vs non-defining |
| Reported Speech | Reporting statements, questions, commands |
| Articles | a/an, the, zero article |
| Prepositions | Time, place, movement, common collocations |

Each sub-rule contains:
- **name**: display label
- **formula**: structural pattern shown in a code block (e.g. `Subject + have/has + V3`)
- **explanation**: 1–2 sentence plain-language description
- **examples**: 2–3 static example sentences

---

## AI Features

### Generate More Examples

Each sub-rule has a **"Thêm ví dụ"** button. On click:
- Calls `POST /api/grammar-examples` with `{ topic, subRule, provider?, disabledProviders? }`
- AI returns 3 new example sentences
- Examples are appended below the static examples in the UI
- Not persisted (session only — static examples are the ground truth)

### Generate Exercise

Each sub-rule has a **"Luyện tập"** button. On click:
- Calls `POST /api/grammar-exercise` with `{ topic, subRule, provider?, disabledProviders? }`
- AI returns one exercise: either fill-in-the-blank or multiple choice (AI decides based on the rule)
- Exercise renders inline below the sub-rule
- User submits answer; correct/incorrect feedback shown inline
- Not persisted

### Generate New Topic (User Input)

Input field at the bottom of the sidebar. On submit:
- Calls `POST /api/grammar-generate` with `{ request: string, provider?, disabledProviders? }`
- AI returns a `GrammarTopic` object: `{ id, name, rules: SubRule[] }`
- Topic is appended to the sidebar list and selected immediately
- Persisted to localStorage and pushed to Supabase (see Storage section)

---

## Data Models

```ts
interface SubRule {
  id: string;           // slug, e.g. "present-simple"
  name: string;
  formula: string;
  explanation: string;
  examples: string[];
}

interface GrammarTopic {
  id: string;           // slug or uuid for user-generated
  name: string;
  rules: SubRule[];
  isUserGenerated?: boolean;
  createdAt?: string;   // ISO, user-generated only
}
```

Static topics live in `src/lib/grammar-data.ts` as `GrammarTopic[]` (without `isUserGenerated`).

User-generated topics are stored in `localStorage["grammarTopics"]` as `GrammarTopic[]`.

---

## API Routes

### `POST /api/grammar-examples`
```
Body:    { topic: string, subRule: string, provider?, disabledProviders? }
Returns: { examples: string[] }   // 3 new sentences
```

### `POST /api/grammar-exercise`
```
Body:    { topic: string, subRule: string, provider?, disabledProviders? }
Returns: { type: "fill" | "mcq", question: string, options?: string[], answer: string }
```

### `POST /api/grammar-generate`
```
Body:    { request: string, provider?, disabledProviders? }
Returns: GrammarTopic
```

All routes use `callWithFallback` from `src/lib/providers/` and set `X-Provider-Used` header.

---

## Storage & Sync

### localStorage

| Key | Type | Purpose |
|---|---|---|
| `grammarTopics` | `GrammarTopic[]` | User-generated topics |

### Supabase

New table: `grammar_topics`

```sql
create table grammar_topics (
  sync_key  text not null,
  id        text not null,
  name      text not null,
  rules     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (sync_key, id)
);
```

**Sync operations** (follow existing `custom_topics` pattern in `src/lib/sync.ts`):
- `pushGrammarTopic(topic)` — fire-and-forget upsert on create
- Pull in `initSync()` — fetch all `grammar_topics` for `syncKey`, merge with local (local wins on conflict by `created_at`)

---

## Navigation

Add `Ngữ pháp` link to the navbar in `src/app/layout.tsx`, positioned after the existing `Nhật ký` link.

---

## Components

| Component | File | Purpose |
|---|---|---|
| `GrammarSidebar` | `src/components/GrammarSidebar.tsx` | Sidebar topic list + add-topic input |
| `GrammarContent` | `src/components/GrammarContent.tsx` | Content area: sub-rules, examples, AI buttons |
| `GrammarExercise` | `src/components/GrammarExercise.tsx` | Inline exercise (fill or MCQ) with answer checking |

Page: `src/app/grammar/page.tsx` — composes sidebar + content, manages selected topic state.

---

## Out of Scope

- Editing or deleting user-generated topics (can be added later)
- Saving generated examples permanently
- Spaced repetition for grammar rules
- Supabase migration file (developer runs manually)
