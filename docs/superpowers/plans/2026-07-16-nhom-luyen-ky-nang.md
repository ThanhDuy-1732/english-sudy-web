# Nhóm Luyện Kỹ Năng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 4 tính năng luyện kỹ năng: Viết câu có chấm điểm, Fill-in-the-blank, Dictation, Daily Challenge với streak.

**Architecture:** Thêm 2 API routes mới (grade-sentence, generate-fillblank). Flashcard có thêm `mode` state để switch giữa 4 chế độ: study / write / fill / dictation. Daily challenge lưu vào localStorage riêng (key `"dailyChallenge"`).

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, Web Speech API (TTS), `@google/generative-ai`

## Global Constraints

- Prerequisite: base plan (`2026-07-16-english-study.md`) đã implement xong
- `GEMINI_API_KEY` chỉ trong API routes
- Web Speech API chỉ gọi sau khi component mount (check `typeof window !== "undefined"`)
- Vietnamese UI text

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `src/app/api/grade-sentence/route.ts` | Create | POST: { word, sentence } → { score, feedback, corrected } |
| `src/app/api/generate-fillblank/route.ts` | Create | POST: { word } → { sentence } (có `_____`) |
| `src/components/WritingChallenge.tsx` | Create | Input + grade button + score display |
| `src/components/FillBlank.tsx` | Create | Ô điền + check button + highlight |
| `src/components/DictationMode.tsx` | Create | TTS player + text input + so sánh |
| `src/components/Flashcard.tsx` | Modify | Thêm mode selector (tabs) + render 3 mode mới ở mặt sau |
| `src/lib/daily-challenge.ts` | Create | getDailyChallenge, setDailyChallenge, getStreak |
| `src/lib/__tests__/daily-challenge.test.ts` | Create | Test cho streak logic |
| `src/app/page.tsx` | Modify | Thêm Daily Challenge banner |

---

## Task 1: Grading API + WritingChallenge Component

**Files:**
- Create: `src/app/api/grade-sentence/route.ts`
- Modify: `src/lib/gemini.ts` — thêm `gradeSentence()`
- Create: `src/components/WritingChallenge.tsx`

**Interfaces:**
- Produces:
  ```ts
  // API response
  { score: number; feedback: string; corrected: string }
  // Component
  <WritingChallenge word="negotiate" />
  ```

- [ ] **Step 1: Thêm `gradeSentence` vào `src/lib/gemini.ts`**

```ts
export async function gradeSentence(
  word: string,
  sentence: string
): Promise<{ score: number; feedback: string; corrected: string }> {
  const model = getModel();
  const prompt = `Grade this English sentence that uses the word "${word}":
"${sentence}"

Return JSON only:
{
  "score": <1-10>,
  "feedback": "<short Vietnamese feedback, 1 sentence>",
  "corrected": "<corrected sentence, same as input if no errors>"
}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(text);
}
```

- [ ] **Step 2: Tạo `src/app/api/grade-sentence/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { gradeSentence } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { word, sentence } = await req.json();
  if (!word || !sentence) {
    return NextResponse.json({ error: "Missing word or sentence" }, { status: 400 });
  }
  const result = await gradeSentence(word, sentence);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Tạo `src/components/WritingChallenge.tsx`**

```tsx
"use client";

import { useState } from "react";

interface Props {
  word: string;
}

interface GradeResult {
  score: number;
  feedback: string;
  corrected: string;
}

export default function WritingChallenge({ word }: Props) {
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGrade() {
    if (!sentence.trim()) return;
    setLoading(true);
    const res = await fetch("/api/grade-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, sentence }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  const scoreColor =
    !result ? "" :
    result.score >= 8 ? "text-green-600" :
    result.score >= 5 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-sm text-gray-500">Viết câu dùng từ <strong>{word}</strong>:</p>
      <textarea
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        placeholder={`Ví dụ: I need to ${word}...`}
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
      />
      <button
        onClick={handleGrade}
        disabled={loading || !sentence.trim()}
        className="w-full bg-blue-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Đang chấm..." : "Chấm điểm"}
      </button>
      {result && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <p className={`font-bold text-lg ${scoreColor}`}>{result.score}/10</p>
          <p className="text-gray-600">{result.feedback}</p>
          {result.corrected !== sentence && (
            <p className="text-green-700">
              <span className="font-medium">Sửa lại:</span> {result.corrected}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Kiểm tra thủ công**

Chạy `npm run dev`. Cần tích hợp tạm vào Flashcard để test: thêm `<WritingChallenge word="negotiate" />` vào bất kỳ trang nào. Nhập câu → click "Chấm điểm" → hiện kết quả.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts src/app/api/grade-sentence/route.ts src/components/WritingChallenge.tsx
git commit -m "feat: add sentence grading via Gemini API"
```

---

## Task 2: Fill-in-the-blank

**Files:**
- Create: `src/app/api/generate-fillblank/route.ts`
- Modify: `src/lib/gemini.ts` — thêm `generateFillBlank()`
- Create: `src/components/FillBlank.tsx`

**Interfaces:**
- Produces:
  ```ts
  // API response
  { sentence: string } // có "_____ " thay thế từ cần điền
  // Component
  <FillBlank word="negotiate" sentence="We need to _____ the terms." />
  ```

- [ ] **Step 1: Thêm `generateFillBlank` vào `src/lib/gemini.ts`**

```ts
export async function generateFillBlank(word: string): Promise<{ sentence: string }> {
  const model = getModel();
  const prompt = `Write one natural English sentence using the word "${word}". 
Replace the word "${word}" with "_____" in the sentence.
Return JSON only: {"sentence": "The sentence with _____ here."}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(text);
}
```

- [ ] **Step 2: Tạo `src/app/api/generate-fillblank/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateFillBlank } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { word } = await req.json();
  if (!word) return NextResponse.json({ error: "Missing word" }, { status: 400 });
  const result = await generateFillBlank(word);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Tạo `src/components/FillBlank.tsx`**

```tsx
"use client";

import { useState } from "react";

interface Props {
  word: string;
  sentence: string; // "We need to _____ the terms."
}

export default function FillBlank({ word, sentence }: Props) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);

  const isCorrect = input.trim().toLowerCase() === word.toLowerCase();

  const parts = sentence.split("_____");

  function handleCheck() {
    setChecked(true);
  }

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-sm text-gray-500">Điền từ còn thiếu:</p>
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <span>{parts[0]}</span>
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setChecked(false); }}
          disabled={checked && isCorrect}
          placeholder="____"
          className={`border-b-2 w-28 text-center focus:outline-none px-1 ${
            !checked ? "border-gray-300" :
            isCorrect ? "border-green-500 text-green-700" : "border-red-500 text-red-700"
          }`}
        />
        <span>{parts[1]}</span>
      </div>
      {!checked || !isCorrect ? (
        <button
          onClick={handleCheck}
          disabled={!input.trim()}
          className="w-full bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
        >
          Kiểm tra
        </button>
      ) : null}
      {checked && (
        <p className={`text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
          {isCorrect ? "Đúng rồi! ✓" : `Sai rồi. Đáp án: "${word}"`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/gemini.ts src/app/api/generate-fillblank/route.ts src/components/FillBlank.tsx
git commit -m "feat: add fill-in-the-blank mode with Gemini-generated sentences"
```

---

## Task 3: Mode Tabs trên Flashcard

Tích hợp WritingChallenge và FillBlank vào mặt sau Flashcard qua tab selector.

**Files:**
- Modify: `src/components/Flashcard.tsx`

- [ ] **Step 1: Thêm mode state và fetch fill-blank sentence vào Flashcard**

```tsx
type CardMode = "study" | "write" | "fill";

// State mới trong Flashcard:
const [mode, setMode] = useState<CardMode>("study");
const [fillSentence, setFillSentence] = useState<string | null>(null);

// Khi lật thẻ (useEffect trên isFlipped), fetch fill-blank song song với sentence:
fetch("/api/generate-fillblank", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ word }),
})
  .then((r) => r.json())
  .then((data) => setFillSentence(data.sentence));
```

- [ ] **Step 2: Thêm tabs vào mặt sau Flashcard**

```tsx
// Trong JSX mặt sau, trước nội dung:
<div className="flex gap-1 mb-3" onClick={(e) => e.stopPropagation()}>
  {(["study", "write", "fill"] as CardMode[]).map((m) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${
        mode === m
          ? "bg-blue-500 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {m === "study" ? "Nghĩa" : m === "write" ? "Viết câu" : "Điền từ"}
    </button>
  ))}
</div>

{mode === "study" && (
  <>
    <p className="text-lg font-semibold">{meaning}</p>
    {sentence && <p className="text-sm text-gray-500 mt-2 italic">"{sentence}"</p>}
    {synonymData && (/* synonyms display */)}
    {/* Đã học button */}
  </>
)}
{mode === "write" && <WritingChallenge word={word} />}
{mode === "fill" && fillSentence && <FillBlank word={word} sentence={fillSentence} />}
```

- [ ] **Step 3: Import components mới**

```tsx
import WritingChallenge from "./WritingChallenge";
import FillBlank from "./FillBlank";
```

- [ ] **Step 4: Kiểm tra thủ công**

Sinh từ, lật thẻ → thấy 3 tabs "Nghĩa / Viết câu / Điền từ". Switch qua lại hoạt động đúng.

- [ ] **Step 5: Commit**

```bash
git add src/components/Flashcard.tsx
git commit -m "feat: add study/write/fill mode tabs to flashcard back"
```

---

## Task 4: Dictation Mode

**Files:**
- Create: `src/components/DictationMode.tsx`
- Modify: `src/components/Flashcard.tsx` — thêm tab "Nghe"

**Interfaces:**
- Consumes: `sentence: string` (câu ví dụ đã có từ trước)
- Produces: `<DictationMode sentence="We need to negotiate." />`

- [ ] **Step 1: Tạo `src/components/DictationMode.tsx`**

```tsx
"use client";

import { useState } from "react";

interface Props {
  sentence: string;
}

function highlightDiff(input: string, correct: string): React.ReactNode {
  const inputWords = input.trim().toLowerCase().split(/\s+/);
  const correctWords = correct.trim().toLowerCase().split(/\s+/);
  return correctWords.map((word, i) => {
    const match = inputWords[i]?.replace(/[.,!?]/g, "") === word.replace(/[.,!?]/g, "");
    return (
      <span key={i} className={match ? "text-green-600" : "text-red-600 underline"}>
        {word}{" "}
      </span>
    );
  });
}

export default function DictationMode({ sentence }: Props) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);

  function speak() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "en-US";
    utterance.rate = 0.75;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-sm text-gray-500">Nghe và gõ lại câu:</p>
      <button
        onClick={speak}
        disabled={playing}
        className="w-full border border-gray-200 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {playing ? "Đang phát..." : "▶ Nghe câu"}
      </button>
      <textarea
        value={input}
        onChange={(e) => { setInput(e.target.value); setChecked(false); }}
        placeholder="Gõ lại câu bạn vừa nghe..."
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
      />
      {!checked ? (
        <button
          onClick={() => setChecked(true)}
          disabled={!input.trim()}
          className="w-full bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          Kiểm tra
        </button>
      ) : (
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-medium mb-1">Kết quả:</p>
          <p>{highlightDiff(input, sentence)}</p>
          <p className="text-gray-400 mt-2 text-xs">Câu đúng: {sentence}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Thêm tab "Nghe" vào Flashcard**

Trong `src/components/Flashcard.tsx`, mở rộng `CardMode`:

```tsx
type CardMode = "study" | "write" | "fill" | "dictation";

// Trong tabs:
{ m === "dictation" ? "Nghe" : ... }

// Trong content switch:
{mode === "dictation" && sentence && <DictationMode sentence={sentence} />}
```

- [ ] **Step 3: Kiểm tra thủ công**

Lật thẻ → tab "Nghe" → click "Nghe câu" → trình duyệt đọc câu ví dụ → gõ lại → click "Kiểm tra" → highlight đỏ/xanh từng từ.

- [ ] **Step 4: Commit**

```bash
git add src/components/DictationMode.tsx src/components/Flashcard.tsx
git commit -m "feat: add dictation mode with Web Speech API TTS"
```

---

## Task 5: Daily Challenge và Streak

**Files:**
- Create: `src/lib/daily-challenge.ts`
- Create: `src/lib/__tests__/daily-challenge.test.ts`
- Modify: `src/app/page.tsx` — thêm banner Daily Challenge

**Interfaces:**
- Produces:
  ```ts
  function getDailyChallenge(): { date: string; words: string[]; completed: boolean } | null
  function setDailyComplete(words: string[]): void
  function getStreak(): number
  ```

- [ ] **Step 1: Viết failing tests**

Tạo `src/lib/__tests__/daily-challenge.test.ts`:

```ts
import { getDailyChallenge, setDailyComplete, getStreak } from "../daily-challenge";

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-16T08:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("getDailyChallenge returns null when no challenge set", () => {
  expect(getDailyChallenge()).toBeNull();
});

test("setDailyComplete marks today as completed", () => {
  setDailyComplete(["hello", "world"]);
  const challenge = getDailyChallenge();
  expect(challenge?.date).toBe("2026-07-16");
  expect(challenge?.completed).toBe(true);
  expect(challenge?.words).toEqual(["hello", "world"]);
});

test("getStreak returns 0 with no history", () => {
  expect(getStreak()).toBe(0);
});

test("getStreak returns 1 after completing today", () => {
  setDailyComplete(["hello"]);
  expect(getStreak()).toBe(1);
});

test("getStreak returns 0 if last completion was 2 days ago", () => {
  // Set completion 2 days ago
  jest.setSystemTime(new Date("2026-07-14T08:00:00.000Z"));
  setDailyComplete(["hello"]);
  jest.setSystemTime(new Date("2026-07-16T08:00:00.000Z"));
  expect(getStreak()).toBe(0);
});
```

- [ ] **Step 2: Chạy test — xác nhận fail**

```bash
npm test -- --testPathPattern=daily-challenge
```

Expected: FAIL.

- [ ] **Step 3: Tạo `src/lib/daily-challenge.ts`**

```ts
const KEY = "dailyChallenge";

interface DayRecord {
  date: string;   // "YYYY-MM-DD"
  words: string[];
  completed: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getHistory(): DayRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getDailyChallenge(): DayRecord | null {
  const history = getHistory();
  const todayStr = today();
  return history.find((r) => r.date === todayStr) ?? null;
}

export function setDailyComplete(words: string[]): void {
  const history = getHistory();
  const todayStr = today();
  const existing = history.findIndex((r) => r.date === todayStr);
  const record: DayRecord = { date: todayStr, words, completed: true };
  if (existing >= 0) {
    history[existing] = record;
  } else {
    history.push(record);
  }
  localStorage.setItem(KEY, JSON.stringify(history));
}

export function getStreak(): number {
  const history = getHistory();
  const completed = history
    .filter((r) => r.completed)
    .map((r) => r.date)
    .sort()
    .reverse();

  if (completed.length === 0) return 0;

  let streak = 0;
  const now = new Date();
  let checkDate = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");

  for (const dateStr of completed) {
    if (dateStr === checkDate.toISOString().slice(0, 10)) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}
```

- [ ] **Step 4: Chạy test — pass**

```bash
npm test -- --testPathPattern=daily-challenge
```

Expected: 5 tests PASS.

- [ ] **Step 5: Thêm Daily Challenge banner vào `src/app/page.tsx`**

```tsx
import { getDailyChallenge, setDailyComplete, getStreak } from "@/lib/daily-challenge";

// State:
const [streak, setStreak] = useState(0);
const [dailyDone, setDailyDone] = useState(false);

// useEffect khi mount:
useEffect(() => {
  setStreak(getStreak());
  setDailyDone(getDailyChallenge()?.completed ?? false);
}, []);

// Khi user click "Đã học ✓" trên một từ, đếm số từ đã lưu hôm nay.
// Khi đủ 5 từ trong ngày và chưa mark daily done:
function handleWordSaved(word: string) {
  const learnedToday = getLearnedWords().filter(
    (w) => w.learnedAt.startsWith(new Date().toISOString().slice(0, 10))
  );
  if (learnedToday.length >= 5 && !dailyDone) {
    setDailyComplete(learnedToday.map((w) => w.word));
    setDailyDone(true);
    setStreak(getStreak());
  }
}

// Banner JSX (hiện trên đầu trang):
<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
  <div>
    <p className="font-medium text-amber-800">
      {dailyDone ? "✓ Thử thách hôm nay hoàn thành!" : "Thử thách hôm nay: học 5 từ mới"}
    </p>
    {streak > 0 && (
      <p className="text-amber-600 text-sm">🔥 Streak: {streak} ngày liên tiếp</p>
    )}
  </div>
  {dailyDone && <span className="text-2xl">🎉</span>}
</div>
```

- [ ] **Step 6: Kiểm tra thủ công**

Sinh từ, lật 5 thẻ, click "Đã học" trên cả 5 → banner chuyển thành "✓ Hoàn thành" và streak tăng lên 1.

- [ ] **Step 7: Commit**

```bash
git add src/lib/daily-challenge.ts src/lib/__tests__/daily-challenge.test.ts src/app/page.tsx
git commit -m "feat: add daily challenge banner with streak tracking"
```
