"use client";

import { useCountdown } from "@/lib/useCountdown";

interface Props {
  totalSeconds: number;
  onTimeUp?: () => void;
}

/**
 * Countdown timer for exam attempts.
 * Deliberately separate from TimerContext (which tracks total study time).
 */
export default function ExamTimer({ totalSeconds, onTimeUp }: Props) {
  const remaining = useCountdown(totalSeconds, true, onTimeUp);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining < 300; // last 5 minutes

  return (
    <div className={`exam-timer ${urgent ? "urgent" : ""}`}>
      ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      <style jsx>{`
        .exam-timer {
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          font-size: 1rem;
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          background: #f8f9fa;
          border: 1.5px solid #dee2e6;
          color: #495057;
        }
        .exam-timer.urgent { color: #dc3545; border-color: #dc3545; background: #fff5f5; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
}
