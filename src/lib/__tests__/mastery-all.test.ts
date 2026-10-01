jest.mock("@/lib/sync", () => ({
  pushAttempt: jest.fn().mockResolvedValue(undefined),
  pushUnifiedMistake: jest.fn().mockResolvedValue(undefined),
  getSyncKey: jest.fn(() => "test-key"),
}));

import { recomputeMastery } from "../mastery-all";
import { saveAttempt } from "../exam/exam-storage";
import { saveSpeaking } from "../speech/speaking-storage";
import { saveWriting } from "../write/writing-storage";
import { saveLearnedWord } from "../storage";
import type { ExamAttempt } from "../exam/types";
import type { SpeakingRecord } from "../speech/speaking-storage";
import type { WritingRecord } from "../write/writing-storage";

beforeEach(() => { localStorage.clear(); });

test("computes mastery for every skill with data, keeps skills with no data absent", () => {
  saveLearnedWord({ word: "run", meaning: "chạy", example: "", topic: "", learnedAt: new Date().toISOString(), mastery: 4 });

  const attempt: ExamAttempt = {
    id: "a1", kind: "TOEIC", mode: "drill", parts: ["RC5"],
    startedAt: new Date().toISOString(),
    answers: [{ itemId: "i1", questionId: "q1", type: "incomplete_sentence", part: "RC5", userAnswer: "A", correct: true, timeSpentSec: 10 }],
  };
  saveAttempt(attempt);

  const speaking: SpeakingRecord = {
    id: "s1", mode: "ielts_p1", prompt: "", transcript: "", durationSec: 30,
    feedback: { overall: 7 } as SpeakingRecord["feedback"], createdAt: new Date().toISOString(),
  };
  saveSpeaking(speaking);

  const writing: WritingRecord = {
    id: "w1", kind: "ielts_task2", prompt: "", content: "", wordCount: 100,
    feedback: { overall: 5 } as WritingRecord["feedback"], createdAt: new Date().toISOString(),
  };
  saveWriting(writing);

  const result = recomputeMastery();
  const skills = result.map((s) => s.skill).sort();
  expect(skills).toEqual(["reading", "speaking", "vocabulary", "writing"]);
  expect(result.find((s) => s.skill === "vocabulary")?.overallMastery).toBeGreaterThan(0);
});

test("returns empty array when there is no data anywhere", () => {
  expect(recomputeMastery()).toEqual([]);
});
