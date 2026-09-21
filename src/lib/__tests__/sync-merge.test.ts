import { stamp, mergeLww } from "../sync-merge";

const getId = (item: { word: string }) => item.word;

describe("stamp", () => {
  it("prefers updatedAt", () => {
    expect(stamp({ updatedAt: "2026-09-21", learnedAt: "2026-09-20" })).toBe("2026-09-21");
  });
  it("falls back to learnedAt", () => {
    expect(stamp({ learnedAt: "2026-09-20" })).toBe("2026-09-20");
  });
  it("falls back to createdAt", () => {
    expect(stamp({ createdAt: "2026-09-19" })).toBe("2026-09-19");
  });
  it("returns empty string when no timestamp", () => {
    expect(stamp({})).toBe("");
  });
});

describe("mergeLww", () => {
  it("local-only item is in toPush", () => {
    const local = [{ word: "hello", updatedAt: "2026-09-21T10:00:00Z" }];
    const { merged, toPush } = mergeLww(local, [], getId);
    expect(merged).toHaveLength(1);
    expect(toPush).toHaveLength(1);
    expect(toPush[0].word).toBe("hello");
  });

  it("remote-only item is merged in, no push", () => {
    const remote = [{ word: "world", updatedAt: "2026-09-21T10:00:00Z" }];
    const { merged, toPush } = mergeLww([], remote, getId);
    expect(merged).toHaveLength(1);
    expect(toPush).toHaveLength(0);
  });

  it("local newer → keep local, push it", () => {
    const local = [{ word: "apple", updatedAt: "2026-09-21T12:00:00Z", mastery: 3 }];
    const remote = [{ word: "apple", updatedAt: "2026-09-21T10:00:00Z", mastery: 1 }];
    const { merged, toPush } = mergeLww(local, remote, getId);
    expect(merged[0].mastery).toBe(3);
    expect(toPush).toHaveLength(1);
  });

  it("remote newer → take remote, no push", () => {
    const local = [{ word: "apple", updatedAt: "2026-09-21T10:00:00Z", mastery: 1 }];
    const remote = [{ word: "apple", updatedAt: "2026-09-21T12:00:00Z", mastery: 3 }];
    const { merged, toPush } = mergeLww(local, remote, getId);
    expect(merged[0].mastery).toBe(3);
    expect(toPush).toHaveLength(0);
  });

  it("tie → keep local, no push", () => {
    const ts = "2026-09-21T10:00:00Z";
    const local = [{ word: "tie", updatedAt: ts, mastery: 2 }];
    const remote = [{ word: "tie", updatedAt: ts, mastery: 5 }];
    const { merged, toPush } = mergeLww(local, remote, getId);
    expect(merged[0].mastery).toBe(2);
    expect(toPush).toHaveLength(0);
  });

  it("handles mix of local-only, remote-only, and conflicting", () => {
    const local = [
      { word: "a", updatedAt: "2026-09-21T12:00:00Z" },
      { word: "b", updatedAt: "2026-09-21T08:00:00Z" },
    ];
    const remote = [
      { word: "b", updatedAt: "2026-09-21T10:00:00Z" }, // newer
      { word: "c", updatedAt: "2026-09-21T09:00:00Z" }, // remote-only
    ];
    const { merged, toPush } = mergeLww(local, remote, getId);
    expect(merged).toHaveLength(3);
    expect(merged.find((x) => x.word === "b")?.updatedAt).toBe("2026-09-21T10:00:00Z");
    // a is local-only → pushed; b remote is newer → no push; c is remote-only → no push
    expect(toPush.map((x) => x.word)).toEqual(["a"]);
  });
});
