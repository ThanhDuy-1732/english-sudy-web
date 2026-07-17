# Nhóm Nội Dung Mở Rộng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 3 tính năng mở rộng nội dung: Tự thêm chủ đề bất kỳ, Import danh sách từ, Reading Mode (đọc hiểu đoạn văn).

**Architecture:** Custom topics lưu vào localStorage key `"customTopics"`. Import word list gọi 1 Gemini request cho cả batch. Reading Mode gọi API route mới trả về đoạn văn + câu hỏi. Không có trang riêng cho Import — dùng `/import` page riêng để tránh làm nặng trang chủ.

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, `@google/generative-ai`

## Global Constraints

- Prerequisite: base plan (`2026-07-16-english-study.md`) đã implement xong
- `GEMINI_API_KEY` chỉ trong API routes
- Import tối đa 20 từ mỗi lần để tránh vượt token limit
- Vietnamese UI text

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `src/lib/custom-topics.ts` | Create | getCustomTopics(), saveCustomTopic() |
| `src/lib/__tests__/custom-topics.test.ts` | Create | Unit tests |
| `src/components/TopicSelector.tsx` | Modify | Thêm ô input + hiện custom topic pills |
| `src/app/api/generate-batch/route.ts` | Create | POST: { words: string[] } → LearnedWord[] |
| `src/components/ImportWords.tsx` | Create | Textarea + bảng kết quả + checkbox chọn |
| `src/app/import/page.tsx` | Create | Trang import từ |
| `src/app/api/generate-reading/route.ts` | Create | POST: { words: string[] } → { passage, questions } |
| `src/components/ReadingMode.tsx` | Create | Đoạn văn highlight + MCQ |
| `src/app/page.tsx` | Modify | Thêm nút "Đọc hiểu" sau khi sinh 5 từ |
| `src/app/layout.tsx` | Modify | Thêm link "Import từ" vào nav |

---

## Task 1: Custom Topics

**Files:**
- Create: `src/lib/custom-topics.ts`
- Create: `src/lib/__tests__/custom-topics.test.ts`
- Modify: `src/components/TopicSelector.tsx`

**Interfaces:**
- Produces:
  ```ts
  function getCustomTopics(): string[]
  function saveCustomTopic(topic: string): void
  ```

- [ ] **Step 1: Viết failing tests**

Tạo `src/lib/__tests__/custom-topics.test.ts`:

```ts
import { getCustomTopics, saveCustomTopic } from "../custom-topics";

beforeEach(() => {
  localStorage.clear();
});

test("getCustomTopics returns empty array initially", () => {
  expect(getCustomTopics()).toEqual([]);
});

test("saveCustomTopic persists a new topic", () => {
  saveCustomTopic("Business Email");
  expect(getCustomTopics()).toContain("Business Email");
});

test("saveCustomTopic does not save duplicate topics", () => {
  saveCustomTopic("Cooking");
  saveCustomTopic("Cooking");
  expect(getCustomTopics().filter((t) => t === "Cooking")).toHaveLength(1);
});

test("saveCustomTopic trims whitespace", () => {
  saveCustomTopic("  Medical  ");
  expect(getCustomTopics()).toContain("Medical");
});

test("saveCustomTopic ignores empty string", () => {
  saveCustomTopic("   ");
  expect(getCustomTopics()).toEqual([]);
});
```

- [ ] **Step 2: Chạy test — xác nhận fail**

```bash
npm test -- --testPathPattern=custom-topics
```

Expected: FAIL.

- [ ] **Step 3: Tạo `src/lib/custom-topics.ts`**

```ts
const KEY = "customTopics";

export function getCustomTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCustomTopic(topic: string): void {
  const trimmed = topic.trim();
  if (!trimmed) return;
  const existing = getCustomTopics();
  if (existing.includes(trimmed)) return;
  localStorage.setItem(KEY, JSON.stringify([...existing, trimmed]));
}
```

- [ ] **Step 4: Chạy test — pass**

```bash
npm test -- --testPathPattern=custom-topics
```

Expected: 5 tests PASS.

- [ ] **Step 5: Cập nhật `src/components/TopicSelector.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { getCustomTopics, saveCustomTopic } from "@/lib/custom-topics";

const DEFAULT_TOPICS = ["Daily Communication", "TOEIC"];

interface Props {
  selectedTopic: string;
  onSelect: (topic: string) => void;
}

export default function TopicSelector({ selectedTopic, onSelect }: Props) {
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setCustomTopics(getCustomTopics());
  }, []);

  function handleAddTopic() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    saveCustomTopic(trimmed);
    setCustomTopics(getCustomTopics());
    onSelect(trimmed);
    setInputValue("");
  }

  const allTopics = [...DEFAULT_TOPICS, ...customTopics];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allTopics.map((topic) => (
          <button
            key={topic}
            onClick={() => onSelect(topic)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedTopic === topic
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {topic}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
          placeholder="Chủ đề khác... (nhấn Enter)"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600"
        />
        <button
          onClick={handleAddTopic}
          disabled={!inputValue.trim()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          + Thêm
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Kiểm tra thủ công**

Chạy `npm run dev`. Trang chủ: gõ "Cooking" vào ô input → nhấn Enter → pill "Cooking" xuất hiện và được chọn → sinh từ về chủ đề Cooking.

- [ ] **Step 7: Commit**

```bash
git add src/lib/custom-topics.ts src/lib/__tests__/custom-topics.test.ts src/components/TopicSelector.tsx
git commit -m "feat: add custom topic input with localStorage persistence"
```

---

## Task 2: Import Word List

**Files:**
- Create: `src/app/api/generate-batch/route.ts`
- Modify: `src/lib/gemini.ts` — thêm `generateWordsBatch()`
- Create: `src/components/ImportWords.tsx`
- Create: `src/app/import/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `POST /api/generate-batch` nhận `{ words: string[] }` (max 20)
- Produces: `{ word: string; meaning: string; example: string }[]`

- [ ] **Step 1: Thêm `generateWordsBatch` vào `src/lib/gemini.ts`**

```ts
export async function generateWordsBatch(
  words: string[]
): Promise<{ word: string; meaning: string; example: string }[]> {
  const model = getModel();
  const wordList = words.slice(0, 20).join(", ");
  const prompt = `For each of these English words: ${wordList}
Provide:
- Vietnamese meaning (1-3 words)
- One natural example sentence

Return JSON array only:
[{"word": "...", "meaning": "...", "example": "..."}]`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(text);
}
```

- [ ] **Step 2: Tạo `src/app/api/generate-batch/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateWordsBatch } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { words } = await req.json();
  if (!Array.isArray(words) || words.length === 0) {
    return NextResponse.json({ error: "Missing words array" }, { status: 400 });
  }
  const result = await generateWordsBatch(words);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Tạo `src/components/ImportWords.tsx`**

```tsx
"use client";

import { useState } from "react";
import { saveLearnedWord, LearnedWord } from "@/lib/storage";

interface WordResult {
  word: string;
  meaning: string;
  example: string;
}

export default function ImportWords() {
  const [rawInput, setRawInput] = useState("");
  const [results, setResults] = useState<WordResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  async function handleFetch() {
    const words = rawInput
      .split(/\n|,/)
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (words.length === 0) return;
    setLoading(true);
    setResults([]);
    setSavedCount(0);

    const res = await fetch("/api/generate-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });
    const data: WordResult[] = await res.json();
    setResults(data);
    setSelected(new Set(data.map((d) => d.word)));
    setLoading(false);
  }

  function toggleSelect(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  function handleSave() {
    let count = 0;
    results
      .filter((r) => selected.has(r.word))
      .forEach((r) => {
        const entry: LearnedWord = {
          word: r.word,
          meaning: r.meaning,
          example: r.example,
          topic: "Import",
          learnedAt: new Date().toISOString(),
          nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
          reviewInterval: 1,
          mastery: 0,
        };
        saveLearnedWord(entry);
        count++;
      });
    setSavedCount(count);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Dán danh sách từ (mỗi dòng 1 từ, tối đa 20 từ):
        </label>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={"negotiate\nfacilitate\nsynthesize\n..."}
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600"
        />
      </div>

      <button
        onClick={handleFetch}
        disabled={loading || !rawInput.trim()}
        className="w-full bg-blue-500 text-white rounded-xl py-3 font-medium hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Đang tra nghĩa..." : "Tra nghĩa với AI"}
      </button>

      {results.length > 0 && (
        <>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === results.length}
                      onChange={() =>
                        setSelected(
                          selected.size === results.length
                            ? new Set()
                            : new Set(results.map((r) => r.word))
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Từ</th>
                  <th className="px-4 py-2 text-left font-medium">Nghĩa</th>
                  <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Ví dụ</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.word} className="border-t border-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.word)}
                        onChange={() => toggleSelect(r.word)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{r.word}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.meaning}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs italic hidden md:table-cell">
                      {r.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSave}
            disabled={selected.size === 0}
            className="w-full bg-green-500 text-white rounded-xl py-3 font-medium hover:bg-green-600 disabled:opacity-50"
          >
            Lưu {selected.size} từ vào lịch sử
          </button>

          {savedCount > 0 && (
            <p className="text-green-600 text-sm text-center font-medium">
              ✓ Đã lưu {savedCount} từ vào lịch sử!
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Tạo `src/app/import/page.tsx`**

```tsx
import ImportWords from "@/components/ImportWords";

export default function ImportPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Import danh sách từ</h1>
      <p className="text-gray-500 text-sm mb-6">
        Dán danh sách từ tiếng Anh — AI sẽ tra nghĩa và câu ví dụ cho từng từ.
      </p>
      <ImportWords />
    </div>
  );
}
```

- [ ] **Step 5: Thêm link "Import từ" vào `src/app/layout.tsx`**

```tsx
<Link href="/import">Import từ</Link>
```

- [ ] **Step 6: Kiểm tra thủ công**

Vào `/import`, dán 5–10 từ → "Tra nghĩa với AI" → bảng kết quả hiện → tick chọn từ → "Lưu" → vào `/history` kiểm tra đã có topic "Import".

- [ ] **Step 7: Commit**

```bash
git add src/lib/gemini.ts src/app/api/generate-batch/route.ts src/components/ImportWords.tsx src/app/import/page.tsx src/app/layout.tsx
git commit -m "feat: add import word list with batch Gemini lookup"
```

---

## Task 3: Reading Mode

**Files:**
- Create: `src/app/api/generate-reading/route.ts`
- Modify: `src/lib/gemini.ts` — thêm `generateReading()`
- Create: `src/components/ReadingMode.tsx`
- Modify: `src/app/page.tsx` — thêm nút "Đọc hiểu"

**Interfaces:**
- Consumes: `POST /api/generate-reading` nhận `{ words: string[] }`
- Produces:
  ```ts
  {
    passage: string;
    questions: { question: string; options: string[]; answer: string }[];
  }
  ```

- [ ] **Step 1: Thêm `generateReading` vào `src/lib/gemini.ts`**

```ts
export async function generateReading(words: string[]): Promise<{
  passage: string;
  questions: { question: string; options: string[]; answer: string }[];
}> {
  const model = getModel();
  const wordList = words.join(", ");
  const prompt = `Write a short English paragraph (80-100 words) that naturally uses all of these words: ${wordList}.
Then write 2 comprehension questions about the paragraph, each with 3 multiple choice options (A, B, C).

Return JSON only:
{
  "passage": "...",
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ..."],
      "answer": "A"
    }
  ]
}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(text);
}
```

- [ ] **Step 2: Tạo `src/app/api/generate-reading/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateReading } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { words } = await req.json();
  if (!Array.isArray(words) || words.length === 0) {
    return NextResponse.json({ error: "Missing words" }, { status: 400 });
  }
  const result = await generateReading(words);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Tạo `src/components/ReadingMode.tsx`**

```tsx
"use client";

interface Question {
  question: string;
  options: string[];
  answer: string;
}

interface Props {
  passage: string;
  questions: Question[];
  highlightWords: string[];
  onClose: () => void;
}

function HighlightedPassage({ text, words }: { text: string; words: string[] }) {
  const pattern = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const parts = text.split(pattern);
  return (
    <p className="leading-relaxed text-gray-700 dark:text-gray-300">
      {parts.map((part, i) =>
        words.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export default function ReadingMode({ passage, questions, highlightWords, onClose }: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // useState import needed at top of file
  const [, forceUpdate] = useState(0);

  function handleAnswer(qi: number, option: string) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qi]: option[0] })); // "A", "B", or "C"
  }

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.answer).length
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Đọc hiểu</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <HighlightedPassage text={passage} words={highlightWords} />
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Câu hỏi:</h3>
            {questions.map((q, qi) => (
              <div key={qi} className="space-y-2">
                <p className="font-medium text-sm">{qi + 1}. {q.question}</p>
                <div className="space-y-1">
                  {q.options.map((opt) => {
                    const letter = opt[0];
                    const isSelected = answers[qi] === letter;
                    const isCorrect = submitted && letter === q.answer;
                    const isWrong = submitted && isSelected && letter !== q.answer;
                    return (
                      <button
                        key={opt}
                        onClick={() => handleAnswer(qi, opt)}
                        className={`w-full text-left px-4 py-2 rounded-lg text-sm border transition-colors ${
                          isCorrect
                            ? "border-green-400 bg-green-50 text-green-800"
                            : isWrong
                            ? "border-red-400 bg-red-50 text-red-800"
                            : isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!submitted ? (
            <button
              onClick={() => setSubmitted(true)}
              disabled={Object.keys(answers).length < questions.length}
              className="w-full bg-blue-500 text-white rounded-xl py-3 font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              Nộp bài
            </button>
          ) : (
            <div className="text-center">
              <p className="text-2xl font-bold mb-1">{score}/{questions.length}</p>
              <p className="text-gray-500 text-sm">
                {score === questions.length ? "Xuất sắc! 🎉" : "Đọc lại đoạn văn và thử lại nhé."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Thêm `import { useState } from "react";` ở đầu file (thay dòng `const [, forceUpdate]` bằng cách dùng useState thật sự từ react).

- [ ] **Step 4: Thêm nút "Đọc hiểu" vào `src/app/page.tsx`**

```tsx
import ReadingMode from "@/components/ReadingMode";

// State:
const [readingData, setReadingData] = useState<{
  passage: string;
  questions: { question: string; options: string[]; answer: string }[];
} | null>(null);
const [readingLoading, setReadingLoading] = useState(false);

async function handleReadingMode() {
  if (words.length === 0) return;
  setReadingLoading(true);
  const res = await fetch("/api/generate-reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words: words.map((w) => w.word) }),
  });
  const data = await res.json();
  setReadingData(data);
  setReadingLoading(false);
}

// JSX — thêm nút sau khi đã có words:
{words.length > 0 && (
  <button
    onClick={handleReadingMode}
    disabled={readingLoading}
    className="bg-teal-500 text-white rounded-xl px-6 py-2 text-sm font-medium hover:bg-teal-600 disabled:opacity-50"
  >
    {readingLoading ? "Đang tạo bài đọc..." : "Đọc hiểu"}
  </button>
)}

{readingData && (
  <ReadingMode
    passage={readingData.passage}
    questions={readingData.questions}
    highlightWords={words.map((w) => w.word)}
    onClose={() => setReadingData(null)}
  />
)}
```

- [ ] **Step 5: Kiểm tra thủ công**

Sinh 5 từ → click "Đọc hiểu" → modal mở với đoạn văn có highlight các từ vừa học → trả lời 2 câu hỏi → nộp bài → thấy điểm.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gemini.ts src/app/api/generate-reading/route.ts src/components/ReadingMode.tsx src/app/page.tsx
git commit -m "feat: add reading comprehension mode with Gemini-generated passage"
```
