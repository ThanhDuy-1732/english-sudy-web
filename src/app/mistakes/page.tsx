"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Segmented from "@/components/Segmented";
import { questionTypeLabel } from "@/lib/exam/labels";
import MistakeWords from "@/components/MistakeWords";
import {
  getMistakes,
  resolveMistake,
  type UnifiedMistake,
  type MistakeSkill,
  type MistakeStatus,
} from "@/lib/mistakes";

const SKILL_LABELS: Record<MistakeSkill, string> = {
  vocabulary: "Từ vựng",
  grammar: "Ngữ pháp",
  reading: "Đọc",
  listening: "Nghe",
  speaking: "Nói",
  writing: "Viết",
};

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<UnifiedMistake[]>([]);
  const [filterSkill, setFilterSkill] = useState<MistakeSkill | "all">("all");
  const [filterStatus, setFilterStatus] = useState<MistakeStatus | "all">("new");

  useEffect(() => {
    setMistakes(getMistakes());
  }, []);

  const filtered = mistakes
    .filter((m) => filterSkill === "all" || m.skill === filterSkill)
    .filter((m) => filterStatus === "all" || m.status === filterStatus);

  function handleResolve(id: string) {
    resolveMistake(id);
    setMistakes(getMistakes());
  }

  return (
    <main className="page">
      <Link href="/today" className="back-link">← Hôm nay</Link>
      <h1 className="page-title mb-4">Sổ lỗi</h1>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 text-sm text-muted">Kỹ năng</span>
          <Segmented label="Kỹ năng" value={filterSkill} onChange={setFilterSkill}
            options={(["all", "vocabulary", "grammar", "reading", "listening", "speaking", "writing"] as const).map((s) => ({ value: s, label: s === "all" ? "Tất cả" : SKILL_LABELS[s] }))} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 text-sm text-muted">Trạng thái</span>
          <Segmented label="Trạng thái" value={filterStatus} onChange={setFilterStatus}
            options={[{ value: "all", label: "Tất cả" }, { value: "new", label: "Mới" }, { value: "reviewing", label: "Đang học" }, { value: "resolved", label: "Đã giải quyết" }] as const} />
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted text-center py-12">Không có lỗi nào.</p>
      )}

      <ul className="space-y-3">
        {filtered.map((m) => (
          <li key={m.id} className="border rounded-2xl p-4 border-rule">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-primary-text">
                {SKILL_LABELS[m.skill]} · {questionTypeLabel(m.category)}
              </span>
              <span className="text-xs text-muted">{m.occurrenceCount}×</span>
            </div>
            <div className="text-sm mb-1">
              <span className="line-through text-margin">{m.userAnswer}</span>
              {" → "}
              <span className="font-medium text-ok">{m.correctAnswer}</span>
            </div>
            <p className="text-xs text-muted">{m.explanation}</p>
            <MistakeWords mistake={m} />
            {m.status !== "resolved" && (
              <button
                onClick={() => handleResolve(m.id)}
                className="mt-3 rounded-full bg-ok-soft px-2 py-1 text-xs text-ink hover:bg-ok/20"
              >
                Đánh dấu đã hiểu
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
