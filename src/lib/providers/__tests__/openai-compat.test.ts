// src/lib/providers/__tests__/openai-compat.test.ts
const mockCreate = jest.fn();
jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }))
);

import { OpenAICompatProvider } from "../openai-compat";

beforeEach(() => mockCreate.mockReset());

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
    temperature: 0.7,
  });
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
