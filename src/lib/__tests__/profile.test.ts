import { getProfile, saveProfile, updateProfile } from "../profile";

beforeEach(() => { localStorage.clear(); });

test("getProfile returns defaults when nothing saved", () => {
  const p = getProfile();
  expect(p.goal).toBe("mixed");
  expect(p.dailyStudyMinutes).toBe(30);
  expect(p.shortcutsEnabled).toBe(true);
});

test("saveProfile persists and retrieves", () => {
  saveProfile({ ...getProfile(), goal: "toeic", targetToeicScore: 750 });
  expect(getProfile().goal).toBe("toeic");
  expect(getProfile().targetToeicScore).toBe(750);
});

test("updateProfile merges partial updates", () => {
  updateProfile({ dailyStudyMinutes: 60 });
  expect(getProfile().dailyStudyMinutes).toBe(60);
  expect(getProfile().goal).toBe("mixed");
});
