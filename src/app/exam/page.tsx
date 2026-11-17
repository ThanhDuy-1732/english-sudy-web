"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, getExamSettings, saveExamSettings, getAttempts } from "@/lib/exam/exam-storage";
import { getUnresolvedExamMistakes } from "@/lib/mistakes";
import { runMistakeMigration } from "@/lib/mistake-migration";
import type { ExamAttempt, ExamKind, ExamSettings } from "@/lib/exam/types";
import LinkList from "@/components/LinkList";
import Segmented from "@/components/Segmented";

// Grouped by skill: the section title is real structure (TOEIC scores Listening and Reading separately).
const PARTS: Record<ExamKind, { skill: string; items: { part: string; name: string; desc: string }[] }[]> = {
  TOEIC: [
    { skill: "Nghe", items: [
      { part: "LC2", name: "Part 2, Question–Response", desc: "Nghe câu hỏi, chọn câu đáp phù hợp" },
      { part: "LC3", name: "Part 3, Conversations", desc: "Hội thoại ngắn giữa 2–3 người" },
      { part: "LC4", name: "Part 4, Short Talks", desc: "Thông báo, bài nói của một người" },
    ] },
    { skill: "Đọc", items: [
      { part: "RC5", name: "Part 5, Incomplete Sentences", desc: "Điền từ vào câu: ngữ pháp và từ vựng" },
      { part: "RC6", name: "Part 6, Text Completion", desc: "Điền từ, điền câu vào đoạn văn" },
      { part: "RC7", name: "Part 7, Reading Comprehension", desc: "Đọc email, quảng cáo, bài báo rồi trả lời" },
    ] },
  ],
  IELTS: [
    { skill: "Nghe", items: [
      { part: "LISTEN_S1", name: "Listening, Section 1", desc: "Hội thoại đời thường, điền thông tin vào form" },
      { part: "LISTEN_S2", name: "Listening, Section 2", desc: "Một người nói về chủ đề đời sống, trắc nghiệm và điền ghi chú" },
      { part: "LISTEN_S3", name: "Listening, Section 3", desc: "Sinh viên và giảng viên thảo luận, trắc nghiệm" },
      { part: "LISTEN_S4", name: "Listening, Section 4", desc: "Bài giảng học thuật, điền ghi chú" },
    ] },
    { skill: "Đọc", items: [
      { part: "READ_P1", name: "Reading, Passage 1", desc: "Bài đọc dễ nhất: True/False/Not Given và điền câu" },
      { part: "READ_P2", name: "Reading, Passage 2", desc: "Chọn tiêu đề cho từng đoạn và trắc nghiệm" },
      { part: "READ_P3", name: "Reading, Passage 3", desc: "Bài đọc học thuật khó nhất, nhiều dạng câu hỏi" },
    ] },
  ],
};

const TARGET: Record<ExamKind, string[]> = {
  TOEIC: ["400", "500", "650", "780", "900+"],
  IELTS: ["4.5", "5.0", "6.0", "7.0", "8.0"],
};

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

  const kind = settings.primaryExam;
  const score = lastAttempt?.score;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Luyện thi</h1>
      <p className="page-lead">Luyện từng part hoặc làm một bài thi thử rút gọn. Câu sai được ghi vào sổ lỗi để ôn lại.</p>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Kỳ thi" value={kind} onChange={updateKind}
          options={[{ value: "TOEIC", label: "TOEIC" }, { value: "IELTS", label: "IELTS" }]} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Trình độ</span>
          <Segmented label="Trình độ" value={settings.level} onChange={updateLevel}
            options={[1, 2, 3, 4, 5].map((level) => ({ value: level as 1 | 2 | 3 | 4 | 5, label: String(level) }))} />
          <span className="text-sm text-muted">khoảng <span className="font-semibold tabular-nums text-ink">{TARGET[kind][settings.level - 1]}</span> điểm</span>
        </div>
      </div>

      {score && (
        <p className="mt-6 rounded-xl border border-rule bg-card px-4 py-3 text-sm text-muted">
          Lần làm gần nhất:{" "}
          {score.toeic && <strong className="font-semibold text-ink">TOEIC {score.toeic.total} điểm</strong>}
          {score.ielts && <strong className="font-semibold text-ink">IELTS Reading {score.ielts.reading ?? "–"}, Listening {score.ielts.listening ?? "–"}</strong>}
          {", "}<span className="tabular-nums">{score.raw.correct}/{score.raw.total}</span> câu đúng
        </p>
      )}

      <section aria-labelledby="mock-title" className="mt-8 flex flex-col gap-4 rounded-xl border border-rule bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="mock-title" className="text-base font-semibold text-ink">Thi thử rút gọn</h2>
          <p className="mt-0.5 text-sm text-muted">Các part đã học gộp trong một bài, có đồng hồ đếm ngược và điểm ước lượng.</p>
        </div>
        <Link href="/exam/mock" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white transition-colors hover:bg-primary-strong">
          Làm bài thi thử
        </Link>
      </section>

      <div className="mt-8">
        {PARTS[kind].map((group) => (
          <LinkList key={group.skill} title={group.skill}
            items={group.items.map((item) => ({ href: `/exam/drill/${item.part}`, title: <span className="font-en">{item.name}</span>, meta: item.desc }))} />
        ))}
        <LinkList title="Ôn lại" items={[{
          href: "/exam/mistakes",
          title: "Sổ lỗi luyện thi",
          meta: "Câu đã làm sai, kèm giải thích",
          aside: unresolvedCount > 0 ? <span className="rounded-full bg-margin/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">{unresolvedCount} chưa xong</span> : undefined,
        }]} />
      </div>
    </main>
  );
}
