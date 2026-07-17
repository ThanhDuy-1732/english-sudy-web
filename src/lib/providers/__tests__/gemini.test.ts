// src/lib/providers/__tests__/gemini.test.ts
const mockGenerateContent = jest.fn();
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({ generateContent: mockGenerateContent }),
  })),
}));

import { GeminiProvider } from "../gemini";

beforeEach(() => mockGenerateContent.mockReset());

const provider = new GeminiProvider("test-key", "gemini-flash-latest");

test("generateContent returns response text", async () => {
  mockGenerateContent.mockResolvedValue({ response: { text: () => "hello" } });
  expect(await provider.generateContent("test prompt")).toBe("hello");
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("generateContent retries once on 429", async () => {
  mockGenerateContent
    .mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce({ response: { text: () => "hello after retry" } });
  expect(await provider.generateContent("test")).toBe("hello after retry");
  expect(mockGenerateContent).toHaveBeenCalledTimes(2);
});

test("generateContent throws immediately on 401", async () => {
  mockGenerateContent.mockRejectedValue({ status: 401 });
  await expect(provider.generateContent("test")).rejects.toMatchObject({ status: 401 });
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("provider has correct metadata", () => {
  expect(provider.id).toBe("gemini");
  expect(provider.model).toBe("gemini-flash-latest");
});
