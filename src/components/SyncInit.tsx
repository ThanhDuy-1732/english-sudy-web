"use client";
import { useEffect } from "react";
import { initSyncQueueManager } from "@/lib/sync-queue";
import { registerSyncProcessors } from "@/lib/sync";

export function SyncInit() {
  useEffect(() => {
    registerSyncProcessors();
    const cleanup = initSyncQueueManager();
    return cleanup;
  }, []);
  return null;
}
