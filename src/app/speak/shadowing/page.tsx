"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createRecorder, audioFilename } from "@/lib/speech/recorder";
import { saveSpeaking } from "@/lib/speech/speaking-storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import { SHADOW_SENTENCES } from "@/lib/shadow-sentences";
import { missingTokens, similarityPct } from "@/lib/answer-match";
import { speakText, voiceHint } from "@/lib/speech-voice";
import { LANG_INFO, type LearnLang } from "@/lib/languages";
import { useLearningLanguages } from "@/lib/useLearningLanguages";
import Segmented from "@/components/Segmented";

type Phase = "ready" | "recording" | "processing" | "result";

export default function ShadowingPage() {
  // The note belongs to the language it was checked for; switching language hides it.
  const [voiceNote, setVoiceNote] = useState<{ lang: LearnLang; text: string | null } | null>(null);
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

  const [learning] = useLearningLanguages();
  const [chosenLang, setChosenLang] = useState<LearnLang | null>(null);
  const lang: LearnLang = chosenLang && learning.includes(chosenLang) ? chosenLang : learning.includes("en") ? "en" : learning[0];
  const list = SHADOW_SENTENCES[lang];
  const item = list[sentenceIdx % list.length];
  const sentence = item.text;

  function chooseLang(next: LearnLang) {
    setChosenLang(next);
    setSentenceIdx(0);
    setPhase("ready");
    setTranscript("");
    setMatchPct(0);
  }

  function discardSession() {
    if (sessionIdRef.current) cancelSession(sessionIdRef.current);
    sessionIdRef.current = null;
  }

  function handleSpeak() {
    setVoiceNote({ lang, text: voiceHint(lang) });
    // A little slower than normal speech, as before; in the sentence's own language.
    speakText(sentence, lang, { voiceURI: null, rate: 0.85, pitch: 1, volume: 1 });
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
      form.append("language", lang);
      const res = await fetch("/api/speech/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error("transcription failed");
      const result = await res.json() as { text?: string };
      const text = result.text ?? "";
      setTranscript(text);
      // Characters for Chinese/Japanese, words for English/Korean.
      const score = similarityPct(sentence, text, lang);
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
        ...(lang === "en" ? {} : { lang }),
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
      {/* Only between attempts: switching mid-recording would orphan the microphone. */}
      {learning.length > 1 && (phase === "ready" || phase === "result") && (
        <div className="mb-4">
          <Segmented
            label="Ngôn ngữ"
            value={lang}
            onChange={(value) => chooseLang(value as LearnLang)}
            options={learning.map((code) => ({ value: code, label: LANG_INFO[code].native }))}
          />
        </div>
      )}

      <div className="postcard mb-6 px-6 py-8 text-center">
        <p className="mb-2 text-sm text-muted">Câu mẫu ({sentenceIdx % list.length + 1}/{list.length})</p>
        <p lang={LANG_INFO[lang].htmlLang} className={`${lang === "en" ? "font-en" : "font-sans"} text-2xl font-semibold leading-snug`}>&ldquo;{sentence}&rdquo;</p>
        {item.reading && <p className="mt-2 text-muted">{item.reading}</p>}
        <p className="mt-2 text-sm text-muted">{item.translation}</p>
      </div>

      {voiceNote?.lang === lang && voiceNote.text && (
        <p role="status" className="-mt-2 mb-4 text-center text-xs text-muted">{voiceNote.text}</p>
      )}
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
            className="btn bg-margin font-semibold text-white motion-safe:animate-pulse"
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

          <div className="bg-paper rounded-2xl p-3 mb-4">
            <p className="text-xs font-medium text-muted mb-1">Bạn đã nói:</p>
            <p className="text-sm italic">&ldquo;{transcript || "(Không nhận được âm thanh)"}&rdquo;</p>
          </div>

          {transcript && (() => {
            // English keeps its word check; Chinese/Japanese list characters, Korean words.
            const missingWords = lang === "en"
              ? sentence.toLowerCase().replace(/[^a-z\s]/g, "").split(" ").filter((w) => !transcript.toLowerCase().includes(w))
              : missingTokens(sentence, transcript, lang);
            return missingWords.length > 0 ? (
              <div className="text-sm mb-4">
                <p className="text-xs font-medium text-muted mb-1">Từ còn thiếu:</p>
                <div className="flex flex-wrap gap-1">
                  {missingWords.map((w, i) => (
                    <span key={i} className="px-2 py-0.5 bg-margin-soft text-margin rounded-full text-xs">{w}</span>
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
