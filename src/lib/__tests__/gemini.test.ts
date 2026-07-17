// src/lib/__tests__/gemini.test.ts
import {
  generateWords,
  generateSentence,
  generateSynonyms,
  gradeSentence,
  generateFillBlank,
  generateWordsBatch,
  generateReading,
} from "../gemini";

const mockFn = jest.fn<Promise<string>, [string]>();

beforeEach(() => mockFn.mockReset());

// generateWords
test("generateWords returns parsed word array", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán" }];
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateWords("TOEIC", mockFn)).toEqual(payload);
  expect(mockFn).toHaveBeenCalledTimes(1);
});

test("generateWords strips JSON code fence", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán" }];
  mockFn.mockResolvedValue("```json\n" + JSON.stringify(payload) + "\n```");
  expect(await generateWords("TOEIC", mockFn)).toEqual(payload);
});

test("generateWords throws on malformed JSON", async () => {
  mockFn.mockResolvedValue("not json");
  await expect(generateWords("TOEIC", mockFn)).rejects.toThrow("Gemini returned invalid JSON");
});

// generateSentence
test("generateSentence returns trimmed text", async () => {
  mockFn.mockResolvedValue("  We need to negotiate.  ");
  expect(await generateSentence("negotiate", mockFn)).toBe("We need to negotiate.");
});

// generateSynonyms
test("generateSynonyms returns parsed result", async () => {
  const payload = { synonyms: ["discuss"], antonyms: ["avoid"] };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateSynonyms("negotiate", mockFn)).toEqual(payload);
});

test("generateSynonyms returns empty arrays on parse failure", async () => {
  mockFn.mockResolvedValue("bad json");
  expect(await generateSynonyms("negotiate", mockFn)).toEqual({ synonyms: [], antonyms: [] });
});

// gradeSentence
test("gradeSentence returns parsed result", async () => {
  const payload = { score: 8, feedback: "Tốt", corrected: "We negotiate daily." };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await gradeSentence("negotiate", "We negotiate daily.", mockFn)).toEqual(payload);
});

test("gradeSentence throws on malformed JSON", async () => {
  mockFn.mockResolvedValue("bad");
  await expect(gradeSentence("negotiate", "We negotiate.", mockFn)).rejects.toThrow(
    "Gemini returned invalid JSON for gradeSentence"
  );
});

// generateFillBlank
test("generateFillBlank returns sentence with blank", async () => {
  const payload = { sentence: "We need to _____ the deal." };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateFillBlank("negotiate", mockFn)).toEqual(payload);
});

// generateWordsBatch
test("generateWordsBatch returns parsed array", async () => {
  const payload = [{ word: "negotiate", meaning: "đàm phán", example: "They negotiate." }];
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateWordsBatch(["negotiate"], mockFn)).toEqual(payload);
});

// generateReading
test("generateReading returns passage and questions", async () => {
  const payload = {
    passage: "They negotiate terms...",
    questions: [{ question: "What?", options: ["A. X", "B. Y", "C. Z"], answer: "A" }],
  };
  mockFn.mockResolvedValue(JSON.stringify(payload));
  expect(await generateReading(["negotiate"], mockFn)).toEqual(payload);
});
