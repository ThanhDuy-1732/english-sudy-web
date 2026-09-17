# Batch 1 / T3: Exam Pages — Session Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session tracking to `/exam/drill/[part]` and `/exam/mock` — start on mount, finish on completion, cancel if user leaves early.

**Architecture:** Same `useRef` guard pattern as T2. Each page adds one `useRef<string | null>(null)` for the session ID. No UI changes — session runs in background.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1

**Requires:** T1 complete (`src/lib/sessions.ts` exists)

**Previous task:** `docs/superpowers/plans/batch1/t2-review-session.md`

**Next task:** `docs/superpowers/plans/batch1/t4-speaking-session.md`

## Global Constraints

- No new npm dependencies.
- `useRef` for session ID — not `useState`.
- `cancelSession` in `useEffect` cleanup.
- Do not change any existing drill/mock logic — only add session calls.
- `npm test && npm run lint && npm run build` must pass at the end.

---

## Files

| Action | File |
|---|---|
| Modify | `src/app/exam/drill/[part]/page.tsx` |
| Modify | `src/app/exam/mock/page.tsx` |

## Interfaces Consumed (from T1)

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";

startSession("exam", metadata?: Record<string, unknown>): string
finishSession(id: string, totals: { totalItems: number; correctItems: number }): void
cancelSession(id: string): void
```

---

### Drill page (`/exam/drill/[part]`)

- [ ] **Step 1: Read the drill page to understand state flow**

```bash
cat -n src/app/exam/drill/[part]/page.tsx
```

Find:
- Where the `part` param is accessed (likely `useParams()` or `params` prop)
- Where correct/total counts live (likely state like `score`, `total`, `correctCount`)
- Where the drill ends (likely when a result/score state is set)

- [ ] **Step 2: Add session tracking to the drill page**

Add import at the top:

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
```

Add after existing `useRef` declarations inside the component:

```ts
const sessionIdRef = useRef<string | null>(null);
```

Add a new `useEffect` (separate from existing ones) that runs once on mount:

```ts
useEffect(() => {
  if (sessionIdRef.current === null) {
    // Replace `params.part` with whatever the actual param variable is called
    sessionIdRef.current = startSession("exam", { part: params.part });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Find where the drill finishes (where final score/accuracy is computed — look for a `setResult`, `setScore`, or `setShowResult` call). **Just after** that state update, add:

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current, {
    totalItems: totalCount,    // replace with actual variable name
    correctItems: correctCount, // replace with actual variable name
  });
  sessionIdRef.current = null;
}
```

- [ ] **Step 3: Run build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Fix any TypeScript errors (variable name mismatches, missing imports).

- [ ] **Step 4: Run existing exam tests**

```bash
npm test -- --testPathPattern="exam" 2>&1 | tail -20
```

All existing tests must still pass.

---

### Mock page (`/exam/mock`)

- [ ] **Step 5: Read the mock page**

```bash
cat -n src/app/exam/mock/page.tsx
```

Find:
- Where totalItems and correctItems are tracked
- Where the test ends (timer runs out or user submits)

- [ ] **Step 6: Add session tracking to the mock page**

Same import + `useRef` pattern as the drill page.

```ts
const sessionIdRef = useRef<string | null>(null);

useEffect(() => {
  if (sessionIdRef.current === null) {
    sessionIdRef.current = startSession("exam", { mode: "mock" });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Call `finishSession` where the mock test result is finalized:

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current, {
    totalItems: totalCount,     // replace with actual variable name
    correctItems: correctCount, // replace with actual variable name
  });
  sessionIdRef.current = null;
}
```

- [ ] **Step 7: Full gate**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/app/exam/drill/[part]/page.tsx src/app/exam/mock/page.tsx
git commit -m "feat(exam): add session tracking to drill and mock pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
