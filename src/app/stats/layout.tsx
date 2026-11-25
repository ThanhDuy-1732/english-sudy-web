import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thống kê" };

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
