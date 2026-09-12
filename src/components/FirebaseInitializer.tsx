"use client";

import { useEffect } from "react";
import { initializeFirebaseAnalytics } from "@/lib/firebase";

export function FirebaseInitializer() {
  useEffect(() => {
    void initializeFirebaseAnalytics();
  }, []);

  return null;
}
