"use client";

import { useEffect } from "react";
import { runRetention } from "@/lib/retention";

/** Deletes data older than 90 days once a day, after the page has loaded. */
export default function DataRetention() {
  useEffect(() => {
    const id = window.setTimeout(() => void runRetention(), 2000);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
