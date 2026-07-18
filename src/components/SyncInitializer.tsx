"use client";

import { useEffect } from "react";
import { initSync } from "@/lib/sync";

export function SyncInitializer() {
  useEffect(() => {
    void initSync();
  }, []);
  return null;
}
