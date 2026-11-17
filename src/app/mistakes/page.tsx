"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
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
        <Link href="/today" className="text-sm text-blue-500">
          ← Hôm nay
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {(
          [
            "all",
            "vocabulary",
            "grammar",
            "reading",
            "listening",
            "speaking",
            "writing",
          ] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilterSkill(s)}
            className={`px-3 py-1 rounded text-sm ${
              filterSkill === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800"
            }`}
          >
            {s === "all" ? "Tất cả" : SKILL_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        {(["all", "new", "reviewing", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded text-sm ${
              filterStatus === s
                ? "bg-purple-600 text-white"
                : "bg-gray-100 dark:bg-gray-800"
            }`}
          >
            {s === "all"
              ? "Tất cả"
              : s === "new"
              ? "Mới"
              : s === "reviewing"
              ? "Đang học"
              : "Đã giải quyết"}
          </button>
        ))}
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
            <p className="text-xs text-gray-500 mb-3">{m.explanation}</p>
            {m.status !== "resolved" && (
              <button
                onClick={() => handleResolve(m.id)}
                className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
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
