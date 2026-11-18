// src/lib/useApiFetch.ts
"use client";

import { useCallback } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function useApiFetch() {
  const { currentProvider, setProvider, disabledProviders } = useProvider();

  const fetchWithProvider = useCallback(
    async (url: string, body: Record<string, unknown>, init?: RequestInit): Promise<Response> => {
      const res = await fetch(url, {
        ...init,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, provider: currentProvider, disabledProviders }),
      });
      const usedProvider = res.headers.get("X-Provider-Used");
      if (usedProvider && usedProvider !== currentProvider) {
        setProvider(usedProvider);
      }
      return res;
    },
    [currentProvider, setProvider, disabledProviders]
  );

  return { fetchWithProvider };
}
