"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLearnedWords, type LearnedWord } from "@/lib/storage";
import Plant, { STAGE_NAMES, growthStage } from "./Plant";

const BED_SIZE = 12;

/** The 12 most recently saved words as plants; the ones due for review are thirsty (sun drop, yellow rim). */
export default function GardenBed() {
  const [state, setState] = useState<{ words: LearnedWord[]; total: number; due: number; now: number } | null>(null);

  useEffect(() => {
    const all = getLearnedWords();
    const now = Date.now();
    const words = [...all].sort((a, b) => b.learnedAt.localeCompare(a.learnedAt)).slice(0, BED_SIZE);
    const due = all.filter((w) => !w.nextReviewAt || Date.parse(w.nextReviewAt) <= now).length;
    setState({ words, total: all.length, due, now });
  }, []);

  if (!state) return <section aria-label="Luống vườn" className="h-72 animate-pulse rounded-3xl bg-primary-soft/60" />;

  const thirsty = (w: LearnedWord) => !w.nextReviewAt || Date.parse(w.nextReviewAt) <= state.now;

  return (
    <section aria-labelledby="garden-title" className="rounded-3xl bg-gradient-to-b from-primary-soft/40 to-primary-soft px-5 pb-5 pt-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="garden-title" className="section-title">Luống từ của bạn</h2>
          <p className="text-sm text-muted">Cây càng lớn, bạn nhớ càng lâu. Viền vàng là cây cần tưới.</p>
        </div>
        <p className="text-sm tabular-nums text-muted">{state.total} từ trong vườn</p>
      </div>

      {state.words.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
          <Plant stage={0} size={64} />
          <p className="max-w-sm text-muted">Vườn còn trống. Gieo vài từ đầu tiên, rồi mỗi ngày quay lại tưới để chúng lớn lên.</p>
          <Link href="/" className="btn btn-primary">Gieo 5 từ mới</Link>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6">
          {state.words.map((w) => {
            const stage = growthStage(w.mastery);
            const dry = thirsty(w);
            return (
              <li key={w.word} className="relative flex flex-col items-center" title={`${w.word}: ${STAGE_NAMES[stage].toLowerCase()}${dry ? ", cần tưới" : ""}`}>
                {dry && <span aria-hidden="true" className="absolute right-[18%] top-1 z-10 h-[15px] w-3 rotate-180 rounded-[50%_50%_50%_50%/62%_62%_38%_38%] bg-marker ring-2 ring-white" />}
                <Plant stage={stage} size={68} className="relative z-[1] h-auto w-full max-w-[68px]" />
                <span className={`relative z-[1] -mt-1.5 w-full truncate rounded-[999px_999px_12px_12px] bg-soil px-1 pb-0.5 pt-1 text-center text-[11.5px] font-medium tracking-tight text-white ${dry ? "ring-[2.5px] ring-marker" : ""}`}>
                  {w.word}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {state.due > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/review" className="btn bg-marker font-semibold text-deep hover:brightness-95">Tưới {state.due} cây</Link>
          <span className="text-sm text-muted">Ôn đúng hạn để cây không héo.</span>
        </div>
      )}
    </section>
  );
}
