"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#7f56d9", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

export default function TopicDistributionChart({ data }: { data: { topic: string; count: number }[] }) {
  return <section aria-labelledby="topic-distribution-title">
    <h2 id="topic-distribution-title" className="mb-3 font-semibold text-gray-700 dark:text-gray-300">Phân bổ theo chủ đề</h2>
    {data.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Chưa có dữ liệu</p> : <div className="h-[220px] w-full" role="img" aria-label="Biểu đồ phân bổ từ theo chủ đề">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="topic" cx="50%" cy="45%" innerRadius={48} outerRadius={78} paddingAngle={2}>
            {data.map((item, index) => <Cell key={item.topic} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => [value, "Từ"]} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>}
  </section>;
}
