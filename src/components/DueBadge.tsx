"use client";

import { useEffect, useState } from "react";
import { getWordsForReview } from "@/lib/storage";

/** Badge showing number of due SRS words. Updates every 60s. */
export function DueBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getWordsForReview().length);
    const id = setInterval(() => setCount(getWordsForReview().length), 60_000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#7f56d9] px-1.5 text-xs font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
