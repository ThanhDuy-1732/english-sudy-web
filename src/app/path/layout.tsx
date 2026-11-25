import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lộ trình" };

export default function PathLayout({ children }: { children: React.ReactNode }) {
  return children;
}
