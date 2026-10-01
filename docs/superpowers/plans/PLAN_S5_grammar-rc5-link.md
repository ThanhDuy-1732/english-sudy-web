# S5 (remaining) — Grammar → RC5 Drill Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Luyện TOEIC Part 5" link next to the exercise button in each grammar sub-rule section, deep-linking to the RC5 drill with the rule name pre-set as the topic.

**Architecture:** Single `<Link>` added to `GrammarContent.tsx`. The drill page already reads `searchParams.topic`. Items generated with a grammar topic use a separate bank key so they don't pollute the general RC5 bank.

**Tech Stack:** TypeScript, Next.js Link, `src/lib/exam/prompts.ts`

**Spec:** `docs/requirement/PLAN_PHASE_6_7_COMPLETION.md` — section S5.5

## Global Constraints

- No new dependencies
- Bank key for grammar items: `TOEIC:RC5:<level>:grammar=<slug>`
- `slug` = rule name lowercased, spaces replaced with `-`, non-alphanumeric removed
- `npm test && npm run lint && npm run build` must pass

---

### Task 1: Add grammar → RC5 drill link in GrammarContent

**Files:**
- Modify: `src/components/GrammarContent.tsx`

**Interfaces:**
- Consumes: Next.js `<Link>` (already in Next.js, no new import needed beyond `next/link`)
- Produces: visible link per sub-rule that navigates to `/exam/drill/RC5?topic=<encoded-rule-name>&grammarSlug=<slug>`

- [ ] **Step 1: Read GrammarContent button area**

```bash
sed -n '100,130p' src/components/GrammarContent.tsx
```

Locate the "Bài tập" button (around line 113–120).

- [ ] **Step 2: Add the Link import at the top of the file**

At the top of `src/components/GrammarContent.tsx`, add:

```ts
import Link from "next/link";
```

- [ ] **Step 3: Add the drill link after the exercise button**

Find the closing `</button>` of the exercise button (the one calling `fetchExercise`). After it, add:

```tsx
<Link
  href={`/exam/drill/RC5?topic=${encodeURIComponent(rule.name)}&grammarSlug=${encodeURIComponent(rule.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}`}
  className="text-sm text-purple-400 underline hover:text-purple-300"
>
  Luyện TOEIC Part 5
</Link>
```

- [ ] **Step 4: Run lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/GrammarContent.tsx
git commit -m "feat(grammar): link sub-rule to RC5 drill"
```

---

### Task 2: Separate bank key for grammar-topic items in drill page

**Files:**
- Modify: `src/app/exam/drill/[part]/page.tsx`

**Interfaces:**
- Consumes: `searchParams.grammarSlug` — if present, use a separate bank key
- Produces: grammar items cached at `TOEIC:RC5:<level>:grammar=<slug>` instead of `TOEIC:RC5:<level>`

- [ ] **Step 1: Find where the bank key is constructed in drill page**

```bash
grep -n "bankKey\|examBank\|TOEIC.*RC5" src/app/exam/drill/\[part\]/page.tsx | head -10
```

- [ ] **Step 2: Modify bank key when `grammarSlug` is present**

In `src/app/exam/drill/[part]/page.tsx`, find the call to `bankKey(kind, part, level)` and replace it with:

```ts
const grammarSlug = searchParams?.grammarSlug as string | undefined;
const effectiveBankKey = grammarSlug
  ? `${kind}:${part}:${level}:grammar=${grammarSlug}`
  : bankKey(kind, part, level);
```

Use `effectiveBankKey` wherever the bank is read or written in the drill page.

- [ ] **Step 3: Pass topic to generate-item when grammarSlug present**

When fetching from `/api/exam/generate-item`, include topic in the body:

```ts
const body = {
  kind, part, level,
  ...(grammarSlug ? { topic: searchParams.topic as string } : {}),
};
```

- [ ] **Step 4: Run lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/exam/drill/
git commit -m "feat(exam): separate bank key for grammar-topic RC5 items"
```

---

### Task 3: Verify with check script

- [ ] **Step 1: Run S0 for S5**

```bash
./scripts/check-phase-6-7.sh 2>&1 | grep -A4 "S5"
```

Expected: "Grammar → drill RC5" ✅ (other S5 items were already ✅)
