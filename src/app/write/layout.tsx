import type { Metadata } from "next";

export const metadata: Metadata = { title: "Luyện viết" };

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
