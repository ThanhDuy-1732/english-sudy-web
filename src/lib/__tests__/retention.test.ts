import { RETENTION_DAYS, pruneOldData } from "../retention";
import { addMistake } from "../mistakes";

const now = new Date("2026-11-17T12:00:00.000Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

beforeEach(() => localStorage.clear());

test(`deletes sessions, exam items and recordings older than ${RETENTION_DAYS} days and keeps the rest`, () => {
  localStorage.setItem("learningSessions", JSON.stringify([{ id: "new", startedAt: daysAgo(10) }, { id: "old", startedAt: daysAgo(91) }]));
  localStorage.setItem("examBank", JSON.stringify({
    "TOEIC:RC5:3": [{ id: "fresh", createdAt: daysAgo(5) }, { id: "stale", createdAt: daysAgo(120) }, { id: "pinned", createdAt: daysAgo(200) }],
    "TOEIC:RC6:3": [{ id: "gone", createdAt: daysAgo(100) }],
  }));
  addMistake({ skill: "reading", category: "incomplete_sentence", source: "exam:RC5:q1", userAnswer: "a", correctAnswer: "b", explanation: "",
    exam: { itemId: "pinned", questionId: "q1", part: "RC5", type: "incomplete_sentence", prompt: "p" } });
  localStorage.setItem("speakingSessions", JSON.stringify([
    { id: "s1", audioId: "a-new", createdAt: daysAgo(3), feedback: { overall: 6 } },
    { id: "s2", audioId: "a-old", createdAt: daysAgo(95), feedback: { overall: 5 } },
  ]));

  const result = pruneOldData(now);

  expect(result).toEqual({ sessions: 1, examItems: 2, audioIds: ["a-old"] });
  expect(JSON.parse(localStorage.getItem("learningSessions")!).map((s: { id: string }) => s.id)).toEqual(["new"]);
  expect(JSON.parse(localStorage.getItem("examBank")!)).toEqual({ "TOEIC:RC5:3": [{ id: "fresh", createdAt: daysAgo(5) }, { id: "pinned", createdAt: daysAgo(200) }] });
  const speaking = JSON.parse(localStorage.getItem("speakingSessions")!);
  expect(speaking[0].audioId).toBe("a-new");
  expect(speaking[1]).toEqual({ id: "s2", createdAt: daysAgo(95), feedback: { overall: 5 } });
});
