// src/lib/providers/__tests__/index.test.ts
import { createCallWithFallback, getRegisteredProviders, getProviderById } from "../index";
import type { AIProvider } from "../types";

const makeProvider = (id: string, fn: jest.Mock): AIProvider => ({
  id,
  name: `Provider ${id}`,
  model: `model-${id}`,
  generateContent: fn,
});

test("callWithFallback returns text and providerId from first provider", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const fn = createCallWithFallback([makeProvider("a", mockA)]);
  const result = await fn("hello");
  expect(result).toEqual({ text: "result-a", providerId: "a" });
});

test("callWithFallback prefers provider matching preferredId", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello", "b");
  expect(result).toEqual({ text: "result-b", providerId: "b" });
  expect(mockA).not.toHaveBeenCalled();
});

test("callWithFallback falls back on 429", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 429 });
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello");
  expect(result).toEqual({ text: "result-b", providerId: "b" });
});

test("callWithFallback falls back on 503", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 503 });
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello");
  expect(result.providerId).toBe("b");
});

test("callWithFallback throws immediately on 401", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 401 });
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  await expect(fn("hello")).rejects.toMatchObject({ status: 401 });
  expect(mockB).not.toHaveBeenCalled();
});

test("callWithFallback throws when all providers fail with 429", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 429 });
  const mockB = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 429 });
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  await expect(fn("hello")).rejects.toMatchObject({ status: 429 });
});

test("callWithFallback throws when no providers configured", async () => {
  const fn = createCallWithFallback([]);
  await expect(fn("hello")).rejects.toThrow("No AI providers configured");
});

test("getRegisteredProviders returns ProviderInfo without generateContent when GEMINI_API_KEY is set", () => {
  // Use jest module isolation to test with an env var set
  jest.resetModules();
  process.env.GEMINI_API_KEY = "test-key";
  const { getRegisteredProviders: getProviders } = require("../index") as typeof import("../index");
  const providers = getProviders();
  expect(providers.length).toBeGreaterThan(0);
  providers.forEach((p) => {
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("name");
    expect(p).toHaveProperty("model");
    expect(p).not.toHaveProperty("generateContent");
  });
  delete process.env.GEMINI_API_KEY;
  jest.resetModules();
});

test("registers the opencode provider when OPENCODE_API_KEY is set", () => {
  jest.resetModules();
  process.env.OPENCODE_API_KEY = "oc_test_key";
  try {
    const { getRegisteredProviders: getProviders } = require("../index") as typeof import("../index");
    const opencode = getProviders().find((p) => p.id === "opencode");
    expect(opencode).toEqual({
      id: "opencode",
      name: "OpenCode Go",
      model: "glm-5.3-flash",
    });
  } finally {
    delete process.env.OPENCODE_API_KEY;
    jest.resetModules();
  }
});

test("callWithFallback skips disabled providers", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  const result = await fn("hello", undefined, ["a"]);
  expect(result).toEqual({ text: "result-b", providerId: "b" });
  expect(mockA).not.toHaveBeenCalled();
});

test("callWithFallback throws when all providers are disabled", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const fn = createCallWithFallback([makeProvider("a", mockA)]);
  await expect(fn("hello", undefined, ["a"])).rejects.toThrow("No AI providers configured");
});

test("callWithFallback preferred provider still respects disabledIds", async () => {
  const mockA = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-a");
  const mockB = jest.fn<Promise<string>, [string]>().mockResolvedValue("result-b");
  const fn = createCallWithFallback([makeProvider("a", mockA), makeProvider("b", mockB)]);
  // prefer "a" but "a" is disabled → should use "b"
  const result = await fn("hello", "a", ["a"]);
  expect(result).toEqual({ text: "result-b", providerId: "b" });
  expect(mockA).not.toHaveBeenCalled();
});

test("getProviderById returns undefined for unknown id", () => {
  expect(getProviderById("nonexistent")).toBeUndefined();
});

test("callWithFallback falls back on a retired model (404) and on network errors without a status", async () => {
  const gone = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 404 });
  const offline = jest.fn<Promise<string>, [string]>().mockRejectedValue(new TypeError("fetch failed"));
  const ok = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  const result = await createCallWithFallback([makeProvider("a", gone), makeProvider("b", offline), makeProvider("c", ok)])("hello");
  expect(result).toEqual({ text: "ok", providerId: "c" });
});

test("callWithFallback falls back when a provider needs billing (402)", async () => {
  const billing = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 402 });
  const ok = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  const result = await createCallWithFallback([makeProvider("a", billing), makeProvider("b", ok)])("hello");
  expect(result).toEqual({ text: "ok", providerId: "b" });
});

test("callWithFallback still throws on non-retryable client errors", async () => {
  const bad = jest.fn<Promise<string>, [string]>().mockRejectedValue({ status: 400 });
  const ok = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
  await expect(createCallWithFallback([makeProvider("a", bad), makeProvider("b", ok)])("hello")).rejects.toEqual({ status: 400 });
  expect(ok).not.toHaveBeenCalled();
});

test("callWithFallback abandons a provider that hangs and falls back", async () => {
  jest.useFakeTimers();
  try {
    const hang = jest.fn<Promise<string>, [string]>().mockReturnValue(new Promise(() => {}));
    const ok = jest.fn<Promise<string>, [string]>().mockResolvedValue("ok");
    const pending = createCallWithFallback([makeProvider("a", hang), makeProvider("b", ok)])("hello");
    await jest.advanceTimersByTimeAsync(25_000);
    expect(await pending).toEqual({ text: "ok", providerId: "b" });
  } finally {
    jest.useRealTimers();
  }
});
