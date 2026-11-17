"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Segmented from "@/components/Segmented";
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Sổ lỗi</h1>
        <Link href="/today" className="text-sm font-medium text-primary hover:underline">
          ← Hôm nay
        </Link>
      </div>

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
        <p className="text-gray-500 text-center py-12">Không có lỗi nào.</p>
      )}

      <ul className="space-y-3">
        {filtered.map((m) => (
          <li key={m.id} className="border rounded-lg p-4 border-rule">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-blue-500">
                {SKILL_LABELS[m.skill]} · {m.category}
              </span>
              <span className="text-xs text-gray-400">{m.occurrenceCount}×</span>
            </div>
            <div className="text-sm mb-1">
              <span className="line-through text-red-500">{m.userAnswer}</span>
              {" → "}
              <span className="font-medium text-green-600">{m.correctAnswer}</span>
            </div>
            <p className="text-xs text-gray-500">{m.explanation}</p>
            <MistakeWords mistake={m} />
            {m.status !== "resolved" && (
              <button
                onClick={() => handleResolve(m.id)}
                className="mt-3 rounded bg-ok-soft px-2 py-1 text-xs text-ink hover:bg-ok/20"
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
