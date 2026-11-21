// src/lib/useApiFetch.ts
"use client";

import { useCallback } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function useApiFetch() {
  const { currentProvider, setProvider, disabledProviders } = useProvider();

  const fetchWithProvider = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      init?: RequestInit,
      // auto: the route picks its own provider (e.g. translation prefers the fastest) and the learner's
      // chosen provider is left alone; only disabledProviders is sent.
      opts?: { auto?: boolean }
    ): Promise<Response> => {
      const res = await fetch(url, {
        ...init,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...(!opts?.auto && { provider: currentProvider }), disabledProviders }),
      });
      const usedProvider = res.headers.get("X-Provider-Used");
      if (!opts?.auto && usedProvider && usedProvider !== currentProvider) {
        setProvider(usedProvider);
      }
      return res;
    },
    [currentProvider, setProvider, disabledProviders]
  );

  return { fetchWithProvider };
}
