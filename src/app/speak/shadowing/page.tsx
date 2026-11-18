"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createRecorder, audioFilename } from "@/lib/speech/recorder";
import { saveSpeaking } from "@/lib/speech/speaking-storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";

const SHADOW_SENTENCES = [
  "The meeting has been postponed until next Thursday.",
  "Could you please send me the report by end of day?",
  "I'd like to schedule a conference call for tomorrow morning.",
  "The quarterly results exceeded our expectations significantly.",
  "We need to finalize the budget before the end of the month.",
  "She apologized for the misunderstanding and offered a refund.",
  "The proposal was well-received by the management team.",
  "Please make sure to submit the application before the deadline.",
];

type Phase = "ready" | "recording" | "processing" | "result";

function similarity(target: string, spoken: string): number {
  const targetWords = target.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
  const spokenSet = new Set(spoken.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/));
  const matches = targetWords.filter((w) => spokenSet.has(w)).length;
  return Math.round((matches / Math.max(targetWords.length, 1)) * 100);
}

export default function ShadowingPage() {
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [transcript, setTranscript] = useState("");
  const [matchPct, setMatchPct] = useState(0);
  const recorderRef = useRef(createRecorder());
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const recorder = recorderRef.current;
    return () => {
      recorder.dispose();
      if (sessionIdRef.current) cancelSession(sessionIdRef.current);
    };
  }, []);

  const sentence = SHADOW_SENTENCES[sentenceIdx % SHADOW_SENTENCES.length];

  function discardSession() {
    if (sessionIdRef.current) cancelSession(sessionIdRef.current);
    sessionIdRef.current = null;
  }

  function handleSpeak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  async function handleStartRecording() {
    setPhase("processing");
    try {
      await recorderRef.current.start();
      setPhase("recording");
      discardSession();
      sessionIdRef.current = startSession("speaking", { mode: "shadowing" });
    } catch {
      alert("Không thể truy cập microphone.");
      setPhase("ready");
    }
  }

  async function handleStopRecording() {
    setPhase("processing");
    try {
      const blob = await recorderRef.current.stop();
      const form = new FormData();
      form.append("audio", blob, audioFilename(blob, "shadowing"));
      const res = await fetch("/api/speech/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error("transcription failed");
      const result = await res.json() as { text?: string };
      const text = result.text ?? "";
      setTranscript(text);
      const score = similarity(sentence, text);
      setMatchPct(score);

      if (sessionIdRef.current) {
        finishSession(sessionIdRef.current, {
          totalItems: 1,
          correctItems: score >= 70 ? 1 : 0,
        });
        sessionIdRef.current = null;
      }

      // Save a minimal speaking record for history
      saveSpeaking({
        id: crypto.randomUUID(),
        mode: "shadowing",
        prompt: sentence,
        transcript: text,
        durationSec: 5,
        feedback: {
          overall: Math.round(score / 11.1) / 10, // rough similarity-to-band mapping
          bands: { fluency: 0, lexical: 0, grammar: 0, pronunciation: null },
          strengths: [],
          improvements: [],
          transcript: text,
          upgradedVersion: sentence,
          newVocabulary: [],
          durationSec: 5,
          wordsPerMinute: 0,
          fillerCount: 0,
        },
        createdAt: new Date().toISOString(),
      });

      setPhase("result");
    } catch {
      discardSession();
      setPhase("ready");
      alert("Lỗi xử lý audio. Vui lòng thử lại.");
    }
  }

  function handleNext() {
    setSentenceIdx((i) => i + 1);
    setPhase("ready");
    setTranscript("");
    setMatchPct(0);
  }

  const isRecording = recorderRef.current.isRecording();
  const matchColor = matchPct >= 80 ? "rgb(var(--ok))" : matchPct >= 60 ? "rgb(var(--warn))" : "rgb(var(--margin))";

  return (
    <main className="page">
      <Link href="/speak" className="back-link">← Luyện nói</Link>
      <h1 className="page-title mb-6">Shadowing</h1>

      <div className="bg-primary-soft rounded-lg p-4 mb-6 text-center">
        <p className="text-sm text-muted mb-1">Câu mẫu ({sentenceIdx % SHADOW_SENTENCES.length + 1}/{SHADOW_SENTENCES.length})</p>
        <p className="text-lg font-medium">&ldquo;{sentence}&rdquo;</p>
      </div>

      <div className="flex gap-3 mb-6 justify-center">
        <button
          onClick={handleSpeak}
          disabled={phase === "processing"}
          className="btn btn-secondary min-h-10 px-4 text-sm"
        >
          Nghe câu mẫu
        </button>
        {phase === "ready" && (
          <button
            onClick={() => void handleStartRecording()}
            className="btn btn-primary min-h-10 px-4 text-sm"
          >
            Ghi âm
          </button>
        )}
        {phase === "recording" && (
          <button
            onClick={() => void handleStopRecording()}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium animate-pulse"
          >
            ⏹ Dừng ghi âm
          </button>
        )}
        {phase === "processing" && (
          <span className="btn btn-secondary text-sm">
            Đang xử lý…
          </span>
        )}
      </div>

      {phase === "result" && (
        <div>
          <div className="text-center mb-4">
            <p className="text-4xl font-bold" style={{ color: matchColor }}>{matchPct}%</p>
            <p className="text-sm text-muted">Độ tương đồng</p>
          </div>

          <div className="bg-paper rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-muted mb-1">Bạn đã nói:</p>
            <p className="text-sm italic">&ldquo;{transcript || "(Không nhận được âm thanh)"}&rdquo;</p>
          </div>

          {transcript && (() => {
            const missingWords = sentence.toLowerCase().replace(/[^a-z\s]/g, "").split(" ").filter(
              (w) => !transcript.toLowerCase().includes(w)
            );
            return missingWords.length > 0 ? (
              <div className="text-sm mb-4">
                <p className="text-xs font-medium text-muted mb-1">Từ còn thiếu:</p>
                <div className="flex flex-wrap gap-1">
                  {missingWords.map((w, i) => (
                    <span key={i} className="px-2 py-0.5 bg-margin-soft text-margin rounded text-xs">{w}</span>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          <button
            onClick={handleNext}
            className="btn btn-primary w-full"
          >
            Câu tiếp theo
          </button>
        </div>
      )}

      {isRecording && phase === "recording" && (
        <p className="text-center text-sm text-margin animate-pulse mt-2">● Đang ghi âm…</p>
      )}
    </main>
  );
}
