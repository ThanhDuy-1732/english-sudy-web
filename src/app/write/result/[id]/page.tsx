"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { saveLearnedWord } from "@/lib/storage";
import { getWriting } from "@/lib/write/writing-storage";

interface WritingFeedback {
  bands: { task: number; coherence: number; lexical: number; grammar: number };
  overall: number;
  wordCount: number;
  annotations: {
    excerpt: string;
    issue: string;
    category: string;
    suggestion: string;
  }[];
  modelAnswer: string;
  nextFocus: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  grammar: "#dc3545",
  vocab: "#6610f2",
  cohesion: "#0d6efd",
  task: "#fd7e14",
  style: "#6c757d",
};

const KIND_TITLES: Record<string, string> = {
  ielts_task1: "IELTS Task 1",
  ielts_task2: "IELTS Task 2",
  toeic_email: "TOEIC Writing – Business Email",
};

export default function WritingResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{
    feedback: WritingFeedback;
    content: string;
    config: { title: string; prompt: string };
    taskId?: string;
  } | null>(null);

  useEffect(() => {
    const record = getWriting().find((item) => item.id === id);
    if (record) {
      setData({ feedback: record.feedback, content: record.content, config: { title: KIND_TITLES[record.kind] ?? record.kind, prompt: record.prompt }, taskId: record.taskId });
      return;
    }
    try {
      const stored = sessionStorage.getItem(`writing-result-${id}`);
      // Legacy results were keyed by task id, so the id is the task.
      if (stored) setData({ ...JSON.parse(stored), taskId: id });
    } catch { /* Ignore invalid legacy result data. */ }
  }, [id]);

  if (!data) {
    return (
      <div className="not-found">
        <p>Không tìm thấy kết quả. <button onClick={() => router.push("/write")}>Về trang Write</button></p>
      </div>
    );
  }

  const { feedback, content, config } = data;

  function escape(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function highlightAnnotations(text: string) {
    // Escape first, then wrap matched excerpts in safe <mark> tags
    let result = escape(text);
    for (const ann of feedback.annotations) {
      if (!ann.excerpt) continue;
      const safeExcerpt = escape(ann.excerpt);
      const color = CATEGORY_COLORS[ann.category] ?? "#6c757d";
      if (result.includes(safeExcerpt)) {
        result = result.replace(
          safeExcerpt,
          `<mark style="background:${escape(color)}22;border-bottom:2px solid ${escape(color)};border-radius:2px;">${safeExcerpt}</mark>`
        );
      }
    }
    return result;
  }

  return (
    <div className="result-page">
      <div className="result-header">
        <button onClick={() => router.push("/write")} className="back-btn">← Write</button>
        <h1>{config.title}</h1>
      </div>

      {/* Scores */}
      <div className="score-grid">
        {(["task", "coherence", "lexical", "grammar"] as const).map((k) => (
          <div key={k} className="score-box">
            <p className="score-label">
              {k === "task" ? "Task" : k === "coherence" ? "Coherence" : k === "lexical" ? "Lexical" : "Grammar"}
            </p>
            <p className="score-val">{feedback.bands[k]}</p>
          </div>
        ))}
        <div className="score-box overall">
          <p className="score-label">Overall</p>
          <p className="score-val">{feedback.overall}</p>
        </div>
      </div>
      <p className="word-count">{feedback.wordCount} từ</p>

      {/* Next focus */}
      <div className="next-focus">
        <span>🎯 Cần cải thiện tiếp theo: </span>
        <strong>{feedback.nextFocus}</strong>
      </div>

      {/* Annotated essay */}
      <section>
        <h2>Bài viết có chú thích</h2>
        <div
          className="annotated-text"
          dangerouslySetInnerHTML={{ __html: highlightAnnotations(content) }}
        />
        {/* Annotation legend */}
        <div className="annotation-list">
          {feedback.annotations.map((ann, i) => (
            <div key={i} className="ann-item" style={{ borderLeftColor: CATEGORY_COLORS[ann.category] ?? "#6c757d" }}>
              <p className="ann-excerpt">&ldquo;{ann.excerpt}&rdquo;</p>
              <p className="ann-issue">{ann.issue}</p>
              <p className="ann-suggestion">✓ {ann.suggestion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Model answer */}
      <section>
        <h2>Bài mẫu band 8</h2>
        <div className="model-answer">{feedback.modelAnswer}</div>
      </section>

      <div className="result-actions">
        <button onClick={() => router.push(data.taskId ? `/write/task/${data.taskId}` : "/write")}>
          Viết lại
        </button>
        <button onClick={() => router.push("/write")}>
          Chọn dạng bài khác
        </button>
      </div>

      <style jsx>{`
        .result-page { max-width: 800px; margin: 0 auto; padding: 1.5rem; }
        .result-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: #6c757d; }
        h1 { font-size: 1.1rem; font-weight: 700; margin: 0; }
        h2 { font-size: 0.9rem; text-transform: uppercase; color: #6c757d; margin: 1.5rem 0 0.5rem; }
        .score-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; margin-bottom: 0.5rem; }
        .score-box { color: #212529; text-align: center; padding: 0.75rem; background: #f8f9fa; border-radius: 10px; }
        .score-box.overall { background: #d1e7dd; }
        .score-label { font-size: 0.7rem; color: #6c757d; margin: 0; text-transform: uppercase; }
        .score-val { font-size: 1.5rem; font-weight: 700; margin: 0.2rem 0 0; }
        .word-count { font-size: 0.8rem; color: #6c757d; margin-bottom: 0.75rem; }
        .next-focus { color: #212529; background: #fff3cd; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.875rem; margin-bottom: 0.5rem; }
        .annotated-text { color: #212529; font-size: 0.9rem; line-height: 1.7; background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; white-space: pre-wrap; }
        .annotation-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .ann-item { color: #212529; padding: 0.6rem 0.75rem; border-left: 3px solid; background: #f8f9fa; border-radius: 0 6px 6px 0; font-size: 0.85rem; }
        .ann-excerpt { font-style: italic; color: #495057; margin: 0 0 0.2rem; }
        .ann-issue { font-weight: 600; margin: 0 0 0.15rem; }
        .ann-suggestion { color: #198754; margin: 0; }
        .model-answer { color: #212529; font-size: 0.9rem; line-height: 1.7; background: #e8f0fe; padding: 1rem; border-radius: 8px; border-left: 3px solid #0d6efd; white-space: pre-wrap; }
        .result-actions { display: flex; gap: 0.75rem; margin-top: 2rem; flex-wrap: wrap; }
        .result-actions button { color: #212529; padding: 0.6rem 1.25rem; border-radius: 8px; border: 1.5px solid #dee2e6; background: white; cursor: pointer; font-size: 0.9rem; }
        .result-actions button:first-child { background: #0d6efd; color: white; border-color: #0d6efd; }
        .not-found { padding: 2rem; text-align: center; }
        .not-found button { background: none; border: none; color: #0d6efd; cursor: pointer; text-decoration: underline; }
        @media (max-width: 560px) { .score-grid { grid-template-columns: repeat(3, 1fr); } }
        /* dark theme: light surfaces */
        :global(:root[data-theme="dark"]) .score-box { background: rgba(255, 255, 255, 0.07); color: #f1ecff; }
        :global(:root[data-theme="dark"]) .score-box.overall { background: rgba(34, 197, 94, 0.16); color: #86efac; }
        :global(:root[data-theme="dark"]) .next-focus { background: rgba(234, 179, 8, 0.18); color: #fde68a; }
        :global(:root[data-theme="dark"]) .annotated-text { background: rgba(255, 255, 255, 0.07); color: #f1ecff; }
        :global(:root[data-theme="dark"]) .ann-item { background: rgba(255, 255, 255, 0.07); color: #f1ecff; }
        :global(:root[data-theme="dark"]) .model-answer { background: rgba(59, 130, 246, 0.2); color: #bfdbfe; }
        :global(:root[data-theme="dark"]) .result-actions button { background: #3a2a61; color: #f1ecff; border-color: rgba(255, 255, 255, 0.22); }
      `}</style>
    </div>
  );
}
