import {
  getConversationPair,
  setConversationPair,
  parseImageTranslation,
  whisperLang,
  TONES,
  TRANSLATE_INFO,
  TRANSLATE_LANGS,
  addHistory,
  getHistory,
  getTranslatePair,
  parseTranslation,
  setTranslatePair,
  type HistoryEntry,
} from "../translate";

beforeEach(() => localStorage.clear());

test("danh sách ngôn ngữ, thông tin và nhãn sắc thái theo đặc tả", () => {
  expect(TRANSLATE_LANGS).toEqual(["vi", "en", "zh", "ja", "ko"]);
  expect(TRANSLATE_INFO.vi).toMatchObject({ label: "Tiếng Việt", native: "Tiếng Việt", voice: "vi-VN", htmlLang: "vi" });
  expect(TRANSLATE_INFO.zh).toMatchObject({ label: "Tiếng Trung", voice: "zh-CN" });
  expect(TONES.map((tone) => tone.label)).toEqual(["Thân mật", "Lịch sự", "Trang trọng"]);
});

test("parseTranslation giữ các sắc thái đã biết theo đúng thứ tự", () => {
  const parsed = parseTranslation({
    detected: "zh",
    vietnamese: "Xin chào",
    results: [
      { tone: "formal", text: "您好", note: "trang trọng" },
      { tone: "casual", text: "你好", note: "thân mật" },
      { tone: "slang", text: "嗨" },
      { tone: "casual", text: "哈喽", note: "thân mật khác" },
    ],
  });
  expect(parsed?.results.map((r) => r.tone)).toEqual(["casual", "formal"]);
  expect(parsed?.results[0].text).toBe("你好");
  expect(parsed?.results[0].reading).toBeUndefined();
});

test("parseTranslation từ chối khi không còn kết quả hoặc ngôn ngữ nhận diện lạ", () => {
  expect(parseTranslation({ detected: "zh", vietnamese: "a", results: [{ tone: "casual", text: "" }] })).toBeNull();
  expect(parseTranslation({ detected: "fr", vietnamese: "a", results: [{ tone: "casual", text: "ok" }] })).toBeNull();
  expect(parseTranslation({ detected: "zh", vietnamese: "a", results: "not an array" })).toBeNull();
  expect(parseTranslation(null)).toBeNull();
});

test("parseTranslation giữ cách đọc và ghi chú khi hợp lệ", () => {
  const parsed = parseTranslation({
    detected: "ja",
    vietnamese: "Cảm ơn",
    results: [{ tone: "polite", text: "ありがとうございます", reading: "arigatō gozaimasu", note: "Lịch sự hằng ngày." }],
  });
  expect(parsed?.results[0]).toEqual({
    tone: "polite",
    text: "ありがとうございます",
    reading: "arigatō gozaimasu",
    note: "Lịch sự hằng ngày.",
  });
});

test("lịch sử bỏ qua mục hỏng thay vì làm sập trang", () => {
  localStorage.setItem(
    "translationHistory",
    JSON.stringify([
      {
        id: "ok",
        from: "vi",
        to: "zh",
        text: "Xin chào",
        translation: { detected: "vi", vietnamese: "v", results: [] },
        at: new Date().toISOString(),
      },
      { id: "bad-lang", from: "fr", to: "zh", text: "x", translation: { detected: "vi", vietnamese: "", results: [] }, at: "" },
      null,
      { id: "bad-detected", from: "auto", to: "zh", text: "y", translation: { detected: 5, vietnamese: "", results: [] }, at: "" },
      { id: "bad-text", from: "vi", to: "zh", text: "", translation: { detected: "vi", vietnamese: "", results: [] }, at: "" },
    ])
  );
  expect(getHistory().map((entry) => entry.id)).toEqual(["ok"]);
});

test("lịch sử giữ 20 mục mới nhất trước và thay thế cùng văn bản + đích", () => {  const entry = (i: number): HistoryEntry => ({
    id: `id${i}`,
    from: "vi",
    to: "en",
    text: `t${i}`,
    translation: { detected: "en", vietnamese: "v", results: [] },
    at: new Date(2026, 10, 19, 0, i).toISOString(),
  });
  for (let i = 0; i < 25; i++) addHistory(entry(i));

  const list = getHistory();
  expect(list).toHaveLength(20);
  expect(list[0].text).toBe("t24");

  addHistory({ ...entry(3) });
  const after = getHistory();
  expect(after[0].id).toBe("id3");
  expect(after.filter((item) => item.id === "id3")).toHaveLength(1);
});

test("cặp ngôn ngữ mặc định Việt → Anh và được ghi nhớ", () => {
  expect(getTranslatePair()).toEqual({ from: "vi", to: "en" });
  setTranslatePair({ from: "auto", to: "zh" });
  expect(getTranslatePair()).toEqual({ from: "auto", to: "zh" });
});

test("whisper language names map to codes", () => {
  expect(whisperLang("vietnamese")).toBe("vi");
  expect(whisperLang("english")).toBe("en");
  expect(whisperLang("chinese")).toBe("zh");
  expect(whisperLang("japanese")).toBe("ja");
  expect(whisperLang("korean")).toBe("ko");
  expect(whisperLang("ZH")).toBe("zh");
  expect(whisperLang("french")).toBeNull();
  expect(whisperLang(undefined)).toBeNull();
});

test("parseImageTranslation drops empty lines and returns null when none remain", () => {
  expect(
    parseImageTranslation({
      detected: "zh",
      lines: [
        { text: "出口", translation: "Lối ra", reading: "chūkǒu" },
        { text: "", translation: "x" },
        { text: "入口", translation: " " },
      ],
    })
  ).toEqual({ detected: "zh", lines: [{ text: "出口", translation: "Lối ra", reading: "chūkǒu" }] });
  expect(parseImageTranslation({ detected: "fr", lines: [{ text: "a", translation: "b" }] })).toEqual({
    detected: null,
    lines: [{ text: "a", translation: "b" }],
  });
  expect(parseImageTranslation({ detected: "zh", lines: [] })).toBeNull();
  expect(parseImageTranslation(null)).toBeNull();
});

test("conversation pair defaults to vi and en and is remembered", () => {
  localStorage.clear();
  expect(getConversationPair()).toEqual({ me: "vi", them: "en" });
  setConversationPair({ me: "vi", them: "ko" });
  expect(getConversationPair()).toEqual({ me: "vi", them: "ko" });
  localStorage.setItem("conversationPair", JSON.stringify({ me: "fr", them: "ko" }));
  expect(getConversationPair()).toEqual({ me: "vi", them: "ko" });
});
