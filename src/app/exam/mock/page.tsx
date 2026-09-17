"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExamRunner from "@/components/exam/ExamRunner";
import ExamTimer from "@/components/exam/ExamTimer";
import { getExamSettings } from "@/lib/exam/exam-storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import type { ExamAttempt, ExamPart, ExamKind } from "@/lib/exam/types";

const TOEIC_MOCK_PARTS: ExamPart[] = ["LC2", "LC3", "LC4", "RC5", "RC6", "RC7"];
const IELTS_MOCK_PARTS: ExamPart[] = ["LISTEN_S1", "READ_P3"];

// Abbreviated mock: ~45 min for TOEIC, ~40 min for IELTS
const MOCK_TIME: Record<ExamKind, number> = {
  TOEIC: 45 * 60,
  IELTS: 40 * 60,
};

export default function MockPage() {
  const router = useRouter();
  const settings = getExamSettings();
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timedOutRef = useRef(false);

  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        // If time ran out but user navigated away before onComplete fired, finish the session
        if (timedOutRef.current) {
          finishSession(sessionIdRef.current);
        } else {
          cancelSession(sessionIdRef.current);
        }
        sessionIdRef.current = null;
      }
    };
  }, []);

  const kind = settings.primaryExam;
  const parts = kind === "TOEIC" ? TOEIC_MOCK_PARTS : IELTS_MOCK_PARTS;
  const timeLimit = MOCK_TIME[kind];

  if (!started) {
    return (
      <div className="mock-start">
        <h1>Mock Test — {kind}</h1>
        <p>
          Bài thi rút gọn: {parts.length} parts · {Math.round(timeLimit / 60)} phút
        </p>
        <p className="level-note">Trình độ: {settings.level} ({kind === "TOEIC"
          ? ["400", "500", "650", "780", "900+"][settings.level - 1]
          : ["4.5", "5.0", "6.0", "7.0", "8.0"][settings.level - 1]})</p>
        <p className="warning">
          ⚠️ Sau khi bắt đầu, timer không thể tạm dừng.
        </p>
        <button onClick={() => {
          sessionIdRef.current = startSession("exam", { mode: "mock" });
          setStarted(true);
        }} className="start-btn">
          Bắt đầu thi
        </button>
        <button onClick={() => router.push("/exam")} className="cancel-btn">
          Hủy
        </button>
        <style jsx>{`
          .mock-start { max-width: 480px; margin: 4rem auto; text-align: center; padding: 2rem; }
          h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
          p { color: #6c757d; margin-bottom: 0.5rem; }
          .level-note { font-size: 0.9rem; }
          .warning { color: #856404; background: #fff3cd; border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.875rem; }
          .start-btn, .cancel-btn { display: block; width: 100%; padding: 0.875rem; border-radius: 8px; font-size: 1rem; cursor: pointer; border: none; margin-top: 0.75rem; }
          .start-btn { background: #0d6efd; color: white; }
          .start-btn:hover { background: #0b5ed7; }
          .cancel-btn { background: white; border: 1.5px solid #dee2e6 !important; color: #495057; }
        `}</style>
      </div>
    );
  }

  if (done && attempt) {
    const correct = attempt.answers.filter((a) => a.correct).length;
    const total = attempt.answers.length;
    return (
      <div className="mock-result">
        <h1>Kết quả Mock Test</h1>
        <p className="raw-score">
          {correct} / {total} câu đúng ({Math.round((correct / total) * 100)}%)
        </p>
        {attempt.score?.toeic && (
          <div className="score-box">
            <p>Listening (ước lượng): {attempt.score.toeic.listening}</p>
            <p>Reading (ước lượng): {attempt.score.toeic.reading}</p>
            <p className="total">Tổng: {attempt.score.toeic.total} / 990</p>
            <p className="disclaimer">* Điểm ước lượng, không phải điểm ETS chính thức.</p>
          </div>
        )}
        {attempt.score?.ielts && (
          <div className="score-box">
            {attempt.score.ielts.listening !== undefined && (
              <p>Listening band: {attempt.score.ielts.listening}</p>
            )}
            {attempt.score.ielts.reading !== undefined && (
              <p>Reading band: {attempt.score.ielts.reading}</p>
            )}
            <p className="disclaimer">* Điểm ước lượng, không phải điểm chính thức.</p>
          </div>
        )}
        <div className="result-actions">
          <button onClick={() => router.push("/exam/mistakes")}>
            Xem sổ lỗi
          </button>
          <button onClick={() => router.push("/exam")}>
            Về trang Exam
          </button>
        </div>
        <style jsx>{`
          .mock-result { max-width: 480px; margin: 3rem auto; text-align: center; padding: 2rem; }
          h1 { font-size: 1.5rem; margin-bottom: 1rem; }
          .raw-score { font-size: 1.1rem; margin-bottom: 1rem; }
          .score-box { background: #f8f9fa; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; }
          .score-box p { margin: 0.35rem 0; }
          .total { font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem !important; }
          .disclaimer { font-size: 0.75rem; color: #6c757d; }
          .result-actions { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }
          .result-actions button { padding: 0.6rem 1.25rem; border-radius: 8px; border: 1.5px solid #dee2e6; background: white; cursor: pointer; }
          .result-actions button:first-child { background: #0d6efd; color: white; border-color: #0d6efd; }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div className="mock-header">
        <span className="mock-label">Mock {kind}</span>
        <ExamTimer
          totalSeconds={timeLimit}
          onTimeUp={() => {
            timedOutRef.current = true;
            setDone(true); // triggers forceComplete on ExamRunner → onComplete fires
          }}
        />
      </div>
      <ExamRunner
        kind={kind}
        parts={parts}
        mode="mock"
        level={settings.level}
        forceComplete={done}
        onComplete={(a) => {
          setAttempt(a);
          setDone(true);
          if (sessionIdRef.current) {
            finishSession(sessionIdRef.current, {
              totalItems: a.answers.length,
              correctItems: a.answers.filter((answer) => answer.correct).length,
            });
            sessionIdRef.current = null;
          }
        }}
      />
      <style jsx>{`
        .mock-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.5rem; border-bottom: 1px solid #dee2e6; position: sticky; top: 0; background: white; z-index: 10; }
        .mock-label { font-weight: 700; font-size: 0.95rem; }
      `}</style>
    </div>
  );
}
