jest.mock("../providers", () => ({
  callWithFallback: jest.fn().mockResolvedValue({ text: "mock response", providerId: "gemini" }),
}));

jest.mock("../ai-metrics", () => ({
  recordMetric: jest.fn(),
}));

import { callTask, getTaskProviderMap } from "../ai-tasks";

test("callTask calls callWithFallback with the prompt", async () => {
  const { callWithFallback } = jest.requireMock("../providers") as {
    callWithFallback: jest.MockedFunction<(p: string, ...args: unknown[]) => Promise<{ text: string; providerId: string }>>;
  };
  const result = await callTask({ task: "word-generation", prompt: "generate 10 words about business" });
  expect(callWithFallback).toHaveBeenCalledWith(
    "generate 10 words about business",
    undefined,
    undefined,
    {},
    expect.any(Function)
  );
  expect(result.text).toBe("mock response");
});

test("getTaskProviderMap returns a map with all task names", () => {
  const map = getTaskProviderMap();
  expect(map["word-generation"]).toBeDefined();
  expect(map["speaking-grade"]).toBeDefined();
  expect(map["writing-grade"]).toBeDefined();
});

test("short tasks get a short provider timeout", async () => {
  const { callWithFallback } = jest.requireMock("../providers") as { callWithFallback: jest.Mock };
  callWithFallback.mockClear();
  await callTask({ task: "vocab-exercise", prompt: "p" });
  expect(callWithFallback.mock.calls[0][3]).toEqual({ timeoutMs: 10_000 });
  await callTask({ task: "exam-generation", prompt: "p" });
  expect(callWithFallback.mock.calls[1][3]).toEqual({});
});
