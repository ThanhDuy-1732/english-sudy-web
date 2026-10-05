"use client";
import { useEffect } from "react";
import { initSyncQueueManager } from "@/lib/sync-queue";
import { registerSyncProcessors, initSync } from "@/lib/sync";
import { runMistakeMigration } from "@/lib/mistake-migration";

export function SyncInit() {
  useEffect(() => {
    // Storage can be blocked or full; a failure here must not escape an effect (it would unmount the whole app).
    try {
      runMistakeMigration();
      registerSyncProcessors();
      return initSyncQueueManager(initSync);
    } catch {
      return undefined;
    }
  }, []);
  return null;
}
