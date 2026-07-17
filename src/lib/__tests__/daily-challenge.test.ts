import { getDailyChallenge, getStreak, setDailyComplete } from "../daily-challenge";

beforeEach(() => { localStorage.clear(); jest.useFakeTimers(); jest.setSystemTime(new Date("2026-07-16T08:00:00.000Z")); });
afterEach(() => jest.useRealTimers());

test("returns no challenge before completion", () => expect(getDailyChallenge()).toBeNull());
test("stores today's challenge and streak", () => { setDailyComplete(["hello", "world"]); expect(getDailyChallenge()).toMatchObject({ date: "2026-07-16", words: ["hello", "world"], completed: true }); expect(getStreak()).toBe(1); });
test("does not count a completion two days ago", () => { jest.setSystemTime(new Date("2026-07-14T08:00:00.000Z")); setDailyComplete(["hello"]); jest.setSystemTime(new Date("2026-07-16T08:00:00.000Z")); expect(getStreak()).toBe(0); });
test("counts consecutive completed days", () => { jest.setSystemTime(new Date("2026-07-15T08:00:00.000Z")); setDailyComplete(["one"]); jest.setSystemTime(new Date("2026-07-16T08:00:00.000Z")); setDailyComplete(["two"]); expect(getStreak()).toBe(2); });
