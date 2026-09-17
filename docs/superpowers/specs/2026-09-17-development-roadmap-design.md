# English Study App — Development Roadmap Spec

**Date:** 2026-09-17  
**Author:** ThanhDuy-ThankZ  
**Strategy:** Approach A — Strict sequential milestone gates  
**Milestone gate:** Each batch must pass `npm test && npm run lint && npm run build` before the next batch begins.

---

## Context

The app currently has: vocabulary (flashcards + SM-2 review), exam (drill/mock/mistakes), speaking (roleplay/IELTS), writing (task/result), diary, grammar (static + user-generated), and a basic `/today` planner.

**What is missing:** All modules are isolated. There is no shared session tracking, no cross-module mistake notebook, no skill mastery engine. The P0 foundation must come first — every P1 and P2 feature depends on it.

---

## Milestone Gate Definition

A batch is **done** when:

1. All tasks in the batch are implemented.
2. `npm test` passes (all existing + new tests).
3. `npm run lint` passes (no warnings, no errors).
4. `npm run build` passes (no TypeScript errors, no missing modules).
5. Existing localStorage data still loads correctly (no data loss).
6. CONTEXT.md updated if any page, API route, component, data model, or localStorage key changed.

---

## Batch 1 — Foundation: Learning Session System

**Epic:** EPIC 1  
**Priority:** P0  
**Depends on:** nothing  

### Goal

Every major learning flow emits a `LearningSession` record. This enables History, Stats, Mastery, and Planner to share a unified timeline of what the user actually did.

### Data Model

New interface in `src/lib/sessions.ts`:

```ts
type LearningActivityType =
  | "vocabulary"
  | "review"
  | "grammar"
  | "exam"
  | "speaking"
  | "writing";

interface LearningSession {
  id: string;                     // crypto.randomUUID()
  type: LearningActivityType;
  startedAt: string;              // ISO
  finishedAt?: string;            // ISO
  durationSeconds: number;
  totalItems?: number;
  correctItems?: number;
  metadata?: Record<string, unknown>;
}
```

### New localStorage Key

| Key | Type | Purpose |
|---|---|---|
| `learningSessions` | `LearningSession[]` | Capped at 500 most recent sessions |

### Files to Create

- `src/lib/sessions.ts` — domain functions: `startSession`, `updateSession`, `finishSession`, `cancelSession`, `getSessions`, `getSessionsForDate`, `getRecentSessions`
- `src/app/activity/page.tsx` — `/activity` route: sessions grouped by date, type badge, duration, result summary
- `src/__tests__/sessions.test.ts` — unit tests

### Files to Modify

- `src/app/review/page.tsx` — call `startSession("review")` on mount, `finishSession` on completion with totalItems/correctItems. Guard against remount duplicate: check for an open session of same type from last 60s.
- `src/app/exam/drill/[part]/page.tsx` — same pattern for `"exam"`.
- `src/app/exam/mock/page.tsx` — same pattern for `"exam"`.
- `src/app/speak/roleplay/[id]/page.tsx` — `"speaking"` session.
- `src/app/speak/ielts/[part]/page.tsx` — `"speaking"` session.
- `src/app/write/task/[id]/page.tsx` — `"writing"` session, finish when result is saved.

### Session Completion Rules

- `finishSession` is idempotent — calling it twice on the same id is a no-op.
- A session is only created once per flow entry. Use a `useRef` flag or `sessionId` state initialized once on mount.
- Result screen re-renders must not create a new session.

### Review Session Summary

After SRS review, show a summary screen before navigating away:

- Total reviewed, Again/Hard/Good/Easy counts, accuracy %, duration, next due count.
- This replaces the current immediate redirect after last card.

### Migration

None required. Old data without `learningSessions` key works — `getSessions()` returns `[]`.

### Tests Required

```
sessions.test.ts:
- startSession creates a session with correct type and startedAt
- finishSession sets finishedAt and durationSeconds
- cancelSession removes the session
- getSessions returns sorted newest-first
- getSessionsForDate filters by local date (not UTC)
- finishSession is idempotent (second call is no-op)
- cap at 500: adding 501st drops oldest
```

---

## Batch 2 — Adaptive Core Part 1: Unified Mistake Notebook

**Epic:** EPIC 2  
**Priority:** P0  
**Depends on:** Batch 1 (sessions must exist before mistake drill can log a session)

### Goal

Replace the exam-only `mistakeLog` with a cross-module `LearningMistake[]` store. All modules write to the same place. One notebook UI shows everything.

### Data Model

New interface in `src/lib/mistakes.ts`:

```ts
type LearningSkill =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "writing";

type MistakeStatus = "open" | "reviewing" | "resolved";

interface LearningMistake {
  id: string;
  skill: LearningSkill;
  source: string;               // e.g. "exam:RC5", "grammar:Tenses", "vocabulary:write"
  category?: string;            // e.g. "preposition", "verb-form"
  prompt?: string;
  userAnswer?: string;
  expectedAnswer?: string;
  explanation?: string;
  createdAt: string;
  reviewedAt?: string;
  status: MistakeStatus;
  mistakeCount: number;         // incremented on recurrence
  lastOccurredAt?: string;      // ISO — updated on recurrence
  metadata?: Record<string, unknown>;
}
```

### Deduplication Rule

Same `skill` + `source` + `category` + `prompt` = same mistake. On recurrence: increment `mistakeCount`, update `lastOccurredAt`, set `status` back to `"open"` if it was `"resolved"`.

Recurring weakness threshold: `mistakeCount >= 3` → mark as `recurringWeakness: true` in metadata. Threshold constant in `src/lib/mistakes.ts`, not in UI.

### New localStorage Key

| Key | Type | Purpose |
|---|---|---|
| `unifiedMistakes` | `LearningMistake[]` | All mistakes, capped at 1000 |

### Migration

Existing `mistakeLog` (`MistakeEntry[]`) must be migrated on first load:

- Each `MistakeEntry` maps to a `LearningMistake` with `skill: "reading"` or `"listening"` depending on exam part, `source: "exam:<part>"`.
- After migration write to `unifiedMistakes`, set `mistakeLog_migrated: "v1"` flag in localStorage.
- Keep `mistakeLog` key intact until Exam v2 is done (backward compat).

### Files to Create

- `src/lib/mistakes.ts` — domain functions: `addMistake`, `getMistakes`, `getMistakesBySkill`, `resolveMistake`, `reopenMistake`, `getRecurringWeaknesses`, `migrateLegacyMistakes`
- `src/app/mistakes/page.tsx` — `/mistakes` route with filters: All / by skill / Open / Reviewing / Resolved
- `src/__tests__/mistakes.test.ts`

### Files to Modify

- `src/app/exam/drill/[part]/page.tsx` — wrong answers write to `unifiedMistakes` (keep writing to `mistakeLog` too during transition)
- `src/app/exam/mock/page.tsx` — same
- `src/app/review/page.tsx` — quality=0 (Again) writes vocabulary mistake

### Tests Required

```
mistakes.test.ts:
- addMistake creates new record
- addMistake on same key increments mistakeCount
- resolveMistake sets status resolved
- addMistake on resolved mistake reopens it
- recurring weakness: mistakeCount >= 3 sets flag
- getMistakesBySkill filters correctly
- migrateLegacyMistakes maps MistakeEntry to LearningMistake
- migration is idempotent (running twice doesn't duplicate)
- cap at 1000
```

---

## Batch 3 — Adaptive Core Part 2: Skill Mastery Engine + Today Planner v2

**Epics:** EPIC 3, EPIC 4  
**Priority:** P0  
**Depends on:** Batch 1 + Batch 2

### Goal

A deterministic mastery score (0–100) per skill/category, derived from sessions + mistakes + recency. The `/today` planner v2 uses mastery + mistake data to build a prioritized daily plan.

### Skill Mastery Data Model

```ts
interface SkillMastery {
  skillId: string;              // e.g. "exam:RC5", "grammar:Tenses", "vocabulary"
  skill: LearningSkill;
  category: string;
  mastery: number;              // 0-100, deterministic
  attempts: number;
  correct: number;
  lastPracticedAt?: string;
  trend: "up" | "stable" | "down";
}
```

No new localStorage key for mastery — it is **derived** (recalculated on demand from existing data). Cache in memory only during a page session; do not persist.

### Mastery Calculation Rules (deterministic, no AI)

```
baseAccuracy = correct / attempts  (0 if attempts = 0)
recencyFactor = decay based on daysSinceLastPractice:
  0 days → 1.0, 7 days → 0.85, 30 days → 0.6, 90+ days → 0.4
confidenceFactor = min(1.0, attempts / 10)  // low sample → low confidence
mastery = baseAccuracy * recencyFactor * confidenceFactor * 100
trend = compare mastery from last 7 days vs previous 7 days:
  > +5 → up, < -5 → down, else stable
```

### Files to Create

- `src/lib/mastery.ts` — `getSkillMastery`, `getCategoryMastery`, `getWeakestSkills`, `getStrongestSkills`, `getSkillTrend`, `recalculateMastery`
- `src/__tests__/mastery.test.ts`

### Today Planner v2

Replaces the current basic plan generator.

**New localStorage key:**

| Key | Type | Purpose |
|---|---|---|
| `learningPreferences` | `{ dailyStudyGoalMinutes: number }` | Daily goal (default 30) |

The `dailyPlan` key shape changes to use `DailyPlanBlock[]`:

```ts
interface DailyPlanBlock {
  id: string;
  type: "review" | "vocabulary" | "grammar" | "exam" | "speaking" | "writing" | "mistake";
  title: string;
  estimatedMinutes: number;
  reason: string;              // data-derived, no AI
  completed: boolean;
  href: string;
  metadata?: Record<string, unknown>;
}
```

**Planning priority (in order):**

1. Overdue SRS words (due count > 0)
2. Recurring weakness (mistakeCount ≥ 3)
3. Skill mastery < 40
4. Speaking inactive > 2 days
5. Writing inactive > 5 days
6. Normal practice (exam drill, vocabulary, grammar)
7. New content

**Reason strings** are data-derived:
- `"Bạn có N từ cần ôn hôm nay"` from SRS due count
- `"Bạn sai X lần với dạng [category]"` from mistakeCount
- `"Kỹ năng [skill] đang ở [mastery]%"` from mastery score

**Plan generation rules:**

- Generate once per calendar day (local date). Persist in `dailyPlan`.
- On reload: if `dailyPlan.date === today`, reuse. Preserve `completed: true` blocks.
- Manual regenerate button: regenerate but keep completed blocks.
- Total estimatedMinutes ≤ dailyStudyGoalMinutes + 10 (one block flexible buffer).

**Daily goal setting:** Add to `/settings` page — select 15/30/45/60/custom minutes.

### Files to Modify

- `src/app/today/page.tsx` — rewrite to use new planner with goal display, block completion toggle, manual regenerate, reason display
- `src/app/settings/page.tsx` — add "Daily Study Goal" setting (new tab or existing General tab)
- `src/lib/plan-generator.ts` (exists) — replace with v2 using mastery + mistakes inputs

### Tests Required

```
mastery.test.ts:
- mastery = 0 when no attempts
- mastery = 100 when all correct, recent, high attempt count
- mastery reduced by recency decay
- mastery reduced by low confidence (< 10 attempts)
- trend: up when recent 7d > previous 7d by 5+
- weakestSkills returns sorted ascending by mastery

plan-generator.test.ts:
- overdue SRS always appears first
- recurring weakness appears before normal practice
- total minutes does not exceed goal + 10
- completed blocks preserved on regenerate
- plan date matches local date (not UTC)
- empty state (no data) produces at least one block
```

---

## Batch 4 — Grammar v2

**Epic:** EPIC 5  
**Priority:** P1  
**Depends on:** Batch 2 (mistakes), Batch 3 (sessions, mastery)

### Goal

Grammar becomes a learning module with progress tracking, quiz mode, bookmarks, and mistake integration.

### Data Model

```ts
interface GrammarProgress {
  topicId: string;
  subRuleId: string;
  viewed: boolean;
  attempts: number;
  correct: number;
  mastery: number;
  lastPracticedAt?: string;
}
```

### New localStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `grammarProgress` | `GrammarProgress[]` | Per-sub-rule progress |
| `grammarBookmarks` | `{ topicId: string, subRuleId?: string }[]` | Bookmarked topics/rules |

### Files to Create

- `src/lib/grammar-progress.ts` — `recordGrammarAttempt`, `getGrammarProgress`, `getGrammarMastery`, `addBookmark`, `removeBookmark`, `getBookmarks`
- `src/app/grammar/quiz/page.tsx` — `/grammar/quiz` route: select count (5/10/20), difficulty (Easy/Medium/Hard), scope (All/Weak/Mistakes only)
- `src/app/grammar/bookmarks/page.tsx` — `/grammar/bookmarks` route
- `src/__tests__/grammar-progress.test.ts`

### Files to Modify

- `src/app/grammar/page.tsx` — show mastery badge per topic in sidebar/selector, mark viewed on sub-rule expand
- `src/app/api/grammar-exercise/route.ts` — on wrong answer, write to `unifiedMistakes` with `skill: "grammar"`, `source: "grammar:<topicId>"`, `category: subRuleId`

### Grammar Quiz Flow

1. Select config → generate questions via existing `/api/grammar-exercise`
2. User answers → grade immediately
3. Wrong answer → write `LearningMistake` + option to call AI explanation via `/api/grammar-explain` (new route, simple: sends rule + question + userAnswer + correctAnswer)
4. End of quiz → `finishSession("grammar")` with totalItems + correctItems
5. Update `grammarProgress` for each attempted sub-rule

### Files to Create (API)

- `src/app/api/grammar-explain/route.ts` — takes `{ topicId, subRuleId, question, userAnswer, correctAnswer }`, returns `{ explanation }`

### Tests Required

```
grammar-progress.test.ts:
- recordGrammarAttempt creates/updates progress
- mastery calculated from attempts/correct
- addBookmark deduplicates
- getBookmarks returns all bookmarks
- getGrammarMastery for unknown topic returns 0
```

---

## Batch 5 — Vocabulary v2

**Epic:** EPIC 6  
**Priority:** P1  
**Depends on:** Batch 2 (mistakes), Batch 3 (sessions)

### Goal

Vocabulary gets a quiz mode, context story generation, and CEFR metadata support.

### Data Model Changes

`LearnedWord` gets optional fields (no migration required — old records just lack them):

```ts
// Added to LearnedWord:
cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
wordFamily?: string[];
partOfSpeech?: string;
```

### Files to Create

- `src/app/vocab/quiz/page.tsx` — `/vocab/quiz`: modes Meaning/Fill/Sentence/Synonym/Mixed; writes session + mistakes
- `src/app/vocab/story/page.tsx` — `/vocab/story`: select words → generate mini story/dialogue via new API
- `src/app/api/vocab/story/route.ts` — takes `{ words: string[], mode: "story"|"dialogue"|"scenario" }`, returns `{ content: string }` containing all target words
- `src/__tests__/vocab-quiz.test.ts`

### Files to Modify

- `src/app/history/page.tsx` — show CEFR badge if present, no forced migration
- `src/app/page.tsx` — words with `Again→Again→Hard` pattern get priority badge in word list (derive from SM-2 fields)

### Adaptive Practice Priority

Derive from existing SM-2 fields in `LearnedWord`:
- Words with `repetitions = 0` and `easiness < 2.0` = high priority
- Words with `easiness >= 2.5` and `repetitions >= 3` = deprioritized (shown last)

No change to SM-2 core algorithm.

### Tests Required

```
vocab-quiz.test.ts:
- quiz session created on start, finished on complete
- wrong answer writes LearningMistake with skill "vocabulary"
- adaptive priority: low easiness words appear before high easiness
- no duplicate word creation when saving
```

---

## Batch 6 — Exam v2

**Epic:** EPIC 7  
**Priority:** P1  
**Depends on:** Batch 2 (unified mistakes replace mistakeLog)

### Goal

Adaptive drill distribution, question tagging, richer analytics, mock test history page.

### Data Model Changes

`ExamItem` gets optional `tags`:

```ts
// Added to ExamItem:
tags?: string[];
```

`ExamAttempt` gets optional response time:

```ts
// Added to ExamAttempt:
responseTimeMs?: number;
```

### New localStorage Key

| Key | Type | Purpose |
|---|---|---|
| `mockHistory` | `MockTestResult[]` | Summary of each mock test (date, type, accuracy, estimated score) |

```ts
interface MockTestResult {
  id: string;
  date: string;
  examType: "TOEIC" | "IELTS";
  durationSeconds: number;
  totalItems: number;
  correctItems: number;
  accuracy: number;
  estimatedScore?: number;
  estimatedScoreNote: string;   // always "Estimated — not official"
  accuracyByCategory: Record<string, number>;
}
```

### Files to Create

- `src/app/exam/mock/history/page.tsx` — `/exam/mock/history`: list MockTestResult, accuracy trend sparkline, estimated score column with disclaimer
- `src/__tests__/exam-adaptive.test.ts`

### Files to Modify

- `src/app/exam/drill/[part]/page.tsx` — adaptive distribution: 70% weak categories, 20% normal, 10% strong (derive from `unifiedMistakes` + `examAttempts`). Configurable ratio in `src/lib/exam-adaptive.ts`.
- `src/app/exam/mock/page.tsx` — save to `mockHistory` on completion; show richer result: accuracy by category, strong/weak categories, mistakes count
- `src/app/exam/mistakes/page.tsx` — read from `unifiedMistakes` (skill=reading/listening) instead of `mistakeLog`, keep backward compat via migration from Batch 2
- `src/app/api/exam/generate-item/route.ts` — add `tags` field to generated items where appropriate

### Files to Create (lib)

- `src/lib/exam-adaptive.ts` — `getAdaptiveDistribution(part, attempts, mistakes)` → `{ weak, normal, strong }` ratios + category selection

### Tests Required

```
exam-adaptive.test.ts:
- weak categories get 70% of questions
- distribution is deterministic for same input
- no category repeats within one drill set if avoidable
- MockTestResult saved correctly after mock completion
- estimatedScoreNote always present
```

---

## Batch 7 — Speaking v2 + Writing v2

**Epics:** EPIC 8, EPIC 9  
**Priority:** P1  
**Depends on:** Batch 1 (sessions), Batch 2 (mistakes)

### Goal

Speaking and writing become iterative modules with history, retry, and transcript corrections.

### Speaking Data Model

```ts
interface SpeakingAttempt {
  id: string;
  mode: "roleplay" | "ielts";
  transcript: string;
  duration: number;
  scores?: { fluency?: number; grammar?: number; vocabulary?: number; pronunciation?: number };
  corrections?: Array<{ original: string; corrected: string; explanation?: string }>;
  createdAt: string;
  retryOfId?: string;           // links to original attempt if this is a retry
}
```

### New localStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `speakingAttempts` | `SpeakingAttempt[]` | Capped at 200 |
| `writingAttempts` | `WritingAttempt[]` | Capped at 100 |

### Writing Data Model

```ts
interface WritingAttempt {
  id: string;
  kind: string;                  // "IELTS Task 1" etc
  prompt: string;
  versions: WritingDraftVersion[];
  createdAt: string;
}

interface WritingDraftVersion {
  id: string;
  version: number;
  content: string;
  createdAt: string;
  feedback?: WritingFeedback;    // from existing grade API
}
```

### Files to Create

- `src/app/speak/history/page.tsx` — `/speak/history`: list attempts, view transcript + scores + corrections, retry button
- `src/app/write/history/page.tsx` — `/write/history`: list attempts, view draft versions, rewrite practice entry
- `src/lib/speaking-storage.ts` — `saveSpeakingAttempt`, `getSpeakingAttempts`, `getSpeakingAttemptById`
- `src/lib/writing-storage.ts` — `saveWritingAttempt`, `addWritingDraftVersion`, `getWritingAttempts`
- `src/__tests__/speaking-storage.test.ts`
- `src/__tests__/writing-storage.test.ts`

### Files to Modify

- `src/app/speak/ielts/[part]/page.tsx` — save `SpeakingAttempt` after grading; write grammar/vocabulary corrections to `unifiedMistakes`
- `src/app/speak/roleplay/[id]/page.tsx` — save `SpeakingAttempt` on session end
- `src/app/write/result/[id]/page.tsx` — save `WritingAttempt` with first version + feedback; show "Practice a rewrite" flow for one issue at a time

### Transcript Annotation UI

Inline correction display in speaking history:

```
I [go] → went   ← click to expand explanation
```

Use existing annotation renderer pattern from `/write/result`.

### Rewrite Mode (Writing)

Per issue from WritingFeedback:
1. Show issue + original sentence + explanation
2. User rewrites sentence in a text area
3. Submit → call `/api/grammar-exercise` or a simplified check (no new AI route needed for v1 — just show model answer for comparison)
4. Resolve corresponding `LearningMistake` if the rewrite is accepted by user

### Tests Required

```
speaking-storage.test.ts:
- saveSpeakingAttempt persists and retrieves
- retryOfId links to original
- cap at 200

writing-storage.test.ts:
- addWritingDraftVersion increments version number
- versions do not overwrite each other
- cap at 100 attempts
```

---

## Batch 8 — Learning Insights

**Epic:** EPIC 10  
**Priority:** P1  
**Depends on:** Batch 1 (sessions), Batch 3 (mastery)

### Goal

Upgrade `/stats` from raw data display to actionable weekly insights with skill trends and rule-based recommendations.

### Files to Modify

- `src/app/stats/page.tsx` — add Weekly Report section: total study time vs prior week, new words, review accuracy, exam accuracy, grammar accuracy, streak, session count, strongest improvement, skills needing attention
- `src/lib/insights.ts` (new) — `getWeeklyReport(date)`, `getSkillTrends()`, `getRuleBasedRecommendations()` — all deterministic, no AI

### Rule-Based Recommendations

```ts
// Priority order:
if (srsOverdue > 5) → "Ôn lại từ vựng — bạn có N từ cần ôn"
if (grammarMastery < 40) → "Luyện grammar — kỹ năng đang ở X%"
if (speakingInactiveDays > 2) → "Luyện nói — đã N ngày chưa thực hành"
if (writingInactiveDays > 5) → "Luyện viết — đã N ngày chưa thực hành"
if (recurringWeaknesses.length > 0) → "Ôn lỗi sai — bạn có N lỗi lặp lại"
```

### Skill Trend Calculation

Use rolling 7-day windows. Compare average mastery in last 7d vs prior 7d. Uses sessions + correctItems/totalItems.

### Tests Required

```
insights.test.ts:
- weekly report correct for local timezone (not UTC)
- no crash when prior week has no data
- recommendations deterministic: same input → same output
- no AI calls
- trend: up when recent window > prior window by 5+
```

---

## Batch 9 — Data & Offline v2

**Epic:** EPIC 11  
**Priority:** P1 Technical  
**Depends on:** Batch 1–8 complete (repository abstraction refactors existing data access)

### Goal

Repository abstraction over localStorage for new data types. IndexedDB for high-volume data. Offline queue with retry.

### Repository Abstraction

New data types (Sessions, Mistakes, SpeakingAttempts, WritingAttempts) get repository interfaces:

```ts
interface Repository<T> {
  getAll(): T[];
  getById(id: string): T | undefined;
  save(item: T): void;
  delete(id: string): void;
}
```

Implementations: `LocalStorageRepository<T>` wraps existing localStorage pattern. UI pages import the repository, not `localStorage` directly.

**Do not refactor old LearnedWord/Grammar localStorage access** — scope is only the new entities from Batch 1–7.

### IndexedDB Migration

Priority order (migrate one at a time, not all at once):

1. `learningSessions` (can grow large)
2. `unifiedMistakes`
3. `speakingAttempts`
4. `writingAttempts`

Migration: on first load, check if data exists in localStorage key; if yes, migrate to IndexedDB, set `idb_migrated_<key>: "v1"` flag, keep localStorage key for 1 more release before removing.

### Offline Queue

```ts
interface SyncOperation {
  id: string;
  type: "CREATE" | "UPDATE" | "DELETE";
  entity: string;
  entityId: string;
  payload?: unknown;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
}
```

- Key: `syncQueue` in localStorage (small, queue-like, not volume data)
- Retry: exponential backoff, max 5 attempts
- Online event triggers flush
- Failed operations stay in queue and are surfaced in Settings/Sync tab

### Sync Status UI

Add to `/settings` Sync tab:

```
● Synced
⟳ Syncing...
⚠ Offline — N changes pending
✕ Sync error — tap to retry
```

### Conflict Resolution (per entity)

| Entity | Strategy |
|---|---|
| `LearningSession` | Append-only — never overwrite |
| `LearningMistake` | Merge: take max mistakeCount, union of metadata |
| `Settings` | Latest updatedAt wins |
| `dailyPlan` completed blocks | completed: true wins (never revert) |
| Deleted entity | Tombstone: keep id + `deletedAt`, skip on read |

### Tests Required

```
repository.test.ts:
- save + getAll round-trip
- getById returns undefined for missing
- cap enforced (if applicable)

offline-queue.test.ts:
- operation queued when offline
- retry increments attempts
- max attempts: operation marked failed, not dropped
- flush processes queue when online
```

---

## Batch 10 — P2 Product Features

**Priority:** P2 — planned, not scheduled. Begin after Batch 9 is complete and stable.

### P2 Epics (in recommended order)

#### EPIC 12 — Goals & Learning Path

- Learning profile: goal (TOEIC/IELTS/communication/vocabulary/mixed), level, dailyMinutes, targetScore, targetDate
- Onboarding: 5 questions, skippable, editable in Settings
- Learning Path: use profile + mastery to weight Today Planner priorities (no hard-coded curriculum)
- Key constraint: existing users must not see forced blocking onboarding

#### EPIC 13 — Search & Knowledge Library

- Route: `/library`
- Local search (no AI) across: learnedWords, grammarTopics, grammarBookmarks, unifiedMistakes, writingAttempts corrections, speakingAttempts corrections
- Debounced, case-insensitive, results grouped by domain
- Works fully offline

#### EPIC 14 — Notifications

- Web Push API (opt-in only)
- Types: today plan ready, SRS due, streak at risk, speaking/writing inactivity
- Settings in `/settings`: per-type toggle + reminder time
- Cooldown: max 1 notification per type per day
- No notification if user already completed the corresponding activity today

#### EPIC 15 — Gamification

- XP per completed activity (deterministic, not farmable — session-gated, not repeat-on-reload)
- Achievements: 7-day streak, 100 words, 500 reviews, first essay, 10 speaking sessions, 100 grammar questions
- XP never used in mastery calculation
- Existing `dailyChallenge` data preserved

#### EPIC 16 — AI Engine v2

- AI task abstraction: `callAI({ task, input, schema })` wraps existing `callWithFallback`
- Task-aware routing: fast/cheap model for simple generation, better model for grading/feedback
- Provider metrics: request count, success, failures, average latency, fallback count
- Prompt registry: `src/lib/ai/prompts/` with named, versioned prompt templates
- No change to existing client isolation (API keys stay server-side only)

---

## Summary: Milestone Map

```
Batch 1 ─ Learning Session System
   │
Batch 2 ─ Unified Mistake Notebook
   │
Batch 3 ─ Skill Mastery + Today Planner v2
   │
   ├── Batch 4 ─ Grammar v2
   ├── Batch 5 ─ Vocabulary v2
   ├── Batch 6 ─ Exam v2
   ├── Batch 7 ─ Speaking v2 + Writing v2
   ├── Batch 8 ─ Learning Insights
   │
Batch 9 ─ Data & Offline v2
   │
Batch 10 ─ P2 Product Features (Goals, Search, Notifications, Gamification, AI v2)
```

Batches 4–8 depend on Batch 3 but are independent of each other — they can be implemented in any order after Batch 3, or interleaved, as long as each passes its milestone gate before moving on.

---

## Non-Goals (for this roadmap)

- Social network, public leaderboard, teacher marketplace
- Payment/subscription, multi-tenant
- Real-time multiplayer
- Phoneme-level pronunciation engine (custom)
- Training custom language model
