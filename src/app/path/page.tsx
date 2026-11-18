"use client";
import { questionTypeLabel } from "@/lib/exam/labels";
import { useState, useEffect } from "react";
import { readString } from "@/lib/safe-json";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { recomputeMastery } from "@/lib/mastery-all";
import { getTopCategories } from "@/lib/mistakes";

interface PathItem {
  rank: number;
  title: string;
  reason: string;
  href: string;
  mastery?: number;
}

function buildPath(): PathItem[] {
  const profile = getProfile();
  const mastery = recomputeMastery();
  const topMistakes = getTopCategories(undefined, 3);

  const items: PathItem[] = [];
  let rank = 1;

  // Weakest skills from mastery; a skill at 80% or more is not suggested as needing work.
  const sorted = mastery.filter((s) => s.overallMastery < 80).sort((a, b) => a.overallMastery - b.overallMastery);
  for (const skill of sorted.slice(0, 2)) {
    items.push({
      rank: rank++,
      title: `Luyện ${skill.skill === "grammar" ? "Ngữ pháp" : skill.skill === "vocabulary" ? "Từ vựng" : skill.skill === "reading" ? "Đọc" : skill.skill === "listening" ? "Nghe" : skill.skill === "speaking" ? "Nói" : "Viết"}`,
      reason: `Mastery ${skill.overallMastery}% — cần cải thiện`,
      href: skill.skill === "grammar" ? "/grammar/quiz"
        : skill.skill === "vocabulary" ? "/vocab/quiz"
        : skill.skill === "reading" ? "/exam/drill/RC5"
        : skill.skill === "listening" ? "/exam/drill/LC3"
        : skill.skill === "speaking" ? "/speak"
        : "/write",
      mastery: skill.overallMastery,
    });
  }

  // Top mistake category
  if (topMistakes.length > 0) {
    const top = topMistakes[0];
    items.push({
      rank: rank++,
      title: `Giải quyết lỗi: ${questionTypeLabel(top.category)}`,
      reason: `Lặp lại ${top.count} lần`,
      href: "/mistakes",
    });
  }

  // Goal-specific focus
  if (profile.goal === "toeic" || profile.goal === "ielts") {
    items.push({
      rank: rank++,
      title: profile.goal === "toeic" ? "Luyện TOEIC RC5" : "Luyện IELTS Reading",
      reason: `Mục tiêu: ${profile.goal.toUpperCase()}`,
      href: profile.goal === "toeic" ? "/exam/drill/RC5" : "/exam/drill/READ_P3",
    });
  }

  // Speaking if goal is communication or hasn't practiced recently
  const lastSpeaking = readString("lastSpeakingAt");
  const daysSince = lastSpeaking
    ? (Date.now() - new Date(lastSpeaking).getTime()) / 86400000 : 999;
  if (profile.goal === "communication" || daysSince > 3) {
    items.push({
      rank: rank++,
      title: "Luyện Speaking",
      reason: daysSince < 999 ? `${Math.round(daysSince)} ngày chưa luyện nói` : "Chưa luyện nói",
      href: "/speak",
    });
  }

  return items.slice(0, 6);
}

const GOAL_LABELS: Record<string, string> = {
  communication: "Giao tiếp", toeic: "TOEIC", ielts: "IELTS",
  vocabulary: "Từ vựng", mixed: "Tổng hợp",
};

export default function LearningPathPage() {
  const [items, setItems] = useState<PathItem[]>([]);
  const [profile] = useState(() =>
    typeof window !== "undefined" ? getProfile() : { goal: "mixed" as const, dailyStudyMinutes: 30 }
  );

  useEffect(() => { setItems(buildPath()); }, []);

  return (
    <main className="page">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Lộ trình học</h1>
        <Link href="/settings" className="btn btn-secondary">Chỉnh mục tiêu</Link>
      </div>
      <p className="page-lead mb-6">
        Mục tiêu: {GOAL_LABELS[profile.goal]}, {profile.dailyStudyMinutes} phút mỗi ngày. Đi lần lượt từ bước 1, việc cần nhất ở trước.
      </p>

      {items.length === 0 && (
        <p className="py-12 text-center text-muted">Học thêm một ít để nhận gợi ý cá nhân hóa.</p>
      )}

      {/* Stepping stones on a garden path: the dashed line joins the steps in priority order. */}
      <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.4rem] before:top-6 before:border-l-[3px] before:border-dashed before:border-soil/40">
        {items.map((item) => (
          <li key={item.rank} className="relative">
            <Link href={item.href} className="group flex items-center gap-4 rounded-3xl py-1 pr-2">
              <span className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-[46%_54%_50%_50%/55%_48%_52%_45%] bg-soil font-display text-lg font-bold text-white shadow-[0_3px_0_rgb(0_0_0/0.15)]">
                {item.rank}
              </span>
              <div className="panel min-w-0 flex-1 p-4 transition-colors group-hover:border-primary">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted">{item.reason}</p>
                {item.mastery !== undefined && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary-soft">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${item.mastery}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted">{item.mastery}%</span>
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>

      {items.length > 0 && (
        <p className="mt-6 text-center text-sm text-muted">Lộ trình cập nhật dựa trên tiến độ học của bạn.</p>
      )}
    </main>
  );
}
