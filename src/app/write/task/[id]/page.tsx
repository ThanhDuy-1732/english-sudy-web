"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import { saveWriting } from "@/lib/write/writing-storage";
import type { WritingKind } from "@/lib/write/writing-storage";
import { useCountdown } from "@/lib/useCountdown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export default function WritingTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const config = TASK_CONFIGS[id] ?? TASK_CONFIGS["task2-opinion"];

  const [content, setContent] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftKey = `writingTaskDraft:${id}`;
  const timeLeft = useCountdown(config.timeLimitMin * 60, started, undefined, deadline);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (draft && typeof draft.content === "string" && typeof draft.deadline === "number" && Number.isFinite(draft.deadline)) {
        setContent(draft.content);
        setDeadline(draft.deadline);
        setStarted(true);
      }
    } catch {
      setError("Không thể khôi phục bản nháp trên thiết bị này.");
    }
    setDraftReady(true);
  }, [draftKey]);

  function saveDraft(nextContent: string, nextDeadline: number) {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ content: nextContent, deadline: nextDeadline }));
    } catch {
      setError("Không thể lưu bản nháp. Hãy sao chép bài viết trước khi rời trang.");
    }
  }

  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = startSession("writing", { taskId: id });
    return () => {
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [id]);

  function restart() {
    try { localStorage.removeItem(draftKey); } catch { /* storage unavailable */ }
    setContent("");
    setDeadline(null);
    setStarted(false);
    setError(null);
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const meetsMin = wordCount >= config.minWords;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
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
      if (!res.ok) throw new Error("grading failed");
      const feedback = await res.json();
      if (!feedback.bands || !Array.isArray(feedback.annotations) || typeof feedback.overall !== "number") {
        throw new Error("invalid feedback");
      }
      const recordId = crypto.randomUUID();
      saveWriting({
        id: recordId,
        taskId: id,
        kind: config.kind as WritingKind,
        prompt: config.prompt,
        chartData: config.chartData,
        content,
        wordCount: feedback.wordCount ?? content.trim().split(/\s+/).length,
        feedback,
        createdAt: new Date().toISOString(),
      });
      localStorage.removeItem(draftKey);
      if (sessionIdRef.current) {
        finishSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
      router.push(`/write/result/${recordId}`);
    } catch {
      setError("Không thể chấm bài. Bản nháp vẫn được giữ để bạn thử lại khi có mạng.");
      setSubmitting(false);
    }
  }

  return (
    <div className="writing-task">
      {error && <p role="alert" className="mb-4 rounded-lg bg-margin-soft p-3 text-margin">{error}</p>}
      <div className="task-header">
        <button onClick={() => router.push("/write")} className="back-btn">← Luyện viết</button>
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
        {config.chartData && <TaskChart data={config.chartData} />}
        <p className="task-meta">Tối thiểu {config.minWords} từ · {config.timeLimitMin} phút</p>
      </div>

      {!started ? (
        <button disabled={!draftReady} onClick={() => {
          const end = Date.now() + config.timeLimitMin * 60_000;
          setDeadline(end);
          saveDraft(content, end);
          setStarted(true);
        }} className="start-btn">
          Bắt đầu viết, đồng hồ bắt đầu chạy
        </button>
      ) : (
        <>
          <div className="editor-area">
            {timeLeft === 0 && (
              <p role="status" className="time-up">
                ⏰ Đã hết giờ. Bạn vẫn có thể nộp bài này, hoặc{" "}
                <button type="button" onClick={restart} className="restart-btn">Làm lại từ đầu</button>
              </p>
            )}
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (deadline !== null) saveDraft(e.target.value, deadline);
              }}
              aria-label="Bài viết"
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
                {submitting ? "Đang chấm…" : "Nộp bài"}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .writing-task { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
        .task-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: rgb(var(--muted)); white-space: nowrap; }
        h1 { color: rgb(var(--ink)); letter-spacing: -0.015em; flex: 1; font-size: 1.625rem; font-weight: 600; margin: 0; }
        .timer { color: rgb(var(--ink)); font-variant-numeric: tabular-nums; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 20px; background: rgb(var(--paper)); border: 1.5px solid rgb(var(--rule)); font-size: 0.9rem; white-space: nowrap; }
        .timer.urgent { color: rgb(var(--margin)); border-color: rgb(var(--margin)); background: rgb(var(--margin-soft)); }
        .prompt-box { color: rgb(var(--ink)); background: rgb(var(--paper)); border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem; border-left: 3px solid rgb(var(--primary)); }
        .prompt-label { font-size: 0.75rem; color: rgb(var(--muted)); margin: 0 0 0.5rem; }
        .prompt-text { font-size: 0.9rem; line-height: 1.6; margin: 0 0 0.5rem; }
        .chart-placeholder { font-size: 0.85rem; background: rgb(var(--rule)); padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; color: rgb(var(--muted)); border-radius: 8px; }
        .task-meta { font-size: 0.8rem; color: rgb(var(--muted)); margin: 0; }
        .start-btn { display: block; width: 100%; padding: 1rem; background: rgb(var(--primary)); color: white; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; }
        .start-btn:hover { background: rgb(var(--primary-strong)); }
        .time-up { margin: 0; padding: 0.6rem 0.75rem; border-radius: 8px; background: rgb(var(--margin-soft)); color: rgb(var(--margin)); font-size: 0.875rem; }
        .restart-btn { background: none; border: none; padding: 0; color: rgb(var(--primary-text)); text-decoration: underline; cursor: pointer; font-size: inherit; }
        .editor-area { display: flex; flex-direction: column; gap: 0.75rem; }
        textarea { width: 100%; padding: 0.875rem; border: 1.5px solid rgb(var(--rule)); border-radius: 10px; font-size: 1rem; line-height: 1.6; resize: vertical; box-sizing: border-box; font-family: inherit; color: rgb(var(--ink)); background: rgb(var(--card)); }
        textarea:focus { border-color: rgb(var(--primary)); outline: none; }
        .word-count-row { display: flex; align-items: center; justify-content: space-between; }
        .word-count { font-size: 0.875rem; font-weight: 600; }
        .word-count.ok { color: rgb(var(--ok)); }
        .word-count.low { color: rgb(var(--margin)); }
        .submit-btn { padding: 0.6rem 1.5rem; background: rgb(var(--ok)); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
        .submit-btn:disabled { background: rgb(var(--muted)); cursor: not-allowed; }
      `}</style>
    </div>
  );
}

const COLORS = ["#2e9e5b", "#2f8fb5", "#d99a00", "#e0533f"];

function TaskChart({ data }: { data: Record<string, unknown> }) {
  const type = data.type as string;
  const title = data.title as string | undefined;

  if (type === "bar") {
    const cats = data.categories as string[];
    const series = data.series as { name: string; data: number[] }[];
    const chartData = cats.map((cat, i) => {
      const row: Record<string, string | number> = { cat };
      series.forEach((s) => { row[s.name] = s.data[i] ?? 0; });
      return row;
    });
    return (
      <div className="chart-placeholder">
        {title && <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>{title}</p>}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6e6dc" />
            <XAxis dataKey="cat" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // default: line chart
  const xAxis = data.xAxis as (string | number)[];
  const series = data.series as { name: string; data: number[] }[];
  const chartData = xAxis.map((x, i) => {
    const row: Record<string, string | number> = { x };
    series.forEach((s) => { row[s.name] = s.data[i] ?? 0; });
    return row;
  });
  return (
    <div className="chart-placeholder">
      {title && <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>{title}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6e6dc" />
          <XAxis dataKey="x" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} unit="%" />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
