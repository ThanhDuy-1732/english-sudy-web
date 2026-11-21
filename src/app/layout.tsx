import type { Metadata, Viewport } from "next";
import { Baloo_2, Fraunces, Lexend } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { ProviderContextProvider } from "@/contexts/ProviderContext";
import { WordJobProvider } from "@/contexts/WordJobContext";
import { TimerContextProvider } from "@/contexts/TimerContext";
import { FirebaseInitializer } from "@/components/FirebaseInitializer";
import AppNavigation from "@/components/AppNavigation";
import BackupReminder from "@/components/BackupReminder";
import StudyReminder from "@/components/StudyReminder";
import DataRetention from "@/components/DataRetention";
import UsageTracker from "@/components/UsageTracker";
import { WordJobStripConnected } from "@/components/WordJobStrip";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Interface text: Lexend, drawn for reading ease; all three fonts cover Vietnamese.
const ui = Lexend({ subsets: ["latin", "vietnamese"], weight: ["300", "400", "500", "600"], variable: "--font-ui" });
// Headings: Baloo 2, rounded and friendly.
const display = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["600", "700", "800"], variable: "--font-display" });
// English being studied (words on postcards, example sentences): Fraunces.
const en = Fraunces({ subsets: ["latin", "vietnamese"], variable: "--font-en" });

export const metadata: Metadata = {
  title: "ThankZ English",
  description: "Website tự học tiếng Anh cá nhân",
  applicationName: "ThankZ English",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ThankZ English",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
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
    { media: "(prefers-color-scheme: light)", color: "#eef6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1f19" },
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
      <body className={`${ui.variable} ${display.variable} ${en.variable} min-h-svh min-w-0 bg-paper font-sans text-ink`}>
        <ProviderContextProvider>
          <WordJobProvider>
            <TimerContextProvider>
              <div className="flex min-h-svh min-w-0 flex-col lg:flex-row">
                <AppNavigation />
                <div className="app-content min-w-0 flex-1"><WordJobStripConnected /><StudyReminder /><BackupReminder />{children}</div>
              </div>
              <FirebaseInitializer />
              <DataRetention />
              <UsageTracker />
              <ServiceWorkerRegistration />
            </TimerContextProvider>
          </WordJobProvider>
        </ProviderContextProvider>
      </body>
    </html>
  );
}
