# Grammar Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/grammar` page with a two-column layout: sidebar of grammar topics + content area showing sub-rules, static examples, and AI-powered examples/exercises.

**Architecture:** Static grammar topics are hardcoded in `grammar-data.ts`; user-added topics are persisted to localStorage and Supabase via three new API routes. The page composes `GrammarSidebar`, `GrammarContent`, and `GrammarExercise` client components.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest + Testing Library, Supabase (existing client), `callWithFallback` from `src/lib/providers/`.

## Global Constraints

- API keys are server-side only — never import `src/lib/providers/` from client components; only from `src/app/api/*/route.ts`.
- All new API routes follow the existing pattern: `callWithFallback` returns `{ text: string, providerId: string }`; set `X-Provider-Used` header and wrap in try/catch returning 503 on failure.
- `localStorage` access must be guarded with `typeof window === "undefined"` checks.
- All UI uses the existing dark-purple color palette: background `bg-[#2c1f4a]`, text `text-[#d9ecff]` / `text-[#b0b0d1]`, accents `text-purple-300` / `bg-purple-600`.
- Run `npm test` after every task and confirm zero regressions before committing.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/grammar-data.ts` | TypeScript interfaces + 8 static topic objects |
| Create | `src/lib/grammar-storage.ts` | localStorage read/write for user-generated topics |
| Create | `src/lib/__tests__/grammar-storage.test.ts` | Unit tests for storage utilities |
| Create | `src/app/api/grammar-generate/route.ts` | AI: generate a full topic from user request |
| Create | `src/app/api/grammar-examples/route.ts` | AI: generate 3 extra examples for a sub-rule |
| Create | `src/app/api/grammar-exercise/route.ts` | AI: generate one fill/MCQ exercise for a sub-rule |
| Create | `src/components/GrammarExercise.tsx` | Inline exercise with answer checking |
| Create | `src/components/__tests__/GrammarExercise.test.tsx` | Unit tests for exercise component |
| Create | `src/components/GrammarContent.tsx` | Content area: sub-rules, AI buttons, exercise slot |
| Create | `src/components/__tests__/GrammarContent.test.tsx` | Unit tests for content component |
| Create | `src/components/GrammarSidebar.tsx` | Sidebar: topic list + add-topic form |
| Create | `src/components/__tests__/GrammarSidebar.test.tsx` | Unit tests for sidebar component |
| Create | `src/app/grammar/page.tsx` | Page: composes sidebar + content, manages state |
| Modify | `src/lib/sync.ts` | Add `pushGrammarTopic()` + grammar pull in `initSync()` |
| Modify | `src/app/layout.tsx` | Add Ngữ pháp navbar link |

---

### Task 1: Static grammar data and types

**Files:**
- Create: `src/lib/grammar-data.ts`

**Interfaces:**
- Produces: `SubRule`, `GrammarTopic`, `STATIC_GRAMMAR_TOPICS` — used by all subsequent tasks.

- [ ] **Step 1: Create `src/lib/grammar-data.ts`**

```typescript
export interface SubRule {
  id: string;
  name: string;
  formula: string;
  explanation: string;
  examples: string[];
}

export interface GrammarTopic {
  id: string;
  name: string;
  rules: SubRule[];
  isUserGenerated?: boolean;
  createdAt?: string;
}

export const STATIC_GRAMMAR_TOPICS: GrammarTopic[] = [
  {
    id: "tenses",
    name: "Tenses",
    rules: [
      {
        id: "present-simple",
        name: "Present Simple",
        formula: "S + V(s/es)  |  S + do/does + not + V",
        explanation: "Used for habits, routines, and general truths.",
        examples: [
          "She works at a hospital.",
          "They don't eat meat.",
          "Water boils at 100°C.",
        ],
      },
      {
        id: "present-continuous",
        name: "Present Continuous",
        formula: "S + am/is/are + V-ing",
        explanation: "Used for actions happening right now or temporary situations.",
        examples: [
          "He is reading a book.",
          "We are staying at a hotel this week.",
          "It is raining outside.",
        ],
      },
      {
        id: "past-simple",
        name: "Past Simple",
        formula: "S + V2  |  S + did + not + V",
        explanation: "Used for completed actions at a specific time in the past.",
        examples: [
          "I visited Paris last summer.",
          "She didn't call me yesterday.",
          "They played football on Sunday.",
        ],
      },
      {
        id: "past-perfect",
        name: "Past Perfect",
        formula: "S + had + V3",
        explanation: "Used for an action that happened before another past action.",
        examples: [
          "By the time he arrived, we had already eaten.",
          "She had never seen snow before moving to Canada.",
          "They had finished the project before the deadline.",
        ],
      },
      {
        id: "future-simple",
        name: "Future Simple",
        formula: "S + will + V",
        explanation: "Used for decisions made at the moment of speaking and predictions.",
        examples: [
          "I will call you tomorrow.",
          "It will probably rain tonight.",
          "She will be a great doctor.",
        ],
      },
    ],
  },
  {
    id: "modal-verbs",
    name: "Modal Verbs",
    rules: [
      {
        id: "can-could",
        name: "can / could",
        formula: "S + can/could + V",
        explanation:
          "'Can' expresses present ability or permission; 'could' expresses past ability or polite requests.",
        examples: [
          "She can speak three languages.",
          "Could you please open the window?",
          "When I was young, I could run very fast.",
        ],
      },
      {
        id: "may-might",
        name: "may / might",
        formula: "S + may/might + V",
        explanation:
          "Both express possibility; 'might' is slightly less certain than 'may'.",
        examples: [
          "It may rain this afternoon.",
          "He might not come to the party.",
          "You may leave early if you finish your work.",
        ],
      },
      {
        id: "must-have-to",
        name: "must / have to",
        formula: "S + must/have to + V",
        explanation:
          "'Must' expresses internal obligation; 'have to' expresses external obligation.",
        examples: [
          "You must wear a seatbelt by law.",
          "I have to submit the report by Friday.",
          "Students must not use phones during exams.",
        ],
      },
      {
        id: "should",
        name: "should",
        formula: "S + should + V",
        explanation: "Expresses advice, recommendation, or expectation.",
        examples: [
          "You should see a doctor.",
          "They should arrive by noon.",
          "We shouldn't stay up too late.",
        ],
      },
      {
        id: "would",
        name: "would",
        formula: "S + would + V",
        explanation: "Used for polite requests, conditional situations, and past habits.",
        examples: [
          "Would you like some coffee?",
          "I would travel more if I had more money.",
          "As a child, he would spend hours reading.",
        ],
      },
    ],
  },
  {
    id: "conditionals",
    name: "Conditionals",
    rules: [
      {
        id: "type-0",
        name: "Type 0 — Zero Conditional",
        formula: "If + present simple, present simple",
        explanation: "Used for general truths and scientific facts.",
        examples: [
          "If you heat water to 100°C, it boils.",
          "If it rains, the ground gets wet.",
          "Plants die if they don't get water.",
        ],
      },
      {
        id: "type-1",
        name: "Type 1 — First Conditional",
        formula: "If + present simple, will + V",
        explanation: "Used for real and possible future situations.",
        examples: [
          "If it rains tomorrow, I will stay home.",
          "You will pass the exam if you study hard.",
          "If she calls, tell her I'm busy.",
        ],
      },
      {
        id: "type-2",
        name: "Type 2 — Second Conditional",
        formula: "If + past simple, would + V",
        explanation: "Used for hypothetical or unlikely present/future situations.",
        examples: [
          "If I had more time, I would travel the world.",
          "She would buy a car if she could drive.",
          "If it weren't so cold, we would go for a walk.",
        ],
      },
      {
        id: "type-3",
        name: "Type 3 — Third Conditional",
        formula: "If + past perfect, would have + V3",
        explanation: "Used to talk about impossible past situations (regrets).",
        examples: [
          "If I had studied harder, I would have passed.",
          "She wouldn't have missed the bus if she had woken up earlier.",
          "If they had known, they would have helped.",
        ],
      },
    ],
  },
  {
    id: "passive-voice",
    name: "Passive Voice",
    rules: [
      {
        id: "present-passive",
        name: "Present Simple Passive",
        formula: "S + am/is/are + V3 (+ by agent)",
        explanation:
          "Used when the focus is on the action or object rather than the doer.",
        examples: [
          "English is spoken in many countries.",
          "The report is written every month.",
          "These cars are made in Germany.",
        ],
      },
      {
        id: "past-passive",
        name: "Past Simple Passive",
        formula: "S + was/were + V3 (+ by agent)",
        explanation:
          "Used for completed past actions where the doer is unknown or unimportant.",
        examples: [
          "The window was broken last night.",
          "The letters were sent yesterday.",
          "This bridge was built in 1890.",
        ],
      },
      {
        id: "perfect-passive",
        name: "Present Perfect Passive",
        formula: "S + has/have been + V3 (+ by agent)",
        explanation: "Used when a recent action affects the present; focus on the result.",
        examples: [
          "The project has been completed.",
          "Several mistakes have been found in the report.",
          "The room has been cleaned.",
        ],
      },
    ],
  },
  {
    id: "relative-clauses",
    name: "Relative Clauses",
    rules: [
      {
        id: "defining",
        name: "Defining Relative Clauses",
        formula: "N + who/which/that + clause",
        explanation:
          "Identifies which person or thing is meant. No commas. Cannot be removed without losing meaning.",
        examples: [
          "The man who called you is my brother.",
          "This is the book that changed my life.",
          "The car which broke down is mine.",
        ],
      },
      {
        id: "non-defining",
        name: "Non-Defining Relative Clauses",
        formula: "N, + which/who + clause,",
        explanation:
          "Adds extra information. Use commas. Can be removed without changing core meaning. Never use 'that'.",
        examples: [
          "My sister, who lives in Hanoi, is a doctor.",
          "The Eiffel Tower, which was built in 1889, is very popular.",
          "He gave me a book, which I found very helpful.",
        ],
      },
    ],
  },
  {
    id: "reported-speech",
    name: "Reported Speech",
    rules: [
      {
        id: "reported-statements",
        name: "Reporting Statements",
        formula: "S + said (that) + clause  (tenses shift back one step)",
        explanation:
          "When reporting what someone said, verb tenses generally shift back one step.",
        examples: [
          "'I am tired.' → She said she was tired.",
          "'We will come.' → They said they would come.",
          "'I have finished.' → He said he had finished.",
        ],
      },
      {
        id: "reported-questions",
        name: "Reporting Questions",
        formula: "S + asked if/whether + clause  |  S + asked + wh-word + clause",
        explanation:
          "Reported questions use statement word order (no inversion) and no question mark.",
        examples: [
          "'Are you coming?' → She asked if I was coming.",
          "'Where do you live?' → He asked where I lived.",
          "'What time is it?' → She asked what time it was.",
        ],
      },
      {
        id: "reported-commands",
        name: "Reporting Commands",
        formula: "S + told/asked + O + to + V",
        explanation:
          "Imperatives are reported using 'told' (commands) or 'asked' (requests) followed by the infinitive.",
        examples: [
          "'Sit down.' → She told him to sit down.",
          "'Please help me.' → He asked her to help him.",
          "'Don't be late.' → She told them not to be late.",
        ],
      },
    ],
  },
  {
    id: "articles",
    name: "Articles",
    rules: [
      {
        id: "a-an",
        name: "a / an (Indefinite Article)",
        formula: "a + consonant sound  |  an + vowel sound",
        explanation:
          "Used with singular countable nouns when mentioned for the first time or when one of many.",
        examples: [
          "She is a doctor.",
          "I saw an elephant at the zoo.",
          "Can I borrow a pen?",
        ],
      },
      {
        id: "the",
        name: "the (Definite Article)",
        formula: "the + noun (singular or plural)",
        explanation: "Used when the noun is specific, already mentioned, or unique.",
        examples: [
          "The book on the table is mine.",
          "The sun rises in the east.",
          "Please close the door.",
        ],
      },
      {
        id: "zero-article",
        name: "Zero Article",
        formula: "∅ + noun",
        explanation:
          "No article used with plural/uncountable nouns for generalizations, proper nouns, and fixed expressions.",
        examples: [
          "Dogs are loyal animals.",
          "She studies medicine at university.",
          "He goes to school by bus.",
        ],
      },
    ],
  },
  {
    id: "prepositions",
    name: "Prepositions",
    rules: [
      {
        id: "prepositions-time",
        name: "Prepositions of Time",
        formula: "at (specific time)  |  on (day/date)  |  in (month/year/period)",
        explanation:
          "'At' for clock times; 'on' for days and dates; 'in' for longer periods.",
        examples: [
          "The meeting starts at 9 o'clock.",
          "She was born on March 15th.",
          "I visited Japan in 2022.",
        ],
      },
      {
        id: "prepositions-place",
        name: "Prepositions of Place",
        formula: "at (point/location)  |  on (surface)  |  in (enclosed space)",
        explanation:
          "'At' for specific locations; 'on' for surfaces or lines; 'in' for enclosed spaces.",
        examples: [
          "She is waiting at the bus stop.",
          "The keys are on the table.",
          "He lives in Hanoi.",
        ],
      },
      {
        id: "prepositions-movement",
        name: "Prepositions of Movement",
        formula: "to (destination)  |  into (enclosed)  |  onto (surface)  |  through",
        explanation: "Describe direction and destination of an action.",
        examples: [
          "We walked to the park.",
          "She jumped into the swimming pool.",
          "He climbed onto the roof.",
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors for `grammar-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/grammar-data.ts
git commit -m "feat: add static grammar data and TypeScript interfaces"
```

---

### Task 2: Grammar localStorage utilities

**Files:**
- Create: `src/lib/grammar-storage.ts`
- Create: `src/lib/__tests__/grammar-storage.test.ts`

**Interfaces:**
- Consumes: `GrammarTopic` from `./grammar-data`
- Produces: `getUserGrammarTopics(): GrammarTopic[]`, `saveUserGrammarTopic(topic: GrammarTopic): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/grammar-storage.test.ts`:

```typescript
import { getUserGrammarTopics, saveUserGrammarTopic } from "../grammar-storage";

const mockTopic = {
  id: "test-topic",
  name: "Test Topic",
  isUserGenerated: true as const,
  createdAt: "2026-07-27T00:00:00.000Z",
  rules: [
    {
      id: "rule-1",
      name: "Rule One",
      formula: "S + V",
      explanation: "Basic sentence.",
      examples: ["He runs.", "She eats."],
    },
  ],
};

describe("grammar-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getUserGrammarTopics()).toEqual([]);
  });

  it("saves and retrieves a topic", () => {
    saveUserGrammarTopic(mockTopic);
    expect(getUserGrammarTopics()).toEqual([mockTopic]);
  });

  it("appends a second distinct topic", () => {
    saveUserGrammarTopic(mockTopic);
    const second = { ...mockTopic, id: "topic-2", name: "Topic 2" };
    saveUserGrammarTopic(second);
    expect(getUserGrammarTopics()).toHaveLength(2);
  });

  it("updates existing topic when id matches", () => {
    saveUserGrammarTopic(mockTopic);
    const updated = { ...mockTopic, name: "Updated Name" };
    saveUserGrammarTopic(updated);
    const result = getUserGrammarTopics();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Updated Name");
  });

  it("returns empty array when stored value is malformed JSON", () => {
    localStorage.setItem("grammarTopics", "not-json");
    expect(getUserGrammarTopics()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=grammar-storage -t "" 2>&1 | tail -20
```

Expected: FAIL — `getUserGrammarTopics` not found.

- [ ] **Step 3: Implement `src/lib/grammar-storage.ts`**

```typescript
import { type GrammarTopic } from "./grammar-data";

const STORAGE_KEY = "grammarTopics";

export function getUserGrammarTopics(): GrammarTopic[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GrammarTopic[]) : [];
  } catch {
    return [];
  }
}

export function saveUserGrammarTopic(topic: GrammarTopic): void {
  const topics = getUserGrammarTopics();
  const idx = topics.findIndex((t) => t.id === topic.id);
  if (idx >= 0) {
    topics[idx] = topic;
  } else {
    topics.push(topic);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=grammar-storage 2>&1 | tail -20
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npm test 2>&1 | tail -10
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grammar-storage.ts src/lib/__tests__/grammar-storage.test.ts
git commit -m "feat: add grammar localStorage utilities"
```

---

### Task 3: Three AI API routes

**Files:**
- Create: `src/app/api/grammar-generate/route.ts`
- Create: `src/app/api/grammar-examples/route.ts`
- Create: `src/app/api/grammar-exercise/route.ts`

**Interfaces:**
- Consumes: `callWithFallback` from `@/lib/providers`
- Produces:
  - `POST /api/grammar-generate` → `GrammarTopic` JSON
  - `POST /api/grammar-examples` → `{ examples: string[] }`
  - `POST /api/grammar-exercise` → `{ type: "fill"|"mcq", question: string, options?: string[], answer: string }`

Note: these routes call external AI — no unit tests. Verify manually after the page is built (Task 7).

- [ ] **Step 1: Create `src/app/api/grammar-generate/route.ts`**

```typescript
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { request, provider, disabledProviders } = (await req.json()) as {
    request: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!request?.trim()) {
    return NextResponse.json({ error: "request is required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";
    const now = new Date().toISOString();

    const prompt = `You are an English grammar expert. Generate a grammar topic for: "${request}"

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "id": "kebab-case-id",
  "name": "Topic Display Name",
  "isUserGenerated": true,
  "createdAt": "${now}",
  "rules": [
    {
      "id": "sub-rule-kebab-id",
      "name": "Sub-rule Name",
      "formula": "grammatical structure or pattern",
      "explanation": "Clear 1-2 sentence explanation in plain English",
      "examples": ["Example sentence 1.", "Example sentence 2.", "Example sentence 3."]
    }
  ]
}
Include 3-6 sub-rules covering the key aspects of this topic.`;

    const result = await callWithFallback(prompt, provider, disabledProviders);
    resolvedProviderId = result.providerId;

    const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
    const topic = JSON.parse(cleaned);

    return NextResponse.json(topic, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("grammar-generate failed", error);
    return NextResponse.json(
      { error: "Không thể tạo ngữ pháp lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
```

- [ ] **Step 2: Create `src/app/api/grammar-examples/route.ts`**

```typescript
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { topic, subRule, provider, disabledProviders } = (await req.json()) as {
    topic: string;
    subRule: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!topic || !subRule) {
    return NextResponse.json({ error: "topic and subRule are required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";

    const prompt = `Generate 3 new example sentences for the "${subRule}" rule in ${topic} English grammar.
Make the sentences clear, natural, and at intermediate level.
Return ONLY JSON (no markdown, no extra text): { "examples": ["sentence1", "sentence2", "sentence3"] }`;

    const result = await callWithFallback(prompt, provider, disabledProviders);
    resolvedProviderId = result.providerId;

    const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
    const data = JSON.parse(cleaned) as { examples: string[] };

    return NextResponse.json(data, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("grammar-examples failed", error);
    return NextResponse.json(
      { error: "Không thể tạo ví dụ lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
```

- [ ] **Step 3: Create `src/app/api/grammar-exercise/route.ts`**

```typescript
import { callWithFallback } from "@/lib/providers";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const { topic, subRule, provider, disabledProviders } = (await req.json()) as {
    topic: string;
    subRule: string;
    provider?: string;
    disabledProviders?: string[];
  };

  if (!topic || !subRule) {
    return NextResponse.json({ error: "topic and subRule are required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let resolvedProviderId = "";

    const prompt = `Create one grammar exercise testing the "${subRule}" rule in ${topic}.
Choose fill-in-the-blank for rules where the correct form is predictable, MCQ for rules with tricky options.

Return ONLY one of these JSON formats (no markdown, no extra text):
Fill-in-the-blank: { "type": "fill", "question": "She ___ to school every day.", "answer": "goes" }
Multiple choice:   { "type": "mcq", "question": "Choose the correct form:", "options": ["opt1", "opt2", "opt3", "opt4"], "answer": "correct option" }`;

    const result = await callWithFallback(prompt, provider, disabledProviders);
    resolvedProviderId = result.providerId;

    const cleaned = result.text.replace(/```json\n?|```/g, "").trim();
    const exercise = JSON.parse(cleaned);

    return NextResponse.json(exercise, {
      headers: { ...NO_STORE, "X-Provider-Used": resolvedProviderId },
    });
  } catch (error) {
    console.error("grammar-exercise failed", error);
    return NextResponse.json(
      { error: "Không thể tạo bài tập lúc này. Vui lòng thử lại." },
      { status: 503, headers: NO_STORE }
    );
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors in the three new route files.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/grammar-generate src/app/api/grammar-examples src/app/api/grammar-exercise
git commit -m "feat: add grammar AI API routes (generate, examples, exercise)"
```

---

### Task 4: GrammarExercise component

**Files:**
- Create: `src/components/GrammarExercise.tsx`
- Create: `src/components/__tests__/GrammarExercise.test.tsx`

**Interfaces:**
- Consumes: nothing external
- Produces: `export default function GrammarExercise({ exercise }: { exercise: Exercise })` — used by `GrammarContent`

Where `Exercise` is defined in the same file:
```typescript
interface FillExercise { type: "fill"; question: string; answer: string; }
interface MCQExercise  { type: "mcq";  question: string; options: string[]; answer: string; }
export type Exercise = FillExercise | MCQExercise;
```

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/GrammarExercise.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import GrammarExercise from "../GrammarExercise";

const fillExercise = {
  type: "fill" as const,
  question: "She ___ to school every day.",
  answer: "goes",
};

const mcqExercise = {
  type: "mcq" as const,
  question: "Choose the correct form:",
  options: ["go", "goes", "went", "going"],
  answer: "goes",
};

describe("GrammarExercise — fill-in-the-blank", () => {
  it("renders the question text", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    expect(screen.getByText(/She ___ to school every day/)).toBeInTheDocument();
  });

  it("renders a text input and Kiểm tra button", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeInTheDocument();
  });

  it("shows Đúng feedback for correct answer", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    expect(screen.getByText(/Đúng/)).toBeInTheDocument();
  });

  it("shows Sai feedback and correct answer for wrong input", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    expect(screen.getByText(/Sai/)).toBeInTheDocument();
    expect(screen.getByText("goes")).toBeInTheDocument();
  });

  it("answer check is case-insensitive", () => {
    render(<GrammarExercise exercise={fillExercise} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "GOES" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    expect(screen.getByText(/Đúng/)).toBeInTheDocument();
  });
});

describe("GrammarExercise — MCQ", () => {
  it("renders all options as buttons", () => {
    render(<GrammarExercise exercise={mcqExercise} />);
    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.getByText("goes")).toBeInTheDocument();
    expect(screen.getByText("went")).toBeInTheDocument();
    expect(screen.getByText("going")).toBeInTheDocument();
  });

  it("shows Đúng feedback when correct option clicked", () => {
    render(<GrammarExercise exercise={mcqExercise} />);
    fireEvent.click(screen.getByText("goes"));
    expect(screen.getByText(/Đúng/)).toBeInTheDocument();
  });

  it("shows Sai feedback when wrong option clicked", () => {
    render(<GrammarExercise exercise={mcqExercise} />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText(/Sai/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=GrammarExercise 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/GrammarExercise.tsx`**

```typescript
"use client";

import { useState } from "react";

interface FillExercise {
  type: "fill";
  question: string;
  answer: string;
}

interface MCQExercise {
  type: "mcq";
  question: string;
  options: string[];
  answer: string;
}

export type Exercise = FillExercise | MCQExercise;

export default function GrammarExercise({ exercise }: { exercise: Exercise }) {
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);

  function check() {
    const answer = exercise.type === "fill" ? userAnswer.trim() : (selectedOption ?? "");
    setResult(
      answer.toLowerCase() === exercise.answer.toLowerCase() ? "correct" : "incorrect"
    );
  }

  function reset() {
    setUserAnswer("");
    setSelectedOption(null);
    setResult(null);
  }

  if (exercise.type === "fill") {
    return (
      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="mb-3 text-sm text-[#d9ecff]">{exercise.question}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={result !== null}
            placeholder="Nhập câu trả lời..."
            onKeyDown={(e) => e.key === "Enter" && result === null && userAnswer.trim() && check()}
            className="flex-1 rounded bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
          />
          {result === null ? (
            <button
              onClick={check}
              disabled={!userAnswer.trim()}
              className="rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40"
            >
              Kiểm tra
            </button>
          ) : (
            <button
              onClick={reset}
              className="rounded bg-white/10 px-3 py-1.5 text-sm font-medium text-[#d9ecff] hover:bg-white/20"
            >
              Thử lại
            </button>
          )}
        </div>
        {result === "correct" && (
          <p className="mt-2 text-sm font-medium text-green-400">Đúng rồi!</p>
        )}
        {result === "incorrect" && (
          <p className="mt-2 text-sm text-red-400">
            Sai. Đáp án:{" "}
            <span className="font-medium text-white">{exercise.answer}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="mb-3 text-sm text-[#d9ecff]">{exercise.question}</p>
      <div className="flex flex-col gap-2">
        {exercise.options.map((opt) => {
          const isCorrect = result !== null && opt === exercise.answer;
          const isWrong = result !== null && opt === selectedOption && opt !== exercise.answer;
          return (
            <button
              key={opt}
              onClick={() => {
                if (result !== null) return;
                setSelectedOption(opt);
                setResult(
                  opt.toLowerCase() === exercise.answer.toLowerCase() ? "correct" : "incorrect"
                );
              }}
              className={`rounded px-3 py-2 text-left text-sm transition-colors ${
                isCorrect
                  ? "bg-green-600/30 text-green-300"
                  : isWrong
                  ? "bg-red-600/30 text-red-300"
                  : "bg-white/10 text-[#d9ecff] hover:bg-white/20"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {result === "correct" && (
        <p className="mt-2 text-sm font-medium text-green-400">Đúng rồi!</p>
      )}
      {result === "incorrect" && (
        <p className="mt-2 text-sm text-red-400">
          Đáp án: <span className="font-medium text-white">{exercise.answer}</span>
        </p>
      )}
      {result !== null && (
        <button onClick={reset} className="mt-2 text-sm text-purple-400 hover:text-purple-300">
          Thử lại
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=GrammarExercise 2>&1 | tail -15
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/GrammarExercise.tsx src/components/__tests__/GrammarExercise.test.tsx
git commit -m "feat: add GrammarExercise component with fill and MCQ modes"
```

---

### Task 5: GrammarContent component

**Files:**
- Create: `src/components/GrammarContent.tsx`
- Create: `src/components/__tests__/GrammarContent.test.tsx`

**Interfaces:**
- Consumes: `GrammarTopic` from `@/lib/grammar-data`; `Exercise` + `GrammarExercise` from `./GrammarExercise`
- Produces: `export default function GrammarContent({ topic }: { topic: GrammarTopic })`

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/GrammarContent.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import GrammarContent from "../GrammarContent";
import { STATIC_GRAMMAR_TOPICS } from "../../lib/grammar-data";

const tensesTopic = STATIC_GRAMMAR_TOPICS[0]; // "Tenses"

describe("GrammarContent", () => {
  it("renders the topic name as heading", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(screen.getByRole("heading", { name: "Tenses" })).toBeInTheDocument();
  });

  it("renders each sub-rule name", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(screen.getByText("Present Simple")).toBeInTheDocument();
    expect(screen.getByText("Past Simple")).toBeInTheDocument();
  });

  it("renders the formula for each sub-rule", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(
      screen.getByText("S + V(s/es)  |  S + do/does + not + V")
    ).toBeInTheDocument();
  });

  it("renders static example sentences", () => {
    render(<GrammarContent topic={tensesTopic} />);
    expect(screen.getByText("She works at a hospital.")).toBeInTheDocument();
  });

  it("renders Thêm ví dụ buttons for each sub-rule", () => {
    render(<GrammarContent topic={tensesTopic} />);
    const buttons = screen.getAllByRole("button", { name: /Thêm ví dụ/ });
    expect(buttons).toHaveLength(tensesTopic.rules.length);
  });

  it("renders Luyện tập buttons for each sub-rule", () => {
    render(<GrammarContent topic={tensesTopic} />);
    const buttons = screen.getAllByRole("button", { name: /Luyện tập/ });
    expect(buttons).toHaveLength(tensesTopic.rules.length);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=GrammarContent 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/GrammarContent.tsx`**

```typescript
"use client";

import { useState } from "react";
import { type GrammarTopic, type SubRule } from "@/lib/grammar-data";
import GrammarExercise, { type Exercise } from "./GrammarExercise";

export default function GrammarContent({ topic }: { topic: GrammarTopic }) {
  const [aiExamples, setAiExamples] = useState<Record<string, string[]>>({});
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [loadingExamples, setLoadingExamples] = useState<Set<string>>(new Set());
  const [loadingExercise, setLoadingExercise] = useState<Set<string>>(new Set());

  async function fetchExamples(rule: SubRule) {
    if (loadingExamples.has(rule.id)) return;
    setLoadingExamples((prev) => new Set(prev).add(rule.id));
    try {
      const res = await fetch("/api/grammar-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.name, subRule: rule.name }),
      });
      const data = (await res.json()) as { examples: string[] };
      setAiExamples((prev) => ({ ...prev, [rule.id]: data.examples }));
    } finally {
      setLoadingExamples((prev) => {
        const s = new Set(prev);
        s.delete(rule.id);
        return s;
      });
    }
  }

  async function fetchExercise(rule: SubRule) {
    if (loadingExercise.has(rule.id)) return;
    setLoadingExercise((prev) => new Set(prev).add(rule.id));
    try {
      const res = await fetch("/api/grammar-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.name, subRule: rule.name }),
      });
      const data = (await res.json()) as Exercise;
      setExercises((prev) => ({ ...prev, [rule.id]: data }));
    } finally {
      setLoadingExercise((prev) => {
        const s = new Set(prev);
        s.delete(rule.id);
        return s;
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#d9ecff]">{topic.name}</h1>
      {topic.rules.map((rule) => (
        <div
          key={rule.id}
          className="rounded-xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">{rule.name}</h2>
          <code className="mb-3 block rounded bg-black/30 px-3 py-2 font-mono text-sm text-purple-300">
            {rule.formula}
          </code>
          <p className="mb-4 text-sm text-[#b0b0d1]">{rule.explanation}</p>
          <ul className="mb-4 space-y-1.5">
            {rule.examples.map((ex, i) => (
              <li
                key={i}
                className="text-sm text-[#d9ecff] before:mr-2 before:text-purple-400 before:content-['→']"
              >
                {ex}
              </li>
            ))}
            {(aiExamples[rule.id] ?? []).map((ex, i) => (
              <li
                key={`ai-${i}`}
                className="italic text-sm text-[#d9ecff]/80 before:mr-2 before:text-purple-300 before:content-['→']"
              >
                {ex}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => fetchExamples(rule)}
              disabled={loadingExamples.has(rule.id)}
              className="rounded bg-white/10 px-3 py-1.5 text-xs font-medium text-[#d9ecff] hover:bg-white/20 disabled:opacity-50"
            >
              {loadingExamples.has(rule.id) ? "Đang tạo..." : "+ Thêm ví dụ"}
            </button>
            <button
              onClick={() => fetchExercise(rule)}
              disabled={loadingExercise.has(rule.id)}
              className="rounded bg-purple-700/50 px-3 py-1.5 text-xs font-medium text-[#d9ecff] hover:bg-purple-700/70 disabled:opacity-50"
            >
              {loadingExercise.has(rule.id) ? "Đang tạo..." : "Luyện tập"}
            </button>
          </div>
          {exercises[rule.id] && <GrammarExercise exercise={exercises[rule.id]} />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=GrammarContent 2>&1 | tail -15
```

Expected: PASS — 6 tests passing.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/GrammarContent.tsx src/components/__tests__/GrammarContent.test.tsx
git commit -m "feat: add GrammarContent component"
```

---

### Task 6: GrammarSidebar component

**Files:**
- Create: `src/components/GrammarSidebar.tsx`
- Create: `src/components/__tests__/GrammarSidebar.test.tsx`

**Interfaces:**
- Consumes: `GrammarTopic` from `@/lib/grammar-data`
- Produces:
```typescript
export default function GrammarSidebar(props: {
  topics: GrammarTopic[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddTopic: (request: string) => void;
  isAdding: boolean;
})
```

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/GrammarSidebar.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import GrammarSidebar from "../GrammarSidebar";
import { STATIC_GRAMMAR_TOPICS } from "../../lib/grammar-data";

const mockOnSelect = jest.fn();
const mockOnAddTopic = jest.fn();

const defaultProps = {
  topics: STATIC_GRAMMAR_TOPICS,
  selectedId: STATIC_GRAMMAR_TOPICS[0].id,
  onSelect: mockOnSelect,
  onAddTopic: mockOnAddTopic,
  isAdding: false,
};

describe("GrammarSidebar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders all topic names", () => {
    render(<GrammarSidebar {...defaultProps} />);
    expect(screen.getByText("Tenses")).toBeInTheDocument();
    expect(screen.getByText("Modal Verbs")).toBeInTheDocument();
    expect(screen.getByText("Conditionals")).toBeInTheDocument();
  });

  it("calls onSelect with topic id when a topic is clicked", () => {
    render(<GrammarSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText("Modal Verbs"));
    expect(mockOnSelect).toHaveBeenCalledWith("modal-verbs");
  });

  it("renders sub-rule count for each topic", () => {
    render(<GrammarSidebar {...defaultProps} />);
    // Tenses has 5 rules
    const counts = screen.getAllByText("5");
    expect(counts.length).toBeGreaterThan(0);
  });

  it("calls onAddTopic with trimmed input when form submitted", () => {
    render(<GrammarSidebar {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Nhập chủ đề mới/), {
      target: { value: "  Inversion  " },
    });
    fireEvent.submit(screen.getByRole("form"));
    expect(mockOnAddTopic).toHaveBeenCalledWith("Inversion");
  });

  it("does not call onAddTopic when input is blank", () => {
    render(<GrammarSidebar {...defaultProps} />);
    fireEvent.submit(screen.getByRole("form"));
    expect(mockOnAddTopic).not.toHaveBeenCalled();
  });

  it("disables input and button while isAdding is true", () => {
    render(<GrammarSidebar {...defaultProps} isAdding={true} />);
    expect(screen.getByPlaceholderText(/Nhập chủ đề mới/)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Đang tạo/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=GrammarSidebar 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/GrammarSidebar.tsx`**

```typescript
"use client";

import { useState } from "react";
import { type GrammarTopic } from "@/lib/grammar-data";

interface Props {
  topics: GrammarTopic[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddTopic: (request: string) => void;
  isAdding: boolean;
}

export default function GrammarSidebar({
  topics,
  selectedId,
  onSelect,
  onAddTopic,
  isAdding,
}: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onAddTopic(trimmed);
    setInput("");
  }

  return (
    <aside className="flex w-64 flex-none flex-col gap-1">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[#b0b0d1]">
        Chủ đề ngữ pháp
      </p>
      {topics.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
            selectedId === t.id
              ? "bg-purple-600/40 font-medium text-white"
              : "text-[#b0b0d1] hover:bg-white/10 hover:text-white"
          }`}
        >
          <span>{t.name}</span>
          <span className="ml-2 shrink-0 text-xs text-white/40">{t.rules.length}</span>
        </button>
      ))}
      <div className="mt-4 border-t border-white/10 pt-4">
        <form onSubmit={handleSubmit} aria-label="form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAdding}
            placeholder="Nhập chủ đề mới..."
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAdding}
            className="mt-2 w-full rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40"
          >
            {isAdding ? "Đang tạo..." : "+ Thêm chủ đề"}
          </button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=GrammarSidebar 2>&1 | tail -15
```

Expected: PASS — 6 tests passing.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/GrammarSidebar.tsx src/components/__tests__/GrammarSidebar.test.tsx
git commit -m "feat: add GrammarSidebar component"
```

---

### Task 7: Grammar page and navbar link

**Files:**
- Create: `src/app/grammar/page.tsx`
- Modify: `src/app/layout.tsx` (add navbar link)

**Interfaces:**
- Consumes: `STATIC_GRAMMAR_TOPICS`, `GrammarTopic` from `@/lib/grammar-data`; `getUserGrammarTopics`, `saveUserGrammarTopic` from `@/lib/grammar-storage`; `GrammarSidebar`, `GrammarContent` components

Note: The grammar page is a client component that orchestrates sidebar + content. No new unit tests — verify manually by running the dev server.

- [ ] **Step 1: Create `src/app/grammar/page.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { STATIC_GRAMMAR_TOPICS, type GrammarTopic } from "@/lib/grammar-data";
import { getUserGrammarTopics, saveUserGrammarTopic } from "@/lib/grammar-storage";
import GrammarSidebar from "@/components/GrammarSidebar";
import GrammarContent from "@/components/GrammarContent";

export default function GrammarPage() {
  const [userTopics, setUserTopics] = useState<GrammarTopic[]>([]);
  const [selectedId, setSelectedId] = useState(STATIC_GRAMMAR_TOPICS[0].id);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setUserTopics(getUserGrammarTopics());
  }, []);

  const allTopics = [...STATIC_GRAMMAR_TOPICS, ...userTopics];
  const selectedTopic = allTopics.find((t) => t.id === selectedId) ?? allTopics[0];

  async function handleAddTopic(request: string) {
    setIsAdding(true);
    try {
      const res = await fetch("/api/grammar-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      if (!res.ok) return;
      const topic = (await res.json()) as GrammarTopic;
      saveUserGrammarTopic(topic);
      setUserTopics((prev) => [...prev, topic]);
      setSelectedId(topic.id);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Mobile: topic selector */}
      <div className="mb-4 md:hidden">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg bg-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          {allTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <GrammarSidebar
            topics={allTopics}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddTopic={handleAddTopic}
            isAdding={isAdding}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <GrammarContent topic={selectedTopic} />
        </div>
      </div>

      {/* Mobile: add topic section */}
      <div className="mt-6 md:hidden">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-sm font-medium text-[#d9ecff]">Thêm chủ đề ngữ pháp</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = (fd.get("request") as string).trim();
              if (val) {
                void handleAddTopic(val);
                e.currentTarget.reset();
              }
            }}
            className="flex gap-2"
          >
            <input
              name="request"
              type="text"
              placeholder="Nhập chủ đề mới..."
              disabled={isAdding}
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isAdding}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40"
            >
              {isAdding ? "..." : "+"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add Ngữ pháp link to navbar in `src/app/layout.tsx`**

In `layout.tsx`, find the existing `Nhật ký` link block and insert the new link immediately after it:

```diff
                   <a
                     href="/diary"
                     className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
                   >
                     Nhật ký
                   </a>
+                  <a
+                    href="/grammar"
+                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
+                  >
+                    Ngữ pháp
+                  </a>
                   <a
                     href="/history"
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build with no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/grammar` and confirm:
- Sidebar shows 8 topics with sub-rule counts
- Clicking a topic loads its content on the right
- Formula code block renders in monospace purple
- "Ngữ pháp" link appears in navbar after "Nhật ký"
- Mobile: dropdown replaces sidebar, add-topic form appears at bottom

- [ ] **Step 6: Commit**

```bash
git add src/app/grammar/page.tsx src/app/layout.tsx
git commit -m "feat: add /grammar page with sidebar/content layout and navbar link"
```

---

### Task 8: Supabase grammar_topics table and sync

**Files:**
- Modify: `src/lib/sync.ts` (add `pushGrammarTopic` + grammar pull in `initSync`)

**Interfaces:**
- Consumes: `GrammarTopic` from `@/lib/grammar-data`; `getUserGrammarTopics`, `saveUserGrammarTopic` from `./grammar-storage`; `getSyncKey`, `createSupabase` already imported in `sync.ts`
- Produces: `export async function pushGrammarTopic(topic: GrammarTopic): Promise<void>`

- [ ] **Step 1: Create the Supabase table**

Run this SQL in your Supabase project dashboard (SQL editor):

```sql
create table if not exists grammar_topics (
  sync_key   text        not null,
  id         text        not null,
  name       text        not null,
  rules      jsonb       not null,
  created_at timestamptz not null default now(),
  primary key (sync_key, id)
);
```

- [ ] **Step 2: Add `pushGrammarTopic` to `src/lib/sync.ts`**

Add this import at the top of `sync.ts` (after the existing imports):

```typescript
import { type GrammarTopic } from "./grammar-data";
import { getUserGrammarTopics, saveUserGrammarTopic } from "./grammar-storage";
```

Add this function after the existing `pushTopic` function:

```typescript
export async function pushGrammarTopic(topic: GrammarTopic): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("grammar_topics").upsert({
      sync_key: syncKey,
      id: topic.id,
      name: topic.name,
      rules: topic.rules,
      created_at: topic.createdAt ?? new Date().toISOString(),
    });
  } catch { /* fire-and-forget */ }
}
```

- [ ] **Step 3: Add grammar pull inside `initSync()` in `src/lib/sync.ts`**

Inside `initSync()`, in the `try` block, after the existing `remoteTopics` pull (around line 179), add:

```typescript
    // Push local user-generated grammar topics
    const localGrammarTopics = getUserGrammarTopics();
    if (localGrammarTopics.length > 0) {
      await supabase.from("grammar_topics").upsert(
        localGrammarTopics.map((t) => ({
          sync_key: syncKey,
          id: t.id,
          name: t.name,
          rules: t.rules,
          created_at: t.createdAt ?? new Date().toISOString(),
        }))
      );
    }

    // Pull remote grammar topics
    const { data: remoteGrammarTopics } = await supabase
      .from("grammar_topics")
      .select("*")
      .eq("sync_key", syncKey);

    if (remoteGrammarTopics) {
      const localGrammarMap = new Map(localGrammarTopics.map((t) => [t.id, t]));
      for (const row of remoteGrammarTopics) {
        if (!localGrammarMap.has(row.id as string)) {
          saveUserGrammarTopic({
            id: row.id as string,
            name: row.name as string,
            rules: row.rules as GrammarTopic["rules"],
            isUserGenerated: true,
            createdAt: row.created_at as string,
          });
        }
      }
    }
```

- [ ] **Step 4: Update `src/app/grammar/page.tsx` to call `pushGrammarTopic` after save**

In `handleAddTopic` in `grammar/page.tsx`, add the push call after `saveUserGrammarTopic`:

```diff
       const topic = (await res.json()) as GrammarTopic;
       saveUserGrammarTopic(topic);
+      void pushGrammarTopic(topic);
       setUserTopics((prev) => [...prev, topic]);
       setSelectedId(topic.id);
```

Also add the import at the top of `grammar/page.tsx`:

```typescript
import { pushGrammarTopic } from "@/lib/sync";
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build.

- [ ] **Step 6: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync.ts src/app/grammar/page.tsx
git commit -m "feat: add Supabase sync for user-generated grammar topics"
```

---

## Done

After Task 8, the grammar page is fully functional:
- 8 static topics with sub-rules, formulas, and examples
- AI-generated extra examples and exercises per sub-rule
- User can add custom grammar topics (AI-generated, persisted to localStorage + Supabase)
- Two-column sidebar/content layout on desktop, dropdown + bottom form on mobile
- Navbar link added
