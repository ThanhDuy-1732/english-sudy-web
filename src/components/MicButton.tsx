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
  const [state, setState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const timerRef = useRef<number | null>(null);
  // The 60 s timer and the transcript arrive after later renders: they read the latest props from here.
  const latest = useRef({ language, onText, onError, onActiveChange });
  latest.current = { language, onText, onError, onActiveChange };
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      recorderRef.current?.dispose();
    };
  }, []);

  async function begin() {
    if (state !== "idle") return;
    // Claim the screen before the mic opens, so a second tap (here or on another mic) cannot start a second recording.
    setState("starting");
    onActiveChange?.(true);
    // Stop the app's own read-aloud, or the mic records it as the speaker's words.
    window.speechSynthesis?.cancel();
    const recorder = (recorderRef.current ??= createRecorder());
    try {
      await recorder.start();
    } catch (error) {
      setState("idle");
      onActiveChange?.(false);
      onError(error instanceof Error ? error.message : "Không thể ghi âm.");
      return;
    }
    setElapsed(0);
    setState("recording");
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
    let outcome: { text: string; lang: TranslateLang | null } | { error: string };
    try {
      const blob = await recorder.stop();
      if (blob.size === 0) {
        outcome = { error: "Không nghe rõ, nói lại nhé." };
      } else {
        const form = new FormData();
        form.append("audio", blob, audioFilename(blob));
        form.append("language", latest.current.language);
        const res = await fetch("/api/speech/transcribe", { method: "POST", body: form });
        if (!res.ok) throw new Error("transcription failed");
        const data = (await res.json()) as { text?: string; lang?: TranslateLang | null; noSpeech?: boolean };
        const text = data.noSpeech ? "" : (data.text ?? "").trim();
        outcome = text ? { text, lang: data.lang ?? null } : { error: "Không nghe rõ, nói lại nhé." };
      }
    } catch {
      outcome = { error: "Không nhận được giọng nói. Vui lòng thử lại." };
    }
    // The person left the screen: the transcript belongs to nothing any more.
    if (!mounted.current) return;
    setState("idle");
    const { onText: deliver, onError: report, onActiveChange: activeChange } = latest.current;
    activeChange?.(false);
    if ("text" in outcome) deliver(outcome.text, outcome.lang);
    else report(outcome.error);
  }

  const recording = state === "recording";
  return (
    <button
      type="button"
      onClick={() => void (recording ? finish() : begin())}
      disabled={disabled || state === "sending" || state === "starting"}
      aria-label={recording ? "Dừng" : label}
      aria-pressed={recording}
      className={`${className} disabled:opacity-40`}
    >
      {state === "sending" ? "Đang nghe…" : recording ? `■ ${elapsed}s` : "🎙"}
    </button>
  );
}
