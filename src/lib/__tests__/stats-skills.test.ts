jest.mock("../speech/speaking-storage", () => ({ getSpeaking: jest.fn(() => []) }));
jest.mock("../write/writing-storage", () => ({ getWriting: jest.fn(() => []) }));
jest.mock("../exam/exam-storage", () => ({ getAttempts: jest.fn(() => []) }));

import { weeklyBands, skillRadar } from "../stats-skills";
import { getSpeaking } from "../speech/speaking-storage";
import { getWriting } from "../write/writing-storage";

const mockGetSpeaking = getSpeaking as jest.Mock;
const mockGetWriting = getWriting as jest.Mock;

beforeEach(() => {
  mockGetSpeaking.mockReturnValue([]);
  mockGetWriting.mockReturnValue([]);
});

it("weeklyBands returns empty array when no data", () => {
  expect(weeklyBands()).toEqual([]);
});

it("weeklyBands groups records by ISO week", () => {
  mockGetSpeaking.mockReturnValue([{
    id: "a", mode: "ielts_p2", prompt: "p", transcript: "t", durationSec: 60,
    feedback: {
      transcript: "", durationSec: 60, wordsPerMinute: 80, fillerCount: 0,
      bands: { fluency: 7, lexical: 6, grammar: 7, pronunciation: null },
      overall: 6.5, strengths: [], improvements: [], upgradedVersion: "", newVocabulary: [],
    },
    createdAt: "2026-09-15T00:00:00.000Z",
  }]);
  const result = weeklyBands(12);
  expect(result.length).toBeGreaterThan(0);
  const week = result.find((w) => w.week === "2026-W38");
  expect(week?.speaking).toBeCloseTo(6.5, 1);
});

it("skillRadar returns null for skills with no data", () => {
  const radar = skillRadar();
  for (const p of radar) {
    if (p.samples === 0) expect(p.value).toBeNull();
  }
});

it("skillRadar computes speaking percentage from overall/9", () => {
  mockGetSpeaking.mockReturnValue([{
    id: "s1", mode: "ielts_p1", prompt: "p", transcript: "t", durationSec: 60,
    feedback: {
      transcript: "", durationSec: 60, wordsPerMinute: 90, fillerCount: 0,
      bands: { fluency: 7, lexical: 7, grammar: 7, pronunciation: null },
      overall: 7, strengths: [], improvements: [], upgradedVersion: "", newVocabulary: [],
    },
    createdAt: "2026-09-15T00:00:00.000Z",
  }]);
  const radar = skillRadar();
  const sp = radar.find((r) => r.skill === "S");
  expect(sp?.value).toBeCloseTo((7 / 9) * 100, 0);
});
