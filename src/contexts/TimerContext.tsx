"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "studyTime";

interface TimerContextValue {
  todaySeconds: number;
  isRunning: boolean;
  isCountdownMode: boolean;
  countdownTarget: number | null;
  countdownRemaining: number | null;
  showTimeUp: boolean;
  pause(): void;
  resume(): void;
  startCountdown(seconds: number): void;
  stopCountdown(): void;
  clearTimeUp(): void;
}

const defaultValue: TimerContextValue = {
  todaySeconds: 0,
  isRunning: false,
  isCountdownMode: false,
  countdownTarget: null,
  countdownRemaining: null,
  showTimeUp: false,
  pause: () => {},
  resume: () => {},
  startCountdown: () => {},
  stopCountdown: () => {},
  clearTimeUp: () => {},
};

const TimerContext = createContext<TimerContextValue>(defaultValue);

function getTodayKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readStudyTime(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function readTodaySeconds(): number {
  const seconds = readStudyTime()[getTodayKey()];
  return typeof seconds === "number" && Number.isFinite(seconds) ? seconds : 0;
}

function writeStudyTime(data: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage blocked or full: today's minutes are simply not persisted.
  }
}

function writeTodaySeconds(seconds: number, day = getTodayKey()): void {
  const data = readStudyTime();
  data[day] = seconds;
  writeStudyTime(data);
}

export function useTimer(): TimerContextValue {
  return useContext(TimerContext);
}

export function TimerContextProvider({ children }: { children: React.ReactNode }) {
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [countdownTarget, setCountdownTarget] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const todaySecondsRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSecondsRef = useRef(0);
  const dayKeyRef = useRef("");
  const deadlineRef = useRef<number | null>(null);
  const remainingRef = useRef<number | null>(null);

  useEffect(() => {
    dayKeyRef.current = getTodayKey();
    const seconds = readTodaySeconds();
    todaySecondsRef.current = seconds;
    pendingSecondsRef.current = seconds;
    setTodaySeconds(seconds);
  }, []);

  const schedulePersist = useCallback((seconds: number) => {
    pendingSecondsRef.current = seconds;
    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => {
      writeTodaySeconds(pendingSecondsRef.current, dayKeyRef.current);
      debounceRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      writeTodaySeconds(pendingSecondsRef.current, dayKeyRef.current);
    };
  }, []);

  useEffect(() => {
    let previous = Date.now();
    let visible = document.visibilityState !== "hidden";
    if (isRunning && remainingRef.current !== null) {
      deadlineRef.current = Date.now() + remainingRef.current * 1000;
    }
    function update() {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - previous) / 1000));
      previous += elapsed * 1000;
      const currentDay = getTodayKey();
      if (currentDay !== dayKeyRef.current) {
        // Day rolled over: flush pending value to the OLD date key, then reset.
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
        const allData = readStudyTime();
        allData[dayKeyRef.current] = pendingSecondsRef.current;
        writeStudyTime(allData);
        dayKeyRef.current = currentDay;
        todaySecondsRef.current = 0;
        pendingSecondsRef.current = 0;
        setTodaySeconds(0);
      }
      if (isRunning && visible && elapsed > 0) {
        const next = todaySecondsRef.current + elapsed;
        todaySecondsRef.current = next;
        setTodaySeconds(next);
        schedulePersist(next);
      }
      if (isRunning && deadlineRef.current !== null) {
        const next = Math.max(0, Math.ceil((deadlineRef.current - now) / 1000));
        remainingRef.current = next || null;
        setCountdownRemaining(next || null);
        if (next === 0) {
          setShowTimeUp(true);
          deadlineRef.current = null;
        }
      }
    }
    function onVisibility() {
      update();
      visible = document.visibilityState !== "hidden";
      previous = Date.now();
      if (!visible) writeTodaySeconds(pendingSecondsRef.current, dayKeyRef.current);
    }
    const id = setInterval(update, 1000);
    document.addEventListener("visibilitychange", onVisibility);
    const persist = () => { update(); writeTodaySeconds(pendingSecondsRef.current, dayKeyRef.current); };
    window.addEventListener("pagehide", persist);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, [isRunning, schedulePersist]);

  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);

  const startCountdown = useCallback((seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    remainingRef.current = seconds;
    setCountdownTarget(seconds);
    setCountdownRemaining(seconds);
    setShowTimeUp(false);
    setIsRunning(true);
  }, []);

  const stopCountdown = useCallback(() => {
    deadlineRef.current = null;
    remainingRef.current = null;
    setCountdownTarget(null);
    setCountdownRemaining(null);
  }, []);

  const clearTimeUp = useCallback(() => {
    setShowTimeUp(false);
    setCountdownTarget(null);
  }, []);

  return (
    <TimerContext.Provider
      value={{
        todaySeconds,
        isRunning,
        isCountdownMode: countdownRemaining !== null,
        countdownTarget,
        countdownRemaining,
        showTimeUp,
        pause,
        resume,
        startCountdown,
        stopCountdown,
        clearTimeUp,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}
