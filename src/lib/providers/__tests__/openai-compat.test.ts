// src/lib/providers/__tests__/openai-compat.test.ts
const mockCreate = jest.fn();
jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }))
);

import { OpenAICompatProvider } from "../openai-compat";
import OpenAI from "openai";

beforeEach(() => mockCreate.mockReset());

const OpenAIMock = OpenAI as unknown as jest.Mock;

const provider = new OpenAICompatProvider({
  id: "groq",
  name: "Groq",
  apiKey: "test-key",
  model: "llama-3.3-70b-versatile",
  baseURL: "https://api.groq.com/openai/v1",
});

test("generateContent returns message content", async () => {
  mockCreate.mockResolvedValue({ choices: [{ message: { content: "hello from groq" } }] });
  expect(await provider.generateContent("test prompt")).toBe("hello from groq");
  expect(mockCreate).toHaveBeenCalledWith({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "test prompt" }],
  }, { signal: undefined });
});

test("generateContent returns empty string when content is null", async () => {
  mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });
  expect(await provider.generateContent("test")).toBe("");
});

test("provider has correct metadata", () => {
  expect(provider.id).toBe("groq");
  expect(provider.name).toBe("Groq");
  expect(provider.model).toBe("llama-3.3-70b-versatile");
});

test("passes defaultHeaders to the client when configured", () => {
  new OpenAICompatProvider({
    id: "opencode",
    name: "OpenCode Go",
    apiKey: "test-key",
    model: "deepseek-v4.1-flash",
    baseURL: "https://opencode.ai/inference/go",
    defaultHeaders: { "x-opencode-session": "ses_test" },
  });

  const options = OpenAIMock.mock.calls.at(-1)?.[0];
  expect(options.baseURL).toBe("https://opencode.ai/inference/go");
  expect(options.defaultHeaders).toEqual({ "x-opencode-session": "ses_test" });
});

test("omits defaultHeaders when none are configured", () => {
  new OpenAICompatProvider({
    id: "groq",
    name: "Groq",
    apiKey: "test-key",
    model: "llama-3.3-70b-versatile",
    baseURL: "https://api.groq.com/openai/v1",
  });

  const options = OpenAIMock.mock.calls.at(-1)?.[0];
  expect("defaultHeaders" in options).toBe(false);
});

test("sends reasoning_effort only to providers that support it", async () => {
  mockCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
  const base = { id: "x", name: "X", apiKey: "k", model: "m", baseURL: "https://x" };
  await new OpenAICompatProvider({ ...base, supportsEffort: true }).generateContent("p", { effort: "low" });
  expect(mockCreate.mock.calls.at(-1)?.[0]).toMatchObject({ reasoning_effort: "low" });
  await new OpenAICompatProvider(base).generateContent("p", { effort: "low" });
  expect(mockCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty("reasoning_effort");
});
