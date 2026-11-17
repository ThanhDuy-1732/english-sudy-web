import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Literata } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { ProviderContextProvider } from "@/contexts/ProviderContext";
import { TimerContextProvider } from "@/contexts/TimerContext";
import { FirebaseInitializer } from "@/components/FirebaseInitializer";
import AppNavigation from "@/components/AppNavigation";
import BackupReminder from "@/components/BackupReminder";
import StudyReminder from "@/components/StudyReminder";
import DataRetention from "@/components/DataRetention";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Vietnamese interface text: Be Vietnam Pro (drawn for Vietnamese diacritics).
const ui = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-ui" });
// English being studied (words, example sentences, passages): Literata, a reading serif.
const en = Literata({ subsets: ["latin", "vietnamese"], variable: "--font-en" });

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
    { media: "(prefers-color-scheme: light)", color: "#f4f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0e182b" },
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
      <body className={`${ui.variable} ${en.variable} min-h-svh min-w-0 bg-paper font-sans text-ink`}>
        <ProviderContextProvider>
          <TimerContextProvider>
            <div className="flex min-h-svh min-w-0 flex-col lg:flex-row">
              <AppNavigation />
              <div className="app-content min-w-0 flex-1"><StudyReminder /><BackupReminder />{children}</div>
            </div>
            <FirebaseInitializer />
            <DataRetention />
            <ServiceWorkerRegistration />
          </TimerContextProvider>
        </ProviderContextProvider>
      </body>
    </html>
  );
}
