import type { Metadata } from "next";

export const metadata: Metadata = { title: "Luyện nói" };

export default function SpeakLayout({ children }: { children: React.ReactNode }) {
  return children;
}
