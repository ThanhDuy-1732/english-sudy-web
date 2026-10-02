"use client";

import Link from "next/link";
import { useState } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function ProviderBadge() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  const [open, setOpen] = useState(false);

  const current = availableProviders.find((p) => p.id === currentProvider);
  if (!current) return null;

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
        aria-label="Chọn AI provider"
      >
        ⚡ {current.name}
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-lg border border-white/10 bg-[#2c1f4a] canvas-surface shadow-xl">
            {availableProviders.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 ${
                  p.id === currentProvider ? "font-semibold text-white" : "text-[#b0b0d1]"
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
        className="flex items-center rounded-full p-1 text-[#b0b0d1] hover:text-white"
        title="Cài đặt provider"
        aria-label="Cài đặt provider"
      >
        ⚙️
      </Link>
    </div>
  );
}
