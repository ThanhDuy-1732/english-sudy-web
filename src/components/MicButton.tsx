"use client";

import { useEffect, useRef, useState } from "react";
import { audioFilename, createRecorder, type Recorder } from "@/lib/speech/recorder";
import type { TranslateLang } from "@/lib/translate";

const LIMIT_SEC = 60;

/** Tap to speak, tap to stop (auto-stops at 60 s); Whisper's transcript goes to onText. */
export function MicButton({
  language,
  onText,
  onError,
  disabled = false,
  label = "Nói",
  className = "chip",
  onActiveChange,
}: {
  language: TranslateLang | "auto";
  onText: (text: string, lang: TranslateLang | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** true from the start of a recording until its transcript is back; lets a screen allow one recording at a time. */
  onActiveChange?: (active: boolean) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      recorderRef.current?.dispose();
    },
    []
  );

  async function begin() {
    const recorder = (recorderRef.current ??= createRecorder());
    try {
      await recorder.start();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Không thể ghi âm.");
      return;
    }
    setElapsed(0);
    setState("recording");
    onActiveChange?.(true);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= LIMIT_SEC) void finish();
    }, 1000);
  }

  async function finish() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    const recorder = recorderRef.current;
    if (!recorder) return;
    setState("sending");
    try {
      const blob = await recorder.stop();
      const form = new FormData();
      form.append("audio", blob, audioFilename(blob));
      form.append("language", language);
      const res = await fetch("/api/speech/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error("transcription failed");
      const data = (await res.json()) as { text?: string; lang?: TranslateLang | null };
      const text = (data.text ?? "").trim();
      if (text) onText(text, data.lang ?? null);
      else onError("Không nghe rõ, nói lại nhé.");
    } catch {
      onError("Không nhận được giọng nói. Vui lòng thử lại.");
    } finally {
      setState("idle");
      onActiveChange?.(false);
    }
  }

  const recording = state === "recording";
  return (
    <button
      type="button"
      onClick={() => void (recording ? finish() : begin())}
      disabled={disabled || state === "sending"}
      aria-label={recording ? "Dừng" : label}
      aria-pressed={recording}
      className={`${className} disabled:opacity-40`}
    >
      {state === "sending" ? "Đang nghe…" : recording ? `■ ${elapsed}s` : "🎙"}
    </button>
  );
}
