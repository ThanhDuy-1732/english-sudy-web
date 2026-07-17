import { renderHook, act } from "@testing-library/react";
import React from "react";
import { useApiFetch } from "../useApiFetch";
import { ProviderContextProvider } from "@/contexts/ProviderContext";

const mockProviders = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b" },
];

function makeHeaders(pairs: Record<string, string>) {
  return { get: (key: string) => pairs[key] ?? null } as unknown as Headers;
}

beforeEach(() => {
  localStorage.clear();
  // Default: providers fetch returns gemini + groq
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockProviders),
    headers: makeHeaders({}),
  }) as jest.Mock;
});

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ProviderContextProvider, null, children);
}

test("fetchWithProvider attaches current provider to request body", async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    headers: makeHeaders({}),
  });

  // First call is the /api/providers load, subsequent calls are AI calls
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProviders),
      headers: makeHeaders({}),
    })
    .mockImplementation(mockFetch);

  const { result } = renderHook(() => useApiFetch(), { wrapper });

  // Wait for provider context to load
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await act(async () => {
    await result.current.fetchWithProvider("/api/generate-words", { topic: "TOEIC" });
  });

  expect(mockFetch).toHaveBeenCalledWith(
    "/api/generate-words",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"provider":"gemini"'),
    })
  );
});

test("fetchWithProvider calls setProvider when X-Provider-Used header differs", async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      // providers fetch
      ok: true,
      json: () => Promise.resolve(mockProviders),
      headers: makeHeaders({}),
    })
    .mockResolvedValueOnce({
      // AI call — server fell back to groq
      ok: true,
      json: () => Promise.resolve({}),
      headers: makeHeaders({ "X-Provider-Used": "groq" }),
    });

  const { result } = renderHook(() => useApiFetch(), { wrapper });

  // Wait for provider context to load (initial fetch)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await act(async () => {
    await result.current.fetchWithProvider("/api/generate-words", { topic: "TOEIC" });
  });

  // Provider should have been updated to groq via the header
  expect(localStorage.getItem("preferredProvider")).toBe("groq");
});

test("fetchWithProvider does not update provider when header matches current", async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProviders),
      headers: makeHeaders({}),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
      headers: makeHeaders({ "X-Provider-Used": "gemini" }),
    });

  const { result } = renderHook(() => useApiFetch(), { wrapper });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await act(async () => {
    await result.current.fetchWithProvider("/api/generate-words", { topic: "TOEIC" });
  });

  // Should still be gemini (unchanged)
  expect(localStorage.getItem("preferredProvider")).toBeNull();
});
