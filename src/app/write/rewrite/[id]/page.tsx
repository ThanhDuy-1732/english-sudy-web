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
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; feedback: string } | null>(null);

  useEffect(() => {
    const record = getWriting().find((r) => r.id === id);
    if (!record) return;
    const annotations = record.feedback.annotations;
    if (annotations.length === 0) return;
    setItems(annotations.map((a) => ({
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
    try {
      const res = await fetch("/api/exam/grade-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Rewrite to fix: "${current.excerpt}" (Issue: ${current.issue})`,
          userAnswer: input,
          correctAnswer: current.suggestion,
        }),
      });
      const result = await res.json() as { correct: boolean; feedback: string };
      if (!res.ok || typeof result.correct !== "boolean") throw new Error("grading failed");
      setError(null);
      setFeedback(result);

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

      setItems((prev) => prev.map((item, i) =>
        i === currentIdx
          ? { ...item, resolved: result.correct, userRewrite: input, feedback: result.feedback }
          : item
      ));
    } catch {
      // A failed request says nothing about the learner's answer: no verdict, no mistake logged.
      setError("Không thể chấm lúc này. Vui lòng thử lại.");
    } finally {
      setChecking(false);
    }
  }

  function handleNext() {
    setError(null);
    setInput("");
    setFeedback(null);
    setCurrentIdx((i) => Math.min(i + 1, items.length - 1));
  }

  if (items.length === 0) {
    return (
      <main className="page">
        <Link href="/write/history" className="back-link">← Bài viết đã làm</Link>
        <h1 className="page-title">Luyện viết lại</h1>
        <p className="page-lead">Bài này không có câu nào bị sửa để luyện lại.</p>
      </main>
    );
  }

  const done = items.every((item) => item.resolved);

  return (
    <main className="page">
      <div className="flex justify-between items-center mb-4">
        <h1 className="page-title">Luyện viết lại</h1>
        <span className="text-sm text-gray-400">{currentIdx + 1}/{items.length}</span>
      </div>

      {done ? (
        <div className="text-center py-12">
          <p className="font-medium mb-4">Đã hoàn thành tất cả lỗi!</p>
          <Link href="/write/history" className="btn btn-primary min-h-10 px-4 text-sm">
            Quay lại lịch sử
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4 mb-4">
            <p className="text-xs font-medium text-red-600 mb-1">Câu gốc</p>
            <p className="text-sm italic">&ldquo;{current.excerpt}&rdquo;</p>
            <p className="text-xs text-red-500 mt-1">Lỗi: {current.issue}</p>
          </div>

          <label className="block text-sm font-medium mb-2">Viết lại câu đúng:</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={feedback !== null}
            className="field w-full h-24 resize-none text-sm"
            placeholder="Nhập câu đã sửa..."
          />

          {feedback ? (
            <div className={`mt-3 p-3 rounded-lg text-sm ${feedback.correct ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200"}`}>
              <p className="font-medium">{feedback.correct ? "✓ Đúng!" : "Chưa chính xác"}</p>
              <p className="mt-1">{feedback.feedback}</p>
              {!feedback.correct && (
                <p className="mt-1 text-xs opacity-70">Gợi ý: {current.suggestion}</p>
              )}
            </div>
          ) : (
            <>
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={() => void handleCheck()}
              disabled={checking || !input.trim()}
              className="btn btn-primary mt-3 w-full"
            >
              {checking ? "Đang kiểm tra..." : "Kiểm tra"}
            </button>
            </>
          )}

          {feedback && currentIdx < items.length - 1 && (
            <button
              onClick={handleNext}
              className="btn btn-secondary mt-3 w-full"
            >
              Câu tiếp theo
            </button>
          )}
        </>
      )}
    </main>
  );
}
