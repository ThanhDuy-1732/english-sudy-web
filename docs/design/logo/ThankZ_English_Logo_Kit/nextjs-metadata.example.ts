// Ghép các trường này vào metadata hiện có trong src/app/layout.tsx.
// Giữ các trường description, manifest và viewport hiện có.
import type { Metadata } from "next";
export const brandingMetadata: Metadata = {
  title: "ThankZ English",
  applicationName: "ThankZ English",
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
