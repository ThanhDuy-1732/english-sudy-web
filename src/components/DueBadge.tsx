"use client";

import { useEffect, useState } from "react";
import { getWordsForReview } from "@/lib/storage";

/** Badge showing number of due SRS words. Updates every 60s. */
export function DueBadge({ compact = false }: { compact?: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getWordsForReview().length);
    const id = setInterval(() => setCount(getWordsForReview().length), 60_000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;
  return (
    <span title={`${count} từ đến hạn`} className={`inline-flex items-center justify-center rounded-full bg-marker font-semibold tabular-nums text-deep ${compact ? "ml-1 h-4 min-w-4 px-1 text-[10px]" : "ml-1 h-5 min-w-5 px-1.5 text-xs"}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
