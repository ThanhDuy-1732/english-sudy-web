"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTimer } from "@/contexts/TimerContext";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

function SetCountdownModal({ onClose }: { onClose: () => void }) {
  const { startCountdown } = useTimer();
  const [minutes, setMinutes] = useState(25);

  function handleStart() {
    if (minutes < 1) return;
    startCountdown(minutes * 60);
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Đặt thời gian học">
        <div className="w-[calc(100vw-2rem)] max-w-[20rem] rounded-2xl border border-rule bg-paper canvas-surface p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-ink">Đặt thời gian học</h2>
          <div className="mb-4 flex gap-2">
            {[10, 25, 45].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMinutes(preset)}
                aria-pressed={minutes === preset}
                className={`chip flex-1 ${minutes === preset ? "chip-on" : ""}`}
              >
                {preset} phút
              </button>
            ))}
          </div>
          <label className="mb-4 block text-sm text-muted">
            Hoặc nhập số phút:
            <input
              type="number"
              min="1"
              max="180"
              value={minutes}
              onChange={(event) => setMinutes(Math.max(1, Number(event.target.value)))}
              className="field mt-1 w-full"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Hủy
            </button>
            <button type="button" onClick={handleStart} className="btn btn-primary flex-1">
              Bắt đầu
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function TimeUpModal() {
  const { countdownTarget, todaySeconds, startCountdown, clearTimeUp } = useTimer();
  const targetMinutes = Math.round((countdownTarget ?? 0) / 60);
  const studiedMinutes = Math.round(todaySeconds / 60);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Hết giờ">
        <div className="w-[calc(100vw-2rem)] max-w-[20rem] rounded-2xl border border-rule bg-paper canvas-surface p-6 text-center shadow-xl">
          <h2 className="mb-2 text-lg font-semibold text-ink">Hết giờ rồi!</h2>
          <p className="mb-6 text-sm text-muted">
            Bạn đã học <strong className="text-ink">{studiedMinutes} phút</strong> hôm nay.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={clearTimeUp} className="btn btn-secondary flex-1">
              Nghỉ thôi
            </button>
            {targetMinutes > 0 && (
              <button
                type="button"
                onClick={() => { startCountdown(countdownTarget!); }}
                className="btn btn-primary flex-1"
              >
                Học thêm {targetMinutes} phút
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function HeaderTimer() {
  const { todaySeconds, isRunning, isCountdownMode, countdownRemaining, showTimeUp, pause, resume } = useTimer();
  const [showSetModal, setShowSetModal] = useState(false);

  const displaySeconds = isCountdownMode && countdownRemaining !== null ? countdownRemaining : todaySeconds;
  const icon = !isRunning ? "⏸" : isCountdownMode ? "⏳" : "⏱";

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={isRunning ? pause : resume}
          className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-2 text-sm font-medium tabular-nums transition-colors hover:bg-ink/5 ${
            !isRunning ? "text-ink opacity-50" : isCountdownMode ? "text-primary" : "text-ink"
          }`}
          aria-label={isRunning ? "Tạm dừng timer" : "Tiếp tục timer"}
        >
          {icon} {formatTime(displaySeconds)}
        </button>
        <button
          type="button"
          onClick={() => setShowSetModal(true)}
          className="inline-flex min-h-11 items-center px-1 text-sm text-muted transition-colors hover:text-ink"
          aria-label="Đặt countdown"
        >
          ＋
        </button>
      </div>
      {showSetModal && <SetCountdownModal onClose={() => setShowSetModal(false)} />}
      {showTimeUp && <TimeUpModal />}
    </>
  );
}
