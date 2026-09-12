"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TaskConfig {
  kind: string;
  title: string;
  prompt: string;
  minWords: number;
  timeLimitMin: number;
  chartData?: Record<string, unknown>;
}

const TASK_CONFIGS: Record<string, TaskConfig> = {
  "task2-opinion": {
    kind: "ielts_task2",
    title: "IELTS Task 2 – Opinion Essay",
    prompt:
      "Some people believe that universities should focus on providing academic knowledge, while others think they should also prepare students for the working world. Discuss both views and give your own opinion.",
    minWords: 250,
    timeLimitMin: 40,
  },
  "task2-discuss": {
    kind: "ielts_task2",
    title: "IELTS Task 2 – Discussion Essay",
    prompt:
      "In many countries, the gap between the rich and the poor is increasing. What are the causes of this problem, and what measures could be taken to reduce it?",
    minWords: 250,
    timeLimitMin: 40,
  },
  "task1-line": {
    kind: "ielts_task1",
    title: "IELTS Task 1 – Line Chart",
    prompt:
      "The graph below shows the percentage of households in the UK owning various consumer goods from 1970 to 2010. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    minWords: 150,
    timeLimitMin: 20,
    chartData: {
      type: "line",
      title: "Consumer goods ownership in the UK (1970–2010)",
      series: [
        { name: "Washing machine", data: [66, 74, 82, 88, 93] },
        { name: "Dishwasher", data: [3, 12, 28, 45, 62] },
        { name: "Computer", data: [0, 5, 18, 45, 78] },
      ],
      xAxis: [1970, 1980, 1990, 2000, 2010],
      yAxis: "% of households",
    },
  },
  "task1-bar": {
    kind: "ielts_task1",
    title: "IELTS Task 1 – Bar Chart",
    prompt:
      "The bar chart below shows the average number of hours per week spent on leisure activities in four countries. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    minWords: 150,
    timeLimitMin: 20,
    chartData: {
      type: "bar",
      title: "Weekly leisure hours by country",
      categories: ["Watching TV", "Socializing", "Reading", "Sport"],
      series: [
        { name: "USA", data: [22, 14, 8, 10] },
        { name: "UK", data: [19, 16, 11, 9] },
        { name: "Japan", data: [14, 10, 15, 7] },
        { name: "Vietnam", data: [16, 18, 6, 8] },
      ],
    },
  },
  "toeic-email": {
    kind: "toeic_email",
    title: "TOEIC Writing – Business Email",
    prompt:
      "You are a project manager. Write a professional email to your team members informing them about a change in the project deadline. The deadline has been moved from Friday to the following Monday. Include the reason (client requested additional time for review) and any action required from the team.",
    minWords: 100,
    timeLimitMin: 10,
  },
};

export default function WritingTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const config = TASK_CONFIGS[id] ?? TASK_CONFIGS["task2-opinion"];

  const [content, setContent] = useState("");
  const [timeLeft, setTimeLeft] = useState(config.timeLimitMin * 60);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const meetsMin = wordCount >= config.minWords;

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setTimeLeft((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [started]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/write/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: config.kind,
          prompt: config.prompt,
          content,
          chartData: config.chartData,
        }),
      });
      const feedback = await res.json();
      // Store feedback in sessionStorage for result page
      sessionStorage.setItem(`writing-result-${id}`, JSON.stringify({ feedback, content, config }));
      router.push(`/write/result/${id}`);
    } catch {
      alert("Lỗi chấm bài, thử lại.");
      setSubmitting(false);
    }
  }

  return (
    <div className="writing-task">
      <div className="task-header">
        <button onClick={() => router.push("/write")} className="back-btn">← Write</button>
        <h1>{config.title}</h1>
        {started && (
          <div className={`timer ${timeLeft < 300 ? "urgent" : ""}`}>
            ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="prompt-box">
        <p className="prompt-label">Task</p>
        <p className="prompt-text">{config.prompt}</p>
        {config.chartData && (
          <div className="chart-placeholder">
            📊 [Biểu đồ: {String(config.chartData?.title ?? "")}]
            <br />
            <small>Dữ liệu được cung cấp trong prompt để AI chấm chính xác.</small>
          </div>
        )}
        <p className="task-meta">Tối thiểu {config.minWords} từ · {config.timeLimitMin} phút</p>
      </div>

      {!started ? (
        <button onClick={() => setStarted(true)} className="start-btn">
          ▶ Bắt đầu viết (timer sẽ chạy)
        </button>
      ) : (
        <>
          <div className="editor-area">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Bắt đầu viết bài của bạn ở đây…"
              rows={16}
              autoFocus
            />
            <div className="word-count-row">
              <span className={`word-count ${meetsMin ? "ok" : "low"}`}>
                {wordCount} / {config.minWords} từ
              </span>
              <button
                onClick={handleSubmit}
                disabled={!meetsMin || submitting}
                className="submit-btn"
              >
                {submitting ? "⏳ Đang chấm…" : "📤 Nộp bài"}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .writing-task { max-width: 800px; margin: 0 auto; padding: 1.5rem; }
        .task-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: #6c757d; white-space: nowrap; }
        h1 { flex: 1; font-size: 1.1rem; font-weight: 700; margin: 0; }
        .timer { font-variant-numeric: tabular-nums; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 20px; background: #f8f9fa; border: 1.5px solid #dee2e6; font-size: 0.9rem; white-space: nowrap; }
        .timer.urgent { color: #dc3545; border-color: #dc3545; background: #fff5f5; }
        .prompt-box { background: #f8f9fa; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem; border-left: 3px solid #0d6efd; }
        .prompt-label { font-size: 0.75rem; text-transform: uppercase; color: #6c757d; margin: 0 0 0.5rem; }
        .prompt-text { font-size: 0.9rem; line-height: 1.6; margin: 0 0 0.5rem; }
        .chart-placeholder { font-size: 0.85rem; background: #e9ecef; padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; color: #495057; }
        .task-meta { font-size: 0.8rem; color: #6c757d; margin: 0; }
        .start-btn { display: block; width: 100%; padding: 1rem; background: #0d6efd; color: white; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; }
        .start-btn:hover { background: #0b5ed7; }
        .editor-area { display: flex; flex-direction: column; gap: 0.75rem; }
        textarea { width: 100%; padding: 0.875rem; border: 1.5px solid #dee2e6; border-radius: 10px; font-size: 0.9rem; line-height: 1.6; resize: vertical; box-sizing: border-box; font-family: inherit; }
        textarea:focus { border-color: #0d6efd; outline: none; }
        .word-count-row { display: flex; align-items: center; justify-content: space-between; }
        .word-count { font-size: 0.875rem; font-weight: 600; }
        .word-count.ok { color: #198754; }
        .word-count.low { color: #dc3545; }
        .submit-btn { padding: 0.6rem 1.5rem; background: #198754; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
        .submit-btn:disabled { background: #adb5bd; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
