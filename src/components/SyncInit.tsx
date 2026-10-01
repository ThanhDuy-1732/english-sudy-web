"use client";
import { useEffect } from "react";
import { initSyncQueueManager } from "@/lib/sync-queue";
import { registerSyncProcessors, initSync } from "@/lib/sync";
import { runMistakeMigration } from "@/lib/mistake-migration";

export function SyncInit() {
  useEffect(() => {
    runMistakeMigration();
    registerSyncProcessors();
    const cleanup = initSyncQueueManager(initSync);
    return cleanup;
  }, []);
  return null;
}
