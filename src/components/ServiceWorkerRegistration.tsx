"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwaInstallDismissed";

export default function ServiceWorkerRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState(false);
  const [installing, setInstalling] = useState(false);
  // Hidden until storage is read, so a dismissed banner never flashes on load.
  const [dismissed, setDismissed] = useState(true);
  // Set when a new worker took over this page: the next navigation loads the new build.
  const updated = useRef(false);
  const pathname = usePathname();

  // Reload on route change, never mid-lesson: the page being left loses nothing.
  useEffect(() => {
    if (updated.current) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => {
      const active = standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
      setInstalled(active);
      if (active) void navigator.storage?.persist?.().catch(() => {});
    };
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    const updateNetwork = () => setOffline(!navigator.onLine);
    updateInstalled();
    updateNetwork();
    standalone.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      standalone.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    // First install also fires controllerchange (clients.claim); only a replaced worker is an update.
    const hadController = !!navigator.serviceWorker.controller;
    const register = async () => {
      try {
        const version = encodeURIComponent(process.env.NEXT_PUBLIC_PWA_VERSION ?? "development");
        registration = await navigator.serviceWorker.register(`/sw.js?v=${version}`, { scope: "/", updateViaCache: "none" });
      } catch (error) {
        console.error("Không thể đăng ký chế độ offline.", error);
      }
    };
    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => {});
    };
    const controllerChanged = () => {
      if (hadController) updated.current = true;
    };
    // Hydration can happen after load; register once without waiting for another event.
    void register();
    document.addEventListener("visibilitychange", updateWhenVisible);
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    return () => {
      document.removeEventListener("visibilitychange", updateWhenVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* remember for this session only */ }
  }

  async function install() {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch {
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <>
      {!installed && !dismissed && (
        <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-2 px-4 py-4 text-sm text-ink">
          <div className="flex-1">
          {installPrompt ? (
            <button type="button" disabled={installing} onClick={() => void install()} className="min-h-11 rounded-full bg-ink/5 px-4">Cài ThankZ English</button>
          ) : (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center">Cài ứng dụng trên điện thoại</summary>
              <p className="mt-2">iPhone/iPad: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.</p>
              <p className="mt-2">Android: mở menu trình duyệt → Cài ứng dụng hoặc Thêm vào màn hình chính.</p>
            </details>
          )}
          </div>
          <button type="button" aria-label="Ẩn hướng dẫn cài đặt" onClick={dismiss} className="min-h-11 min-w-11 rounded-full bg-ink/5">✕</button>
        </div>
      )}
      {offline && (
        <aside role="status" className="pwa-status fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-rule bg-paper canvas-surface px-4 pt-3 text-sm text-white shadow-lg">
          <p>Đang ngoại tuyến. Bạn có thể ôn từ đã lưu, đọc ngữ pháp và viết nháp. Chức năng AI cần mạng.</p>
        </aside>
      )}
    </>
  );
}
