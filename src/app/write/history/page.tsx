"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getWriting, type WritingRecord } from "@/lib/write/writing-storage";

const KIND_LABELS: Record<string, string> = {
  ielts_task1: "IELTS Task 1",
  ielts_task2: "IELTS Task 2",
  toeic_email: "TOEIC Email",
};

export default function WritingHistoryPage() {
  const [records, setRecords] = useState<WritingRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getWriting());
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "2-digit",
    });
  }

  return (
    <main className="page">
      <Link href="/write" className="back-link">← Luyện viết</Link>
      <h1 className="page-title mb-4">Bài viết đã làm</h1>

      {records.length === 0 && (
        <p className="text-muted text-center py-12">Chưa có bài viết nào.</p>
      )}

      <ul className="space-y-3">
        {records.map((r) => (
          <li key={r.id} className="border rounded-2xl border-rule">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full text-left p-4"
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-primary-text">{KIND_LABELS[r.kind] ?? r.kind}</span>
                  <p className="text-sm font-medium mt-0.5 line-clamp-2">{r.prompt}</p>
                  <p className="text-xs text-muted mt-1">{r.wordCount} từ · {formatDate(r.createdAt)}</p>
                </div>
                <span className="text-2xl font-bold text-primary-text ml-2 shrink-0">
                  {r.feedback.overall.toFixed(1)}
                </span>
              </div>
            </button>

            {expanded === r.id && (
              <div className="px-4 pb-4 border-t">
                <div className="grid grid-cols-2 gap-1 mt-3 mb-3">
                  {Object.entries(r.feedback.bands).map(([k, v]) => (
                    <div key={k} className="text-xs flex justify-between">
                      <span className="text-muted capitalize">{k}</span>
                      <span className="font-medium">{(v as number).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted italic mb-2">{r.feedback.nextFocus}</p>

                {(r.versions?.length ?? 0) > 1 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted mb-1">Các phiên bản:</p>
                    <div className="flex gap-2 text-xs flex-wrap">
                      {r.versions!.map((v) => (
                        <span key={v.version} className="px-2 py-0.5 bg-ink/5 rounded-xl">
                          v{v.version}: {v.feedback.overall.toFixed(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2 flex-wrap">
                  <Link
                    href={`/write/result/${r.id}`}
                    className="text-xs px-3 py-1.5 bg-ink/5 rounded-full"
                  >
                    Xem chi tiết
                  </Link>
                  <Link
                    href={`/write/rewrite/${r.id}`}
                    className="text-xs px-3 py-1.5 bg-primary-soft text-primary-text rounded-full"
                  >
                    Luyện viết lại
                  </Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
