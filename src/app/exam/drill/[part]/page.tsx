"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import ExamRunner from "@/components/exam/ExamRunner";
import { getExamSettings, getItemsFromBank } from "@/lib/exam/exam-storage";
import type { ExamPart, ExamAttempt, ExamKind } from "@/lib/exam/types";

const PART_LABELS: Record<string, string> = {
  RC5: "TOEIC Part 5 – Incomplete Sentences",
  RC6: "TOEIC Part 6 – Text Completion",
  RC7: "TOEIC Part 7 – Reading Comprehension",
  LC2: "TOEIC Part 2 – Question-Response",
  LC3: "TOEIC Part 3 – Conversations",
  LC4: "TOEIC Part 4 – Short Talks",
  READ_P3: "IELTS Reading – Academic",
  LISTEN_S1: "IELTS Listening – Section 1",
};

const PART_KIND: Record<string, ExamKind> = {
  RC5: "TOEIC", RC6: "TOEIC", RC7: "TOEIC", LC2: "TOEIC", LC3: "TOEIC", LC4: "TOEIC",
  READ_P3: "IELTS", LISTEN_S1: "IELTS",
};

export default function DrillPage({ params }: { params: Promise<{ part: string }> }) {
  const { part } = use(params);
  const router = useRouter();
  const settings = getExamSettings();
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);

  const kind: ExamKind = PART_KIND[part] ?? settings.primaryExam;
  const cachedItems = getItemsFromBank(kind, part as ExamPart, settings.level);

  if (done && attempt) {
    return (
      <div className="done-container">
        <h1>✅ Drill hoàn thành</h1>
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
          h1 { font-size: 1.5rem; margin-bottom: 1rem; }
          .done-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem; }
          .done-actions button { padding: 0.75rem 1.5rem; border-radius: 8px; border: 1.5px solid #dee2e6; background: white; cursor: pointer; font-size: 0.95rem; }
          .done-actions button:first-child { background: #0d6efd; color: white; border-color: #0d6efd; }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div className="drill-header">
        <button onClick={() => router.push("/exam")} className="back-btn">
          ← Exam
        </button>
        <h1>{PART_LABELS[part] ?? part}</h1>
      </div>
      <ExamRunner
        kind={kind}
        parts={[part as ExamPart]}
        mode="drill"
        level={settings.level}
        preloadedItems={cachedItems.length > 0 ? [cachedItems[Math.floor(Math.random() * cachedItems.length)]] : undefined}
        onComplete={(a) => {
          setAttempt(a);
          setDone(true);
        }}
      />
      <style jsx>{`
        .drill-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid #dee2e6; }
        .back-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; color: #6c757d; }
        h1 { font-size: 1.1rem; font-weight: 600; margin: 0; }
      `}</style>
    </div>
  );
}
