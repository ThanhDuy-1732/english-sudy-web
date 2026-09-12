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

function writeTodaySeconds(seconds: number): void {
  if (typeof window === "undefined") return;
  const data = readStudyTime();
  data[getTodayKey()] = seconds;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      writeTodaySeconds(pendingSecondsRef.current);
      debounceRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isRunning) return undefined;
    const id = setInterval(() => {
      const currentDay = getTodayKey();
      if (currentDay !== dayKeyRef.current) {
        // Day rolled over: flush pending value to the OLD date key, then reset.
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
        const allData = readStudyTime();
        allData[dayKeyRef.current] = pendingSecondsRef.current;
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
        dayKeyRef.current = currentDay;
        todaySecondsRef.current = 0;
        pendingSecondsRef.current = 0;
        setTodaySeconds(0);
      }
      const next = todaySecondsRef.current + 1;
      todaySecondsRef.current = next;
      setTodaySeconds(next);
      schedulePersist(next);
      setCountdownRemaining((previous) => {
        if (previous === null) return null;
        if (previous <= 1) {
          setShowTimeUp(true);
          return null;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, schedulePersist]);

  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);

  const startCountdown = useCallback((seconds: number) => {
    setCountdownTarget(seconds);
    setCountdownRemaining(seconds);
    setShowTimeUp(false);
    setIsRunning(true);
  }, []);

  const stopCountdown = useCallback(() => {
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
