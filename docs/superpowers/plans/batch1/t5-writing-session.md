# Batch 1 / T5: Writing Page — Session Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session tracking to `/write/task/[id]`. Session starts on mount, finishes when the user submits for grading and navigates to the result page.

**Architecture:** Same `useRef` guard pattern as T2–T4. `finishSession` called just before navigation to `/write/result/[id]`. Writing sessions have no correct/total counts — duration only.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1

**Requires:** T1 complete (`src/lib/sessions.ts` exists)

**Previous task:** `docs/superpowers/plans/batch1/t4-speaking-session.md`

**Next task:** `docs/superpowers/plans/batch1/t6-activity-page.md`

## Global Constraints

- No new npm dependencies.
- `useRef` for session ID — not `useState`.
- `cancelSession` in `useEffect` cleanup.
- Do not change any existing writing/grading logic — only add session calls.
- `npm test && npm run lint && npm run build` must pass at the end.

---

## Files

| Action | File |
|---|---|
| Modify | `src/app/write/task/[id]/page.tsx` |

## Interfaces Consumed (from T1)

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";

startSession("writing", metadata?: Record<string, unknown>): string
finishSession(id: string): void
cancelSession(id: string): void
```

---

- [ ] **Step 1: Read the writing task page**

```bash
cat -n src/app/write/task/[id]/page.tsx
```

Find:
- Where the `id` param is accessed
- Where the user submits (the grading API call — likely a `handleSubmit` function)
- Where navigation to result happens (likely `router.push("/write/result/...")`)

- [ ] **Step 2: Add session tracking**

Add import at the top:

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
```

Add `useRef` inside the component:

```ts
const sessionIdRef = useRef<string | null>(null);
```

Add mount effect:

```ts
useEffect(() => {
  if (sessionIdRef.current === null) {
    sessionIdRef.current = startSession("writing", { taskId: params.id });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Find the submit/navigation point. **Just before** `router.push(...)`, add:

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current);
  sessionIdRef.current = null;
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Fix any TypeScript errors before continuing.

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -20
```

- [ ] **Step 5: Full gate**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/write/task/[id]/page.tsx
git commit -m "feat(write): add session tracking to writing task page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
