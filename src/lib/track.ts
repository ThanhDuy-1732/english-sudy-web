// Client-side anonymous usage tracking → POST /api/track. Never throws.

const DEVICE_KEY = "deviceId";

function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(kind: "page" | "done", name: string): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") return;
  const device = deviceId();
  if (!device) return;
  try {
    const body = JSON.stringify({ kind, name: name.slice(0, 120), device });
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // tracking is best-effort
  }
}
