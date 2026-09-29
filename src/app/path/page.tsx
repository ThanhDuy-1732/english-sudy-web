"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { getCachedMastery } from "@/lib/mastery";
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
  const mastery = getCachedMastery();
  const topMistakes = getTopCategories(undefined, 3);

  const items: PathItem[] = [];
  let rank = 1;

  // Weakest skills from mastery
  const sorted = [...mastery].sort((a, b) => a.overallMastery - b.overallMastery);
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
      title: `Giải quyết lỗi: ${top.category}`,
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
  const lastSpeaking = typeof window !== "undefined" ? localStorage.getItem("lastSpeakingAt") : null;
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
    <main className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-xl font-bold">Lộ trình học</h1>
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600">Chỉnh mục tiêu →</Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Mục tiêu: {GOAL_LABELS[profile.goal]} · {profile.dailyStudyMinutes} phút/ngày
      </p>

      {items.length === 0 && (
        <p className="text-gray-400 text-center py-12">Học thêm một ít để nhận gợi ý cá nhân hóa.</p>
      )}

      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.rank}>
            <Link href={item.href}
              className="flex items-start gap-3 p-4 border rounded-xl hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors">
              <span className="text-2xl font-bold text-gray-200 dark:text-gray-700 w-8 shrink-0 text-center leading-none pt-1">
                {item.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                {item.mastery !== undefined && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                      <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${item.mastery}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{item.mastery}%</span>
                  </div>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600 self-center">→</span>
            </Link>
          </li>
        ))}
      </ol>

      {items.length > 0 && (
        <p className="text-xs text-center text-gray-400 mt-6">Lộ trình cập nhật dựa trên tiến độ học của bạn.</p>
      )}
    </main>
  );
}
