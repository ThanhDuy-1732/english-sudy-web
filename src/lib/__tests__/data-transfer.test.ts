import {
  BACKUP_APP,
  BACKUP_VERSION,
  backupFileName,
  clearAllData,
  exportData,
  importData,
  markBackedUp,
  mergeData,
  needsBackup,
  parseBackup,
} from "../data-transfer";

function makeBackup(data: Record<string, string>, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: "2026-11-13T10:00:00.000Z",
    data,
    ...overrides,
  });
}

beforeEach(() => localStorage.clear());

describe("exportData", () => {
  it("exports every app key with its raw string value", () => {
    localStorage.setItem("learnedWords", '[{"word":"hello"}]');
    localStorage.setItem("theme", "dark");

    const backup = parseBackup(exportData());

    expect(backup.app).toBe(BACKUP_APP);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.data.learnedWords).toBe('[{"word":"hello"}]');
    expect(backup.data.theme).toBe("dark");
  });

  it("skips runtime-only keys", () => {
    localStorage.setItem("learnedWords", "[]");
    localStorage.setItem("syncKey", "abc");
    localStorage.setItem("syncFailedQueue", "[]");

    const backup = parseBackup(exportData());

    expect(backup.data).toEqual({ learnedWords: "[]" });
  });

  it("exports wordBank but not wordJob", () => {
    localStorage.setItem("wordBank", '[{"word":"alpha"}]');
    localStorage.setItem("wordJob", '{"id":"j1"}');
    const backup = parseBackup(exportData());
    expect(backup.data.wordBank).toBe('[{"word":"alpha"}]');
    expect(backup.data.wordJob).toBeUndefined();
  });

  it("produces a valid ISO export date", () => {
    const backup = parseBackup(exportData());
    expect(backup.exportedAt).toBe(new Date(backup.exportedAt).toISOString());
  });
});

describe("importData", () => {
  it("restores values written by exportData", () => {
    localStorage.setItem("learnedWords", '[{"word":"hello"}]');
    localStorage.setItem("unifiedMistakes", '[{"id":"m1"}]');
    const json = exportData();
    localStorage.clear();

    const result = importData(json);

    expect(result).toEqual({ imported: 2, skipped: 0 });
    expect(localStorage.getItem("learnedWords")).toBe('[{"word":"hello"}]');
    expect(localStorage.getItem("unifiedMistakes")).toBe('[{"id":"m1"}]');
  });

  it("overwrites existing keys and keeps unrelated ones", () => {
    localStorage.setItem("learnedWords", "[]");
    localStorage.setItem("theme", "dark");

    const result = importData(makeBackup({ learnedWords: '[{"word":"new"}]' }));

    expect(result.imported).toBe(1);
    expect(localStorage.getItem("learnedWords")).toBe('[{"word":"new"}]');
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("refuses to import runtime-only keys", () => {
    const result = importData(makeBackup({ syncKey: "stolen", learnedWords: "[]" }));

    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(localStorage.getItem("syncKey")).toBeNull();
  });

  it("rejects a file from another app", () => {
    expect(() => importData(makeBackup({}, { app: "other-app" }))).toThrow(
      "Đây không phải file sao lưu của ThankZ English."
    );
  });

  it("rejects a newer backup version", () => {
    expect(() => importData(makeBackup({}, { version: BACKUP_VERSION + 1 }))).toThrow(
      "Phiên bản file sao lưu không được hỗ trợ."
    );
  });

  it("rejects invalid JSON", () => {
    expect(() => importData("not json")).toThrow("File không phải JSON hợp lệ.");
  });

  it("rejects a backup without data", () => {
    expect(() => importData(JSON.stringify({ app: BACKUP_APP, version: 1 }))).toThrow(
      "File sao lưu thiếu phần dữ liệu."
    );
  });

  it("does not write anything when validation fails", () => {
    localStorage.setItem("learnedWords", "[]");
    expect(() => importData(makeBackup({ learnedWords: "[]" }, { app: "nope" }))).toThrow();
    expect(localStorage.getItem("learnedWords")).toBe("[]");
  });
});

describe("clearAllData", () => {
  it("removes app data but keeps runtime-only keys", () => {
    localStorage.setItem("learnedWords", "[]");
    localStorage.setItem("theme", "dark");
    localStorage.setItem("syncKey", "abc");

    const removed = clearAllData();

    expect(removed).toBe(2);
    expect(localStorage.getItem("learnedWords")).toBeNull();
    expect(localStorage.getItem("theme")).toBeNull();
    expect(localStorage.getItem("syncKey")).toBe("abc");
  });

  it("also removes the word job even though it is runtime-only", () => {
    localStorage.setItem("wordBank", "[]");
    localStorage.setItem("wordJob", '{"id":"j1"}');
    clearAllData();
    expect(localStorage.getItem("wordJob")).toBeNull();
    expect(localStorage.getItem("wordBank")).toBeNull();
  });
});

describe("backupFileName", () => {
  it("includes the export date", () => {
    expect(backupFileName(new Date(2026, 10, 13))).toBe("thankz-english-backup-2026-11-13.json");
  });
});

describe("mergeData", () => {
  const word = (w: string, updatedAt: string, meaning = "old") => ({ word: w, meaning, example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", updatedAt });

  it("keeps words from both devices and lets the newer edit win", () => {
    localStorage.setItem("learnedWords", JSON.stringify([word("alpha", "2026-11-10T00:00:00.000Z", "local"), word("beta", "2026-11-12T00:00:00.000Z", "local")]));
    mergeData(makeBackup({ learnedWords: JSON.stringify([word("alpha", "2026-11-11T00:00:00.000Z", "file"), word("beta", "2026-11-01T00:00:00.000Z", "file"), word("gamma", "2026-11-05T00:00:00.000Z", "file")]) }));
    const merged = JSON.parse(localStorage.getItem("learnedWords")!);
    expect(merged.map((w: { word: string; meaning: string }) => `${w.word}:${w.meaning}`)).toEqual(["alpha:file", "beta:local", "gamma:file"]);
  });

  it("unions sessions newest-first, takes the larger study time per day and keeps local settings", () => {
    localStorage.setItem("learningSessions", JSON.stringify([{ id: "a", startedAt: "2026-11-10T00:00:00.000Z" }]));
    localStorage.setItem("studyTime", JSON.stringify({ "2026-11-10": 600, "2026-11-11": 100 }));
    localStorage.setItem("theme", "dark");
    const result = mergeData(makeBackup({
      learningSessions: JSON.stringify([{ id: "b", startedAt: "2026-11-12T00:00:00.000Z" }, { id: "a", startedAt: "2026-11-10T00:00:00.000Z" }]),
      studyTime: JSON.stringify({ "2026-11-10": 300, "2026-11-11": 900 }),
      theme: "light",
      customTopics: JSON.stringify(["Travel"]),
    }));
    expect(JSON.parse(localStorage.getItem("learningSessions")!).map((x: { id: string }) => x.id)).toEqual(["b", "a"]);
    expect(JSON.parse(localStorage.getItem("studyTime")!)).toEqual({ "2026-11-10": 600, "2026-11-11": 900 });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(localStorage.getItem("customTopics")).toBe('["Travel"]');
    expect(result).toEqual({ imported: 3, skipped: 0 });
  });

  it("merges exam banks per key and ignores malformed values", () => {
    localStorage.setItem("examBank", JSON.stringify({ "TOEIC:RC5:3": [{ id: "q1" }] }));
    localStorage.setItem("unifiedMistakes", "not json");
    mergeData(makeBackup({ examBank: JSON.stringify({ "TOEIC:RC5:3": [{ id: "q1" }, { id: "q2" }], "IELTS:READ_P3:2": [{ id: "r1" }] }), unifiedMistakes: "[]" }));
    expect(JSON.parse(localStorage.getItem("examBank")!)).toEqual({ "TOEIC:RC5:3": [{ id: "q1" }, { id: "q2" }], "IELTS:READ_P3:2": [{ id: "r1" }] });
    expect(localStorage.getItem("unifiedMistakes")).toBe("not json");
  });

  it("merges wordBank by word and keeps seenAt", () => {
    localStorage.setItem("wordBank", JSON.stringify([
      { word: "alpha", meaning: "a", topic: "TOEIC", createdAt: "2026-11-01T00:00:00.000Z" },
    ]));
    mergeData(makeBackup({
      wordBank: JSON.stringify([
        { word: "Alpha", meaning: "a", topic: "TOEIC", createdAt: "2026-11-01T00:00:00.000Z", seenAt: "2026-11-02T00:00:00.000Z" },
        { word: "beta", meaning: "b", topic: "TOEIC", createdAt: "2026-11-01T00:00:00.000Z" },
      ]),
    }));
    const bank = JSON.parse(localStorage.getItem("wordBank") ?? "[]");
    expect(bank).toHaveLength(2);
    expect(bank[0].seenAt).toBe("2026-11-02T00:00:00.000Z");
  });
});

describe("backup reminder", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");

  it("asks for a backup only when there is learning data and the last one is older than 7 days", () => {
    expect(needsBackup(now)).toBe(false);
    localStorage.setItem("learnedWords", '[{"word":"hello"}]');
    expect(needsBackup(now)).toBe(true);
    markBackedUp(new Date("2026-11-12T12:00:00.000Z"));
    expect(needsBackup(now)).toBe(false);
    markBackedUp(new Date("2026-11-09T12:00:00.000Z"));
    expect(needsBackup(now)).toBe(true);
  });

  it("sees word bank activity as data worth backing up", () => {
    localStorage.setItem("wordBank", '[{"word":"alpha"}]');
    expect(needsBackup(now)).toBe(true);
  });
});
