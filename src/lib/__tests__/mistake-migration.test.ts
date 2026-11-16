
import { migrateLegacyMistakes, runMistakeMigration, needsRemoteMistakeMigration } from "../mistake-migration";
import { getMistakes, resolveMistake } from "../mistakes";
import type { MistakeEntry } from "../exam/types";
import type { UnifiedMistake } from "../mistakes";

const legacy = (o: Partial<MistakeEntry> = {}): MistakeEntry => ({
  id: "l1",
  questionId: "q1",
  itemId: "i1",
  type: "incomplete_sentence",
  part: "RC5",
  prompt: "P?",
  userAnswer: "A",
  correctAnswer: "B",
  explanation: "e",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  resolved: false,
  ...o,
});

const uni = (o: Partial<UnifiedMistake> = {}): UnifiedMistake => ({
  id: "u1",
  skill: "reading",
  category: "incomplete_sentence",
  source: "exam:RC5:q1",
  userAnswer: "A",
  correctAnswer: "B",
  explanation: "e",
  occurrenceCount: 1,
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...o,
});

test("empty legacy changes nothing", () => {
  const u = [uni()];
  const r = migrateLegacyMistakes([], u);
  expect(r.merged).toEqual(u);
  expect(r.changed).toEqual([]);
});

test("groups repeated wrong answers into one entry with count, latest id and answer, earliest createdAt", () => {
  const r = migrateLegacyMistakes(
    [
      legacy({ id: "l1", updatedAt: "2026-09-01T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z", userAnswer: "A" }),
      legacy({ id: "l3", updatedAt: "2026-09-03T00:00:00.000Z", createdAt: "2026-09-03T00:00:00.000Z", userAnswer: "C" }),
      legacy({ id: "l2", updatedAt: "2026-09-02T00:00:00.000Z", createdAt: "2026-09-02T00:00:00.000Z", userAnswer: "D" }),
    ],
    []
  );
  expect(r.merged).toHaveLength(1);
  expect(r.merged[0]).toMatchObject({
    id: "l3",
    skill: "reading",
    category: "incomplete_sentence",
    source: "exam:RC5:q1",
    occurrenceCount: 3,
    status: "new",
    userAnswer: "C",
    createdAt: "2026-09-01T00:00:00.000Z",
    exam: { itemId: "i1", questionId: "q1", part: "RC5", type: "incomplete_sentence", prompt: "P?" },
  });
  expect(r.changed).toHaveLength(1);
});

test("different questions stay separate", () => {
  const r = migrateLegacyMistakes(
    [legacy({ id: "a", questionId: "q1" }), legacy({ id: "b", questionId: "q2" })],
    []
  );
  expect(r.merged.map((m) => m.source).sort()).toEqual(["exam:RC5:q1", "exam:RC5:q2"]);
});

test("does not add counts when unified already has the entry (old dual-write), only attaches exam meta", () => {
  const r = migrateLegacyMistakes(
    [legacy({ id: "l1" }), legacy({ id: "l2" })],
    [uni({ occurrenceCount: 2 })]
  );
  expect(r.merged).toHaveLength(1);
  expect(r.merged[0].occurrenceCount).toBe(2);
  expect(r.merged[0].exam).toMatchObject({ itemId: "i1", prompt: "P?" });
  expect(r.changed).toHaveLength(1);
});

test("propagates a legacy resolve to the unresolved unified entry", () => {
  const r = migrateLegacyMistakes(
    [legacy({ resolved: true, reviewedAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z" })],
    [uni()]
  );
  expect(r.merged[0].status).toBe("resolved");
  expect(r.merged[0].reviewedAt).toBe("2026-09-05T00:00:00.000Z");
});

test("does not resolve a unified entry that was updated after the legacy resolve", () => {
  const r = migrateLegacyMistakes(
    [legacy({ resolved: true, updatedAt: "2026-09-05T00:00:00.000Z" })],
    [uni({ updatedAt: "2026-09-10T00:00:00.000Z" })]
  );
  expect(r.merged[0].status).toBe("new");
});

test("resolved then wrong again: unified stays unresolved and keeps its count", () => {
  const r = migrateLegacyMistakes(
    [
      legacy({ id: "l1", resolved: true, updatedAt: "2026-09-02T00:00:00.000Z" }),
      legacy({ id: "l2", resolved: false, updatedAt: "2026-09-04T00:00:00.000Z" }),
    ],
    [uni({ occurrenceCount: 2, updatedAt: "2026-09-04T00:00:00.000Z" })]
  );
  expect(r.merged).toHaveLength(1);
  expect(r.merged[0].status).toBe("new");
  expect(r.merged[0].occurrenceCount).toBe(2);
});

test("resolved legacy with no unified counterpart becomes a resolved entry", () => {
  const r = migrateLegacyMistakes(
    [legacy({ resolved: true, reviewedAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z" })],
    []
  );
  expect(r.merged[0]).toMatchObject({ status: "resolved", reviewedAt: "2026-09-05T00:00:00.000Z" });
});

test("duplicate legacy ids (local + remote overlap) are counted once", () => {
  const e = legacy({ id: "same" });
  const r = migrateLegacyMistakes([e, { ...e }], []);
  expect(r.merged[0].occurrenceCount).toBe(1);
});

test("legacy entries without updatedAt fall back to reviewedAt/createdAt instead of throwing", () => {
  const old = legacy({ id: "old" }) as Partial<MistakeEntry>;
  delete old.updatedAt;
  expect(() => migrateLegacyMistakes([old as MistakeEntry], [])).not.toThrow();
  const r = migrateLegacyMistakes([old as MistakeEntry], []);
  expect(r.merged[0].updatedAt).toBe("2026-09-01T00:00:00.000Z");
});

test("is idempotent: running again on its own output changes nothing", () => {
  const input = [
    legacy({ id: "l1" }),
    legacy({ id: "l2", resolved: true, updatedAt: "2026-09-02T00:00:00.000Z" }),
    legacy({ id: "l3", questionId: "q2" }),
  ];
  const first = migrateLegacyMistakes(input, []);
  const second = migrateLegacyMistakes(input, first.merged);
  expect(second.changed).toEqual([]);
  expect(second.merged).toEqual(first.merged);
});

describe("runMistakeMigration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates local mistakeLog, backs it up, keeps the legacy key, sets the flag", () => {
    const raw = JSON.stringify([legacy({ id: "l1" }), legacy({ id: "l2" })]);
    localStorage.setItem("mistakeLog", raw);
    runMistakeMigration();
    expect(getMistakes()).toHaveLength(1);
    expect(getMistakes()[0].occurrenceCount).toBe(2);
    expect(localStorage.getItem("mistakeLog")).toBe(raw);
    expect(localStorage.getItem("mistakeLogBackup")).toBe(raw);
    expect(localStorage.getItem("mistakeLogMigrated")).toBe("1");
  });

  it("runs only once: resolving a unified entry afterwards is not undone by a restart", () => {
    localStorage.setItem("mistakeLog", JSON.stringify([legacy({ id: "l1" })]));
    runMistakeMigration();
    resolveMistake(getMistakes()[0].id);
    runMistakeMigration();
    expect(getMistakes()).toHaveLength(1);
    expect(getMistakes()[0].status).toBe("resolved");
  });

  it("does not throw on corrupt mistakeLog JSON and still sets the flag", () => {
    localStorage.setItem("mistakeLog", "{not json");
    expect(() => runMistakeMigration()).not.toThrow();
    expect(localStorage.getItem("mistakeLogMigrated")).toBe("1");
    expect(getMistakes()).toEqual([]);
  });

  it("no mistakeLog at all is a no-op that sets the flag", () => {
    runMistakeMigration();
    expect(localStorage.getItem("mistakeLogMigrated")).toBe("1");
    expect(localStorage.getItem("mistakeLogBackup")).toBeNull();
  });

  it("migrates remote entries once, skipping ids already in the local legacy log", () => {
    localStorage.setItem("mistakeLog", JSON.stringify([legacy({ id: "l1" })]));
    runMistakeMigration();
    expect(needsRemoteMistakeMigration()).toBe(true);
    runMistakeMigration([legacy({ id: "l1" }), legacy({ id: "r1", questionId: "q9" })]);
    expect(getMistakes().map((m) => m.source).sort()).toEqual(["exam:RC5:q1", "exam:RC5:q9"]);
    expect(needsRemoteMistakeMigration()).toBe(false);
    runMistakeMigration([legacy({ id: "r2", questionId: "q10" })]);
    expect(getMistakes()).toHaveLength(2);
  });
});
