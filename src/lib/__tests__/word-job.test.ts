import {
  classifyFailure,
  clearJob,
  createRateWindow,
  getJob,
  isLockStale,
  isSameRunningJob,
  makeJob,
  nextBackoffMs,
  reconcileFollowedJob,
  saveJob,
  shouldStopJob,
} from "../word-job";

beforeEach(() => localStorage.clear());

test("makeJob tạo job running đúng target và topic", () => {
  const job = makeJob("TOEIC", 1000, new Date("2026-11-18T00:00:00.000Z"));
  expect(job).toMatchObject({ topic: "TOEIC", target: 1000, status: "running" });
  expect(job.createdAt).toBe("2026-11-18T00:00:00.000Z");
});

test("shouldStopJob ưu tiên done, rồi exhausted, rồi error", () => {
  expect(shouldStopJob({ count: 1000, target: 1000, emptyStreak: 9, failures: 9 })).toBe("done");
  expect(shouldStopJob({ count: 400, target: 1000, emptyStreak: 3, failures: 9 })).toBe("exhausted");
  expect(shouldStopJob({ count: 400, target: 1000, emptyStreak: 0, failures: 3 })).toBe("error");
  expect(shouldStopJob({ count: 400, target: 1000, emptyStreak: 2, failures: 2 })).toBeNull();
});

test("nextBackoffMs tăng gấp đôi và chặn ở 30 s", () => {
  expect([0, 1, 2, 3, 10].map(nextBackoffMs)).toEqual([1000, 2000, 4000, 8000, 30000]);
});

test("classifyFailure coi 429 là cooldown, 5xx/network là retry", () => {
  expect(classifyFailure(429)).toBe("cooldown");
  expect(classifyFailure(500)).toBe("retry");
  expect(classifyFailure(undefined)).toBe("retry");
  expect(classifyFailure(400)).toBe("fail");
});

test("isLockStale sau 30 s", () => {
  const now = Date.parse("2026-11-18T00:01:00.000Z");
  expect(isLockStale({ tabId: "a", heartbeatAt: "2026-11-18T00:00:45.000Z" }, now)).toBe(false);
  expect(isLockStale({ tabId: "a", heartbeatAt: "2026-11-18T00:00:20.000Z" }, now)).toBe(true);
  expect(isLockStale(undefined, now)).toBe(true);
});

test("isSameRunningJob chỉ nhận đúng job và trạng thái running", () => {
  const job = makeJob("TOEIC", 100);
  expect(isSameRunningJob(job, job.id)).toBe(true);
  expect(isSameRunningJob({ ...job, id: "other" }, job.id)).toBe(false);
  expect(isSameRunningJob({ ...job, status: "paused" }, job.id)).toBe(false);
  expect(isSameRunningJob(null, job.id)).toBe(false);
});

test("reconcileFollowedJob chuyển job của tab đã chết thành paused", () => {
  const now = Date.parse("2026-11-18T00:01:00.000Z");
  const job = {
    ...makeJob("TOEIC", 100),
    lock: { tabId: "other", heartbeatAt: "2026-11-18T00:00:20.000Z" },
  };
  const next = reconcileFollowedJob(job, "mine", now);
  expect(next?.status).toBe("paused");
  expect(next?.lock).toBeUndefined();

  const live = { ...job, lock: { tabId: "other", heartbeatAt: "2026-11-18T00:00:45.000Z" } };
  expect(reconcileFollowedJob(live, "mine", now)).toEqual(live);
  expect(reconcileFollowedJob({ ...job, lock: { tabId: "mine", heartbeatAt: "2026-11-18T00:00:20.000Z" } }, "mine", now)?.status).toBe("running");
  expect(reconcileFollowedJob(null, "mine", now)).toBeNull();
});

test("rate window chặn request thứ 41 trong 60 s", () => {
  const window = createRateWindow(40, 60_000);
  const t0 = 1_000_000;
  for (let i = 0; i < 40; i++) window.record(t0 + i);
  expect(window.waitMs(t0 + 40)).toBe(59_960);
  expect(window.waitMs(t0 + 30_000)).toBe(30_000);
  expect(window.waitMs(t0 + 60_000)).toBe(0);
});

test("saveJob/getJob/clearJob roundtrip và bỏ qua JSON hỏng", () => {
  expect(saveJob(makeJob("TOEIC", 100))).toBe(true);
  expect(getJob()?.topic).toBe("TOEIC");
  clearJob();
  expect(getJob()).toBeNull();
  localStorage.setItem("wordJob", "{");
  expect(getJob()).toBeNull();
});
