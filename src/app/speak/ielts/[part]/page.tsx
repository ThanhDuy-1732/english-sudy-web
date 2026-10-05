"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createRecorder, audioFilename } from "@/lib/speech/recorder";
import { useCountdown } from "@/lib/useCountdown";
import { saveLearnedWord } from "@/lib/storage";
import type { SpeakingFeedback } from "@/lib/speech/types";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import { saveSpeaking } from "@/lib/speech/speaking-storage";
import type { SpeakingRecord } from "@/lib/speech/speaking-storage";
import { saveAudio, loadAudio } from "@/lib/speech/audio-store";

const PART_CONFIG: Record<string, { title: string; prepSec: number; speakSec: number; prompt: string }> = {
  p1: {
    title: "IELTS Speaking Part 1",
    prepSec: 0,
    speakSec: 90,
    prompt: "Tell me about yourself. What do you do for a living or study?",
  },
  p2: {
    title: "IELTS Speaking Part 2",
    prepSec: 60,
    speakSec: 120,
    prompt: "Describe a place you have visited that you particularly liked. You should say: where it is, how you got there, what you did there, and why you liked it.",
  },
  p3: {
    title: "IELTS Speaking Part 3",
    prepSec: 0,
    speakSec: 120,
    prompt: "Let's talk about tourism. Do you think tourism has more benefits or drawbacks for local communities? Why?",
  },
};

export default function IeltsSpeakingPage({ params }: { params: { part: string } }) {
  const { part } = params;
  const router = useRouter();
  const config = PART_CONFIG[part] ?? PART_CONFIG.p1;

  type Phase = "ready" | "prep" | "recording" | "processing" | "result";
  const [phase, setPhase] = useState<Phase>("ready");
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef(createRecorder());
  const prepLeft = useCountdown(config.prepSec, phase === "prep", () => { void startRecording(); });
  const recLeft = useCountdown(config.speakSec, phase === "recording", () => { void stopRecording(); });
  const processingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentAudioId) return;
    loadAudio(currentAudioId).then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
    });
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [currentAudioId]);

  useEffect(() => {
    const recorder = recorderRef.current;
    if (!sessionIdRef.current) {
      sessionIdRef.current = startSession("speaking", { mode: "ielts", part });
    }
    return () => {
      recorder.dispose();
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [part]);

  async function startPrep() {
    if (config.prepSec === 0) {
      startRecording();
      return;
    }
    setPhase("prep");
  }

  async function startRecording() {
    setPhase("processing");
    try {
      await recorderRef.current.start();
    } catch {
      alert("Không thể truy cập microphone. Dùng chế độ nhập text.");
      setTextMode(true);
      setPhase("ready");
      return;
    }
    setPhase("recording");
  }

  async function stopRecording() {
    if (processingRef.current) return;
    processingRef.current = true;
    setPhase("processing");
    try {
      const blob = await recorderRef.current.stop();
      const audioId = crypto.randomUUID();
      await saveAudio(audioId, blob);
      setCurrentAudioId(audioId);
      const formData = new FormData();
      formData.append("audio", blob, audioFilename(blob));
      const transcribeRes = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!transcribeRes.ok) throw new Error("transcription failed");
      const { text, durationSec } = await transcribeRes.json();
      await gradeTranscript(text, durationSec, audioId);
    } catch {
      alert("Lỗi xử lý audio. Vui lòng thử lại.");
      setPhase("ready");
    } finally {
      processingRef.current = false;
    }
  }

  async function gradeTranscript(text: string, durationSec: number, audioId?: string) {
    const gradeRes = await fetch("/api/speech/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: { prompt: config.prompt },
        transcript: text,
        durationSec,
      }),
    });
    if (!gradeRes.ok) throw new Error("grading failed");
    const fb: SpeakingFeedback = await gradeRes.json();
    setFeedback(fb);
    const record: SpeakingRecord = {
      id: crypto.randomUUID(),
      mode: `ielts_${part}` as SpeakingRecord["mode"],
      prompt: config.prompt,
      transcript: text,
      durationSec,
      feedback: fb,
      audioId,
      createdAt: new Date().toISOString(),
    };
    saveSpeaking(record);
    if (sessionIdRef.current) {
      finishSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
    setPhase("result");
  }

  async function submitText() {
    if (!textInput.trim()) return;
    setPhase("processing");
    const wordCount = textInput.trim().split(/\s+/).length;
    const durationSec = Math.round(wordCount / 2.5); // ~150 wpm estimate
    try {
      await gradeTranscript(textInput.trim(), durationSec);
    } catch {
      alert("Không thể chấm bài. Kiểm tra kết nối và thử lại.");
      setPhase("ready");
    }
  }

  function handleAddVocab(word: string) {
    saveLearnedWord({
      word,
      meaning: "",
      example: config.prompt,
      topic: `speak:ielts_${part}`,
      learnedAt: new Date().toISOString(),
      mastery: 0,
      nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      reviewInterval: 1,
    });
  }

  if (phase === "result" && feedback) {
    return (
      <div className="result-page">
        <div className="result-header">
          <button onClick={() => router.push("/speak")} className="back-btn">← Speak</button>
          <h1>{config.title}</h1>
        </div>

        <div className="score-grid">
          {(["fluency", "lexical", "grammar"] as const).map((k) => (
            <div key={k} className="score-box">
              <p className="score-label">{k === "fluency" ? "Fluency" : k === "lexical" ? "Lexical" : "Grammar"}</p>
              <p className="score-val">{feedback.bands[k]}</p>
            </div>
          ))}
          <div className="score-box overall">
            <p className="score-label">Overall</p>
            <p className="score-val">{feedback.overall}</p>
          </div>
        </div>

        <div className="stats-row">
          <span>⏱ {Math.round(feedback.durationSec)}s</span>
          <span>📝 {Math.round(feedback.wordsPerMinute)} wpm</span>
          <span>🔤 Filler words: {feedback.fillerCount}</span>
        </div>

        {audioUrl && (
          <div className="replay-section">
            <p className="replay-label">Nghe lại</p>
            <audio controls src={audioUrl} className="replay-audio" />
          </div>
        )}

        <section>
          <h2>✅ Điểm mạnh</h2>
          <ul>{feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>

        <section>
          <h2>🔧 Cần cải thiện</h2>
          {feedback.improvements.map((imp, i) => (
            <div key={i} className="improvement">
              <p className="issue">{imp.issue}</p>
              <p className="wrong">✗ {imp.example}</p>
              <p className="better">✓ {imp.better}</p>
            </div>
          ))}
        </section>

        <section>
          <h2>📖 Transcript</h2>
          <p className="transcript">{feedback.transcript}</p>
        </section>

        <section>
          <h2>⭐ Phiên bản nâng cấp (band cao hơn)</h2>
          <p className="upgraded">{feedback.upgradedVersion}</p>
        </section>

        {feedback.newVocabulary.length > 0 && (
          <section>
            <h2>💡 Từ vựng nên dùng</h2>
            <div className="vocab-list">
              {feedback.newVocabulary.map((w) => (
                <button key={w} onClick={() => handleAddVocab(w)} className="vocab-chip" title="Thêm vào flashcard">
                  + {w}
                </button>
              ))}
            </div>
            <p className="vocab-hint">Nhấn để thêm vào flashcard</p>
          </section>
        )}

        <button onClick={() => {
          sessionIdRef.current = startSession("speaking", { mode: "ielts", part });
          setPhase("ready");
          setFeedback(null);
        }} className="retry-btn">
          Thử lại
        </button>

        <style jsx>{`
          .result-page { max-width: 680px; margin: 0 auto; padding: 1.5rem; }
          .result-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
          .back-btn { background: none; border: none; cursor: pointer; color: #6c757d; }
          h1 { font-size: 1.1rem; font-weight: 700; margin: 0; }
          h2 { font-size: 0.9rem; font-weight: 600; text-transform: uppercase; color: #6c757d; margin: 1.25rem 0 0.5rem; }
          .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
          .score-box { color: #212529; text-align: center; padding: 0.75rem; background: #f8f9fa; border-radius: 10px; }
          .score-box.overall { background: #d1e7dd; }
          .score-label { font-size: 0.75rem; color: #6c757d; margin: 0; }
          .score-val { font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0 0; }
          .stats-row { display: flex; gap: 1rem; font-size: 0.8rem; color: #6c757d; margin-bottom: 0.5rem; flex-wrap: wrap; }
          ul { padding-left: 1.25rem; }
          li { margin-bottom: 0.35rem; font-size: 0.9rem; }
          .improvement { color: #212529; background: #f8f9fa; border-radius: 8px; padding: 0.75rem; margin-bottom: 0.5rem; }
          .issue { font-weight: 600; font-size: 0.875rem; margin: 0 0 0.35rem; }
          .wrong { color: #dc3545; font-size: 0.85rem; margin: 0; }
          .better { color: #198754; font-size: 0.85rem; margin: 0.25rem 0 0; }
          .transcript { color: #212529; font-size: 0.875rem; line-height: 1.6; background: #f8f9fa; padding: 0.75rem; border-radius: 8px; }
          .upgraded { font-size: 0.875rem; line-height: 1.6; background: #e8f0fe; padding: 0.75rem; border-radius: 8px; border-left: 3px solid #0d6efd; }
          .vocab-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
          .vocab-chip { padding: 0.3rem 0.75rem; border: 1.5px solid #0d6efd; border-radius: 16px; background: white; cursor: pointer; font-size: 0.8rem; color: #0d6efd; }
          .vocab-chip:hover { background: #e8f0fe; }
          .vocab-hint { font-size: 0.75rem; color: #6c757d; margin-top: 0.35rem; }
          .replay-section { margin: 0.75rem 0; }
          .replay-label { font-size: 0.75rem; text-transform: uppercase; color: #6c757d; margin: 0 0 0.35rem; }
          .replay-audio { width: 100%; border-radius: 8px; }
          .retry-btn { width: 100%; padding: 0.875rem; background: #0d6efd; color: white; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; margin-top: 1.5rem; }
          /* dark theme: light surfaces */
          :global(:root[data-theme="dark"]) .score-box { background: rgba(255, 255, 255, 0.07); color: #f1ecff; }
          :global(:root[data-theme="dark"]) .score-box.overall { background: rgba(34, 197, 94, 0.16); color: #86efac; }
          :global(:root[data-theme="dark"]) .improvement { background: rgba(255, 255, 255, 0.07); color: #f1ecff; }
          :global(:root[data-theme="dark"]) .transcript { background: rgba(255, 255, 255, 0.07); color: #f1ecff; }
          :global(:root[data-theme="dark"]) .upgraded { background: rgba(59, 130, 246, 0.2); color: #bfdbfe; }
          :global(:root[data-theme="dark"]) .vocab-chip { background: #3a2a61; color: #f1ecff; }
          :global(:root[data-theme="dark"]) .vocab-chip:hover { background: rgba(59, 130, 246, 0.2); color: #bfdbfe; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="speaking-page">
      <div className="speak-header">
        <button onClick={() => router.push("/speak")} className="back-btn">← Speak</button>
        <h1>{config.title}</h1>
        <button onClick={() => setTextMode(!textMode)} className="mode-btn">
          {textMode ? "🎤 Dùng mic" : "⌨️ Nhập text"}
        </button>
      </div>

      <div className="task-card">
        <p className="task-label">Task</p>
        <p className="task-prompt">{config.prompt}</p>
      </div>

      {!textMode ? (
        <div className="mic-section">
          {phase === "ready" && (
            <button onClick={startPrep} className="big-btn start">
              {config.prepSec > 0 ? `▶ Bắt đầu (${config.prepSec}s chuẩn bị)` : "🎤 Bắt đầu ghi âm"}
            </button>
          )}
          {phase === "prep" && (
            <div className="countdown">
              <p>Chuẩn bị…</p>
              <p className="big-number">{prepLeft}</p>
            </div>
          )}
          {phase === "recording" && (
            <div className="recording-state">
              <div className="rec-dot" />
              <p>Đang ghi âm… {recLeft}s còn lại</p>
              <button onClick={stopRecording} className="stop-btn">⏹ Dừng sớm</button>
            </div>
          )}
          {phase === "processing" && <p className="processing">⏳ Đang xử lý…</p>}
        </div>
      ) : (
        <div className="text-section">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Nhập câu trả lời của bạn bằng tiếng Anh…"
            rows={8}
          />
          <button
            onClick={submitText}
            disabled={!textInput.trim() || phase === "processing"}
            className="big-btn start"
          >
            {phase === "processing" ? "⏳ Đang chấm…" : "📤 Nộp bài"}
          </button>
        </div>
      )}

      <style jsx>{`
        .speaking-page { max-width: 640px; margin: 0 auto; padding: 1.5rem; }
        .speak-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; }
        .back-btn { background: none; border: none; cursor: pointer; color: #6c757d; }
        h1 { flex: 1; font-size: 1.1rem; font-weight: 700; margin: 0; }
        .mode-btn { color: #212529; padding: 0.35rem 0.75rem; border: 1.5px solid #dee2e6; border-radius: 16px; background: white; cursor: pointer; font-size: 0.8rem; }
        .task-card { color: #212529; background: #f8f9fa; border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem; border-left: 3px solid #0d6efd; }
        .task-label { font-size: 0.75rem; text-transform: uppercase; color: #6c757d; margin: 0 0 0.5rem; }
        .task-prompt { font-size: 0.95rem; line-height: 1.6; margin: 0; }
        .mic-section, .text-section { text-align: center; }
        .big-btn { display: block; width: 100%; padding: 1rem; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
        .big-btn.start { background: #0d6efd; color: white; }
        .big-btn.start:hover:not(:disabled) { background: #0b5ed7; }
        .big-btn:disabled { background: #adb5bd; cursor: not-allowed; }
        .countdown { padding: 2rem; }
        .big-number { font-size: 4rem; font-weight: 700; color: #0d6efd; margin: 0.5rem 0; }
        .recording-state { padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .rec-dot { width: 16px; height: 16px; border-radius: 50%; background: #dc3545; animation: blink 1s infinite; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .stop-btn { padding: 0.6rem 1.5rem; border: 1.5px solid #dc3545; color: #dc3545; background: white; border-radius: 8px; cursor: pointer; }
        .processing { color: #6c757d; padding: 2rem; }
        textarea { width: 100%; padding: 0.75rem; border: 1.5px solid #dee2e6; border-radius: 8px; font-size: 0.9rem; resize: vertical; box-sizing: border-box; }
      `}</style>
    </div>
  );
}
