import { saveWriting, getWriting } from "../writing-storage";
import type { WritingRecord } from "../writing-storage";

const makeFeedback = () => ({
  bands: { task: 6, coherence: 6, lexical: 6, grammar: 6 },
  overall: 6,
  wordCount: 250,
  annotations: [],
  modelAnswer: "Model answer here.",
  nextFocus: "Task response",
});

const make = (id: string, createdAt: string): WritingRecord => ({
  id,
  kind: "ielts_task2" as const,
  prompt: "Discuss both views",
  content: "In this essay...",
  wordCount: 250,
  feedback: makeFeedback(),
  createdAt,
});

beforeEach(() => localStorage.clear());

it("saveWriting stores newest first", () => {
  saveWriting(make("a", "2026-01-01T00:00:00.000Z"));
  saveWriting(make("b", "2026-01-02T00:00:00.000Z"));
  expect(getWriting()[0].id).toBe("b");
});

it("saveWriting deduplicates by id", () => {
  saveWriting(make("a", "2026-01-01T00:00:00.000Z"));
  saveWriting(make("a", "2026-01-01T00:00:00.000Z"));
  expect(getWriting()).toHaveLength(1);
});

it("saveWriting caps at 100 records", () => {
  for (let i = 0; i < 105; i++) {
    saveWriting(make(`r${i}`, new Date(Date.UTC(2026, 0, i + 1)).toISOString()));
  }
  expect(getWriting().length).toBeLessThanOrEqual(100);
});

it("saveWriting updates lastWritingAt", () => {
  saveWriting(make("x", "2026-06-01T00:00:00.000Z"));
  expect(localStorage.getItem("lastWritingAt")).toBe("2026-06-01T00:00:00.000Z");
});

it("getWriting returns empty array when empty", () => {
  expect(getWriting()).toEqual([]);
});
