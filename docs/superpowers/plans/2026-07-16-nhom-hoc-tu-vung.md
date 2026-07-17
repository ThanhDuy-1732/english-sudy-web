# Nhóm Học Từ Vựng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 4 tính năng học từ vựng: Spaced Repetition, Phát âm, Từ đồng/trái nghĩa, Quiz Mode.

**Architecture:** Mở rộng `LearnedWord` interface (thêm `nextReviewAt`, `reviewInterval`, `mastery`, `synonyms`, `antonyms`). Thêm 1 API route cho synonyms. Thêm trang `/review` cho từ đến hạn ôn. Thêm `QuizMode` component chạy inline trên trang chủ.

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, Web Speech API (built-in browser), `@google/generative-ai`

## Global Constraints

- Prerequisite: base plan (`2026-07-16-english-study.md`) đã được implement xong
- `GEMINI_API_KEY` chỉ dùng trong API routes — không bao giờ ở client component
- Web Speech API dùng `window.speechSynthesis` — chỉ gọi ở client component sau khi mount
- localStorage key giữ nguyên: `"learnedWords"`
- Vietnamese UI text

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `src/lib/storage.ts` | Modify | Mở rộng `LearnedWord`, thêm `updateWordReview()`, `getWordsForReview()` |
| `src/lib/__tests__/storage-review.test.ts` | Create | Test cho spaced repetition logic |
| `src/app/api/generate-synonyms/route.ts` | Create | POST: word → { synonyms, antonyms } |
| `src/components/PronunciationButton.tsx` | Create | Nút loa dùng Web Speech API |
| `src/components/QuizCard.tsx` | Create | Một câu hỏi quiz với 4 lựa chọn |
| `src/components/QuizMode.tsx` | Create | Điều phối quiz session |
| `src/components/Flashcard.tsx` | Modify | Thêm phát âm, synonyms, self-assessment buttons |
| `src/app/page.tsx` | Modify | Thêm nút "Kiểm tra" sau khi lật ≥3 thẻ |
| `src/app/review/page.tsx` | Create | Trang ôn tập: từ đến hạn hôm nay |
| `src/app/layout.tsx` | Modify | Thêm link "Ôn tập" vào nav |

---

## Task 1: Mở rộng Storage cho Spaced Repetition

**Files:**
- Modify: `src/lib/storage.ts`
- Create: `src/lib/__tests__/storage-review.test.ts`

**Interfaces:**
- Consumes: existing `LearnedWord`, `getLearnedWords()`, `saveLearnedWord()`
- Produces:
  ```ts
  interface LearnedWord {
    word: string;
    meaning: string;
    example: string;
    topic: string;
    learnedAt: string;
    nextReviewAt: string;   // ISO — ngày ôn tiếp theo
    reviewInterval: number; // số ngày: 1 → 2 → 4 → 8 → 16 → 30 (cap)
    mastery: number;        // 0–5
    synonyms?: string[];
    antonyms?: string[];
  }
  function updateWordReview(word: string, remembered: boolean): void
  function getWordsForReview(): LearnedWord[]
  ```

- [ ] **Step 1: Viết failing tests**

Tạo `src/lib/__tests__/storage-review.test.ts`:

```ts
import {
  getLearnedWords,
  saveLearnedWord,
  updateWordReview,
  getWordsForReview,
  LearnedWord,
} from "../storage";

const baseWord: LearnedWord = {
  word: "negotiate",
  meaning: "đàm phán",
  example: "We need to negotiate.",
  topic: "TOEIC",
  learnedAt: "2026-07-16T00:00:00.000Z",
  nextReviewAt: "2026-07-17T00:00:00.000Z",
  reviewInterval: 1,
  mastery: 0,
};

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("saveLearnedWord sets defaults for new spaced repetition fields", () => {
  const wordWithoutSR = { ...baseWord };
  saveLearnedWord(wordWithoutSR);
  const [saved] = getLearnedWords();
  expect(saved.reviewInterval).toBe(1);
  expect(saved.mastery).toBe(0);
});

test("updateWordReview remembered=true doubles interval and increments mastery", () => {
  saveLearnedWord(baseWord);
  updateWordReview("negotiate", true);
  const [updated] = getLearnedWords();
  expect(updated.reviewInterval).toBe(2);
  expect(updated.mastery).toBe(1);
});

test("updateWordReview remembered=false resets interval to 1 and decrements mastery", () => {
  saveLearnedWord({ ...baseWord, reviewInterval: 8, mastery: 3 });
  updateWordReview("negotiate", false);
  const [updated] = getLearnedWords();
  expect(updated.reviewInterval).toBe(1);
  expect(updated.mastery).toBe(2);
});

test("updateWordReview caps reviewInterval at 30", () => {
  saveLearnedWord({ ...baseWord, reviewInterval: 16, mastery: 4 });
  updateWordReview("negotiate", true);
  const [updated] = getLearnedWords();
  expect(updated.reviewInterval).toBe(30);
});

test("updateWordReview caps mastery at 5", () => {
  saveLearnedWord({ ...baseWord, mastery: 5 });
  updateWordReview("negotiate", true);
  const [updated] = getLearnedWords();
  expect(updated.mastery).toBe(5);
});

test("getWordsForReview returns words where nextReviewAt <= now", () => {
  const dueWord: LearnedWord = {
    ...baseWord,
    word: "due",
    nextReviewAt: "2026-07-16T10:00:00.000Z", // before now
  };
  const futureWord: LearnedWord = {
    ...baseWord,
    word: "future",
    nextReviewAt: "2026-07-18T00:00:00.000Z", // after now
  };
  saveLearnedWord(dueWord);
  saveLearnedWord(futureWord);
  const review = getWordsForReview();
  expect(review.map((w) => w.word)).toEqual(["due"]);
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

```bash
npm test -- --testPathPattern=storage-review
```

Expected: FAIL — `updateWordReview` and `getWordsForReview` not defined.

- [ ] **Step 3: Cập nhật `src/lib/storage.ts`**

```ts
export interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;
  nextReviewAt: string;
  reviewInterval: number;
  mastery: number;
  synonyms?: string[];
  antonyms?: string[];
}

const KEY = "learnedWords";

export function getLearnedWords(): LearnedWord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveLearnedWord(entry: LearnedWord): void {
  const words = getLearnedWords();
  if (words.some((w) => w.word === entry.word)) return;
  const withDefaults: LearnedWord = {
    reviewInterval: 1,
    mastery: 0,
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    ...entry,
  };
  localStorage.setItem(KEY, JSON.stringify([...words, withDefaults]));
}

export function deleteLearnedWord(word: string): void {
  const words = getLearnedWords().filter((w) => w.word !== word);
  localStorage.setItem(KEY, JSON.stringify(words));
}

export function updateWordReview(word: string, remembered: boolean): void {
  const words = getLearnedWords().map((w) => {
    if (w.word !== word) return w;
    const newInterval = remembered
      ? Math.min((w.reviewInterval ?? 1) * 2, 30)
      : 1;
    const newMastery = remembered
      ? Math.min((w.mastery ?? 0) + 1, 5)
      : Math.max((w.mastery ?? 0) - 1, 0);
    const nextReviewAt = new Date(
      Date.now() + newInterval * 86400000
    ).toISOString();
    return { ...w, reviewInterval: newInterval, mastery: newMastery, nextReviewAt };
  });
  localStorage.setItem(KEY, JSON.stringify(words));
}

export function getWordsForReview(): LearnedWord[] {
  const now = new Date().toISOString();
  return getLearnedWords().filter((w) => (w.nextReviewAt ?? now) <= now);
}
```

- [ ] **Step 4: Chạy test — pass**

```bash
npm test -- --testPathPattern=storage-review
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage-review.test.ts
git commit -m "feat: extend LearnedWord with spaced repetition fields"
```

---

## Task 2: PronunciationButton Component

**Files:**
- Create: `src/components/PronunciationButton.tsx`
- Modify: `src/components/Flashcard.tsx` (thêm PronunciationButton vào mặt trước thẻ)

**Interfaces:**
- Consumes: nothing
- Produces: `<PronunciationButton word="negotiate" />`

- [ ] **Step 1: Tạo `src/components/PronunciationButton.tsx`**

```tsx
"use client";

interface Props {
  word: string;
}

export default function PronunciationButton({ word }: Props) {
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        speak();
      }}
      className="text-gray-400 hover:text-blue-500 transition-colors"
      title="Nghe phát âm"
    >
      🔊
    </button>
  );
}
```

- [ ] **Step 2: Thêm vào mặt trước Flashcard**

Trong `src/components/Flashcard.tsx`, tìm chỗ render mặt trước thẻ (front face), thêm `PronunciationButton` bên cạnh chữ từ:

```tsx
import PronunciationButton from "./PronunciationButton";

// Trong JSX mặt trước:
<div className="flex items-center gap-2 justify-center">
  <span className="text-2xl font-bold">{word}</span>
  <PronunciationButton word={word} />
</div>
```

- [ ] **Step 3: Kiểm tra thủ công**

Chạy `npm run dev`, vào trang chủ, sinh từ, click icon 🔊 trên flashcard — trình duyệt phát âm từ đó.

- [ ] **Step 4: Commit**

```bash
git add src/components/PronunciationButton.tsx src/components/Flashcard.tsx
git commit -m "feat: add pronunciation button using Web Speech API"
```

---

## Task 3: Synonyms/Antonyms API + Flashcard Integration

**Files:**
- Create: `src/app/api/generate-synonyms/route.ts`
- Modify: `src/components/Flashcard.tsx` (hiện synonyms/antonyms ở mặt sau)
- Modify: `src/lib/storage.ts` (đã có `synonyms?`, `antonyms?` fields — dùng luôn)

**Interfaces:**
- Consumes: `POST /api/generate-synonyms` nhận `{ word: string }`
- Produces: `{ synonyms: string[], antonyms: string[] }`

- [ ] **Step 1: Tạo `src/app/api/generate-synonyms/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateSynonyms } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { word } = await req.json();
  if (!word) return NextResponse.json({ error: "Missing word" }, { status: 400 });
  const result = await generateSynonyms(word);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Thêm `generateSynonyms` vào `src/lib/gemini.ts`**

```ts
export async function generateSynonyms(
  word: string
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const model = getModel();
  const prompt = `For the English word "${word}", provide:
- 2-3 synonyms
- 1-2 antonyms
Return JSON only: {"synonyms": ["word1", "word2"], "antonyms": ["word1"]}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(text);
}
```

- [ ] **Step 3: Cập nhật mặt sau Flashcard để fetch và hiện synonyms**

Trong `src/components/Flashcard.tsx`, thêm state và fetch khi lật thẻ:

```tsx
const [synonymData, setSynonymData] = useState<{
  synonyms: string[];
  antonyms: string[];
} | null>(null);

// Trong useEffect khi isFlipped thành true (cạnh fetch sentence):
fetch("/api/generate-synonyms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ word }),
})
  .then((r) => r.json())
  .then(setSynonymData);

// Trong JSX mặt sau, sau phần example sentence:
{synonymData && (
  <div className="mt-3 text-sm">
    {synonymData.synonyms.length > 0 && (
      <p>
        <span className="text-green-600 font-medium">Đồng nghĩa:</span>{" "}
        {synonymData.synonyms.join(", ")}
      </p>
    )}
    {synonymData.antonyms.length > 0 && (
      <p>
        <span className="text-red-500 font-medium">Trái nghĩa:</span>{" "}
        {synonymData.antonyms.join(", ")}
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Kiểm tra thủ công**

`npm run dev`, sinh từ, lật thẻ — mặt sau hiện đồng nghĩa và trái nghĩa.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate-synonyms/route.ts src/lib/gemini.ts src/components/Flashcard.tsx
git commit -m "feat: add synonyms/antonyms on flashcard back via Gemini"
```

---

## Task 4: Self-Assessment Buttons trên Review Card

**Files:**
- Modify: `src/components/Flashcard.tsx` — thêm "Nhớ tốt / Nhớ mờ / Quên" sau khi lật

**Interfaces:**
- Consumes: `updateWordReview(word, remembered)` từ `src/lib/storage.ts`
- Produces: nút self-assessment chỉ hiện khi `isReviewMode={true}` (prop mới)

- [ ] **Step 1: Thêm prop `isReviewMode` vào Flashcard**

```tsx
interface Props {
  word: string;
  meaning: string;
  topic: string;
  isReviewMode?: boolean; // mặc định false
}
```

- [ ] **Step 2: Thêm self-assessment buttons vào mặt sau Flashcard**

```tsx
import { updateWordReview } from "@/lib/storage";

// Trong JSX mặt sau, sau nút "Đã học ✓":
{isReviewMode && (
  <div className="flex gap-2 mt-3">
    <button
      onClick={(e) => { e.stopPropagation(); updateWordReview(word, true); onReviewed?.(); }}
      className="flex-1 bg-green-100 text-green-800 rounded-lg py-1 text-sm font-medium hover:bg-green-200"
    >
      Nhớ tốt ✓
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); updateWordReview(word, false); onReviewed?.(); }}
      className="flex-1 bg-red-100 text-red-800 rounded-lg py-1 text-sm font-medium hover:bg-red-200"
    >
      Quên ✗
    </button>
  </div>
)}
```

Thêm `onReviewed?: () => void` vào Props để trang Review có thể xử lý sau khi đánh giá.

- [ ] **Step 3: Tạo `src/app/review/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { getWordsForReview, LearnedWord } from "@/lib/storage";
import Flashcard from "@/components/Flashcard";

export default function ReviewPage() {
  const [words, setWords] = useState<LearnedWord[]>([]);

  useEffect(() => {
    setWords(getWordsForReview());
  }, []);

  function handleReviewed() {
    setWords(getWordsForReview());
  }

  if (words.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-gray-500 text-lg">Không có từ nào cần ôn hôm nay!</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Ôn tập hôm nay</h1>
      <p className="text-gray-500 mb-6">{words.length} từ cần ôn</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {words.map((w) => (
          <Flashcard
            key={w.word}
            word={w.word}
            meaning={w.meaning}
            topic={w.topic}
            isReviewMode={true}
            onReviewed={handleReviewed}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Thêm link "Ôn tập" vào `src/app/layout.tsx`**

```tsx
<nav>
  <Link href="/">Học từ mới</Link>
  <Link href="/review">Ôn tập</Link>
  <Link href="/history">Lịch sử</Link>
</nav>
```

- [ ] **Step 5: Kiểm tra thủ công**

Vào `/review`, lật thẻ, click "Nhớ tốt" → thẻ biến mất khỏi danh sách. Vào localStorage kiểm tra `reviewInterval` đã tăng.

- [ ] **Step 6: Commit**

```bash
git add src/components/Flashcard.tsx src/app/review/page.tsx src/app/layout.tsx
git commit -m "feat: add spaced repetition self-assessment and review page"
```

---

## Task 5: Quiz Mode

**Files:**
- Create: `src/components/QuizCard.tsx`
- Create: `src/components/QuizMode.tsx`
- Modify: `src/app/page.tsx` — thêm nút "Kiểm tra" sau khi ≥3 thẻ đã lật

**Interfaces:**
- Consumes: list of `{ word, meaning }` từ session hiện tại + `getLearnedWords()` để lấy distractors
- Produces:
  ```tsx
  <QuizMode words={sessionWords} onClose={() => setQuizOpen(false)} />
  ```

- [ ] **Step 1: Tạo `src/components/QuizCard.tsx`**

```tsx
"use client";

interface Props {
  question: string;      // nghĩa tiếng Việt
  options: string[];     // 4 từ tiếng Anh
  correctAnswer: string;
  onAnswer: (correct: boolean) => void;
}

export default function QuizCard({ question, options, correctAnswer, onAnswer }: Props) {
  function handleClick(option: string) {
    onAnswer(option === correctAnswer);
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow">
      <p className="text-center text-gray-500 text-sm mb-2">Nghĩa của từ nào là:</p>
      <p className="text-center text-xl font-bold mb-6">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleClick(opt)}
            className="border border-gray-200 rounded-xl py-3 px-4 text-center hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/components/QuizMode.tsx`**

```tsx
"use client";

import { useState } from "react";
import { getLearnedWords } from "@/lib/storage";
import QuizCard from "./QuizCard";

interface WordPair {
  word: string;
  meaning: string;
}

interface Props {
  words: WordPair[];
  onClose: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildOptions(correct: string, allWords: WordPair[]): string[] {
  const distractors = allWords
    .filter((w) => w.word !== correct)
    .map((w) => w.word);
  const picked = shuffle(distractors).slice(0, 3);
  return shuffle([correct, ...picked]);
}

export default function QuizMode({ words, onClose }: Props) {
  const history = getLearnedWords();
  const allWords: WordPair[] = [
    ...words,
    ...history.map((w) => ({ word: w.word, meaning: w.meaning })),
  ];

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  const current = words[index];
  const options = buildOptions(current.word, allWords);

  function handleAnswer(correct: boolean) {
    setLastCorrect(correct);
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      setLastCorrect(null);
      if (index + 1 >= words.length) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    }, 800);
  }

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center shadow-xl max-w-sm w-full mx-4">
          <p className="text-4xl font-bold mb-2">{score}/{words.length}</p>
          <p className="text-gray-500 mb-6">
            {score === words.length ? "Tuyệt vời! 🎉" : "Cố gắng hơn nhé!"}
          </p>
          <button
            onClick={onClose}
            className="bg-blue-500 text-white rounded-xl px-6 py-3 font-medium hover:bg-blue-600"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-400 text-sm">{index + 1} / {words.length}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {lastCorrect !== null && (
          <div className={`text-center text-lg font-bold mb-2 ${lastCorrect ? "text-green-500" : "text-red-500"}`}>
            {lastCorrect ? "Đúng rồi! ✓" : "Sai rồi ✗"}
          </div>
        )}
        <QuizCard
          question={current.meaning}
          options={options}
          correctAnswer={current.word}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Thêm nút "Kiểm tra" vào `src/app/page.tsx`**

```tsx
const [flippedCount, setFlippedCount] = useState(0);
const [quizOpen, setQuizOpen] = useState(false);

// Truyền callback vào FlashcardGrid để đếm số thẻ đã lật
// Khi flippedCount >= 3 và words.length > 0, hiện nút:
{words.length > 0 && flippedCount >= 3 && (
  <div className="text-center mt-6">
    <button
      onClick={() => setQuizOpen(true)}
      className="bg-purple-500 text-white rounded-xl px-8 py-3 font-medium hover:bg-purple-600"
    >
      Kiểm tra kiến thức
    </button>
  </div>
)}

{quizOpen && (
  <QuizMode
    words={words.map((w) => ({ word: w.word, meaning: w.meaning }))}
    onClose={() => setQuizOpen(false)}
  />
)}
```

- [ ] **Step 4: Kiểm tra thủ công**

Sinh 5 từ, lật 3 thẻ, nút "Kiểm tra kiến thức" xuất hiện. Click → quiz modal mở, trả lời 5 câu, thấy kết quả.

- [ ] **Step 5: Commit**

```bash
git add src/components/QuizCard.tsx src/components/QuizMode.tsx src/app/page.tsx
git commit -m "feat: add quiz mode after studying flashcards"
```
