import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "English Study",
    short_name: "English Study",
    description: "Học từ vựng tiếng Anh theo chủ đề bằng flashcard và AI.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#2c1f4a",
    theme_color: "#2c1f4a",
    lang: "vi",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Học từ mới",
        short_name: "Học từ",
        description: "Sinh và luyện một bộ từ mới.",
        url: "/",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Lịch sử học",
        short_name: "Lịch sử",
        description: "Xem lại các từ đã lưu.",
        url: "/history",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
