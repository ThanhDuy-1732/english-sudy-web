import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "English Study",
  description: "Website tự học tiếng Anh cá nhân",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <nav className="border-b bg-white px-4 py-3 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center gap-6">
            <span className="font-bold text-blue-600">English Study</span>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              Học từ mới
            </Link>
            <Link href="/history" className="text-sm text-gray-600 hover:text-gray-900">
              Lịch sử
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
