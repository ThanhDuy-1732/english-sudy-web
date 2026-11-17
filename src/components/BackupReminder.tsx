"use client";

import { useEffect, useState } from "react";
import { LAST_BACKUP_KEY, downloadBackup, exportData, needsBackup } from "@/lib/data-transfer";

const SNOOZE_KEY = "backupReminderSnoozedUntil";

/** Reminds the learner to export a backup: data lives only in this browser. Shown at most once a day. */
export default function BackupReminder() {
  const [lastBackup, setLastBackup] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      const snoozedUntil = Date.parse(localStorage.getItem(SNOOZE_KEY) ?? "");
      if (!Number.isNaN(snoozedUntil) && snoozedUntil > Date.now()) return;
      if (needsBackup()) setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
    } catch {
      // Blocked storage: nothing to remind about.
    }
  }, []);

  if (lastBackup === undefined) return null;

  const days = lastBackup ? Math.floor((Date.now() - Date.parse(lastBackup)) / 86_400_000) : null;

  function hide() {
    setLastBackup(undefined);
  }

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, new Date(Date.now() + 86_400_000).toISOString());
    } catch {
      // Ignore: it will show again next visit.
    }
    hide();
  }

  function backup() {
    try {
      downloadBackup(exportData());
      hide();
    } catch {
      snooze();
    }
  }

  return (
    <div role="region" aria-label="Nhắc sao lưu" className="border-b border-rule bg-warn-soft px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-ink">
          {days === null ? "Bạn chưa sao lưu lần nào." : `Lần sao lưu gần nhất là ${days} ngày trước.`}{" "}
          Dữ liệu học chỉ nằm trong trình duyệt này; xuất file để không mất khi xoá dữ liệu trình duyệt hoặc đổi máy.
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={backup} className="btn btn-primary min-h-10 px-4 text-sm">Xuất file sao lưu</button>
          <button type="button" onClick={snooze} className="btn btn-secondary min-h-10 px-4 text-sm">Để mai</button>
        </div>
      </div>
    </div>
  );
}
