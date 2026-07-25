import { getCalendarData, getStudyTimePerDay, getTopicDistribution, getWordsForDate, getWordsPerDay } from "../stats";

function mockStorage(words: object[]) {
  localStorage.setItem("learnedWords", JSON.stringify(words));
}

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
});

afterEach(() => jest.useRealTimers());

test("returns one zero-count entry per requested day", () => {
  const result = getWordsPerDay(7);
  expect(result).toHaveLength(7);
  expect(result.every((day) => day.count === 0)).toBe(true);
});

test("counts words by learned date", () => {
  mockStorage([
    { word: "a", learnedAt: "2026-07-16T08:00:00.000Z" },
    { word: "b", learnedAt: "2026-07-16T10:00:00.000Z" },
    { word: "c", learnedAt: "2026-07-15T08:00:00.000Z" },
  ]);
  const result = getWordsPerDay(7);
  expect(result.find((day) => day.date === "2026-07-16")?.count).toBe(2);
  expect(result.find((day) => day.date === "2026-07-15")?.count).toBe(1);
});

test("groups words by topic and handles missing topics", () => {
  mockStorage([
    { word: "a", topic: "TOEIC" },
    { word: "b", topic: "TOEIC" },
    { word: "c", topic: "Daily Communication" },
    { word: "d" },
  ]);
  expect(getTopicDistribution()).toEqual([
    { topic: "TOEIC", count: 2 },
    { topic: "Daily Communication", count: 1 },
    { topic: "Chưa phân loại", count: 1 },
  ]);
});

test("assigns calendar levels based on daily count", () => {
  mockStorage([
    { word: "a", learnedAt: "2026-07-16T08:00:00.000Z" },
    { word: "b", learnedAt: "2026-07-16T09:00:00.000Z" },
    { word: "c", learnedAt: "2026-07-16T10:00:00.000Z" },
    { word: "d", learnedAt: "2026-07-16T11:00:00.000Z" },
    { word: "e", learnedAt: "2026-07-16T12:00:00.000Z" },
  ]);
  const today = getCalendarData(4).find((day) => day.date === "2026-07-16");
  expect(today).toMatchObject({ count: 5, level: 3 });
});

test("getStudyTimePerDay returns one entry per day with 0 minutes by default", () => {
  const result = getStudyTimePerDay(7);
  expect(result).toHaveLength(7);
  expect(result.every((day) => day.minutes === 0)).toBe(true);
});

test("getStudyTimePerDay converts seconds to rounded minutes", () => {
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
  localStorage.setItem("studyTime", JSON.stringify({
    "2026-07-16": 1830,
    "2026-07-15": 900,
  }));
  const result = getStudyTimePerDay(3);
  expect(result.find((day) => day.date === "2026-07-16")?.minutes).toBe(31);
  expect(result.find((day) => day.date === "2026-07-15")?.minutes).toBe(15);
  expect(result.find((day) => day.date === "2026-07-14")?.minutes).toBe(0);
});

test("getStudyTimePerDay ignores dates outside range", () => {
  jest.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
  localStorage.setItem("studyTime", JSON.stringify({ "2026-01-01": 3600 }));
  const result = getStudyTimePerDay(7);
  expect(result.every((day) => day.minutes === 0)).toBe(true);
});

test("getWordsForDate returns words learned on the given date", () => {
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "ambitious", learnedAt: "2026-07-16T08:00:00.000Z", meaning: "đầy tham vọng", example: "", topic: "TOEIC" },
    { word: "persevere", learnedAt: "2026-07-16T10:00:00.000Z", meaning: "kiên trì", example: "", topic: "TOEIC" },
    { word: "diligent",  learnedAt: "2026-07-15T08:00:00.000Z", meaning: "chăm chỉ",   example: "", topic: "TOEIC" },
  ]));
  const result = getWordsForDate("2026-07-16");
  expect(result).toHaveLength(2);
  expect(result.map(w => w.word)).toEqual(["ambitious", "persevere"]);
});

test("getWordsForDate returns empty array when no words on that date", () => {
  localStorage.setItem("learnedWords", JSON.stringify([
    { word: "ambitious", learnedAt: "2026-07-16T08:00:00.000Z", meaning: "đầy tham vọng", example: "", topic: "TOEIC" },
  ]));
  expect(getWordsForDate("2026-07-15")).toEqual([]);
});

test("getWordsForDate returns empty array when storage is empty", () => {
  expect(getWordsForDate("2026-07-16")).toEqual([]);
});
