import { saveSpeaking, getSpeaking } from "../speaking-storage";
import type { SpeakingRecord } from "../speaking-storage";

const make = (id: string, createdAt: string): SpeakingRecord => ({
  id,
  mode: "ielts_p1",
  prompt: "Describe your home",
  transcript: "I live in a house",
  durationSec: 60,
  feedback: {
    transcript: "I live in a house",
    durationSec: 60,
    wordsPerMinute: 90,
    fillerCount: 0,
    bands: { fluency: 6, lexical: 6, grammar: 6, pronunciation: null },
    overall: 6,
    strengths: [],
    improvements: [],
    upgradedVersion: "",
    newVocabulary: [],
  },
  createdAt,
});

beforeEach(() => localStorage.clear());

it("saveSpeaking stores newest first", () => {
  saveSpeaking(make("a", "2026-01-01T00:00:00.000Z"));
  saveSpeaking(make("b", "2026-01-02T00:00:00.000Z"));
  const all = getSpeaking();
  expect(all[0].id).toBe("b");
  expect(all[1].id).toBe("a");
});

it("saveSpeaking deduplicates by id", () => {
  saveSpeaking(make("a", "2026-01-01T00:00:00.000Z"));
  saveSpeaking(make("a", "2026-01-01T00:00:00.000Z"));
  expect(getSpeaking()).toHaveLength(1);
});

it("saveSpeaking caps at 200 records", () => {
  for (let i = 0; i < 205; i++) {
    saveSpeaking(make(`r${i}`, new Date(Date.UTC(2026, 0, i + 1)).toISOString()));
  }
  expect(getSpeaking().length).toBeLessThanOrEqual(200);
});

it("saveSpeaking updates lastSpeakingAt", () => {
  saveSpeaking(make("x", "2026-06-01T00:00:00.000Z"));
  expect(localStorage.getItem("lastSpeakingAt")).toBe("2026-06-01T00:00:00.000Z");
});

it("getSpeaking returns empty array when storage empty", () => {
  expect(getSpeaking()).toEqual([]);
});
