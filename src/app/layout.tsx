import type { Metadata, Viewport } from "next";
import { Caladea, Inter } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { SyncInitializer } from "@/components/SyncInitializer";
import { ProviderContextProvider } from "@/contexts/ProviderContext";
import { TimerContextProvider } from "@/contexts/TimerContext";
import { FirebaseInitializer } from "@/components/FirebaseInitializer";
import { SyncInit } from "@/components/SyncInit";
import AppNavigation from "@/components/AppNavigation";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ff" },
    { media: "(prefers-color-scheme: dark)", color: "#2c1f4a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${caladea.variable} grid min-h-screen min-h-svh min-w-0 grid-rows-[auto_1fr_auto] bg-[#2c1f4a] font-sans text-white`}
      >
        <ProviderContextProvider>
          <TimerContextProvider>
            <AppNavigation />
            <div className="app-content min-w-0">{children}</div>
            <footer className="app-footer min-w-0 border-t border-white/10 bg-[#2c1f4a] canvas-surface px-4 py-8 text-[#b0b0d1]">
              <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-display text-2xl font-bold text-[#d9ecff]">English Study</p>
                <p className="text-sm">Practice smarter vocabulary, one card at a time.</p>
              </div>
            </footer>
            <FirebaseInitializer />
            <ServiceWorkerRegistration />
            <SyncInitializer />
            <SyncInit />
          </TimerContextProvider>
        </ProviderContextProvider>
      </body>
    </html>
  );
}
