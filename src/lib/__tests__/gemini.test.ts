import { generateSentence, generateWords } from "../gemini";

const mockGenerateContent = jest.fn();

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

beforeEach(() => {
  mockGenerateContent.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

test("generateWords returns parsed word array", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán" }];
  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify(payload) },
  });

  const result = await generateWords("TOEIC");
  expect(result).toEqual(payload);
  expect(mockGenerateContent).toHaveBeenCalledTimes(1);
});

test("generateWords throws descriptive error on malformed JSON", async () => {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => "Sorry, I cannot help with that." },
  });

  await expect(generateWords("TOEIC")).rejects.toThrow(
    "Gemini returned invalid JSON"
  );
});

test("generateSentence returns trimmed string", async () => {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => "  We need to negotiate.  " },
  });

  const result = await generateSentence("negotiate");
  expect(result).toBe("We need to negotiate.");
});
