"use client";

import { useState } from "react";

const REPORT_REASONS = [
  "Đáp án sai",
  "Câu hỏi khó hiểu",
  "Nội dung lỗi thời",
  "Khác",
] as const;

const KEY = "reportedQuestions";

interface ReportEntry {
  questionId: string;
  itemId: string;
  reason: string;
  note: string;
  reportedAt: string;
}

function saveReport(entry: ReportEntry) {
  if (typeof window === "undefined") return;
  try {
    const existing: ReportEntry[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    localStorage.setItem(KEY, JSON.stringify([entry, ...existing].slice(0, 200)));
  } catch {
    // ignore
  }
}

interface Props {
  questionId: string;
  itemId: string;
  onClose: () => void;
}

export default function ReportQuestionModal({ questionId, itemId, onClose }: Props) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    saveReport({ questionId, itemId, reason, note: note.trim(), reportedAt: new Date().toISOString() });
    setSubmitted(true);
  }

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <>
            <p className="report-thanks">✅ Đã ghi nhận. Cảm ơn bạn!</p>
            <button onClick={onClose} className="report-close-btn">Đóng</button>
          </>
        ) : (
          <>
            <h3>Báo cáo câu hỏi</h3>
            <div className="report-reasons">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`reason-btn ${reason === r ? "selected" : ""}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm (không bắt buộc)..."
              rows={3}
              className="report-note"
            />
            <div className="report-actions">
              <button onClick={onClose} className="report-cancel-btn">Hủy</button>
              <button onClick={handleSubmit} className="report-submit-btn">Gửi báo cáo</button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .report-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center; z-index: 50;
        }
        .report-modal {
          background: white; border-radius: 12px; padding: 1.5rem;
          width: min(400px, 90vw); box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        h3 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
        .report-reasons { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
        .reason-btn {
          padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.8rem;
          border: 1.5px solid #dee2e6; background: white; cursor: pointer;
        }
        .reason-btn.selected { border-color: #0d6efd; background: #e7f0ff; color: #0d6efd; }
        .report-note {
          width: 100%; padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 6px;
          font-size: 0.85rem; resize: none; margin-bottom: 1rem;
        }
        .report-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
        .report-cancel-btn {
          padding: 0.5rem 1rem; border-radius: 6px; border: 1.5px solid #dee2e6;
          background: white; cursor: pointer; font-size: 0.875rem;
        }
        .report-submit-btn {
          padding: 0.5rem 1rem; border-radius: 6px; border: none;
          background: #0d6efd; color: white; cursor: pointer; font-size: 0.875rem;
        }
        .report-thanks { text-align: center; padding: 1rem 0; font-size: 1rem; }
        .report-close-btn {
          display: block; width: 100%; padding: 0.6rem; margin-top: 0.5rem;
          border-radius: 6px; border: 1.5px solid #dee2e6; background: white;
          cursor: pointer; font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
