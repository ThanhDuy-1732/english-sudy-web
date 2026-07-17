"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;

    const register = async () => {
      try {
        const version = encodeURIComponent(process.env.NEXT_PUBLIC_PWA_VERSION ?? "development");
        registration = await navigator.serviceWorker.register(`/sw.js?v=${version}`, {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        console.error("Không thể đăng ký chế độ offline.", error);
      }
    };

    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void registration?.update();
      }
    };

    window.addEventListener("load", register);
    document.addEventListener("visibilitychange", updateWhenVisible);

    if (document.readyState === "complete") {
      void register();
    }

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, []);

  return null;
}
