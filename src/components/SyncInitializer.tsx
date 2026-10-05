"use client";

import { useEffect } from "react";
import { initSync } from "@/lib/sync";

export function SyncInitializer() {
  useEffect(() => {
    // Never let a sync/storage failure escape an effect: it would unmount the whole app.
    void Promise.resolve().then(initSync).catch(() => {});
  }, []);
  return null;
}
