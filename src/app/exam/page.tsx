"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, getExamSettings, saveExamSettings, getAttempts } from "@/lib/exam/exam-storage";
import { getUnresolvedExamMistakes } from "@/lib/mistakes";
import { runMistakeMigration } from "@/lib/mistake-migration";
import type { ExamAttempt, ExamKind, ExamSettings } from "@/lib/exam/types";

const TOEIC_PARTS = [
  { part: "RC5", label: "Part 5 – Incomplete Sentences", emoji: "📝" },
  { part: "RC6", label: "Part 6 – Text Completion", emoji: "📄" },
  { part: "RC7", label: "Part 7 – Reading Comprehension", emoji: "📖" },
  { part: "LC2", label: "Part 2 – Question-Response", emoji: "🎧" },
  { part: "LC3", label: "Part 3 – Conversations", emoji: "💬" },
  { part: "LC4", label: "Part 4 – Short Talks", emoji: "🗣️" },
];

const IELTS_PARTS = [
  { part: "READ_P3", label: "Reading – Academic", emoji: "📚" },
  { part: "LISTEN_S1", label: "Listening – Section 1", emoji: "🎙️" },
];

export default function ExamPage() {
  // Storage is read after mount so the first client render matches the server HTML.
  const [settings, setSettings] = useState<ExamSettings>(DEFAULT_SETTINGS);
  const [lastAttempt, setLastAttempt] = useState<ExamAttempt | undefined>();
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  useEffect(() => {
    setSettings(getExamSettings());
    setLastAttempt(getAttempts()[0]);
    runMistakeMigration();
    setUnresolvedCount(getUnresolvedExamMistakes().length);
  }, []);

  function updateKind(kind: ExamKind) {
    const updated = { ...settings, primaryExam: kind };
    setSettings(updated);
    saveExamSettings(updated);
  }

  function updateLevel(level: number) {
    const updated = { ...settings, level: level as 1 | 2 | 3 | 4 | 5 };
    setSettings(updated);
    saveExamSettings(updated);
  }

  const parts = settings.primaryExam === "TOEIC" ? TOEIC_PARTS : IELTS_PARTS;

  return (
    <div className="exam-dashboard">
      <h1>Luyện thi</h1>

      {/* Exam selector */}
      <div className="exam-toggle">
        {(["TOEIC", "IELTS"] as ExamKind[]).map((k) => (
          <button
            key={k}
            onClick={() => updateKind(k)}
            className={settings.primaryExam === k ? "active" : ""}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Level selector */}
      <div className="level-row">
        <span>Trình độ:</span>
        {[1, 2, 3, 4, 5].map((l) => (
          <button
            key={l}
            onClick={() => updateLevel(l)}
            className={`level-btn ${settings.level === l ? "active" : ""}`}
          >
            {l}
          </button>
        ))}
        <span className="level-hint">
          {settings.primaryExam === "TOEIC"
            ? ["400", "500", "650", "780", "900+"][settings.level - 1]
            : ["4.5", "5.0", "6.0", "7.0", "8.0"][settings.level - 1]}
        </span>
      </div>

      {/* Last score */}
      {lastAttempt?.score && (
        <div className="last-score">
          <p>Lần làm gần nhất:</p>
          {lastAttempt.score.toeic && (
            <strong>TOEIC {lastAttempt.score.toeic.total} điểm</strong>
          )}
          {lastAttempt.score.ielts && (
            <strong>
              IELTS R:{lastAttempt.score.ielts.reading ?? "-"} L:{lastAttempt.score.ielts.listening ?? "-"}
            </strong>
          )}
          <span>
            ({lastAttempt.score.raw.correct}/{lastAttempt.score.raw.total} câu đúng)
          </span>
        </div>
      )}

      {/* Drill parts */}
      <section>
        <h2>Luyện theo Part</h2>
        <div className="parts-grid">
          {parts.map(({ part, label, emoji }) => (
            <Link key={part} href={`/exam/drill/${part}`} className="part-card">
              <span className="part-emoji">{emoji}</span>
              <span className="part-label">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Mock test */}
      <section className="mock-section">
        <h2>Mock Test</h2>
        <Link href="/exam/mock" className="mock-btn">
          🏆 Thi thử rút gọn
        </Link>
      </section>

      {/* Mistakes */}
      <section className="mistakes-section">
        <Link href="/exam/mistakes" className="mistakes-link">
          📋 Sổ lỗi
          {unresolvedCount > 0 && (
            <span className="badge">{unresolvedCount}</span>
          )}
        </Link>
      </section>

      <style jsx>{`
        .exam-dashboard { max-width: 640px; margin: 0 auto; padding: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
        h2 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: #b0b0d1; text-transform: uppercase; letter-spacing: 0.05em; }
        .exam-toggle { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .exam-toggle button { color: #212529; padding: 0.5rem 1.5rem; border: 1.5px solid #dee2e6; border-radius: 20px; background: white; cursor: pointer; font-weight: 500; }
        .exam-toggle button.active { background: #0d6efd; color: white; border-color: #0d6efd; }
        .level-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; font-size: 0.9rem; }
        .level-btn { color: #212529; width: 32px; height: 32px; border: 1.5px solid #dee2e6; border-radius: 50%; background: white; cursor: pointer; font-size: 0.85rem; }
        .level-btn.active { background: #0d6efd; color: white; border-color: #0d6efd; font-weight: 700; }
        .level-hint { color: #6c757d; font-size: 0.8rem; }
        .last-score { color: #212529; display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f8f9fa; border-radius: 8px; margin-bottom: 0.5rem; font-size: 0.9rem; flex-wrap: wrap; }
        .parts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        :global(.part-card) { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s, background 0.15s; }
        :global(.part-card):hover { border-color: #0d6efd; background: rgba(13, 110, 253, 0.18); }
        .part-emoji { font-size: 1.25rem; }
        .part-label { font-size: 0.875rem; line-height: 1.3; }
        .mock-section, .mistakes-section { margin-top: 1rem; }
        :global(.mock-btn) { display: block; padding: 1rem; background: #0d6efd; color: white; border-radius: 10px; text-decoration: none; text-align: center; font-weight: 600; }
        :global(.mock-btn):hover { background: #0b5ed7; }
        :global(.mistakes-link) { display: flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; text-decoration: none; color: inherit; font-weight: 500; }
        :global(.mistakes-link):hover { border-color: #dc3545; background: rgba(220, 53, 69, 0.18); }
        .badge { background: #dc3545; color: white; border-radius: 10px; padding: 0.1rem 0.5rem; font-size: 0.75rem; font-weight: 700; }
        @media (max-width: 480px) { .parts-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
