"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ExamAttempt } from "@/lib/exam/types";

export default function WeaknessRadar({ attempts }: { attempts: ExamAttempt[] }) {
  const byType: Record<string, { correct: number; total: number }> = {};
  for (const attempt of attempts) {
    for (const ans of attempt.answers) {
      if (!byType[ans.type]) byType[ans.type] = { correct: 0, total: 0 };
      byType[ans.type].total++;
      if (ans.correct) byType[ans.type].correct++;
    }
  }

  const data = Object.entries(byType).map(([type, v]) => ({
    type: type.replace(/_/g, " "),
    accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
  }));

  if (data.length === 0) {
    return (
      <section>
        <h2 className="mb-3 font-semibold text-gray-700">Điểm yếu theo kỹ năng</h2>
        <p className="py-8 text-center text-sm text-gray-400">Chưa có dữ liệu luyện thi</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="weakness-radar-title">
      <h2 id="weakness-radar-title" className="mb-3 font-semibold text-gray-700">
        Điểm yếu theo kỹ năng
      </h2>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="type" tick={{ fontSize: 10 }} />
            <Radar dataKey="accuracy" stroke="#fd7e14" fill="#fd7e14" fillOpacity={0.4} />
            <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
