import {
  startSession, updateSession, finishSession, cancelSession,
  getSessions, getSessionsForDate, getRecentSessions, logActivity,
} from "../sessions";

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-17T10:00:00.000+07:00"));
});

afterEach(() => jest.useRealTimers());

test("starts and updates a session", () => {
  const id = startSession("exam", { part: "RC5" });
  expect(getSessions()[0]).toMatchObject({ id, type: "exam", durationSeconds: 0, metadata: { part: "RC5" } });
  expect(getSessions()[0].startedAt).toBe("2026-09-17T03:00:00.000Z");
  expect(getSessions()[0].finishedAt).toBeUndefined();
  updateSession(id, { totalItems: 5, correctItems: 3 });
  expect(getSessions()[0]).toMatchObject({ totalItems: 5, correctItems: 3 });
});

test("finishes once with elapsed seconds and totals", () => {
  const id = startSession("review");
  jest.advanceTimersByTime(90_000);
  finishSession(id, { totalItems: 10, correctItems: 8 });
  const finished = getSessions()[0];
  expect(finished).toMatchObject({ durationSeconds: 90, totalItems: 10, correctItems: 8 });
  expect(finished.finishedAt).toBe("2026-09-17T03:01:30.000Z");
  jest.advanceTimersByTime(60_000);
  finishSession(id, { totalItems: 99 });
  expect(getSessions()[0]).toEqual(finished);
});

test("cancels an existing session and ignores unknown ids", () => {
  const id = startSession("speaking");
  cancelSession("unknown");
  expect(getSessions()).toHaveLength(1);
  cancelSession(id);
  expect(getSessions()).toEqual([]);
});

test("returns newest sessions first and caps storage at 500", () => {
  const oldest = startSession("review");
  for (let i = 0; i < 500; i++) {
    jest.advanceTimersByTime(1000);
    startSession("vocabulary");
  }
  const sessions = getSessions();
  expect(sessions).toHaveLength(500);
  expect(sessions.find((session) => session.id === oldest)).toBeUndefined();
  expect(getRecentSessions(2)).toEqual(sessions.slice(0, 2));
  expect(sessions[0].startedAt > sessions[1].startedAt).toBe(true);
});

test("groups by local calendar date", () => {
  const previousTZ = process.env.TZ;
  process.env.TZ = "Asia/Ho_Chi_Minh";
  try {
    jest.setSystemTime(new Date("2026-09-16T18:00:00.000Z"));
    const id = startSession("grammar");
    expect(getSessionsForDate("2026-09-17").map((session) => session.id)).toEqual([id]);
    expect(getSessionsForDate("2026-09-16")).toEqual([]);
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});

test("returns empty for missing or malformed storage", () => {
  expect(getSessions()).toEqual([]);
  localStorage.setItem("learningSessions", "not json");
  expect(getSessions()).toEqual([]);
});

test("logActivity merges items within 30 minutes, then starts a new session", () => {
  logActivity("translation", "translate");
  jest.setSystemTime(new Date("2026-09-17T10:10:00.000+07:00"));
  logActivity("translation", "translate");
  expect(getSessions()).toHaveLength(1);
  expect(getSessions()[0]).toMatchObject({ type: "translation", totalItems: 2, durationSeconds: 600 });
  jest.setSystemTime(new Date("2026-09-17T11:00:00.000+07:00"));
  logActivity("translation", "translate");
  expect(getSessions()).toHaveLength(2);
  expect(getSessions()[0]).toMatchObject({ totalItems: 1, durationSeconds: 0 });
});
