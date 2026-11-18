"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { WeeklyBand } from "@/lib/stats-skills";

const COLORS = {
  speaking: "#e0533f",
  writing: "#8a6fd1",
  listening: "#2e9e5b",
  reading: "#2f8fb5",
} as const;

export default function BandTimelineChart({ data }: { data: WeeklyBand[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted py-4 text-center">Chưa có dữ liệu band.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
        <Legend />
        {(["speaking", "writing", "listening", "reading"] as const).map((k) => (
          <Line
            key={k} type="monotone" dataKey={k} stroke={COLORS[k]}
            dot={false} strokeWidth={2} connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
