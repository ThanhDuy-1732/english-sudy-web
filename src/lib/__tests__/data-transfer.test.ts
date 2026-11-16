import {
  BACKUP_APP,
  BACKUP_VERSION,
  backupFileName,
  clearAllData,
  exportData,
  importData,
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
      "Đây không phải file sao lưu của English Study."
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
});

describe("backupFileName", () => {
  it("includes the export date", () => {
    expect(backupFileName(new Date(2026, 10, 13))).toBe("english-study-backup-2026-11-13.json");
  });
});
