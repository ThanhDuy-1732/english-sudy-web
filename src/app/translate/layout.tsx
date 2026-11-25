import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dịch" };

export default function TranslateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
