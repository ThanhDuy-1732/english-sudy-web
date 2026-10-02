import { localDateKey } from "../date";

test("localDateKey uses the local calendar day, not UTC", () => {
  // 00:30 local on 5 March is still 4 March in UTC for any timezone east of UTC.
  expect(localDateKey(new Date(2026, 2, 5, 0, 30))).toBe("2026-03-05");
  expect(localDateKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
});
