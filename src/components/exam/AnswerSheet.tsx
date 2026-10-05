"use client";

interface Props {
  total: number;
  answered: Set<number>;
  flagged: Set<string>;
  questionIds: string[];
  current: number;
  onJump: (index: number) => void;
}

export default function AnswerSheet({
  total,
  answered,
  flagged,
  questionIds,
  current,
  onJump,
}: Props) {
  return (
    <div className="answer-sheet">
      <p className="sheet-title">Phiếu trả lời</p>
      <div className="grid">
        {Array.from({ length: total }, (_, i) => {
          const qid = questionIds[i];
          const isAnswered = answered.has(i);
          const isFlagged = flagged.has(qid);
          const isCurrent = i === current;
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={[
                "cell",
                isCurrent ? "current" : "",
                isAnswered ? "answered" : "",
                isFlagged ? "flagged" : "",
              ].filter(Boolean).join(" ")}
              title={`Câu ${i + 1}${isFlagged ? " (đánh dấu)" : ""}${isAnswered ? " (đã trả lời)" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="legend">
        <span className="dot answered" /> Đã trả lời &nbsp;
        <span className="dot flagged" /> Đánh dấu
      </p>
      <style jsx>{`
        .answer-sheet { padding: 0.75rem; }
        .sheet-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6c757d; margin-bottom: 0.5rem; }
        .grid { display: flex; flex-wrap: wrap; gap: 4px; }
        .cell {
          width: 32px; height: 32px;
          border: 1.5px solid #dee2e6;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 0.75rem;
          color: #495057;
        }
        .cell.current { border-color: #0d6efd; background: #e8f0fe; font-weight: 700; }
        .cell.answered { background: #d1e7dd; border-color: #198754; color: #0a3622; }
        .cell.flagged { border-color: #ffc107 !important; background: #fff3cd !important; }
        .legend { font-size: 0.75rem; color: #6c757d; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.25rem; }
        .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 2px; }
        .dot.answered { background: #d1e7dd; border: 1.5px solid #198754; }
        .dot.flagged { background: #fff3cd; border: 1.5px solid #ffc107; }
        /* dark theme: light surfaces */
        :global(:root[data-theme="dark"]) .cell.current { background: rgba(59, 130, 246, 0.2); color: #bfdbfe; }
        :global(:root[data-theme="dark"]) .cell.answered { background: rgba(34, 197, 94, 0.16); color: #86efac; }
        :global(:root[data-theme="dark"]) .cell.flagged { background: rgba(234, 179, 8, 0.18); color: #fde68a; }
        :global(:root[data-theme="dark"]) .dot.answered { background: rgba(34, 197, 94, 0.16); color: #86efac; }
        :global(:root[data-theme="dark"]) .dot.flagged { background: rgba(234, 179, 8, 0.18); color: #fde68a; }
      `}</style>
    </div>
  );
}
