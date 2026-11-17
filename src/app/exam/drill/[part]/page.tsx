"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ExamRunner from "@/components/exam/ExamRunner";
import { getExamSettings, getExamBank, bankKey } from "@/lib/exam/exam-storage";
import { getTagAccuracies } from "@/lib/exam/exam-tags";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import type { ExamPart, ExamAttempt, ExamKind } from "@/lib/exam/types";

const PART_LABELS: Record<string, string> = {
  RC5: "TOEIC Part 5 – Incomplete Sentences",
  RC6: "TOEIC Part 6 – Text Completion",
  RC7: "TOEIC Part 7 – Reading Comprehension",
  LC2: "TOEIC Part 2 – Question-Response",
  LC3: "TOEIC Part 3 – Conversations",
  LC4: "TOEIC Part 4 – Short Talks",
  READ_P1: "IELTS Reading – Passage 1",
  READ_P2: "IELTS Reading – Passage 2",
  READ_P3: "IELTS Reading – Passage 3",
  LISTEN_S1: "IELTS Listening – Section 1",
  LISTEN_S2: "IELTS Listening – Section 2",
  LISTEN_S3: "IELTS Listening – Section 3",
  LISTEN_S4: "IELTS Listening – Section 4",
};

const PART_KIND: Record<string, ExamKind> = {
  RC5: "TOEIC", RC6: "TOEIC", RC7: "TOEIC", LC2: "TOEIC", LC3: "TOEIC", LC4: "TOEIC",
  READ_P1: "IELTS", READ_P2: "IELTS", READ_P3: "IELTS",
  LISTEN_S1: "IELTS", LISTEN_S2: "IELTS", LISTEN_S3: "IELTS", LISTEN_S4: "IELTS",
};

export default function DrillPage() {
  const { part } = useParams<{ part: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = getExamSettings();
  const [done, setDone] = useState(false);
  // The runner depends on localStorage (settings, question bank); mount it client-side only to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [sessionTags, setSessionTags] = useState<string[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = startSession("exam", { part });
    return () => {
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [part]);

  const kind: ExamKind = PART_KIND[part] ?? settings.primaryExam;
  const grammarSlug = searchParams.get("grammarSlug");
  const topic = searchParams.get("topic") ?? undefined;
  const effectiveBankKey = grammarSlug
    ? `${kind}:${part}:${settings.level}:grammar=${grammarSlug}`
    : bankKey(kind, part as ExamPart, settings.level);
  const cachedItems = getExamBank()[effectiveBankKey] ?? [];

  if (done && attempt) {
    const tagStats = sessionTags.length > 0
      ? getTagAccuracies()
          .filter((t) => sessionTags.includes(t.tag))
          .sort((a, b) => a.accuracy - b.accuracy)
      : [];

    return (
      <div className="done-container">
        <h1>Đã xong bài luyện</h1>
        <p>
          {attempt.answers.filter((a) => a.correct).length} / {attempt.answers.length} câu đúng
        </p>
        {attempt.score?.toeic && (
          <p>TOEIC ước lượng: {attempt.score.toeic.total} điểm</p>
        )}
        {attempt.score?.ielts && (
          <p>
            IELTS:{" "}
            {attempt.score.ielts.reading
              ? `Reading ${attempt.score.ielts.reading}`
              : `Listening ${attempt.score.ielts.listening}`}
          </p>
        )}
        {tagStats.length > 0 && (
          <div className="tag-stats">
            <p className="tag-stats-title">Phân tích theo chủ đề</p>
            {tagStats.map((t) => (
              <div key={t.tag} className="tag-row">
                <span className="tag-name">{t.tag}</span>
                <div className="tag-bar-bg">
                  <div
                    className="tag-bar-fill"
                    style={{
                      width: `${t.accuracy}%`,
                      background: t.accuracy < 60 ? "rgb(var(--margin))" : t.accuracy < 80 ? "rgb(var(--warn))" : "rgb(var(--ok))",
                    }}
                  />
                </div>
                <span className="tag-pct">{t.accuracy}%</span>
              </div>
            ))}
          </div>
        )}
        <div className="done-actions">
          <button onClick={() => router.push(`/exam/drill/${part}`)}>
            Luyện thêm
          </button>
          <button onClick={() => router.push("/exam")}>
            Về trang Exam
          </button>
          <button onClick={() => router.push("/exam/mistakes")}>
            Xem sổ lỗi
          </button>
        </div>
        <style jsx>{`
          .done-container { max-width: 480px; margin: 3rem auto; text-align: center; padding: 2rem; }
          h1 { color: rgb(var(--ink)); letter-spacing: -0.015em; font-weight: 600; font-size: 1.625rem; margin-bottom: 1rem; }
          .tag-stats { text-align: left; margin: 1.5rem 0; padding: 1rem; border: 1px solid rgb(var(--rule)); border-radius: 8px; }
          .tag-stats-title { font-size: 0.75rem; font-weight: 600; color: rgb(var(--muted)); margin-bottom: 0.75rem; }
          .tag-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
          .tag-name { font-size: 0.8rem; min-width: 120px; flex-shrink: 0; }
          .tag-bar-bg { flex: 1; height: 6px; background: rgb(var(--rule)); border-radius: 3px; overflow: hidden; }
          .tag-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
          .tag-pct { font-size: 0.75rem; color: rgb(var(--muted)); min-width: 32px; text-align: right; }
          .done-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem; }
          .done-actions button { color: rgb(var(--ink)); padding: 0.75rem 1.5rem; border-radius: 8px; border: 1.5px solid rgb(var(--rule)); background: rgb(var(--card)); cursor: pointer; font-size: 0.95rem; }
          .done-actions button:first-child { background: rgb(var(--primary)); color: white; border-color: rgb(var(--primary)); }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div className="drill-header">
        <button onClick={() => router.push("/exam")} className="back-btn">
          ← Luyện thi
        </button>
        <h1>{PART_LABELS[part] ?? part}</h1>
      </div>
      {mounted && <ExamRunner
        kind={kind}
        parts={[part as ExamPart]}
        mode="drill"
        level={settings.level}
        topic={topic}
        preloadedItems={cachedItems.length > 0 ? [cachedItems[Math.floor(Math.random() * cachedItems.length)]] : undefined}
        onComplete={(a, tags) => {
          setAttempt(a);
          setSessionTags(tags ?? []);
          setDone(true);
          if (sessionIdRef.current) {
            finishSession(sessionIdRef.current, {
              totalItems: a.answers.length,
              correctItems: a.answers.filter((answer) => answer.correct).length,
            });
            sessionIdRef.current = null;
          }
        }}
      />}
      <style jsx>{`
        .drill-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid rgb(var(--rule)); }
        .back-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; color: rgb(var(--muted)); }
        h1 { color: rgb(var(--ink)); letter-spacing: -0.015em; font-size: 1.625rem; font-weight: 600; margin: 0; }
      `}</style>
    </div>
  );
}
