import { buildReminderIcs, snoozeStudyNudge, studyNudge } from "../reminders";

const evening = new Date(2026, 10, 17, 21, 0);
const word = { word: "w", meaning: "", example: "", topic: "", learnedAt: "2026-11-01T00:00:00.000Z", nextReviewAt: "2026-11-16T00:00:00.000Z" };

beforeEach(() => localStorage.clear());

test("nudges after the reminder time when nothing was studied today, until snoozed", () => {
  expect(studyNudge("20:00", evening)).toBeNull(); // no words yet
  localStorage.setItem("learnedWords", JSON.stringify([word]));
  expect(studyNudge("22:00", evening)).toBeNull(); // too early
  expect(studyNudge("20:00", evening)).toEqual({ dueWords: 1, streak: 0 });
  snoozeStudyNudge(evening);
  expect(studyNudge("20:00", evening)).toBeNull();
});

test("no nudge once a session finished today", () => {
  localStorage.setItem("learnedWords", JSON.stringify([word]));
  const started = new Date(2026, 10, 17, 9, 0).toISOString();
  localStorage.setItem("learningSessions", JSON.stringify([{ id: "s", type: "review", startedAt: started, finishedAt: started, durationSeconds: 60 }]));
  expect(studyNudge("20:00", evening)).toBeNull();
});

test("builds a daily calendar event with an alert, starting tomorrow at the chosen time", () => {
  const ics = buildReminderIcs("07:30", "https://study.example/today", evening);
  expect(ics).toContain("DTSTART:20261118T073000\r\n");
  expect(ics).toContain("RRULE:FREQ=DAILY\r\n");
  expect(ics).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0M");
  expect(ics).toContain("URL:https://study.example/today");
  expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
});
