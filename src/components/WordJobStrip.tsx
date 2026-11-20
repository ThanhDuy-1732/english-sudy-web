"use client";

import { useWordJob } from "@/contexts/WordJobContext";
import type { WordJob } from "@/lib/word-job";
import { isEnglishOnly } from "@/lib/word-bank";

const FORMAT = new Intl.NumberFormat("vi-VN");

export interface WordJobStripProps {
  job: WordJob | null;
  count: number;
  isOwner: boolean;
  wordsPerMinute?: number;
  onPause(): void;
  onResume(): void;
  onCancel(): void;
}

export function WordJobStrip({
  job,
  count,
  isOwner,
  wordsPerMinute = 0,
  onPause,
  onResume,
  onCancel,
}: WordJobStripProps) {
  if (!job || job.status === "done") return null;

  const percent = job.target > 0 ? Math.min(100, Math.round((count / job.target) * 100)) : 0;
  const progress = `${FORMAT.format(count)}/${FORMAT.format(job.target)}`;
  // Several languages count meanings (one meaning is a word in each language), as the bank panel does.
  const unit = isEnglishOnly(job.langs ?? ["en"]) ? "từ" : "nghĩa";

  return (
    <div className="border-b border-rule bg-marker/15 px-4 py-2" aria-live="polite">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="min-w-0 flex-1 text-ink">
          {job.status === "running" && isOwner && (
            <>
              Đang tạo {progress} {unit}
              {wordsPerMinute > 0 ? ` · ${wordsPerMinute} ${unit}/phút` : ""}
            </>
          )}
          {job.status === "running" && !isOwner && <>Đang chạy ở tab khác · {progress}</>}
          {job.status === "paused" && (
            <>
              Đã dừng ở {progress} {unit}
              {job.lastError ? ` — ${job.lastError}` : ""}
            </>
          )}
          {job.status === "error" && <>{job.lastError ?? "Job đã dừng do lỗi."}</>}
        </p>

        <div
          className="h-1.5 w-32 overflow-hidden rounded-full bg-rule"
          role="progressbar"
          aria-label={`Tiến trình tạo từ cho ${job.topic}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>

        {job.status === "running" && isOwner && (
          <button type="button" className="btn btn-secondary" onClick={onPause}>
            Dừng
          </button>
        )}
        {job.status === "paused" && (
          <>
            <button type="button" className="btn btn-secondary" onClick={onResume}>
              Chạy tiếp
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Huỷ
            </button>
          </>
        )}
        {job.status === "error" && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Huỷ
          </button>
        )}
      </div>
    </div>
  );
}

/** Connected to the job context; mounted in `layout.tsx` so progress is visible on every page. */
export function WordJobStripConnected() {
  const { job, count, wordsPerMinute, isOwner, pauseJob, resumeJob, cancelJob } = useWordJob();
  return (
    <WordJobStrip
      job={job}
      count={count}
      wordsPerMinute={wordsPerMinute}
      isOwner={isOwner}
      onPause={pauseJob}
      onResume={resumeJob}
      onCancel={cancelJob}
    />
  );
}
