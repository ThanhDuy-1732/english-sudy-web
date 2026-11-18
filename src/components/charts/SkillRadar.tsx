"use client";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { SkillRadarPoint } from "@/lib/stats-skills";

export default function SkillRadar({ data }: { data: SkillRadarPoint[] }) {
  const hasData = data.some((d) => d.value !== null);
  if (!hasData) {
    return <p className="text-sm text-muted py-4 text-center">Chưa có đủ dữ liệu 4 kỹ năng.</p>;
  }
  const chartData = data.map((d) => ({ label: d.label, value: d.value ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar name="Skill" dataKey="value" stroke="#2e9e5b" fill="#2e9e5b" fillOpacity={0.3} />
        <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(0)}%` : v)} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
