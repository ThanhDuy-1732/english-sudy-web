"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfile } from "@/lib/profile";
import { snoozeStudyNudge, studyNudge, type StudyNudge } from "@/lib/reminders";

/** In-app study reminder: after the reminder time, if nothing was studied today. "Để mai" hides it until tomorrow. */
export default function StudyReminder() {
  const [nudge, setNudge] = useState<StudyNudge | null>(null);

  useEffect(() => {
    try {
      setNudge(studyNudge(getProfile().reminderTime));
    } catch {
      // Blocked storage: no reminder.
    }
  }, []);

  if (!nudge) return null;

  function snooze() {
    try {
      snoozeStudyNudge();
    } catch {
      // Ignore: it shows again next visit.
    }
    setNudge(null);
  }

  return (
    <div role="region" aria-label="Nhắc học" className="border-b border-rule bg-primary-soft px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-ink">
          Hôm nay bạn chưa học.
          {nudge.dueWords > 0 && <> Có <span className="font-semibold tabular-nums">{nudge.dueWords} từ</span> đến hạn ôn.</>}
          {nudge.streak > 0 && <> Học vài phút để giữ chuỗi <span className="font-semibold tabular-nums">{nudge.streak} ngày</span>.</>}
        </p>
        <div className="flex shrink-0 gap-2">
          <Link href={nudge.dueWords > 0 ? "/review" : "/today"} onClick={() => setNudge(null)} className="btn btn-primary min-h-10 px-4 text-sm">
            {nudge.dueWords > 0 ? "Ôn tập ngay" : "Xem kế hoạch hôm nay"}
          </Link>
          <button type="button" onClick={snooze} className="btn btn-secondary min-h-10 px-4 text-sm">Để mai</button>
        </div>
      </div>
    </div>
  );
}
