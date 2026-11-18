// src/lib/data-transfer.ts
// localStorage là nguồn dữ liệu duy nhất; file JSON chỉ dùng để backup / chuyển máy.

export const BACKUP_APP = "english-study";
export const BACKUP_VERSION = 1;

// Runtime-only keys that must never leave the device.
const EXCLUDED_KEYS = new Set(["syncKey", "syncFailedQueue", "backupReminderSnoozedUntil", "retentionRanOn", "studyReminderSnoozedOn", "wordJob"]);

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

function isExcluded(key: string): boolean {
  return EXCLUDED_KEYS.has(key);
}

export function exportData(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || isExcluded(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }

  const backup: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("File không phải JSON hợp lệ.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Nội dung file không hợp lệ.");
  }

  const file = parsed as Partial<BackupFile>;
  if (file.app !== BACKUP_APP) {
    throw new Error("Đây không phải file sao lưu của ThankZ English.");
  }
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) {
    throw new Error("Phiên bản file sao lưu không được hỗ trợ.");
  }
  if (!file.data || typeof file.data !== "object" || Array.isArray(file.data)) {
    throw new Error("File sao lưu thiếu phần dữ liệu.");
  }

  return {
    app: file.app,
    version: file.version,
    exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : "",
    data: file.data as Record<string, string>,
  };
}

export function importData(json: string): { imported: number; skipped: number } {
  const backup = parseBackup(json);
  let imported = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(backup.data)) {
    if (isExcluded(key) || typeof value !== "string") {
      skipped++;
      continue;
    }
    localStorage.setItem(key, value);
    imported++;
  }

  return { imported, skipped };
}

/*
 * Merge import: combine a backup with what is already on this device instead of replacing whole keys.
 * Lists of records are merged item by item (identity below, newer timestamp wins, ties keep the local copy);
 * settings and caches keep the local value and only fill in what is missing.
 * ponytail: deletions are not tracked (no tombstones), so a word deleted here but present in the file comes back.
 */
type Item = Record<string, unknown>;

const IDENTITY: Record<string, (item: Item) => string> = {
  learnedWords: (x) => String(x.word),
  wordBank: (x) => String(x.word).trim().toLowerCase(),
  dailyChallenge: (x) => String(x.date),
  reportedQuestions: (x) => String(x.questionId),
  grammarBookmarks: (x) => `${x.topicId}:${x.subRuleId}`,
  masteryTimeline: (x) => `${x.date}:${x.skill}`,
  examTagAccuracies: (x) => String(x.tag),
};

// Stored newest-first by their owners; keep that order after merging.
const NEWEST_FIRST = new Set(["learningSessions", "examAttempts", "speakingSessions", "writingSubmissions"]);
// ISO timestamps where the later value is the right one.
const LATEST_WINS = new Set(["lastSpeakingAt", "lastWritingAt", "lastBackupAt"]);

function stamp(item: Item): number {
  const value = item.updatedAt ?? item.finishedAt ?? item.createdAt ?? item.learnedAt ?? item.startedAt ?? item.reportedAt ?? item.at;
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function isRecord(value: unknown): value is Item {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function incomingWins(key: string, local: Item, incoming: Item): boolean {
  if (key === "examTagAccuracies") return Number(incoming.total) > Number(local.total);
  if (key === "dailyChallenge") return Boolean(incoming.completed) && !local.completed;
  // A word seen on either device must stay seen after a merge, or it reappears as new.
  if (key === "wordBank") return Boolean(incoming.seenAt) && !local.seenAt;
  return stamp(incoming) > stamp(local);
}

function mergeList(key: string, local: unknown[], incoming: unknown[]): unknown[] {
  if ([...local, ...incoming].every((x) => typeof x === "string")) return [...new Set([...local, ...incoming])];
  const identity = IDENTITY[key] ?? ((x: Item) => (typeof x.id === "string" ? x.id : JSON.stringify(x)));
  const merged = new Map<string, unknown>();
  for (const item of local) merged.set(isRecord(item) ? identity(item) : JSON.stringify(item), item);
  for (const item of incoming) {
    const id = isRecord(item) ? identity(item) : JSON.stringify(item);
    const current = merged.get(id);
    if (current === undefined || (isRecord(current) && isRecord(item) && incomingWins(key, current, item))) merged.set(id, item);
  }
  const result = [...merged.values()];
  return NEWEST_FIRST.has(key) ? result.sort((a, b) => stamp(b as Item) - stamp(a as Item)) : result;
}

/** Returns the merged raw value, or null to keep the local value unchanged. */
function mergeValue(key: string, localRaw: string, incomingRaw: string): string | null {
  if (LATEST_WINS.has(key)) return Date.parse(incomingRaw) > Date.parse(localRaw) ? incomingRaw : null;
  let local: unknown;
  let incoming: unknown;
  try {
    local = JSON.parse(localRaw);
    incoming = JSON.parse(incomingRaw);
  } catch {
    return null;
  }
  if (Array.isArray(local) && Array.isArray(incoming)) return JSON.stringify(mergeList(key, local, incoming));
  if (key === "studyTime" && isRecord(local) && isRecord(incoming)) {
    const merged: Record<string, number> = { ...(local as Record<string, number>) };
    for (const [day, seconds] of Object.entries(incoming)) {
      if (typeof seconds === "number" && seconds > (merged[day] ?? 0)) merged[day] = seconds;
    }
    return JSON.stringify(merged);
  }
  if (key === "examBank" && isRecord(local) && isRecord(incoming)) {
    const merged: Item = { ...local };
    for (const [bankKey, items] of Object.entries(incoming)) {
      const current = merged[bankKey];
      merged[bankKey] = Array.isArray(current) && Array.isArray(items) ? mergeList(key, current, items) : current ?? items;
    }
    return JSON.stringify(merged);
  }
  return null; // settings, profile, caches: this device's value stays
}

export function mergeData(json: string): { imported: number; skipped: number } {
  const backup = parseBackup(json);
  let imported = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(backup.data)) {
    if (isExcluded(key) || typeof value !== "string") {
      skipped++;
      continue;
    }
    const local = localStorage.getItem(key);
    const next = local === null ? value : mergeValue(key, local, value);
    if (next !== null && next !== local) {
      localStorage.setItem(key, next);
      imported++;
    }
  }

  return { imported, skipped };
}

/* Backup reminder and storage use. */
export const LAST_BACKUP_KEY = "lastBackupAt";
export const BACKUP_REMIND_DAYS = 7;

export function markBackedUp(date = new Date()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, date.toISOString());
  } catch {
    // Storage full or blocked: the reminder will simply show again.
  }
}

/** True when there is learning data and no backup in the last BACKUP_REMIND_DAYS days. */
export function needsBackup(now = new Date()): boolean {
  try {
    const hasData = ["learnedWords", "learningSessions", "unifiedMistakes", "writingSubmissions", "speakingSessions", "wordBank"].some((key) => {
      const raw = localStorage.getItem(key);
      return raw !== null && raw !== "[]";
    });
    if (!hasData) return false;
    const last = Date.parse(localStorage.getItem(LAST_BACKUP_KEY) ?? "");
    return Number.isNaN(last) || now.getTime() - last > BACKUP_REMIND_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Saves a backup file in the browser and remembers the date for the reminder. */
export function downloadBackup(json: string, date = new Date()): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName(date);
  link.click();
  URL.revokeObjectURL(url);
  markBackedUp(date);
}

// Browsers give localStorage about 5 MB per site; it is what fills up first (examBank grows fastest).
export const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;

/** Approximate bytes used by this app in localStorage (UTF-16: 2 bytes per character), largest keys first. */
export function storageUsage(): { bytes: number; keys: { key: string; bytes: number }[] } {
  const keys: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      keys.push({ key, bytes: (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2 });
    }
  } catch {
    // Blocked storage: report nothing.
  }
  keys.sort((a, b) => b.bytes - a.bytes);
  return { bytes: keys.reduce((sum, k) => sum + k.bytes, 0), keys };
}

export function clearAllData(): number {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !isExcluded(key)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  // Runtime keys stay out of backup/import, but clearing data must not leave a job
  // that resumes later and spends AI against an empty bank.
  localStorage.removeItem("wordJob");
  return keys.length;
}

export function backupFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `thankz-english-backup-${y}-${m}-${d}.json`;
}
