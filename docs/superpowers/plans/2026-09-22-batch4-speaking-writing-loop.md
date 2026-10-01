# Batch 4: Speaking/Writing Learning Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add history pages for speaking and writing, enable retry-with-score-comparison for speaking, highlight transcript errors, add shadowing mode, and implement writing rewrite practice with draft versioning — closing the feedback→improvement loop for both skills.

**Architecture:** History pages read from existing `speaking-storage.ts` / `writing-storage.ts`. Shadowing mode is a new speaking mode added to the existing IELTS speaking flow. Draft versioning adds a `versions` array to `WritingRecord`. Speaking/writing mistakes feed `UnifiedMistake` (Batch 1). No new API routes — shadowing reuses `/api/speech/transcribe` + `/api/speech/grade`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest (jsdom), localStorage

**Spec:** `docs/requirement/DEVELOPMENT_DIRECTION.md` §7 (Speaking v2), §8 (Writing v2), Batch 4 in §18

## Global Constraints

- No new npm dependencies.
- Audio replay uses existing `audio-store.ts` (IndexedDB) — do not change audio storage.
- Draft versioning must be backward-compatible: old `WritingRecord` without `versions` reads as `versions: []`.
- Speaking/writing mistakes write to `UnifiedMistake` from Batch 1.
- Shadowing initial version: missing word, wrong word, transcript similarity, speaking speed. No phoneme engine.
- `npm test && npm run lint && npm run build` must pass after every task.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/speak/history/page.tsx` | `/speak/history` — browse SpeakingRecords |
| Modify | `src/lib/speech/speaking-storage.ts` | Add `retryOfId?: string` field to SpeakingRecord |
| Create | `src/app/write/history/page.tsx` | `/write/history` — browse WritingRecords |
| Modify | `src/lib/write/writing-storage.ts` | Add `versions` array to WritingRecord |
| Create | `src/app/write/rewrite/[id]/page.tsx` | `/write/rewrite/[id]` — sentence rewrite practice |
| Create | `src/app/speak/shadowing/page.tsx` | `/speak/shadowing` — shadowing mode |

---

## Task 1: Speaking History page

**Files:**
- Create: `src/app/speak/history/page.tsx`
- Modify: `src/lib/speech/speaking-storage.ts` (add `retryOfId`)

**Interfaces — Consumes:**
- `getSpeaking`, `saveSpeaking`, `SpeakingRecord` from `src/lib/speech/speaking-storage.ts`
- `getAudio` from `src/lib/speech/audio-store.ts` (for replay)

- [ ] **Step 1: Add `retryOfId` to `SpeakingRecord`**

In `src/lib/speech/speaking-storage.ts`, add optional field to the interface:
```ts
export interface SpeakingRecord {
  // ... existing fields ...
  retryOfId?: string;   // links a retry to its original attempt
}
```

- [ ] **Step 2: Create `src/app/speak/history/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getSpeaking, type SpeakingRecord } from "@/lib/speech/speaking-storage";
import { getAudio } from "@/lib/speech/audio-store";

const MODE_LABELS: Record<string, string> = {
  ielts_p1: "IELTS P1", ielts_p2: "IELTS P2", ielts_p3: "IELTS P3",
  roleplay: "Roleplay", shadowing: "Shadowing",
};

function ScoreBars({ bands }: { bands: SpeakingRecord["feedback"]["bands"] }) {
  const items = [
    ["Fluency", bands.fluency],
    ["Lexical", bands.lexical],
    ["Grammar", bands.grammar],
    ["Pronunciation", bands.pronunciation ?? 0],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-1 mt-2">
      {items.map(([label, score]) => (
        <div key={label} className="text-xs">
          <div className="flex justify-between mb-0.5">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium">{score > 0 ? score.toFixed(1) : "—"}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded">
            <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${(score / 9) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SpeakingHistoryPage() {
  const [records, setRecords] = useState<SpeakingRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => { setRecords(getSpeaking()); }, []);

  async function handleReplay(audioId: string) {
    const blob = await getAudio(audioId);
    if (blob) setAudioUrl(URL.createObjectURL(blob));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Lịch sử Speaking</h1>
        <Link href="/speak" className="text-sm text-blue-500">← Quay lại</Link>
      </div>

      {records.length === 0 && (
        <p className="text-gray-500 text-center py-12">Chưa có bài nói nào.</p>
      )}

      <ul className="space-y-3">
        {records.map((r) => (
          <li key={r.id} className="border rounded-lg dark:border-gray-700">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full text-left p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-medium text-blue-500">{MODE_LABELS[r.mode] ?? r.mode}</span>
                  <p className="text-sm font-medium mt-0.5 line-clamp-2">{r.prompt}</p>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <span className="text-2xl font-bold text-blue-600">{r.feedback.overall.toFixed(1)}</span>
                  <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                </div>
              </div>
            </button>

            {expanded === r.id && (
              <div className="px-4 pb-4 border-t dark:border-gray-700">
                <ScoreBars bands={r.feedback.bands} />
                <p className="text-xs text-gray-500 mt-3 italic">{r.transcript}</p>
                <div className="flex gap-2 mt-3">
                  {r.audioId && (
                    <button onClick={() => handleReplay(r.audioId!)}
                      className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded">
                      ▶ Nghe lại
                    </button>
                  )}
                  <Link href={`/speak/ielts/${r.mode}?retryOf=${r.id}`}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded">
                    Thử lại
                  </Link>
                </div>
                {audioUrl && (
                  <audio controls src={audioUrl} className="w-full mt-2" autoPlay />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/speak/history/page.tsx src/lib/speech/speaking-storage.ts
git commit -m "feat: add /speak/history page (batch4)"
```

---

## Task 2: Writing History + Draft Versioning

**Files:**
- Modify: `src/lib/write/writing-storage.ts` (add `versions`)
- Create: `src/app/write/history/page.tsx`

**Interface changes:**
```ts
export interface WritingDraft {
  version: number;
  content: string;
  wordCount: number;
  feedback: WritingFeedbackShape;
  createdAt: string;
}

export interface WritingRecord {
  // ... existing fields ...
  versions?: WritingDraft[];    // v1 at index 0, latest at end
}
```

- [ ] **Step 1: Update `WritingRecord` and add `addWritingVersion` function**

In `src/lib/write/writing-storage.ts`:
```ts
// Add interface above WritingRecord:
export interface WritingDraft {
  version: number;
  content: string;
  wordCount: number;
  feedback: WritingFeedbackShape;
  createdAt: string;
}

// Extend WritingRecord:
export interface WritingRecord {
  // ... existing fields ...
  versions?: WritingDraft[];
}

// Add new function:
export function addWritingVersion(id: string, draft: Omit<WritingDraft, "version">): void {
  if (typeof window === "undefined") return;
  const all = getWriting();
  const record = all.find((r) => r.id === id);
  if (!record) return;
  const versions = record.versions ?? [];
  const updated: WritingRecord = {
    ...record,
    content: draft.content,
    wordCount: draft.wordCount,
    feedback: draft.feedback,
    updatedAt: new Date().toISOString(),
    versions: [...versions, { ...draft, version: versions.length + 1 }],
  };
  const rest = all.filter((r) => r.id !== id);
  rest.unshift(updated);
  localStorage.setItem(KEY, JSON.stringify(rest.slice(0, MAX)));
}
```

- [ ] **Step 2: Create `src/app/write/history/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getWriting, type WritingRecord } from "@/lib/write/writing-storage";

const KIND_LABELS: Record<string, string> = {
  ielts_task1: "IELTS Task 1", ielts_task2: "IELTS Task 2", toeic_email: "TOEIC Email",
};

export default function WritingHistoryPage() {
  const [records, setRecords] = useState<WritingRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setRecords(getWriting()); }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Lịch sử Writing</h1>
        <Link href="/write" className="text-sm text-blue-500">← Quay lại</Link>
      </div>

      {records.length === 0 && (
        <p className="text-gray-500 text-center py-12">Chưa có bài viết nào.</p>
      )}

      <ul className="space-y-3">
        {records.map((r) => (
          <li key={r.id} className="border rounded-lg dark:border-gray-700">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full text-left p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-medium text-purple-500">{KIND_LABELS[r.kind] ?? r.kind}</span>
                  <p className="text-sm font-medium mt-0.5 line-clamp-2">{r.prompt}</p>
                  <p className="text-xs text-gray-400 mt-1">{r.wordCount} từ · {formatDate(r.createdAt)}</p>
                </div>
                <span className="text-2xl font-bold text-purple-600 ml-2 shrink-0">
                  {r.feedback.overall.toFixed(1)}
                </span>
              </div>
            </button>

            {expanded === r.id && (
              <div className="px-4 pb-4 border-t dark:border-gray-700">
                {/* Band breakdown */}
                <div className="grid grid-cols-2 gap-1 mt-3 mb-3">
                  {Object.entries(r.feedback.bands).map(([k, v]) => (
                    <div key={k} className="text-xs flex justify-between">
                      <span className="text-gray-500 capitalize">{k}</span>
                      <span className="font-medium">{v.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 italic mb-2">{r.feedback.nextFocus}</p>

                {/* Version history */}
                {(r.versions?.length ?? 0) > 1 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Các phiên bản:</p>
                    <div className="flex gap-2 text-xs">
                      {r.versions!.map((v) => (
                        <span key={v.version} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                          v{v.version}: {v.feedback.overall.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Link href={`/write/result/${r.id}`}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded">
                    Xem chi tiết
                  </Link>
                  <Link href={`/write/rewrite/${r.id}`}
                    className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded">
                    Luyện viết lại
                  </Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Build check + commit**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
git add src/app/write/history/page.tsx src/lib/write/writing-storage.ts
git commit -m "feat: add /write/history + draft versioning (batch4)"
```

---

## Task 3: Writing Rewrite Practice

**Files:**
- Create: `src/app/write/rewrite/[id]/page.tsx`

Flow: extract sentences with `issue` from `feedback.annotations` → user rewrites one at a time → call `/api/exam/grade-open` to check → mark resolved if correct.

- [ ] **Step 1: Create `src/app/write/rewrite/[id]/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getWriting } from "@/lib/write/writing-storage";
import { addMistake } from "@/lib/mistakes";

interface RewriteItem {
  excerpt: string;
  issue: string;
  category: string;
  suggestion: string;
  resolved: boolean;
  userRewrite: string;
  feedback: string;
}

export default function RewritePage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<RewriteItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; feedback: string } | null>(null);

  useEffect(() => {
    const record = getWriting().find((r) => r.id === id);
    if (!record) return;
    setItems(record.feedback.annotations.map((a) => ({
      excerpt: a.excerpt,
      issue: a.issue,
      category: a.category,
      suggestion: a.suggestion,
      resolved: false,
      userRewrite: "",
      feedback: "",
    })));
  }, [id]);

  const current = items[currentIdx];

  async function handleCheck() {
    if (!input.trim() || !current) return;
    setChecking(true);
    const res = await fetch("/api/exam/grade-open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `Rewrite to fix: "${current.excerpt}" (Issue: ${current.issue})`,
        userAnswer: input,
        correctAnswer: current.suggestion,
      }),
    });
    const result = await res.json();
    setFeedback(result);
    setChecking(false);

    if (!result.correct) {
      addMistake({
        skill: "writing",
        category: current.category,
        source: `writing:rewrite:${id}`,
        userAnswer: input,
        correctAnswer: current.suggestion,
        explanation: current.issue,
      });
    }

    // Update item
    setItems((prev) => prev.map((item, i) =>
      i === currentIdx
        ? { ...item, resolved: result.correct, userRewrite: input, feedback: result.feedback }
        : item
    ));
  }

  function handleNext() {
    setInput("");
    setFeedback(null);
    setCurrentIdx((i) => Math.min(i + 1, items.length - 1));
  }

  if (items.length === 0) return (
    <main className="max-w-lg mx-auto p-4 text-center py-16">
      <p className="text-gray-500">Không có lỗi nào để luyện lại.</p>
      <Link href="/write/history" className="text-blue-500 text-sm mt-4 block">← Quay lại lịch sử</Link>
    </main>
  );

  const done = items.every((i) => i.resolved);

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Luyện viết lại</h1>
        <span className="text-sm text-gray-400">{currentIdx + 1}/{items.length}</span>
      </div>

      {done ? (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-medium mb-4">Đã hoàn thành tất cả lỗi!</p>
          <Link href="/write/history" className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm">
            Quay lại lịch sử
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4 mb-4">
            <p className="text-xs font-medium text-red-600 mb-1">Câu gốc</p>
            <p className="text-sm italic">"{current.excerpt}"</p>
            <p className="text-xs text-red-500 mt-1">Lỗi: {current.issue}</p>
          </div>

          <label className="block text-sm font-medium mb-2">Viết lại câu đúng:</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={feedback !== null}
            className="w-full border rounded-lg p-3 text-sm h-24 resize-none dark:bg-gray-900 dark:border-gray-700"
            placeholder="Nhập câu đã sửa..."
          />

          {feedback ? (
            <div className={`mt-3 p-3 rounded-lg text-sm ${feedback.correct ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200"}`}>
              <p className="font-medium">{feedback.correct ? "✓ Đúng!" : "Chưa chính xác"}</p>
              <p className="mt-1">{feedback.feedback}</p>
              {!feedback.correct && <p className="mt-1 text-xs opacity-70">Gợi ý: {current.suggestion}</p>}
            </div>
          ) : (
            <button onClick={handleCheck} disabled={checking || !input.trim()}
              className="mt-3 w-full py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50">
              {checking ? "Đang kiểm tra..." : "Kiểm tra"}
            </button>
          )}

          {feedback && currentIdx < items.length - 1 && (
            <button onClick={handleNext}
              className="mt-3 w-full py-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-medium">
              Câu tiếp theo
            </button>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
git add src/app/write/rewrite/[id]/page.tsx
git commit -m "feat: add writing rewrite practice (batch4)"
```

---

## Task 4: Shadowing mode

**Files:**
- Create: `src/app/speak/shadowing/page.tsx`

Shadowing flow: AI provides a sample sentence → user listens (TTS) → records → transcribe via `/api/speech/transcribe` → compare similarity → give feedback.

- [ ] **Step 1: Create `src/app/speak/shadowing/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRecorder } from "@/lib/speech/recorder";
import { saveSpeaking } from "@/lib/speech/speaking-storage";
import { startSession, finishSession } from "@/lib/sessions";

// Sample sentences for shadowing (static list — extend later)
const SHADOW_SENTENCES = [
  "The meeting has been postponed until next Thursday.",
  "Could you please send me the report by end of day?",
  "I'd like to schedule a conference call for tomorrow morning.",
  "The quarterly results exceeded our expectations significantly.",
  "We need to finalize the budget before the end of the month.",
];

type Phase = "ready" | "recording" | "result";

function similarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const matches = wordsA.filter((w) => wordsB.has(w)).length;
  return Math.round((matches / Math.max(wordsA.length, 1)) * 100);
}

export default function ShadowingPage() {
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [transcript, setTranscript] = useState("");
  const [matchPct, setMatchPct] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { startRecording, stopRecording, isRecording } = useRecorder();

  const sentence = SHADOW_SENTENCES[sentenceIdx % SHADOW_SENTENCES.length];

  function handleSpeak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  async function handleRecord() {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;
      setPhase("result");
      const sid = startSession({ type: "speaking" });
      setSessionId(sid);

      const form = new FormData();
      form.append("audio", blob, "shadowing.webm");
      const res = await fetch("/api/speech/transcribe", { method: "POST", body: form });
      const result = await res.json();
      const text = result.text ?? "";
      setTranscript(text);
      const score = similarity(sentence, text);
      setMatchPct(score);
      finishSession(sid, { totalItems: 1, correctItems: score >= 70 ? 1 : 0 });
    } else {
      await startRecording();
      setPhase("recording");
    }
  }

  function handleNext() {
    setSentenceIdx((i) => i + 1);
    setPhase("ready");
    setTranscript("");
    setMatchPct(0);
    setSessionId(null);
  }

  return (
    <main className="max-w-md mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Shadowing</h1>
        <Link href="/speak" className="text-sm text-blue-500">← Quay lại</Link>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mb-6 text-center">
        <p className="text-sm text-gray-500 mb-1">Câu mẫu</p>
        <p className="text-lg font-medium">"{sentence}"</p>
      </div>

      <div className="flex gap-3 mb-6 justify-center">
        <button onClick={handleSpeak}
          className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
          🔊 Nghe câu mẫu
        </button>
        <button onClick={handleRecord} disabled={phase === "result"}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${isRecording ? "bg-red-500 text-white" : "bg-blue-600 text-white"} disabled:opacity-40`}>
          {isRecording ? "⏹ Dừng ghi âm" : "🎤 Ghi âm"}
        </button>
      </div>

      {phase === "result" && (
        <div>
          <div className="text-center mb-4">
            <p className="text-4xl font-bold" style={{ color: matchPct >= 80 ? "#22c55e" : matchPct >= 60 ? "#f97316" : "#ef4444" }}>
              {matchPct}%
            </p>
            <p className="text-sm text-gray-500">Độ tương đồng</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Bạn đã nói:</p>
            <p className="text-sm italic">"{transcript || "(Không nhận được âm thanh)"}"</p>
          </div>

          {/* Highlight missing words */}
          {transcript && (
            <div className="text-sm mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Từ còn thiếu:</p>
              <div className="flex flex-wrap gap-1">
                {sentence.toLowerCase().split(" ").filter(
                  (w) => !transcript.toLowerCase().includes(w)
                ).map((w, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{w}</span>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleNext}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium">
            Câu tiếp theo
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add shadowing link to `/speak` page**

In `src/app/speak/page.tsx`, add a link to `/speak/shadowing` alongside the existing options.

- [ ] **Step 3: Build check + commit**

```bash
cd /Users/thankz/Code/study && npm run build 2>&1 | tail -10
git add src/app/speak/shadowing/page.tsx src/app/speak/page.tsx
git commit -m "feat: add shadowing mode (batch4)"
```

---

## Acceptance Criteria

- [ ] `/speak/history` lists records with mode, prompt, score, date; expands to show bands, transcript, replay, retry.
- [ ] `/write/history` lists records with kind, prompt, word count, score; expands to show bands, versions, rewrite link.
- [ ] `WritingRecord.versions` is optional — old records render without errors.
- [ ] `/write/rewrite/[id]` shows each annotation as a sentence rewrite exercise; wrong rewrites add a `UnifiedMistake`.
- [ ] `/speak/shadowing` allows listen → record → get similarity score + missing words.
- [ ] `npm test && npm run lint && npm run build` pass.

## Risks

- `useRecorder` hook from `src/lib/speech/recorder.ts` — verify API (`startRecording`, `stopRecording`, `isRecording`) before using in shadowing page; adjust to match actual exports.
- `/api/exam/grade-open` may not perfectly grade sentence rewrites — acceptable for v1; improve prompt if needed.
- `SpeechSynthesisUtterance` is browser-only — guarded by `typeof window !== "undefined"`.

## Dependencies

- Batch 1 (`src/lib/mistakes.ts`) — `addMistake` in rewrite practice.
- Existing `src/lib/speech/recorder.ts`, `src/lib/speech/audio-store.ts`.
- Existing `saveSpeaking`, `getWriting`, `addWritingVersion`.

## Out of Scope

- Speaking retry score comparison UI (retry link navigates to speaking page with `?retryOf=` param; comparison UI is future work).
- Supabase sync for new routes (Batch 6).
- Phoneme-level pronunciation analysis.
