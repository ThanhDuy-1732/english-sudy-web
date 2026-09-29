"use client";
import { useState, useEffect } from "react";
import { getSyncStatus, type SyncStatus } from "@/lib/sync-queue";

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  synced:  { label: "Đã đồng bộ", color: "text-green-500" },
  syncing: { label: "Đang đồng bộ...", color: "text-blue-500" },
  pending: { label: "Đang chờ", color: "text-yellow-500" },
  offline: { label: "Ngoại tuyến", color: "text-gray-400" },
  failed:  { label: "Lỗi đồng bộ", color: "text-red-500" },
};

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>("synced");

  useEffect(() => {
    function update() { setStatus(getSyncStatus()); }
    update();
    const interval = setInterval(update, 5000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`text-xs ${cfg.color} flex items-center gap-1`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
      {cfg.label}
    </span>
  );
}
