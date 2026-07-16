# English Self-Study Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal English vocabulary flashcard website powered by Google Gemini API with localStorage history.

**Architecture:** Next.js App Router handles both the React frontend and server-side API routes (keeping the Gemini API key server-only). Two pages: main study page (`/`) and history page (`/history`). All persistence via localStorage — no database, no auth.

**Tech Stack:** Next.js 14 (App Router), TypeScript, TailwindCSS, `@google/generative-ai`, Jest + React Testing Library

## Global Constraints

- Node.js 18+
- Gemini model: `gemini-1.5-flash` (free tier)
- `GEMINI_API_KEY` lives in `.env.local` only — never imported in client components
- All client components must have `"use client"` directive
- Vietnamese UI text throughout (labels, buttons, placeholders)
- localStorage key: `"learnedWords"`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/storage.ts` | Read/write `learnedWords` in localStorage |
| `src/lib/gemini.ts` | Wrapper around `@google/generative-ai` — two exported functions |
| `src/app/api/generate-words/route.ts` | POST endpoint: topic → 5 words |
| `src/app/api/generate-sentence/route.ts` | POST endpoint: word → example sentence |
| `src/components/TopicSelector.tsx` | Topic pill buttons (Daily Communication / TOEIC) |
| `src/components/Flashcard.tsx` | Single flip card — fetches sentence on flip, saves on "Đã học" |
| `src/components/FlashcardGrid.tsx` | Renders 5 Flashcard instances |
| `src/app/layout.tsx` | Root layout with nav (Học từ mới / Lịch sử) |
| `src/app/page.tsx` | Main study page — wires TopicSelector + FlashcardGrid |
| `src/app/history/page.tsx` | History page — reads localStorage, filter by topic, delete |
| `src/app/globals.css` | Tailwind directives |
| `jest.config.ts` | Jest config using `next/jest` |
| `jest.setup.ts` | `@testing-library/jest-dom` import |

---

## Task 1: Project Scaffolding

**Files:**
- Create: project root (via `create-next-app`)
- Create: `.env.local.example`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `package.json` (add test script + jest deps)

**Interfaces:**
- Produces: runnable Next.js dev server + working `npm test`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/thankz/Code/study
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

When prompted, accept defaults (TypeScript ✓, ESLint ✓, Tailwind ✓, `src/` dir ✓, App Router ✓, import alias `@/*` ✓).

- [ ] **Step 2: Install Gemini SDK and testing dependencies**

```bash
npm install @google/generative-ai
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest ts-jest
```

- [ ] **Step 3: Create `jest.config.ts`**

```ts
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default createJestConfig(config);
```

- [ ] **Step 4: Create `jest.setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, inside `"scripts"`, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Create `.env.local.example`**

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Then copy it to `.env.local` and fill in your real key from https://aistudio.google.com/app/apikey

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Next.js dev server at http://localhost:3000 with no errors.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind and Jest"
```

---

## Task 2: Storage Library

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/__tests__/storage.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface LearnedWord {
    word: string;
    meaning: string;
    example: string;
    topic: string;
    learnedAt: string; // ISO string
  }
  function getLearnedWords(): LearnedWord[]
  function saveLearnedWord(entry: LearnedWord): void
  function deleteLearnedWord(word: string): void
  ```

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/storage.test.ts`:

```ts
import { getLearnedWords, saveLearnedWord, deleteLearnedWord, LearnedWord } from "../storage";

const mockWord: LearnedWord = {
  word: "greet",
  meaning: "chào hỏi",
  example: "I greet my neighbors every morning.",
  topic: "Daily Communication",
  learnedAt: "2026-07-16T00:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
});

test("getLearnedWords returns empty array when nothing saved", () => {
  expect(getLearnedWords()).toEqual([]);
});

test("saveLearnedWord persists a word", () => {
  saveLearnedWord(mockWord);
  expect(getLearnedWords()).toEqual([mockWord]);
});

test("saveLearnedWord does not save duplicate words", () => {
  saveLearnedWord(mockWord);
  saveLearnedWord(mockWord);
  expect(getLearnedWords()).toHaveLength(1);
});

test("deleteLearnedWord removes the correct word", () => {
  saveLearnedWord(mockWord);
  deleteLearnedWord("greet");
  expect(getLearnedWords()).toEqual([]);
});

test("deleteLearnedWord leaves other words intact", () => {
  const other: LearnedWord = { ...mockWord, word: "smile" };
  saveLearnedWord(mockWord);
  saveLearnedWord(other);
  deleteLearnedWord("greet");
  expect(getLearnedWords()).toEqual([other]);
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=storage
```

Expected: FAIL — "Cannot find module '../storage'"

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
export interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;
}

const KEY = "learnedWords";

export function getLearnedWords(): LearnedWord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as LearnedWord[]) : [];
}

export function saveLearnedWord(entry: LearnedWord): void {
  const words = getLearnedWords();
  if (words.some((w) => w.word === entry.word)) return;
  localStorage.setItem(KEY, JSON.stringify([...words, entry]));
}

export function deleteLearnedWord(word: string): void {
  const words = getLearnedWords().filter((w) => w.word !== word);
  localStorage.setItem(KEY, JSON.stringify(words));
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- --testPathPattern=storage
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat: add localStorage storage library"
```

---

## Task 3: Gemini Client

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/lib/__tests__/gemini.test.ts`

**Interfaces:**
- Consumes: `GEMINI_API_KEY` env var (server-side only)
- Produces:
  ```ts
  function generateWords(topic: string): Promise<Array<{ word: string; meaning: string }>>
  function generateSentence(word: string): Promise<string>
  ```

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/gemini.test.ts`:

```ts
import { generateWords, generateSentence } from "../gemini";

const mockGenerateContent = jest.fn();

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

beforeEach(() => {
  mockGenerateContent.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

test("generateWords returns parsed word array", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán" }];
  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify(payload) },
  });

  const result = await generateWords("TOEIC");
  expect(result).toEqual(payload);
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("generateSentence returns trimmed string", async () => {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => "  We need to negotiate.  " },
  });

  const result = await generateSentence("negotiate");
  expect(result).toBe("We need to negotiate.");
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=gemini
```

Expected: FAIL — "Cannot find module '../gemini'"

- [ ] **Step 3: Implement `src/lib/gemini.ts`**

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

export async function generateWords(
  topic: string
): Promise<Array<{ word: string; meaning: string }>> {
  const prompt = `Generate 5 English vocabulary words for the topic "${topic}". For each word, provide the Vietnamese meaning. Return ONLY a JSON array with no markdown: [{"word": "...", "meaning": "..."}]`;
  const result = await getModel().generateContent(prompt);
  const text = result.response.text().trim();
  // Strip markdown code fences if present
  const clean = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(clean);
}

export async function generateSentence(word: string): Promise<string> {
  const prompt = `Write one natural English example sentence using the word "${word}". Return only the sentence, nothing else.`;
  const result = await getModel().generateContent(prompt);
  return result.response.text().trim();
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- --testPathPattern=gemini
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts src/lib/__tests__/gemini.test.ts
git commit -m "feat: add Gemini API client"
```

---

## Task 4: API Routes

**Files:**
- Create: `src/app/api/generate-words/route.ts`
- Create: `src/app/api/generate-sentence/route.ts`
- Create: `src/app/api/__tests__/generate-words.test.ts`
- Create: `src/app/api/__tests__/generate-sentence.test.ts`

**Interfaces:**
- Consumes: `generateWords(topic)` and `generateSentence(word)` from `@/lib/gemini`
- Produces:
  - `POST /api/generate-words` → `[{ word, meaning }]` (200) or `{ error }` (400)
  - `POST /api/generate-sentence` → `{ sentence }` (200) or `{ error }` (400)

- [ ] **Step 1: Write failing tests for generate-words**

Create `src/app/api/__tests__/generate-words.test.ts`:

```ts
import { POST } from "../generate-words/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/gemini", () => ({
  generateWords: jest.fn().mockResolvedValue([
    { word: "negotiate", meaning: "đàm phán" },
  ]),
}));

test("returns word list for valid topic", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual([{ word: "negotiate", meaning: "đàm phán" }]);
});

test("returns 400 when topic is missing", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Write failing tests for generate-sentence**

Create `src/app/api/__tests__/generate-sentence.test.ts`:

```ts
import { POST } from "../generate-sentence/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/gemini", () => ({
  generateSentence: jest.fn().mockResolvedValue("We need to negotiate."),
}));

test("returns sentence for valid word", async () => {
  const req = new NextRequest("http://localhost/api/generate-sentence", {
    method: "POST",
    body: JSON.stringify({ word: "negotiate" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual({ sentence: "We need to negotiate." });
});

test("returns 400 when word is missing", async () => {
  const req = new NextRequest("http://localhost/api/generate-sentence", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 3: Run tests — expect failure**

```bash
npm test -- --testPathPattern="api/__tests__"
```

Expected: FAIL — route modules not found

- [ ] **Step 4: Implement `src/app/api/generate-words/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateWords } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { topic } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  const words = await generateWords(topic as string);
  return NextResponse.json(words);
}
```

- [ ] **Step 5: Implement `src/app/api/generate-sentence/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateSentence } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { word } = await req.json();
  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }
  const sentence = await generateSentence(word as string);
  return NextResponse.json({ sentence });
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npm test -- --testPathPattern="api/__tests__"
```

Expected: PASS — 4 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/app/api/
git commit -m "feat: add generate-words and generate-sentence API routes"
```

---

## Task 5: Flashcard Component

**Files:**
- Create: `src/components/Flashcard.tsx`
- Create: `src/components/__tests__/Flashcard.test.tsx`

**Interfaces:**
- Consumes: `saveLearnedWord` from `@/lib/storage`, `POST /api/generate-sentence`
- Props:
  ```ts
  interface FlashcardProps {
    word: string;
    meaning: string;
    topic: string;
  }
  ```
- Produces: rendered card, accessible via role queries in tests

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/Flashcard.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Flashcard from "../Flashcard";

global.fetch = jest.fn().mockResolvedValue({
  json: async () => ({ sentence: "I greet my neighbors." }),
});

jest.mock("@/lib/storage", () => ({
  saveLearnedWord: jest.fn(),
}));

import { saveLearnedWord } from "@/lib/storage";

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows word on front face initially", () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  expect(screen.getByText("greet")).toBeInTheDocument();
});

test("shows meaning and example after clicking", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));
  await waitFor(() => expect(screen.getByText("chào hỏi")).toBeInTheDocument());
  expect(screen.getByText("I greet my neighbors.")).toBeInTheDocument();
});

test("calls saveLearnedWord when Đã học is clicked", async () => {
  render(<Flashcard word="greet" meaning="chào hỏi" topic="Daily Communication" />);
  fireEvent.click(screen.getByRole("button", { name: /greet/i }));
  await waitFor(() => screen.getByText("Đã học ✓"));
  fireEvent.click(screen.getByText("Đã học ✓"));
  expect(saveLearnedWord).toHaveBeenCalledWith(
    expect.objectContaining({ word: "greet", meaning: "chào hỏi", topic: "Daily Communication" })
  );
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- --testPathPattern=Flashcard
```

Expected: FAIL — "Cannot find module '../Flashcard'"

- [ ] **Step 3: Implement `src/components/Flashcard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { saveLearnedWord } from "@/lib/storage";

interface FlashcardProps {
  word: string;
  meaning: string;
  topic: string;
}

export default function Flashcard({ word, meaning, topic }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const [example, setExample] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleFlip() {
    if (!flipped && !example) {
      setLoading(true);
      const res = await fetch("/api/generate-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();
      setExample(data.sentence);
      setLoading(false);
    }
    setFlipped((f) => !f);
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!example) return;
    saveLearnedWord({ word, meaning, example, topic, learnedAt: new Date().toISOString() });
    setSaved(true);
  }

  return (
    <div className="relative h-52 [perspective:1000px]">
      <button
        aria-label={word}
        onClick={handleFlip}
        className={`relative h-full w-full text-left transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front */}
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white shadow-md [backface-visibility:hidden]">
          <span className="text-2xl font-bold text-gray-800">{word}</span>
        </div>
        {/* Back */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-blue-50 p-4 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {loading ? (
            <span className="text-gray-400">Đang tải...</span>
          ) : (
            <>
              <p className="text-center font-semibold text-blue-700">{meaning}</p>
              {example && (
                <p className="text-center text-sm italic text-gray-600">{example}</p>
              )}
              <button
                onClick={handleSave}
                disabled={saved}
                className="mt-2 rounded-lg bg-green-500 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {saved ? "Đã lưu ✓" : "Đã học ✓"}
              </button>
            </>
          )}
        </div>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- --testPathPattern=Flashcard
```

Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/Flashcard.tsx src/components/__tests__/Flashcard.test.tsx
git commit -m "feat: add Flashcard component with flip animation"
```

---

## Task 6: TopicSelector & FlashcardGrid

**Files:**
- Create: `src/components/TopicSelector.tsx`
- Create: `src/components/FlashcardGrid.tsx`
- Create: `src/components/__tests__/TopicSelector.test.tsx`
- Create: `src/components/__tests__/FlashcardGrid.test.tsx`

**Interfaces:**
- TopicSelector props:
  ```ts
  interface TopicSelectorProps {
    value: string;
    onChange: (topic: string) => void;
  }
  ```
- FlashcardGrid props:
  ```ts
  interface FlashcardGridProps {
    words: Array<{ word: string; meaning: string }>;
    topic: string;
  }
  ```

- [ ] **Step 1: Write failing tests for TopicSelector**

Create `src/components/__tests__/TopicSelector.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import TopicSelector from "../TopicSelector";

test("renders both topic buttons", () => {
  render(<TopicSelector value="Daily Communication" onChange={jest.fn()} />);
  expect(screen.getByText("Daily Communication")).toBeInTheDocument();
  expect(screen.getByText("TOEIC")).toBeInTheDocument();
});

test("calls onChange with selected topic", () => {
  const onChange = jest.fn();
  render(<TopicSelector value="Daily Communication" onChange={onChange} />);
  fireEvent.click(screen.getByText("TOEIC"));
  expect(onChange).toHaveBeenCalledWith("TOEIC");
});

test("active topic button has different style", () => {
  render(<TopicSelector value="TOEIC" onChange={jest.fn()} />);
  const active = screen.getByText("TOEIC");
  expect(active.className).toContain("bg-blue-600");
});
```

- [ ] **Step 2: Write failing tests for FlashcardGrid**

Create `src/components/__tests__/FlashcardGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import FlashcardGrid from "../FlashcardGrid";

jest.mock("../Flashcard", () =>
  function MockFlashcard({ word }: { word: string }) {
    return <div data-testid="flashcard">{word}</div>;
  }
);

const words = [
  { word: "negotiate", meaning: "đàm phán" },
  { word: "analyze", meaning: "phân tích" },
];

test("renders one Flashcard per word", () => {
  render(<FlashcardGrid words={words} topic="TOEIC" />);
  expect(screen.getAllByTestId("flashcard")).toHaveLength(2);
});

test("passes word text to each Flashcard", () => {
  render(<FlashcardGrid words={words} topic="TOEIC" />);
  expect(screen.getByText("negotiate")).toBeInTheDocument();
  expect(screen.getByText("analyze")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests — expect failure**

```bash
npm test -- --testPathPattern="TopicSelector|FlashcardGrid"
```

Expected: FAIL — modules not found

- [ ] **Step 4: Implement `src/components/TopicSelector.tsx`**

```tsx
const TOPICS = ["Daily Communication", "TOEIC"];

interface TopicSelectorProps {
  value: string;
  onChange: (topic: string) => void;
}

export default function TopicSelector({ value, onChange }: TopicSelectorProps) {
  return (
    <div className="flex gap-3">
      {TOPICS.map((topic) => (
        <button
          key={topic}
          onClick={() => onChange(topic)}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            value === topic
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {topic}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/components/FlashcardGrid.tsx`**

```tsx
import Flashcard from "./Flashcard";

interface FlashcardGridProps {
  words: Array<{ word: string; meaning: string }>;
  topic: string;
}

export default function FlashcardGrid({ words, topic }: FlashcardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {words.map(({ word, meaning }) => (
        <Flashcard key={word} word={word} meaning={meaning} topic={topic} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npm test -- --testPathPattern="TopicSelector|FlashcardGrid"
```

Expected: PASS — 5 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/TopicSelector.tsx src/components/FlashcardGrid.tsx src/components/__tests__/
git commit -m "feat: add TopicSelector and FlashcardGrid components"
```

---

## Task 7: Layout & Main Page

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `TopicSelector`, `FlashcardGrid` from `@/components/*`
- Consumes: `POST /api/generate-words`
- Produces: fully functional study page at `/`

- [ ] **Step 1: Update `src/app/globals.css`**

Replace the entire file content with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "English Study",
  description: "Website tự học tiếng Anh cá nhân",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <nav className="border-b bg-white px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center gap-6">
            <span className="font-bold text-blue-600">English Study</span>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              Học từ mới
            </Link>
            <Link href="/history" className="text-sm text-gray-600 hover:text-gray-900">
              Lịch sử
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update `src/app/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import TopicSelector from "@/components/TopicSelector";
import FlashcardGrid from "@/components/FlashcardGrid";

interface Word {
  word: string;
  meaning: string;
}

export default function HomePage() {
  const [topic, setTopic] = useState("Daily Communication");
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setWords([]);
    const res = await fetch("/api/generate-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    setWords(data);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Học từ vựng tiếng Anh</h1>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <TopicSelector value={topic} onChange={(t) => { setTopic(t); setWords([]); }} />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Đang sinh từ..." : "Sinh từ mới"}
        </button>
      </div>
      {words.length > 0 && <FlashcardGrid words={words} topic={topic} />}
    </main>
  );
}
```

- [ ] **Step 4: Start dev server and test manually**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Topic selector switches between "Daily Communication" and "TOEIC"
- "Sinh từ mới" button shows loading state, then renders 5 flashcards
- Clicking a card flips it and shows meaning + example sentence
- "Đã học ✓" button appears after flip; clicking it disables it ("Đã lưu ✓")

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/page.tsx
git commit -m "feat: add layout with nav and main study page"
```

---

## Task 8: History Page

**Files:**
- Create: `src/app/history/page.tsx`

**Interfaces:**
- Consumes: `getLearnedWords`, `deleteLearnedWord`, `LearnedWord` from `@/lib/storage`
- Produces: history page at `/history`

- [ ] **Step 1: Create `src/app/history/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getLearnedWords, deleteLearnedWord, LearnedWord } from "@/lib/storage";

export default function HistoryPage() {
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [filter, setFilter] = useState("Tất cả");

  useEffect(() => {
    setWords(getLearnedWords());
  }, []);

  function handleDelete(word: string) {
    deleteLearnedWord(word);
    setWords(getLearnedWords());
  }

  const topics = ["Tất cả", ...Array.from(new Set(words.map((w) => w.topic)))];
  const filtered =
    filter === "Tất cả" ? words : words.filter((w) => w.topic === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Từ đã học</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {topics.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
              filter === t
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">Chưa có từ nào được lưu.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li
              key={entry.word}
              className="flex items-start justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-bold text-gray-800">
                  {entry.word}{" "}
                  <span className="font-normal text-gray-500">— {entry.meaning}</span>
                </p>
                <p className="mt-1 text-sm italic text-gray-600">{entry.example}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {entry.topic} ·{" "}
                  {new Date(entry.learnedAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(entry.word)}
                className="ml-4 text-sm text-red-400 hover:text-red-600"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Test manually**

With dev server running, mark 2–3 words as "Đã học" from the main page, then navigate to http://localhost:3000/history. Verify:
- All saved words appear
- Topic filter buttons work (only show relevant topics)
- "Xóa" button removes a word immediately without page reload

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/history/
git commit -m "feat: add history page with topic filter and delete"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace `CLAUDE.md` with project-specific guidance**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server at http://localhost:3000
- `npm test` — run all Jest tests
- `npm test -- --testPathPattern=<pattern>` — run tests matching pattern
- `npm run build` — production build
- `npm run lint` — ESLint check

## Architecture

Next.js 14 App Router project. Two pages: `/` (study) and `/history`. No database — all persistence via `localStorage`.

**Data flow for word generation:**
`page.tsx` → `POST /api/generate-words` → `lib/gemini.ts` → Google Gemini API → 5 words rendered as `<Flashcard>` components.

**Data flow for sentence generation:**
`Flashcard.tsx` (on flip) → `POST /api/generate-sentence` → `lib/gemini.ts` → sentence shown on card back.

**Persistence:** `lib/storage.ts` wraps localStorage under the key `"learnedWords"`. Called from `Flashcard.tsx` (save) and `history/page.tsx` (read/delete).

## Key Constraint

`GEMINI_API_KEY` must stay server-side only. It is only imported in `src/lib/gemini.ts`, which is only called from API routes (`src/app/api/*/route.ts`), never from client components.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with project commands and architecture"
```
