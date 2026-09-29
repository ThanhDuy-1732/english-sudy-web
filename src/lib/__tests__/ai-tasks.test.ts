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
    {}
  );
  expect(result.text).toBe("mock response");
});

test("getTaskProviderMap returns a map with all task names", () => {
  const map = getTaskProviderMap();
  expect(map["word-generation"]).toBeDefined();
  expect(map["speaking-grade"]).toBeDefined();
  expect(map["writing-grade"]).toBeDefined();
});
