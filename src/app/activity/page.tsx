"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessions, type LearningActivityType, type LearningSession } from "@/lib/sessions";

const labels: Record<LearningActivityType, string> = {
  vocabulary: "Từ vựng",
  review: "Ôn tập",
  grammar: "Ngữ pháp",
  exam: "Luyện thi",
  speaking: "Luyện nói",
  writing: "Luyện viết",
};

const badgeColors: Record<LearningActivityType, string> = {
  vocabulary: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  grammar: "bg-green-100 text-green-700",
  exam: "bg-orange-100 text-orange-700",
  speaking: "bg-pink-100 text-pink-700",
  writing: "bg-yellow-100 text-yellow-700",
};

function localDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export default function ActivityPage() {
  const [groups, setGroups] = useState<[string, LearningSession[]][]>([]);

  useEffect(() => {
    const byDate = new Map<string, LearningSession[]>();
    for (const session of getSessions().filter((entry) => entry.finishedAt)) {
      const date = localDate(session.startedAt);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(session);
    }
    setGroups(Array.from(byDate.entries()).sort(([a], [b]) => b.localeCompare(a)));
  }, []);

  if (groups.length === 0) {
    return (
      <main className="min-h-full bg-[#f7f4ff] px-4 py-16 text-[#2c1f4a] sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-6 text-5xl" aria-hidden="true">📖</p>
          <h1 className="mb-3 font-display text-3xl font-bold">Chưa có hoạt động</h1>
          <p className="mb-8 text-[#6b6384]">Bắt đầu học để xem lịch sử tại đây.</p>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-[#7f56d9] px-6 font-semibold text-white hover:bg-[#6941c6]">
            Bắt đầu học
          </Link>
        </div>
      </main>
    );
  }

  const today = localDate(new Date().toISOString());

  return (
    <main className="min-h-full bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 font-display text-4xl font-bold">Hoạt động</h1>
        <div className="space-y-6">
          {groups.map(([date, sessions]) => (
            <section key={date} className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-[#6b6384]">
                {date === today ? "Hôm nay" : new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", {
                  weekday: "long", day: "numeric", month: "long",
                })}
                <span className="ml-2 font-normal">({sessions.length} phiên)</span>
              </h2>
              <ul>
                {sessions.map((session) => {
                  const accuracy = session.totalItems && session.correctItems !== undefined
                    ? Math.round(session.correctItems / session.totalItems * 100)
                    : null;
                  return (
                    <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8e0f7] py-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeColors[session.type]}`}>
                          {labels[session.type]}
                        </span>
                        <span className="text-sm text-[#6b6384]">
                          {new Date(session.startedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {accuracy !== null && <span className="text-[#6b6384]">{accuracy}%</span>}
                        {session.totalItems !== undefined && <span className="text-[#6b6384]">{session.totalItems} mục</span>}
                        <span className="font-medium">{duration(session.durationSeconds)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
