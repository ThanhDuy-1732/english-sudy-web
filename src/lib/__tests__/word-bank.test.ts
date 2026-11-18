import {
  WORD_BANK_LIMIT,
  addBankWords,
  countBank,
  getBank,
  getKnownWordSet,
  getUnseen,
  markBankWordsSeen,
  normalizeWord,
  pickExcludeSample,
  takeUnseen,
} from "../word-bank";

const bankWord = (word: string, topic = "TOEIC", extra: Record<string, unknown> = {}) => ({
  word,
  meaning: `nghĩa ${word}`,
  topic,
  createdAt: "2026-11-01T00:00:00.000Z",
  ...extra,
});

beforeEach(() => localStorage.clear());

test("normalizeWord gộp khoảng trắng và hạ chữ", () => {
  expect(normalizeWord("  Take   Off ")).toBe("take off");
});

test("addBankWords bỏ từ trùng trong batch, trong bank và trong learnedWords", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("invoice")]));
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "Deadline" }]));
  const result = addBankWords([
    bankWord("Invoice"),
    bankWord("invoice "),
    bankWord("deadline"),
    bankWord("launch"),
    bankWord("launch"),
  ]);
  expect(result).toEqual({ added: 1, persisted: true });
  expect(getBank().map((w) => w.word)).toContain("launch");
});

test("addBankWords giữ batch trong bộ nhớ khi ghi localStorage lỗi", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  expect(addBankWords([bankWord("alpha"), bankWord("beta")])).toEqual({ added: 2, persisted: false });
  expect(getBank().map((w) => w.word)).toEqual(["alpha", "beta"]);
  spy.mockRestore();
  expect(addBankWords([bankWord("gamma")]).persisted).toBe(true);
  expect(getBank().map((w) => w.word)).toEqual(["alpha", "beta", "gamma"]);
});

test("getUnseen chỉ trả từ chưa xem đúng chủ đề, cũ trước", () => {
  localStorage.setItem(
    "wordBank",
    JSON.stringify([
      bankWord("a", "TOEIC", { createdAt: "2026-11-02T00:00:00.000Z" }),
      bankWord("b", "IELTS"),
      bankWord("c", "TOEIC", { createdAt: "2026-11-01T00:00:00.000Z" }),
      bankWord("d", "TOEIC", { seenAt: "2026-11-03T00:00:00.000Z" }),
    ])
  );
  expect(getUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["c", "a"]);
});

test("getUnseen và countBank ẩn từ đã lưu trong learnedWords", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("alpha"), bankWord("beta")]));
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "Alpha" }]));
  expect(getUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["beta"]);
  expect(countBank("TOEIC")).toBe(1);
});

test("markBankWordsSeen đánh dấu không phân biệt hoa thường", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("Alpha"), bankWord("beta")]));
  markBankWordsSeen(["ALPHA"]);
  expect(getBank()[0].seenAt).toBeTruthy();
  expect(getBank()[1].seenAt).toBeUndefined();
});

test("takeUnseen đánh dấu đã xem và không trả lại lần sau", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("a"), bankWord("b")]));
  expect(takeUnseen("TOEIC", 1).map((w) => w.word)).toEqual(["a"]);
  expect(takeUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["b"]);
});

test("bank giới hạn WORD_BANK_LIMIT, bỏ cũ nhất", () => {
  const entries = Array.from({ length: WORD_BANK_LIMIT }, (_, i) =>
    bankWord(`w${i}`, "TOEIC", {
      createdAt: `2026-11-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
    })
  );
  localStorage.setItem("wordBank", JSON.stringify(entries));
  addBankWords([bankWord("last")]);
  const words = getBank().map((w) => w.word);
  expect(words).toHaveLength(WORD_BANK_LIMIT);
  expect(words[0]).toBe("w1");
  expect(words.at(-1)).toBe("last");
});

test("đọc JSON hỏng trả mảng rỗng", () => {
  localStorage.setItem("wordBank", "{}");
  expect(getBank()).toEqual([]);
});

test("pickExcludeSample tối đa max, ưu tiên từ mới và không trùng", () => {
  const entries = Array.from({ length: 300 }, (_, i) => bankWord(`w${i}`));
  localStorage.setItem("wordBank", JSON.stringify(entries));
  const sample = pickExcludeSample("TOEIC", 200);
  expect(sample).toHaveLength(200);
  expect(new Set(sample).size).toBe(200);
  expect(sample).toContain("w299");
  // 120 từ mới nhất luôn có mặt; phần còn lại lấy ngẫu nhiên từ 180 từ cũ.
  expect(sample.some((word) => Number(word.slice(1)) < 180)).toBe(true);
});

test("getKnownWordSet gồm bank và learnedWords", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("alpha")]));
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "Beta" }]));
  expect([...getKnownWordSet()].sort()).toEqual(["alpha", "beta"]);
});

test("không crash khi learnedWords có phần tử thiếu word", () => {
  localStorage.setItem("learnedWords", JSON.stringify([{ meaning: "x" }, { word: "Alpha" }]));
  localStorage.setItem("wordBank", JSON.stringify([bankWord("alpha"), bankWord("beta")]));

  expect(() => countBank("TOEIC")).not.toThrow();
  expect(getUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["beta"]);
  expect([...getKnownWordSet()].sort()).toEqual(["alpha", "beta"]);
  expect(addBankWords([bankWord("gamma")]).added).toBe(1);
  expect(pickExcludeSample("TOEIC", 10)).toEqual(expect.arrayContaining(["beta"]));
});
