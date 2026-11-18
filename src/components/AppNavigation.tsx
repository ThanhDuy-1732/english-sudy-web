"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { DueBadge } from "@/components/DueBadge";
import { ProviderBadge } from "@/components/ProviderBadge";
import HeaderTimer from "@/components/HeaderTimer";
import Plant from "@/components/Plant";

type NavLink = { href: string; label: string };

// Grouped by what the learner wants to do, not by feature. Group titles are real structure (they name the section).
const GROUPS: { title?: string; links: NavLink[] }[] = [
  { links: [
    { href: "/today", label: "Hôm nay" },
    { href: "/review", label: "Ôn tập" },
  ] },
  { title: "Học", links: [
    { href: "/", label: "Từ mới" },
    { href: "/vocab/context", label: "Từ trong ngữ cảnh" },
    { href: "/grammar", label: "Ngữ pháp" },
    { href: "/import", label: "Nhập từ" },
  ] },
  { title: "Luyện", links: [
    { href: "/exam", label: "Luyện thi" },
    { href: "/speak", label: "Nói" },
    { href: "/write", label: "Viết" },
    { href: "/mistakes", label: "Sổ lỗi" },
  ] },
  { title: "Tiến độ", links: [
    { href: "/path", label: "Lộ trình" },
    { href: "/stats", label: "Thống kê" },
    { href: "/diary", label: "Nhật ký" },
    { href: "/activity", label: "Hoạt động" },
    { href: "/history", label: "Vườn từ" },
    { href: "/library", label: "Tìm kiếm" },
  ] },
];

// Phone tab bar: the four things done every day, everything else under "Thêm".
const TABS: NavLink[] = [
  { href: "/today", label: "Hôm nay" },
  { href: "/", label: "Từ mới" },
  { href: "/review", label: "Ôn tập" },
  { href: "/exam", label: "Luyện thi" },
];


// 20px line icons for the phone tab bar, drawn on one 24-unit grid so they read as a set.
const ICONS: Record<string, ReactNode> = {
  "/today": <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  "/": <><path d="M12 20v-8" /><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6z" /><path d="M12 11c3 0 5-2 5-5-3 0-5 2-5 5z" /></>,
  "/review": <><path d="M4 11h11v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" /><path d="M15 13l5-4" /><path d="M7 11c0-3 1.5-5 4-5s4 2 4 5" /></>,
  "/exam": <><path d="M9 4h6M9 4a2 2 0 0 0-2 2v0H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1a2 2 0 0 0-2-2" /><path d="m9 13 2 2 4-4" /></>,
  more: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
};

function TabIcon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-2xl px-3 text-[15px] lg:min-h-9 transition-colors ${
        active ? "bg-primary-soft font-semibold text-primary-text" : "text-ink/80 hover:bg-ink/5 hover:text-ink"
      }`}
    >
      <span className="flex-1">{link.label}</span>
      {link.href === "/review" && <DueBadge />}
    </Link>
  );
}

export default function AppNavigation() {
  const pathname = usePathname() ?? "/";
  const moreRef = useRef<HTMLDetailsElement>(null);

  // Close the "Thêm" sheet after navigating.
  useEffect(() => {
    if (moreRef.current) moreRef.current.open = false;
  }, [pathname]);

  const moreActive = !TABS.some((tab) => isActive(pathname, tab.href));

  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Điều hướng chính" className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-rule bg-card px-3 py-5 lg:flex">
        <Link href="/today" className="mb-4 flex min-h-11 items-center gap-2 px-3 font-display text-[1.4rem] font-extrabold text-primary-text">
          <Plant stage={3} size={30} />English Study
        </Link>
        <div className="flex-1 space-y-4 overflow-y-auto">
          {GROUPS.map((group, index) => (
            <div key={group.title ?? index}>
              {group.title && <p className="mb-1 px-3 text-[13px] font-medium text-muted">{group.title}</p>}
              <div className="space-y-0.5">
                {group.links.map((link) => <SidebarLink key={link.href} link={link} active={isActive(pathname, link.href)} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-rule pt-3">
          <SidebarLink link={{ href: "/settings", label: "Cài đặt" }} active={isActive(pathname, "/settings")} />
          <div className="flex flex-wrap items-center justify-between gap-1 px-1"><HeaderTimer /><ProviderBadge /></div>
        </div>
      </nav>

      {/* Phone top bar */}
      <header className="app-topbar sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-rule bg-paper/95 pb-2 backdrop-blur lg:hidden">
        <Link href="/today" className="inline-flex min-h-11 items-center gap-1.5 font-display text-xl font-extrabold text-primary-text"><Plant stage={3} size={26} />English Study</Link>
        <HeaderTimer />
      </header>

      {/* Phone tab bar */}
      <nav aria-label="Điều hướng nhanh" className="app-tabbar fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-3xl border border-rule bg-card/95 p-1.5 shadow-[0_12px_32px_-12px_rgb(23_51_42/0.35)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs ${active ? "bg-primary-soft font-semibold text-primary-text" : "text-muted"}`}>
                <TabIcon name={tab.href} />
                <span className="flex items-center">{tab.label}{tab.href === "/review" && <DueBadge compact />}</span>
              </Link>
            );
          })}
          <details ref={moreRef} className="group relative">
            <summary className={`flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-2xl text-xs [&::-webkit-details-marker]:hidden ${moreActive ? "bg-primary-soft font-semibold text-primary-text" : "text-muted"}`}>
              <TabIcon name="more" />
              <span>Thêm</span>
            </summary>
            <div aria-hidden="true" className="fixed inset-0 bg-deep/40" onClick={() => { if (moreRef.current) moreRef.current.open = false; }} />
            <div className="more-sheet fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] overflow-y-auto rounded-3xl border border-rule bg-card p-3 shadow-[0_12px_40px_rgb(23_51_42/0.18)]">
              {GROUPS.slice(1).map((group) => (
                <div key={group.title} className="mb-3">
                  <p className="mb-1 px-3 text-sm font-medium text-muted">{group.title}</p>
                  <div className="grid grid-cols-2 gap-0.5">
                    {group.links.filter((link) => !TABS.some((tab) => tab.href === link.href)).map((link) => (
                      <SidebarLink key={link.href} link={link} active={isActive(pathname, link.href)} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 items-center gap-0.5 border-t border-rule pt-2">
                <SidebarLink link={{ href: "/settings", label: "Cài đặt" }} active={isActive(pathname, "/settings")} />
                <div className="justify-self-end"><ProviderBadge /></div>
              </div>
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
