"use client";

import RetentionNotice from "@/components/RetentionNotice";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getSpeaking, type SpeakingRecord } from "@/lib/speech/speaking-storage";
import { loadAudio } from "@/lib/speech/audio-store";

const MODE_LABELS: Record<string, string> = {
  ielts_p1: "IELTS P1",
  ielts_p2: "IELTS P2",
  ielts_p3: "IELTS P3",
  roleplay: "Roleplay",
  shadowing: "Shadowing",
};

function ScoreBars({ bands }: { bands: SpeakingRecord["feedback"]["bands"] }) {
  const items: [string, number][] = [
    ["Fluency", bands.fluency],
    ["Lexical", bands.lexical],
    ["Grammar", bands.grammar],
    ["Pronunciation", bands.pronunciation ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-1 mt-2">
      {items.map(([label, score]) => (
        <div key={label} className="text-xs">
          <div className="flex justify-between mb-0.5">
            <span className="text-muted">{label}</span>
            <span className="font-medium">{score > 0 ? score.toFixed(1) : "—"}</span>
          </div>
          <div className="h-1.5 bg-ink/10 rounded">
            <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${(score / 9) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SpeakingHistoryPage() {
  const [records, setRecords] = useState<SpeakingRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getSpeaking());
  }, []);

  async function handleReplay(audioId: string, recordId: string) {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    const blob = await loadAudio(audioId);
    if (blob) {
      setAudioUrl(URL.createObjectURL(blob));
      setPlayingId(recordId);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  return (
    <main className="page">
      <Link href="/speak" className="back-link">← Luyện nói</Link>
      <h1 className="page-title mb-4">Bài nói đã làm</h1>
      <RetentionNotice className="mb-6" />

      {records.length === 0 && (
        <p className="text-muted text-center py-12">Chưa có bài nói nào.</p>
      )}

      <ul className="space-y-3">
        {records.map((r) => (
          <li key={r.id} className="border rounded-lg border-rule">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full text-left p-4"
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-primary-text">{MODE_LABELS[r.mode] ?? r.mode}</span>
                  <p className="text-sm font-medium mt-0.5 line-clamp-2">{r.prompt}</p>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <span className="text-2xl font-bold text-primary-text">{r.feedback.overall.toFixed(1)}</span>
                  <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                </div>
              </div>
            </button>

            {expanded === r.id && (
              <div className="px-4 pb-4 border-t">
                <ScoreBars bands={r.feedback.bands} />
                <p className="text-xs text-muted mt-3 italic line-clamp-4">{r.transcript}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {r.audioId && (
                    <button
                      onClick={() => void handleReplay(r.audioId!, r.id)}
                      className="text-xs px-3 py-1.5 bg-ink/5 rounded"
                    >
                      ▶ Nghe lại
                    </button>
                  )}
                  <Link
                    href={`/speak/ielts/${r.mode.replace("ielts_", "")}?retryOf=${r.id}`}
                    className="text-xs px-3 py-1.5 bg-primary-soft text-primary-text rounded"
                  >
                    Thử lại
                  </Link>
                </div>
                {playingId === r.id && audioUrl && (
                  <audio controls src={audioUrl} className="w-full mt-2" autoPlay />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
