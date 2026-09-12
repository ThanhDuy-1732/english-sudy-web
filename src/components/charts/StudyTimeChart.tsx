"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyStudyTime } from "@/lib/stats";

export default function StudyTimeChart({ data }: { data: DailyStudyTime[] }) {
  const displayData = data.map((day) => ({ ...day, label: day.date.slice(5) }));

  return (
    <section aria-labelledby="study-time-title">
      <h2 id="study-time-title" className="mb-3 font-semibold text-gray-700">
        Thời gian học mỗi ngày <span className="font-normal text-gray-400">(30 ngày gần nhất)</span>
      </h2>
      <div className="h-[220px] w-full" role="img" aria-label="Biểu đồ thời gian học theo ngày">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [value, "Phút"]} labelFormatter={(label) => `Ngày ${label}`} />
            <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
