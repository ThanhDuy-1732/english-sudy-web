"use client";

import { useEffect, useRef, useState } from "react";

export function useCountdown(seconds: number, enabled = true, onTimeUp?: () => void, deadline?: number | null) {
  const [remaining, setRemaining] = useState(seconds);
  const callback = useRef(onTimeUp);
  callback.current = onTimeUp;

  useEffect(() => {
    if (!enabled) {
      setRemaining(seconds); // a later run must not start from the previous run's 0
      return;
    }
    const end = deadline ?? Date.now() + seconds * 1000;
    let fired = false;
    function update() {
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0 && !fired) {
        fired = true;
        callback.current?.();
      }
    }
    update();
    const interval = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, [seconds, enabled, deadline]);

  return remaining;
}
