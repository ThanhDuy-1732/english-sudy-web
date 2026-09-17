# Batch 1 / T4: Speaking Pages — Session Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session tracking to `/speak/roleplay/[id]` and `/speak/ielts/[part]`. Speaking sessions have no correct/total counts — only duration matters.

**Architecture:** Same `useRef` guard pattern as T2/T3. `finishSession` called with no totals — duration is calculated automatically from startedAt.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest

**Spec:** `docs/superpowers/specs/2026-09-17-development-roadmap-design.md` — Batch 1

**Requires:** T1 complete (`src/lib/sessions.ts` exists)

**Previous task:** `docs/superpowers/plans/batch1/t3-exam-session.md`

**Next task:** `docs/superpowers/plans/batch1/t5-writing-session.md`

## Global Constraints

- No new npm dependencies.
- `useRef` for session ID — not `useState`.
- `cancelSession` in `useEffect` cleanup.
- Do not change any existing speaking/grading logic — only add session calls.
- `npm test && npm run lint && npm run build` must pass at the end.

---

## Files

| Action | File |
|---|---|
| Modify | `src/app/speak/roleplay/[id]/page.tsx` |
| Modify | `src/app/speak/ielts/[part]/page.tsx` |

## Interfaces Consumed (from T1)

```ts
import { startSession, finishSession, cancelSession } from "@/lib/sessions";

startSession("speaking", metadata?: Record<string, unknown>): string
finishSession(id: string): void   // no totals needed for speaking
cancelSession(id: string): void
```

---

### Roleplay page (`/speak/roleplay/[id]`)

- [ ] **Step 1: Read the roleplay page**

```bash
cat -n src/app/speak/roleplay/[id]/page.tsx
```

Find:
- Where the `id` param is accessed
- Where the session ends — look for `goalAchieved === true` or an "End session" action
- Where grading result is shown

- [ ] **Step 2: Add session tracking to roleplay page**

Add import:

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
    sessionIdRef.current = startSession("speaking", { mode: "roleplay", scenarioId: params.id });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Find where `goalAchieved` becomes true or the user taps "End session". Add after that point:

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current);
  sessionIdRef.current = null;
}
```

If there is no explicit end action (conversation just continues indefinitely), trigger `finishSession` when the user navigates away — this is handled by the `cancelSession` in the cleanup, so it records nothing if the user leaves early. That is acceptable for v1.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

---

### IELTS speaking page (`/speak/ielts/[part]`)

- [ ] **Step 4: Read the IELTS speaking page**

```bash
cat -n src/app/speak/ielts/[part]/page.tsx
```

Find:
- Where the `part` param is accessed
- Where grading result is received and displayed (the `SpeakingFeedback` state being set)

- [ ] **Step 5: Add session tracking to IELTS speaking page**

Same import + `useRef` + mount effect pattern:

```ts
const sessionIdRef = useRef<string | null>(null);

useEffect(() => {
  if (sessionIdRef.current === null) {
    sessionIdRef.current = startSession("speaking", { mode: "ielts", part: params.part });
  }
  return () => {
    if (sessionIdRef.current) {
      cancelSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Call `finishSession` where the grading feedback is received (after the API response sets the feedback state):

```ts
if (sessionIdRef.current) {
  finishSession(sessionIdRef.current);
  sessionIdRef.current = null;
}
```

- [ ] **Step 6: Full gate**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/speak/roleplay/[id]/page.tsx src/app/speak/ielts/[part]/page.tsx
git commit -m "feat(speak): add session tracking to roleplay and IELTS pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
