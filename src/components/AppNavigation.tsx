"use client";

import { DueBadge } from "@/components/DueBadge";
import { ProviderBadge } from "@/components/ProviderBadge";
import HeaderTimer from "@/components/HeaderTimer";

const links = [
  ["/", "Học từ mới"], ["/review", "Ôn tập"], ["/today", "Hôm nay"],
  ["/grammar", "Ngữ pháp"], ["/exam", "Luyện thi"], ["/speak", "Nói"], ["/write", "Viết"],
  ["/history", "Lịch sử"], ["/diary", "Nhật ký"], ["/activity", "Hoạt động"],
  ["/path", "Lộ trình"], ["/library", "Thư viện"], ["/mistakes", "Sổ lỗi"],
  ["/stats", "Thống kê"], ["/vocab/context", "Từ trong ngữ cảnh"], ["/import", "Nhập từ"],
  ["/settings", "Cài đặt"],
];

export default function AppNavigation() {
  return (
    <nav aria-label="Điều hướng chính" className="app-nav sticky top-0 z-30 min-w-0 border-b border-white/10 bg-[#2c1f4a]/95 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <a href="/" className="inline-flex min-h-11 flex-1 items-center font-display text-xl font-bold text-[#d9ecff]">English Study</a>
        <HeaderTimer />
        <details className="relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg border border-white/20 px-3">Menu</summary>
          <div className="mobile-menu absolute right-0 top-full mt-2 grid w-64 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-white/20 bg-[#2c1f4a] p-2 shadow-xl">
            {links.map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-[#d9ecff] hover:bg-white/10">
                {label}{href === "/review" && <DueBadge />}
              </a>
            ))}
          </div>
        </details>
        <div className="hidden lg:block"><ProviderBadge /></div>
        <div className="hidden w-full flex-wrap gap-1 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-[#b0b0d1] hover:bg-white/10 hover:text-white">
              {label}{href === "/review" && <DueBadge />}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
