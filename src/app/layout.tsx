import type { Metadata, Viewport } from "next";
import { Caladea, Inter } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { ProviderContextProvider } from "@/contexts/ProviderContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const caladea = Caladea({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "English Study",
  description: "Website tự học tiếng Anh cá nhân",
  applicationName: "English Study",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "English Study",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2c1f4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${inter.variable} ${caladea.variable} grid min-h-screen min-h-svh grid-rows-[auto_1fr_auto] bg-[#2c1f4a] font-sans text-white`}
      >
        <ProviderContextProvider>
        <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#2c1f4a]/90 px-2 py-2 backdrop-blur sm:px-4 sm:py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:justify-between sm:gap-6">
            <a
              href="/"
              className="inline-flex min-h-11 w-full items-center whitespace-nowrap px-1 font-display text-xl font-bold text-[#d9ecff] sm:w-auto sm:shrink-0 sm:text-2xl"
            >
              English Study
            </a>
            <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:shrink-0 sm:gap-3">
              <a
                href="/"
                className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#d9ecff] transition-colors hover:text-white"
              >
                Học từ mới
              </a>
              <a
                href="/review"
                className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
              >
                Ôn tập
              </a>
              <a
                href="/history"
                className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white"
              >
                Lịch sử
              </a>
              <a href="/import" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
                Import từ
              </a>
              <a href="/stats" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-[#b0b0d1] transition-colors hover:text-white">
                Thống kê
              </a>
            </div>
          </div>
        </nav>
        {children}
        <footer className="border-t border-white/10 bg-[#2c1f4a] px-4 py-8 text-[#b0b0d1]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-2xl font-bold text-[#d9ecff]">English Study</p>
            <p className="text-sm">Practice smarter vocabulary, one card at a time.</p>
          </div>
        </footer>
        <ServiceWorkerRegistration />
        </ProviderContextProvider>
      </body>
    </html>
  );
}
