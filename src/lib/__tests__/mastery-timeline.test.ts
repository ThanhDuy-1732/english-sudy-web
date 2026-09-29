import { recordMasterySnapshot, getMasteryTimeline, getSkillTrend } from "../mastery-timeline";

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.defineProperty(global, "localStorage", {
    value: {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    },
    writable: true,
    configurable: true,
  });
});

test("recordMasterySnapshot stores a snapshot", () => {
  recordMasterySnapshot("grammar", 44);
  const timeline = getMasteryTimeline("grammar");
  expect(timeline).toHaveLength(1);
  expect(timeline[0].mastery).toBe(44);
  expect(timeline[0].skill).toBe("grammar");
});

test("recordMasterySnapshot does not duplicate same date+skill", () => {
  recordMasterySnapshot("grammar", 44);
  recordMasterySnapshot("grammar", 46); // same day, overwrite
  expect(getMasteryTimeline("grammar")).toHaveLength(1);
  expect(getMasteryTimeline("grammar")[0].mastery).toBe(46);
});

test("different skills are independent", () => {
  recordMasterySnapshot("grammar", 44);
  recordMasterySnapshot("vocabulary", 60);
  expect(getMasteryTimeline("grammar")).toHaveLength(1);
  expect(getMasteryTimeline("vocabulary")).toHaveLength(1);
});

test("getSkillTrend compares last half vs prior half", () => {
  // Seed 14 days: first 7 at mastery=40, last 7 at mastery=65
  const key = "masteryTimeline";
  const snapshots = [];
  for (let i = 14; i > 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    snapshots.push({ date, skill: "grammar", mastery: i > 7 ? 40 : 65 });
  }
  mockStorage[key] = JSON.stringify(snapshots);
  expect(getSkillTrend("grammar")).toBe("up");
});

test("getSkillTrend returns stable when fewer than 4 entries", () => {
  recordMasterySnapshot("reading", 50);
  recordMasterySnapshot("reading", 52);
  expect(getSkillTrend("reading")).toBe("stable");
});
