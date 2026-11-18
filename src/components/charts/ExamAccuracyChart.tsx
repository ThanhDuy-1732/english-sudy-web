"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExamAttempt } from "@/lib/exam/types";

export default function ExamAccuracyChart({ attempts }: { attempts: ExamAttempt[] }) {
  const now = Date.now();
  const data = [3, 2, 1, 0].map((w) => {
    const start = now - (w + 1) * 7 * 86_400_000;
    const end = now - w * 7 * 86_400_000;
    const slice = attempts.filter((a) => {
      const t = new Date(a.startedAt).getTime();
      return t >= start && t < end;
    });
    const total = slice.reduce((s, a) => s + a.answers.length, 0);
    const correct = slice.reduce((s, a) => s + a.answers.filter((x) => x.correct).length, 0);
    return {
      label: w === 0 ? "Tuần này" : `${w}T trước`,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });

  return (
    <section aria-labelledby="exam-accuracy-title">
      <h2 id="exam-accuracy-title" className="mb-3 text-base font-semibold text-ink">
        Độ chính xác luyện thi{" "}
        <span className="font-normal text-muted">(4 tuần)</span>
      </h2>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid stroke="#d6e6dc" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
            <Bar dataKey="accuracy" fill="#2e9e5b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
