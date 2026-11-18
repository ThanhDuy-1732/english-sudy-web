"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/date";
import type { LearnedWord } from "@/lib/storage";

interface DayDrawerProps {
  date: string | null;
  words: LearnedWord[];
  studyMinutes: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (date: string) => void;
}

function offsetDate(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateKey(d);
}

function formatDateVi(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function MasteryStars({ mastery = 0 }: { mastery?: number }) {
  return (
    <span className="text-xs text-warn" aria-label={`Mastery: ${mastery}/5`}>
      {"★".repeat(mastery)}{"☆".repeat(5 - mastery)}
    </span>
  );
}

export default function DayDrawer({ date, words, studyMinutes, isOpen, onClose, onNavigate }: DayDrawerProps) {
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());

  useEffect(() => { setExpandedWords(new Set()); }, [date]);

  function toggleWord(word: string) {
    setExpandedWords((prev) => {
      const next = new Set(prev);
      next.has(word) ? next.delete(word) : next.add(word);
      return next;
    });
  }

  const noData = words.length === 0 && studyMinutes === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết ngày học"
        // Closed: off screen, and out of the tab order and the accessibility tree.
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={[
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-card shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <p className="font-semibold text-ink capitalize">
            {date ? formatDateVi(date) : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {noData ? (
            <p className="py-12 text-center text-sm text-muted">Không có dữ liệu cho ngày này.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-5 flex gap-4">
                <div className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3">
                  
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-ink">{words.length}</p>
                    <p className="text-xs text-muted">từ</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3">
                  <span className="text-lg">⏱</span>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-ink">{studyMinutes}</p>
                    <p className="text-xs text-muted">phút</p>
                  </div>
                </div>
              </div>

              {/* Word list */}
              {words.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  Không có từ nào được học hôm này.
                </p>
              ) : (
                <ul className="space-y-2">
                  {words.map((w) => (
                    <li key={w.word} className="rounded-xl border border-rule overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleWord(w.word)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-primary-soft/50"
                      >
                        <div>
                          <span className="font-medium text-ink">{w.word}</span>
                          <span className="mx-2 text-muted">—</span>
                          <span className="text-sm text-muted">{w.meaning}</span>
                        </div>
                        <span className="ml-2 text-muted text-xs">{expandedWords.has(w.word) ? "▲" : "▼"}</span>
                      </button>
                      {expandedWords.has(w.word) && (
                        <div className="border-t border-rule bg-ink/5 px-4 py-3 space-y-1">
                          {w.example && (
                            <p className="text-sm text-muted italic">&quot;{w.example}&quot;</p>
                          )}
                          <MasteryStars mastery={w.mastery} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        {date && (
          <div className="flex items-center justify-between border-t border-rule px-5 py-3">
            <button
              type="button"
              onClick={() => onNavigate(offsetDate(date, -1))}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-primary hover:bg-paper"
            >
              ← Ngày trước
            </button>
            <button
              type="button"
              onClick={() => onNavigate(offsetDate(date, 1))}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-primary hover:bg-paper"
            >
              Ngày sau →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
