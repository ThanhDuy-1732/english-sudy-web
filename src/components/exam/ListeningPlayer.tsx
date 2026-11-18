"use client";

import { useState, useEffect, useRef } from "react";
import type { AudioLine } from "@/lib/exam/types";
import { playScript, stopPlayback } from "@/lib/exam/tts-player";
import { getExamSettings } from "@/lib/exam/exam-storage";

interface Props {
  script: AudioLine[];
  onPlaybackComplete?: () => void;
}

type PlayState = "idle" | "playing" | "done";

export default function ListeningPlayer({ script, onPlaybackComplete }: Props) {
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [currentLine, setCurrentLine] = useState(-1);
  const [showTranscript, setShowTranscript] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const settings = getExamSettings();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      abortRef.current?.abort();
    };
  }, []);

  async function handlePlay() {
    stopPlayback();
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlayState("playing");
    setCurrentLine(0);

    try {
      await playScript(script, {
        rate: settings.listeningRate,
        onLine: (i) => setCurrentLine(i),
        signal: ctrl.signal,
      });
      if (!ctrl.signal.aborted) {
        setPlayState("done");
        setCurrentLine(-1);
        onPlaybackComplete?.();
      }
    } catch {
      setPlayState("idle");
    }
  }

  function handleStop() {
    stopPlayback();
    abortRef.current?.abort();
    setPlayState("idle");
    setCurrentLine(-1);
  }

  return (
    <div className="listening-player">
      <div className="player-controls">
        {playState !== "playing" ? (
          <button onClick={handlePlay} className="play-btn" aria-label="Phát audio">
            {playState === "done" ? "Phát lại" : "Phát"}
          </button>
        ) : (
          <button onClick={handleStop} className="stop-btn" aria-label="Dừng">
            ⏹ Dừng
          </button>
        )}
        <span className="state-label">
          {playState === "playing"
            ? `Đang phát… (${currentLine + 1}/${script.length})`
            : playState === "done"
            ? "✓ Đã phát xong"
            : "Nhấn để nghe"}
        </span>
      </div>

      {/* Transcript reveal */}
      <button
        onClick={() => setShowTranscript((v) => !v)}
        className="transcript-toggle"
      >
        {showTranscript ? "Ẩn transcript" : "Xem transcript"}
      </button>

      {showTranscript && (
        <div className="transcript">
          {script.map((line, i) => (
            <p
              key={i}
              className={`transcript-line ${i === currentLine ? "active" : ""}`}
            >
              <span className="speaker">{line.speaker}:</span> {line.text}
            </p>
          ))}
        </div>
      )}

      <style jsx>{`
        .listening-player { padding: 1rem 0; }
        .player-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .play-btn, .stop-btn {
          padding: 0.5rem 1.25rem;
          border: none;
          border-radius: 999px; min-height: 44px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .play-btn { background: rgb(var(--primary)); color: white; }
        .play-btn:hover { background: rgb(var(--primary-strong)); }
        .stop-btn { background: rgb(var(--margin)); color: white; }
        .stop-btn:hover { background: rgb(var(--margin)); }
        .state-label { font-size: 0.85rem; color: rgb(var(--muted)); }
        .transcript-toggle {
          font-size: 0.8rem;
          color: rgb(var(--muted));
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
          margin-bottom: 0.5rem;
        }
        .transcript { color: rgb(var(--ink)); background: rgb(var(--paper)); border-radius: 1rem; padding: 0.75rem 1rem; margin-top: 0.5rem; }
        .transcript-line { margin: 0 0 0.4rem; font-size: 0.875rem; line-height: 1.5; transition: background 0.2s; border-radius: 4px; padding: 0.1rem 0.3rem; }
        .transcript-line.active { color: rgb(var(--ink)); background: rgb(var(--warn-soft)); font-weight: 500; }
        .speaker { font-weight: 700; color: rgb(var(--muted)); margin-right: 0.3rem; }
      `}</style>
    </div>
  );
}
