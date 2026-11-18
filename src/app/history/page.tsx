"use client";

import Link from "next/link";
import RetentionNotice from "@/components/RetentionNotice";
import { useEffect, useState } from "react";
import Segmented from "@/components/Segmented";
import Plant, { STAGE_NAMES, growthStage } from "@/components/Plant";
import StageCensus from "@/components/StageCensus";
import {
  deleteLearnedWord,
  getLearnedWords,
  type LearnedWord,
} from "@/lib/storage";

export default function HistoryPage() {
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [filter, setFilter] = useState("Tất cả");
  const [masteryFilter, setMasteryFilter] = useState<"all" | "weak">("all");
  const [now, setNow] = useState(0);

  useEffect(() => {
    setWords(getLearnedWords());
    setNow(Date.now());
  }, []);

  function handleDelete(word: string) {
    deleteLearnedWord(word);
    const nextWords = words.filter((w) => w.word !== word);
    setWords(nextWords);

    if (filter !== "Tất cả" && !nextWords.some((entry) => entry.topic === filter)) {
      setFilter("Tất cả");
    }
  }

  const topics = ["Tất cả", ...Array.from(new Set(words.map((word) => word.topic)))];
  const filtered = words
    .filter((word) => filter === "Tất cả" || word.topic === filter)
    .filter((word) => masteryFilter === "all" || (word.mastery ?? 0) < 3);
  const isDue = (word: LearnedWord) => now > 0 && new Date(word.nextReviewAt ?? 0).getTime() <= now;
  const dueCount = words.filter(isDue).length;

  return (
    <main className="page-wide">
      <div className="mb-6">
        <h1 className="page-title">Vườn từ</h1>
        <p className="page-lead">Mọi từ bạn đã gieo. Ôn đúng hạn để cây lớn từ hạt đến hoa.</p>
        <RetentionNotice className="mt-4 max-w-2xl" />
      </div>

      <section aria-label="Tổng quan vườn" className="mb-6 rounded-3xl bg-gradient-to-b from-primary-soft/40 to-primary-soft px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-ink"><span className="font-display text-2xl font-extrabold tabular-nums">{words.length}</span> từ đã lưu</p>
          {dueCount > 0 ? (
            <Link href="/review" className="btn bg-marker font-semibold text-deep hover:brightness-95">Tưới {dueCount} cây</Link>
          ) : (
            <p className="text-sm text-muted">Không có cây nào cần tưới</p>
          )}
        </div>
        <div className="mt-3"><StageCensus masteries={words.map((w) => w.mastery)} /></div>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented label="Chủ đề" value={filter} onChange={setFilter} options={topics.map((topic) => ({ value: topic, label: topic }))} />
        <button
          type="button"
          onClick={() => setMasteryFilter((current) => (current === "all" ? "weak" : "all"))}
          aria-pressed={masteryFilter === "weak"}
          className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
            masteryFilter === "weak" ? "border-primary bg-primary-soft text-primary-text" : "border-rule bg-card text-muted hover:border-primary hover:text-ink"
          }`}
        >
          Chỉ từ chưa thuộc
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">Chưa có từ nào được lưu.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((entry) => {
            const stage = growthStage(entry.mastery);
            const due = isDue(entry);
            return (
              <li key={entry.word} className="panel flex items-start gap-3 p-4">
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <Plant stage={stage} size={52} label={`Giai đoạn ${STAGE_NAMES[stage]} (${stage}/5)`} />
                  <span className="text-xs text-muted">{STAGE_NAMES[stage]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words [overflow-wrap:anywhere]">
                    <span className="font-en text-lg font-semibold text-ink">{entry.word}</span>{" "}
                    <span className="text-muted">- {entry.meaning}</span>
                  </p>
                  <p className="mt-1 break-words font-en text-sm italic text-ink/80 [overflow-wrap:anywhere]">{entry.example}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 break-words text-xs text-muted [overflow-wrap:anywhere]">
                    {due && <span className="rounded-full bg-marker px-2 py-0.5 font-semibold text-deep">Cần tưới</span>}
                    {entry.topic} · {new Date(entry.learnedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.word)}
                  aria-label={`Xóa ${entry.word}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-margin transition-colors hover:bg-margin-soft"
                >
                  Xóa
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
