"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { saveLearnedWord } from "@/lib/storage";
import { getWriting, setWritingModelAnswer } from "@/lib/write/writing-storage";

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
  modelAnswer?: string;
  nextFocus: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  grammar: "rgb(var(--margin))",
  vocab: "rgb(var(--soil))",
  cohesion: "rgb(var(--primary))",
  task: "rgb(var(--warn))",
  style: "rgb(var(--muted))",
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
    kind?: string;
    chartData?: unknown;
  } | null>(null);
  const [modelFailed, setModelFailed] = useState(false);

  useEffect(() => {
    const record = getWriting().find((item) => item.id === id);
    if (record) {
      setData({ feedback: record.feedback, content: record.content, config: { title: KIND_TITLES[record.kind] ?? record.kind, prompt: record.prompt }, taskId: record.taskId, kind: record.kind, chartData: record.chartData });
      return;
    }
    try {
      const stored = sessionStorage.getItem(`writing-result-${id}`);
      // Legacy results were keyed by task id, so the id is the task.
      if (stored) setData({ ...JSON.parse(stored), taskId: id });
    } catch { /* Ignore invalid legacy result data. */ }
  }, [id]);

  // Grading returns without the band 8 model answer (it is slow to write); fetch it here, once, and keep it on the record.
  const needsModel = !!data && !!data.kind && !data.feedback.modelAnswer;
  useEffect(() => {
    if (!needsModel || !data) return;
    let cancelled = false;
    fetch("/api/write/model-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: data.kind, prompt: data.config.prompt, chartData: data.chartData }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("model answer failed"))))
      .then(({ modelAnswer }: { modelAnswer: string }) => {
        setWritingModelAnswer(id, modelAnswer);
        if (!cancelled) setData((d) => (d ? { ...d, feedback: { ...d.feedback, modelAnswer } } : d));
      })
      .catch(() => { if (!cancelled) setModelFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsModel, id]);

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
      const color = CATEGORY_COLORS[ann.category] ?? "rgb(var(--muted))";
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
        <button onClick={() => router.push("/write")} className="back-btn">← Luyện viết</button>
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
        <span>Nên tập trung tiếp: </span>
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
            <div key={i} className="ann-item" style={{ borderLeftColor: CATEGORY_COLORS[ann.category] ?? "rgb(var(--muted))" }}>
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
        <div className="model-answer postcard">
          {feedback.modelAnswer ?? (modelFailed ? "Không tạo được bài mẫu. Tải lại trang để thử lại." : "Đang viết bài mẫu…")}
        </div>
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
        .result-page { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
        .result-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: rgb(var(--muted)); }
        h1 { color: rgb(var(--ink)); letter-spacing: -0.015em; font-size: 1.625rem; font-weight: 600; margin: 0; }
        h2 { font-weight: 600; font-size: 1rem; color: rgb(var(--ink)); margin: 1.5rem 0 0.5rem; }
        .score-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; margin-bottom: 0.5rem; }
        .score-box { color: rgb(var(--ink)); text-align: center; padding: 0.75rem; background: rgb(var(--paper)); border-radius: 1.5rem; }
        .score-box.overall { background: rgb(var(--ok-soft)); }
        .score-label { font-size: 0.7rem; color: rgb(var(--muted)); margin: 0; }
        .score-val { font-size: 1.5rem; font-weight: 700; margin: 0.2rem 0 0; }
        .word-count { font-size: 0.8rem; color: rgb(var(--muted)); margin-bottom: 0.75rem; }
        .next-focus { color: rgb(var(--ink)); background: rgb(var(--warn-soft)); border-radius: 1rem; padding: 0.75rem 1rem; font-size: 0.875rem; margin-bottom: 0.5rem; }
        .annotated-text { color: rgb(var(--ink)); font-family: var(--font-en), Georgia, serif; font-size: 1rem; line-height: 1.7; background: rgb(var(--paper)); padding: 1rem; border-radius: 1rem; margin-bottom: 0.75rem; white-space: pre-wrap; }
        .annotation-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .ann-item { color: rgb(var(--ink)); padding: 0.6rem 0.75rem; border-left: 3px solid; background: rgb(var(--paper)); border-radius: 0 6px 6px 0; font-size: 0.85rem; }
        .ann-excerpt { font-style: italic; color: rgb(var(--muted)); margin: 0 0 0.2rem; }
        .ann-issue { font-weight: 600; margin: 0 0 0.15rem; }
        .ann-suggestion { color: rgb(var(--ok)); margin: 0; }
        .model-answer { font-family: var(--font-en), Georgia, serif; font-size: 1rem; line-height: 1.75; padding: 1.25rem 1.4rem; white-space: pre-wrap; }
        .result-actions { display: flex; gap: 0.75rem; margin-top: 2rem; flex-wrap: wrap; }
        .result-actions button { color: rgb(var(--ink)); padding: 0.6rem 1.25rem; border-radius: 999px; min-height: 44px; border: 1.5px solid rgb(var(--rule)); background: rgb(var(--card)); cursor: pointer; font-size: 0.9rem; }
        .result-actions button:first-child { background: rgb(var(--primary)); color: white; border-color: rgb(var(--primary)); }
        .not-found { padding: 2rem; text-align: center; }
        .not-found button { background: none; border: none; color: rgb(var(--primary-text)); cursor: pointer; text-decoration: underline; }
        @media (max-width: 560px) { .score-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </div>
  );
}
