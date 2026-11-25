// src/lib/__tests__/gemini.test.ts
import {
  generateWords,
  generateSentence,
  generateSynonyms,
  gradeSentence,
  generateFillBlank,
  generateWordsBatch,
  generateReading,
  generateConcepts,
  parseConcepts,
  generateExample,
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
    "AI returned invalid JSON for gradeSentence"
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

// Several languages: concepts
test("parseConcepts drops concepts missing a selected language", () => {
  const text = JSON.stringify([
    { meaning: "hoá đơn", words: { en: { word: "invoice" }, zh: { word: "发票", reading: "fāpiào" } } },
    { meaning: "hợp đồng", words: { en: { word: "contract" } } },
  ]);
  expect(parseConcepts(text, ["en", "zh"])).toEqual([
    { meaning: "hoá đơn", words: { en: { word: "invoice" }, zh: { word: "发票", reading: "fāpiào" } } },
  ]);
});

test("parseConcepts keeps a missing reading as undefined and ignores unasked languages", () => {
  const text = "```json\n" + JSON.stringify([{ meaning: "nước", words: { ja: { word: "水" }, ko: { word: "물", reading: "mul" } } }]) + "\n```";
  expect(parseConcepts(text, ["ja"])).toEqual([{ meaning: "nước", words: { ja: { word: "水" } } }]);
});

test("generateConcepts prompt names each language and excludes per language", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ meaning: "hoá đơn", words: { en: { word: "invoice" }, zh: { word: "发票", reading: "fāpiào" } } }]));
  const concepts = await generateConcepts("TOEIC", ["en", "zh"], mockFn, { count: 1, exclude: { zh: ["合同"] } });
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("pinyin");
  expect(prompt).toContain("合同");
  expect(prompt).toContain("Simplified");
  expect(concepts).toHaveLength(1);
});

test("generateConcepts drops a concept whose word was excluded", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ meaning: "hợp đồng", words: { en: { word: "contract" }, zh: { word: "合同" } } }]));
  expect(await generateConcepts("TOEIC", ["en", "zh"], mockFn, { count: 1, exclude: { zh: ["合同"] } })).toEqual([]);
});

test("generateSentence uses English by default", async () => {
  mockFn.mockResolvedValue("We need to negotiate.");
  await generateSentence("negotiate", mockFn);
  expect(mockFn.mock.calls[0][0]).toContain("English");
});

test("generateExample in Japanese asks for kana and a Vietnamese translation", async () => {
  mockFn.mockResolvedValue(JSON.stringify({ sentence: "水を飲みます。", reading: "みずをのみます。", translation: "Tôi uống nước." }));
  const example = await generateExample("水", "ja", mockFn);
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("Japanese");
  expect(prompt).toContain("kana");
  expect(prompt).toContain("Vietnamese");
  expect(example).toEqual({ sentence: "水を飲みます。", reading: "みずをのみます。", translation: "Tôi uống nước." });
});

test("generateSynonyms names the word's language", async () => {
  mockFn.mockResolvedValue(JSON.stringify({ synonyms: ["学子"], antonyms: [] }));
  await generateSynonyms("学生", mockFn, "zh");
  expect(mockFn.mock.calls[0][0]).toContain("Chinese");
});

// Practice prompts per language
test("generateFillBlank in Chinese asks for pinyin and a Vietnamese translation", async () => {
  mockFn.mockResolvedValue(JSON.stringify({ sentence: "我是_____。", reading: "wǒ shì _____.", translation: "Tôi là học sinh." }));
  const result = await generateFillBlank("学生", mockFn, "zh");
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("Chinese");
  expect(prompt).toContain("pinyin");
  expect(prompt).toContain("Vietnamese");
  expect(result).toEqual({ sentence: "我是_____。", reading: "wǒ shì _____.", translation: "Tôi là học sinh." });
});

test("generateFillBlank in English keeps its prompt", async () => {
  mockFn.mockResolvedValue(JSON.stringify({ sentence: "I _____ them." }));
  await generateFillBlank("greet", mockFn);
  expect(mockFn.mock.calls[0][0]).toBe('Write one natural English sentence using the word "greet". Replace the word "greet" with "_____".\nReturn JSON only: {"sentence": "The sentence with _____ here."}');
});

test("gradeSentence in Korean names Korean and keeps Vietnamese feedback", async () => {
  mockFn.mockResolvedValue(JSON.stringify({ score: 8, feedback: "Tốt.", corrected: "저는 학생입니다." }));
  await gradeSentence("학생", "저는 학생입니다", mockFn, "ko");
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("Korean");
  expect(prompt).toContain("Vietnamese");
});

test("generateReading in Japanese asks for a Japanese passage and a translation", async () => {
  mockFn.mockResolvedValue(JSON.stringify({ passage: "…", questions: [], translation: "…" }));
  await generateReading(["水"], mockFn, "ja");
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("Japanese");
  expect(prompt).toContain("translation");
});

test("generateConcepts names Japanese and Korean in English", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ meaning: "nước", words: { ja: { word: "水", reading: "みず" }, ko: { word: "물", reading: "mul" } } }]));
  await generateConcepts("TOEIC", ["ja", "ko"], mockFn, { count: 1 });
  const prompt = mockFn.mock.calls.at(-1)![0];
  expect(prompt).toContain("- ja: Japanese.");
  expect(prompt).toContain("- ko: Korean.");
  expect(prompt).not.toContain("日本語");
});
