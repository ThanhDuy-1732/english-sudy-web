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

test("generateWords asks the model to avoid excluded words", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ word: "launch", meaning: "ra mắt" }]));
  await generateWords("TOEIC", mockFn, { exclude: ["negotiate", "invoice"] });
  expect(mockFn.mock.calls[0][0]).toContain("negotiate, invoice");
});

test("generateWords drops excluded words and asks once for replacements", async () => {
  mockFn
    .mockResolvedValueOnce(
      JSON.stringify([
        { word: "Negotiate", meaning: "đàm phán" },
        { word: "invoice", meaning: "hoá đơn" },
        { word: "launch", meaning: "ra mắt" },
      ])
    )
    .mockResolvedValueOnce(JSON.stringify([{ word: "deadline", meaning: "hạn chót" }]));

  const words = await generateWords("TOEIC", mockFn, { exclude: ["negotiate"], count: 3 });

  expect(words.map((w) => w.word)).toEqual(["invoice", "launch", "deadline"]);
  expect(mockFn).toHaveBeenCalledTimes(2);
  expect(mockFn.mock.calls[1][0]).toContain("negotiate");
});

test("generateWords keeps the first batch when the replacement call fails", async () => {
  mockFn
    .mockResolvedValueOnce(
      JSON.stringify([
        { word: "negotiate", meaning: "đàm phán" },
        { word: "invoice", meaning: "hoá đơn" },
      ])
    )
    .mockResolvedValueOnce("not json");

  const words = await generateWords("TOEIC", mockFn, { exclude: ["negotiate"], count: 3 });

  expect(words.map((w) => w.word)).toEqual(["invoice"]);
});

test("generateWords đưa count và knownCount vào prompt", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ word: "launch", meaning: "ra mắt" }]));
  await generateWords("TOEIC", mockFn, { count: 20, knownCount: 640 });
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("Generate 20 English");
  expect(prompt).toContain("already knows 640 words");
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

test("generateWords with the random topic asks for a mix of everyday topics, not a 'Random' theme", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ word: "umbrella", meaning: "cái ô" }]));
  await generateWords("Random", mockFn);
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("many different everyday topics");
  expect(prompt).not.toContain('topic "Random"');
});
