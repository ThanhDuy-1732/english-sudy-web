# S8 — New Exam Parts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new exam parts: READ_P1 (true/false/NG), READ_P2 (matching headings), LISTEN_S2 (monologue MCQ+sentence_completion), LISTEN_S3 (academic discussion MCQ), LISTEN_S4 (lecture summary_completion), LC1 (photo description — text-only fallback).

**Architecture:** Each part needs: (1) a prompt template in `src/lib/exam/prompts.ts`, (2) any new question type already in the Zod schema, (3) a renderer in `QuestionCard.tsx` if the UI differs from the default. Parts with reading passages use the existing `PassageReader` component. Parts with audio scripts use the existing `ListeningPlayer`. One commit per part.

**Tech Stack:** TypeScript, Zod, Recharts (none needed), Jest

**Spec:** `docs/requirement/PLAN_PHASE_6_7_COMPLETION.md` — section S8

## Global Constraints

- `ExamItemSchema` already accepts all QuestionType values via `z.string()` — no schema change needed for new types
- `READING_PARTS` and `LISTENING_PARTS` sets in `QuestionCard.tsx` already include the new parts (check first)
- One commit per part: `feat(exam): add <PART> (<question_type>)`
- `npm test && npm run lint && npm run build` after every commit
- Implement in order: READ_P1 → LISTEN_S2 → READ_P2 → LISTEN_S3 → LISTEN_S4 → LC1

---

### Task 1: READ_P1 — true_false_ng

**Files:**
- Modify: `src/lib/exam/prompts.ts`

READ_P1 is IELTS Academic Reading Passage 1: shorter passage, True/False/Not Given questions with fixed options `['TRUE', 'FALSE', 'NOT GIVEN']`.

- [ ] **Step 1: Check READING_PARTS includes READ_P1**

```bash
grep "READ_P1" src/components/exam/QuestionCard.tsx
```

If missing, add `'READ_P1'` to the `READING_PARTS` Set.

- [ ] **Step 2: Write a test for the READ_P1 prompt**

```ts
// src/lib/exam/__tests__/prompts.test.ts — add to existing
import { buildPrompt } from '../prompts';

it('READ_P1 prompt includes true_false_ng and NOT GIVEN constraint', () => {
  const prompt = buildPrompt({ kind: 'IELTS', part: 'READ_P1', level: 3 });
  expect(prompt).toContain('TRUE');
  expect(prompt).toContain('NOT GIVEN');
  expect(prompt).toContain('true_false_ng');
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=prompts
```

- [ ] **Step 4: Add READ_P1 prompt builder in `prompts.ts`**

Find the `builders` object in `src/lib/exam/prompts.ts` (after `LISTEN_S1`). Add:

```ts
READ_P1: () => `You are an IELTS Academic Reading item writer for Passage 1.
Create a short academic passage (200-250 words) and EXACTLY 5 True/False/Not Given questions.
Level: ${score} (IELTS band). Topic: ${topicStr}.
Rules:
- Options for every question MUST be exactly: ["TRUE", "FALSE", "NOT GIVEN"]
- Answer must be one of those three strings exactly
- Include at least 1 "NOT GIVEN" answer — information not mentioned in the passage
- "Not given" ≠ "false". "False" means passage explicitly contradicts the statement.
- keyVocabulary: 2-3 topic words from the passage

Respond with ONLY valid JSON:
{"kind":"IELTS","part":"READ_P1","level":${level},"topic":"${topicStr}","passage":"passage text","questions":[{"type":"true_false_ng","prompt":"statement to evaluate","options":["TRUE","FALSE","NOT GIVEN"],"answer":"TRUE","explanation":"The passage states that..."}]}`,
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --testPathPattern=prompts
```

- [ ] **Step 6: Run full build**

```bash
npm run lint && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/exam/prompts.ts src/components/exam/QuestionCard.tsx src/lib/exam/__tests__/prompts.test.ts
git commit -m "feat(exam): add READ_P1 (true_false_ng)"
```

---

### Task 2: LISTEN_S2 — monologue MCQ + sentence_completion

LISTEN_S2 is IELTS Listening Section 2: monologue (NARRATOR only), mix of MCQ and sentence_completion.

**Files:**
- Modify: `src/lib/exam/prompts.ts`

- [ ] **Step 1: Check LISTENING_PARTS includes LISTEN_S2**

```bash
grep "LISTEN_S2" src/components/exam/QuestionCard.tsx
```

If missing, add to the `LISTENING_PARTS` Set.

- [ ] **Step 2: Write test**

```ts
it('LISTEN_S2 prompt includes NARRATOR and sentence_completion', () => {
  const prompt = buildPrompt({ kind: 'IELTS', part: 'LISTEN_S2', level: 3 });
  expect(prompt).toContain('NARRATOR');
  expect(prompt).toContain('sentence_completion');
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=prompts
```

- [ ] **Step 4: Add LISTEN_S2 prompt builder**

```ts
LISTEN_S2: () => `You are an IELTS Listening item writer for Section 2.
Create a monologue (single NARRATOR speaker, 8-10 lines) about a local/community topic.
Level: ${score} (IELTS band). Topic: ${topicStr}.
Include EXACTLY 5 questions — mix of MCQ (3 questions) and sentence_completion (2 questions):
- MCQ: 4 options, answer matches exactly one option
- sentence_completion: answer is 1-3 words from the script, no options field
- keyVocabulary: 2-3 words per question

Respond with ONLY valid JSON:
{"kind":"IELTS","part":"LISTEN_S2","level":${level},"topic":"${topicStr}","script":[{"speaker":"NARRATOR","text":"Welcome to the community centre..."}],"questions":[{"type":"mcq","prompt":"What is the main purpose of the event?","options":["A. Fundraising","B. Entertainment","C. Education","D. Networking"],"answer":"A. Fundraising","explanation":"The narrator says..."},{"type":"sentence_completion","prompt":"The event starts at _____","answer":"7pm","explanation":"The narrator says the event starts at 7pm"}]}`,
```

- [ ] **Step 5: Run test, lint, build, commit**

```bash
npm test -- --testPathPattern=prompts && npm run lint && npm run build
git add src/lib/exam/prompts.ts src/components/exam/QuestionCard.tsx src/lib/exam/__tests__/prompts.test.ts
git commit -m "feat(exam): add LISTEN_S2 (mcq + sentence_completion, monologue)"
```

---

### Task 3: READ_P2 — matching_headings

READ_P2 is IELTS Academic Reading Passage 2: longer passage divided into sections A–F, matching headings from a list (with 2 extra headings).

**Files:**
- Modify: `src/lib/exam/prompts.ts`
- Modify: `src/components/exam/PassageReader.tsx` (add dropdown renderer for matching_headings)

- [ ] **Step 1: Check READING_PARTS includes READ_P2**

```bash
grep "READ_P2" src/components/exam/QuestionCard.tsx
```

- [ ] **Step 2: Write test**

```ts
it('READ_P2 prompt includes matching_headings and section labels', () => {
  const prompt = buildPrompt({ kind: 'IELTS', part: 'READ_P2', level: 3 });
  expect(prompt).toContain('matching_headings');
  expect(prompt).toContain('Section A');
});
```

- [ ] **Step 3: Add READ_P2 prompt builder**

```ts
READ_P2: () => `You are an IELTS Academic Reading item writer for Passage 2.
Create a passage (300-350 words) divided into exactly 4 labelled sections: "Section A:", "Section B:", "Section C:", "Section D:".
Level: ${score} (IELTS band). Topic: ${topicStr}.
Provide a list of 6 headings (4 correct + 2 distractors) numbered i–vi.
Create EXACTLY 4 matching_headings questions — one per section.
Rules:
- prompt = section label (e.g. "Section A")
- options = the 6 headings list (array of 6 strings)
- answer = exact string from options that matches the section
- No two sections share the same answer
- acceptableAnswers: omit

Respond with ONLY valid JSON:
{"kind":"IELTS","part":"READ_P2","level":${level},"topic":"${topicStr}","passage":"Section A: text...\n\nSection B: text...","questions":[{"type":"matching_headings","prompt":"Section A","options":["i. The origins of...","ii. A new approach...","iii. Economic factors...","iv. Cultural impact...","v. Future directions...","vi. Historical context..."],"answer":"ii. A new approach...","explanation":"Section A discusses..."}]}`,
```

- [ ] **Step 4: Add matching_headings renderer in PassageReader**

Read `src/components/exam/PassageReader.tsx` to find the answer input section, then add a `matching_headings` branch:

```bash
cat src/components/exam/PassageReader.tsx | grep -n "options\|completion\|input\|select" | head -20
```

In the answer section of `PassageReader.tsx`, add a dropdown for `matching_headings`:

```tsx
{question.type === 'matching_headings' && question.options ? (
  <select
    value={userAnswer ?? ''}
    onChange={e => !showResult && onAnswer(e.target.value)}
    disabled={showResult}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
  >
    <option value="">— Select heading —</option>
    {question.options.map(opt => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
) : /* existing MCQ or completion input here */ null}
```

- [ ] **Step 5: Run tests, lint, build, commit**

```bash
npm test && npm run lint && npm run build
git add src/lib/exam/prompts.ts src/components/exam/PassageReader.tsx src/lib/exam/__tests__/prompts.test.ts
git commit -m "feat(exam): add READ_P2 (matching_headings + dropdown renderer)"
```

---

### Task 4: LISTEN_S3 — academic discussion MCQ

LISTEN_S3 is IELTS Listening Section 3: 2-3 academic speakers discussing a topic, MCQ only.

**Files:**
- Modify: `src/lib/exam/prompts.ts`

- [ ] **Step 1: Write test**

```ts
it('LISTEN_S3 prompt includes M1 and W1 speakers and mcq', () => {
  const prompt = buildPrompt({ kind: 'IELTS', part: 'LISTEN_S3', level: 3 });
  expect(prompt).toContain('M1');
  expect(prompt).toContain('W1');
  expect(prompt).toContain('mcq');
});
```

- [ ] **Step 2: Add LISTEN_S3 prompt builder**

```ts
LISTEN_S3: () => `You are an IELTS Listening item writer for Section 3.
Create a conversation between 2 students (M1 and W1) or a student and tutor (W1 and M1) discussing an academic topic.
The script should be 10-14 lines long. Level: ${score} (IELTS band). Topic: ${topicStr}.
Create EXACTLY 5 MCQ questions. Each has 4 options and the answer matches exactly one option.

Respond with ONLY valid JSON:
{"kind":"IELTS","part":"LISTEN_S3","level":${level},"topic":"${topicStr}","script":[{"speaker":"W1","text":"I found the research on..."},{"speaker":"M1","text":"Yes, the main argument is..."}],"questions":[{"type":"mcq","prompt":"What does M1 think about the experiment?","options":["A. It was poorly designed","B. It was too expensive","C. The results were inconclusive","D. It was well-conducted"],"answer":"C. The results were inconclusive","explanation":"M1 says the results were inconclusive"}]}`,
```

- [ ] **Step 3: Run test, lint, build, commit**

```bash
npm test -- --testPathPattern=prompts && npm run lint && npm run build
git add src/lib/exam/prompts.ts src/lib/exam/__tests__/prompts.test.ts
git commit -m "feat(exam): add LISTEN_S3 (academic discussion, mcq)"
```

---

### Task 5: LISTEN_S4 — lecture summary_completion

LISTEN_S4 is IELTS Listening Section 4: academic lecture (NARRATOR), summary_completion only — fill blanks with words from the lecture.

**Files:**
- Modify: `src/lib/exam/prompts.ts`

- [ ] **Step 1: Write test**

```ts
it('LISTEN_S4 prompt includes NARRATOR and summary_completion', () => {
  const prompt = buildPrompt({ kind: 'IELTS', part: 'LISTEN_S4', level: 3 });
  expect(prompt).toContain('NARRATOR');
  expect(prompt).toContain('summary_completion');
});
```

- [ ] **Step 2: Add LISTEN_S4 prompt builder**

```ts
LISTEN_S4: () => `You are an IELTS Listening item writer for Section 4.
Create an academic lecture by a single NARRATOR speaker (12-15 lines).
Level: ${score} (IELTS band). Topic: ${topicStr}.
Create EXACTLY 5 summary_completion questions. The answer to each must be 1-3 words found verbatim in the script.
Do NOT include an options field.

Respond with ONLY valid JSON:
{"kind":"IELTS","part":"LISTEN_S4","level":${level},"topic":"${topicStr}","script":[{"speaker":"NARRATOR","text":"Today we will examine..."}],"questions":[{"type":"summary_completion","prompt":"The main cause of the phenomenon is _____","answer":"climate change","acceptableAnswers":["climate change","changing climate"],"explanation":"The lecturer says the main cause is climate change"}]}`,
```

- [ ] **Step 3: Run test, lint, build, commit**

```bash
npm test -- --testPathPattern=prompts && npm run lint && npm run build
git add src/lib/exam/prompts.ts src/lib/exam/__tests__/prompts.test.ts
git commit -m "feat(exam): add LISTEN_S4 (lecture, summary_completion)"
```

---

### Task 6: LC1 — photo_description (text-only fallback)

LC1 is TOEIC Part 1: photo description — 4 spoken statements about a photo, pick the one that best describes it. Since we cannot generate images, the item renders a text description of the photo and a prominent disclaimer.

**Files:**
- Modify: `src/lib/exam/prompts.ts`
- Modify: `src/components/exam/QuestionCard.tsx`

- [ ] **Step 1: Check LISTENING_PARTS includes LC1**

```bash
grep "LC1" src/components/exam/QuestionCard.tsx
```

- [ ] **Step 2: Write test**

```ts
it('LC1 prompt includes imagePrompt and photo_description', () => {
  const prompt = buildPrompt({ kind: 'TOEIC', part: 'LC1', level: 2 });
  expect(prompt).toContain('imagePrompt');
  expect(prompt).toContain('photo_description');
});
```

- [ ] **Step 3: Add LC1 prompt builder**

```ts
LC1: () => `You are a TOEIC Part 1 item writer (Photo Description).
Level: ${score} (TOEIC score band). Topic: ${topicStr}.
Describe a realistic workplace or daily-life scene and produce 4 spoken statements about it.
Only ONE statement correctly describes the scene. The other 3 are plausible but wrong.
Create EXACTLY 1 question of type "photo_description".
imagePrompt: concise English description of the scene (used as alt text, ~20 words).
The script has 4 lines (W1 reads each option A–D aloud).

Respond with ONLY valid JSON:
{"kind":"TOEIC","part":"LC1","level":${level},"topic":"${topicStr}","imagePrompt":"Two people are shaking hands in an office lobby","script":[{"speaker":"W1","text":"(A) Two people are shaking hands."},{"speaker":"W1","text":"(B) A woman is sitting at a desk."},{"speaker":"W1","text":"(C) A man is looking at his phone."},{"speaker":"W1","text":"(D) The lobby is empty."}],"questions":[{"type":"photo_description","prompt":"Which statement best describes the scene?","options":["(A) Two people are shaking hands.","(B) A woman is sitting at a desk.","(C) A man is looking at his phone.","(D) The lobby is empty."],"answer":"(A) Two people are shaking hands.","explanation":"The image shows two people shaking hands in an office lobby.","keyVocabulary":["lobby","shaking hands"]}]}`,
```

- [ ] **Step 4: Add photo_description disclaimer renderer in QuestionCard**

In `src/components/exam/QuestionCard.tsx`, find the section that renders the question prompt (after listening player, before options). Add a text-only photo fallback for LC1:

```tsx
{/* Photo description fallback: show imagePrompt as alt text */}
{item.part === 'LC1' && item.imagePrompt && (
  <div className="mb-3 rounded bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-400 p-3 text-sm text-gray-600 dark:text-gray-400">
    <span className="font-medium">📷 Mô tả ảnh:</span> {item.imagePrompt}
    <span className="ml-2 text-xs italic">(bản không có ảnh)</span>
  </div>
)}
```

- [ ] **Step 5: Run tests, lint, build, commit**

```bash
npm test && npm run lint && npm run build
git add src/lib/exam/prompts.ts src/components/exam/QuestionCard.tsx src/lib/exam/__tests__/prompts.test.ts
git commit -m "feat(exam): add LC1 (photo_description, text-only fallback)"
```

---

### Task 7: Verify all S8 parts with check script

- [ ] **Step 1: Run S0 for S8**

```bash
./scripts/check-phase-6-7.sh 2>&1 | grep -A8 "S8"
```

Expected: all 6 parts ✅
