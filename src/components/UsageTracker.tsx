"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/** Sends one anonymous page-view event per route change (not for /admin). */
export default function UsageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && !pathname.startsWith("/admin")) track("page", pathname);
  }, [pathname]);
  return null;
}
