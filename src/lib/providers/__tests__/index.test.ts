// src/lib/providers/__tests__/index.test.ts
import { createCallWithFallback, getRegisteredProviders } from "../index";
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

test("getRegisteredProviders returns only safe fields", () => {
  const providers = getRegisteredProviders();
  providers.forEach((p) => {
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("name");
    expect(p).toHaveProperty("model");
    expect(p).not.toHaveProperty("generateContent");
  });
});
