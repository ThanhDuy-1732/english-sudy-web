import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hôm nay" };

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
