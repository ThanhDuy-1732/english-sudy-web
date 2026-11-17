"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyWordCount } from "@/lib/stats";

export default function WordsPerDayChart({ data }: { data: DailyWordCount[] }) {
  const displayData = data.map((day) => ({ ...day, label: day.date.slice(5) }));
  return <section aria-labelledby="words-per-day-title">
    <h2 id="words-per-day-title" className="mb-3 text-base font-semibold text-ink">Từ học mỗi ngày <span className="font-normal text-gray-500">(30 ngày gần nhất)</span></h2>
    <div className="h-[220px] w-full" role="img" aria-label="Biểu đồ số từ học theo ngày">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={displayData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid stroke="#d4ddee" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [value, "Từ"]} labelFormatter={(label) => `Ngày ${label}`} />
          <Bar dataKey="count" fill="#4a6fe3" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>;
}
