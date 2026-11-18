"use client";

import { useEffect, useState } from "react";
import { useWordJob } from "@/contexts/WordJobContext";
import { countBank } from "@/lib/word-bank";

const FORMAT = new Intl.NumberFormat("vi-VN");
const TARGETS = [100, 300, 1000];

export function WordBankPanel({ topic }: { topic: string }) {
  const { job, count, isOwner, startJob } = useWordJob();
  const [target, setTarget] = useState(1000);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const available = mounted ? countBank(topic) : 0;
  const busy = Boolean(job && job.status === "running" && (!isOwner || job.topic !== topic));
  const done = job?.topic === topic && job.status === "done";
  const paused = job?.topic === topic && job.status === "paused";

  return (
    <section
      aria-label="Tạo trước từ mới"
      className="mt-4 rounded-xl border border-rule bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="text-sm text-muted">
          Ngân hàng:{" "}
          <span className="font-semibold tabular-nums text-ink">{FORMAT.format(available)}</span> từ chưa
          học cho chủ đề này.
        </p>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto" role="group" aria-label="Số từ muốn tạo trước">
          {TARGETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={target === value}
              onClick={() => setTarget(value)}
              className={`min-h-9 rounded-2xl border px-3 text-sm tabular-nums transition-colors ${
                target === value
                  ? "border-primary bg-primary/10 text-ink"
                  : "border-rule text-muted hover:border-primary"
              }`}
            >
              {FORMAT.format(value)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => startJob(topic, target)}
            disabled={busy}
            className="btn btn-primary px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bắt đầu
          </button>
        </div>
      </div>

      {busy && (
        <p className="mt-2 text-xs text-muted">
          Đang có job khác chạy. Dừng job đó trước khi tạo job mới.
        </p>
      )}
      {done && (
        <p className="mt-2 text-sm text-ok">
          Đã đủ {FORMAT.format(job.target)} từ cho chủ đề này.
        </p>
      )}
      {paused && (
        <p className="mt-2 text-sm text-muted">
          Đang có {FORMAT.format(count)}/{FORMAT.format(job.target)} từ — dùng “Chạy tiếp” ở thanh trên.
          {job.lastError ? ` ${job.lastError}` : ""}
        </p>
      )}
    </section>
  );
}
