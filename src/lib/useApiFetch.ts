"use client";

import { useCallback } from "react";
import { useProvider } from "@/contexts/ProviderContext";

export function useApiFetch() {
  const { currentProvider, setProvider } = useProvider();

  const fetchWithProvider = useCallback(
    async (url: string, body: Record<string, unknown>): Promise<Response> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, provider: currentProvider }),
      });
      const usedProvider = res.headers.get("X-Provider-Used");
      if (usedProvider && usedProvider !== currentProvider) {
        setProvider(usedProvider);
      }
      return res;
    },
    [currentProvider, setProvider]
  );

  return { fetchWithProvider };
}
