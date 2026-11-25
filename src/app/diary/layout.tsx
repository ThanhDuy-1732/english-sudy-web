import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nhật ký" };

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
