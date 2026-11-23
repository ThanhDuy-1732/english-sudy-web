"use client";

import Link from "next/link";
import { useState } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function ProviderBadge() {
  const { currentProvider, availableProviders, setProvider, unlocked } = useProvider();
  const [open, setOpen] = useState(false);

  const current = availableProviders.find((p) => p.id === currentProvider);
  if (!current) return null;

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Mô hình AI đang dùng" className="flex items-center gap-1 whitespace-nowrap rounded-full border border-rule px-2.5 py-1 text-xs font-medium text-muted hover:border-primary hover:text-ink"
        aria-label="Chọn AI provider"
      >
        {current.name}
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-40 mb-1 min-w-[180px] rounded-2xl border border-rule bg-card shadow-xl">
            {availableProviders.filter((p) => !p.locked || unlocked).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-ink/5 ${
                  p.id === currentProvider ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                {p.id === currentProvider && "✓ "}
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      <Link
        href="/settings"
        className="flex items-center rounded-full p-1 text-muted hover:text-ink"
        title="Cài đặt provider"
        aria-label="Cài đặt provider"
      >
        ⚙️
      </Link>
    </div>
  );
}
