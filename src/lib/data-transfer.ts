// src/lib/data-transfer.ts
// localStorage là nguồn dữ liệu duy nhất; file JSON chỉ dùng để backup / chuyển máy.

export const BACKUP_APP = "english-study";
export const BACKUP_VERSION = 1;

// Runtime-only keys that must never leave the device.
const EXCLUDED_KEYS = new Set(["syncKey", "syncFailedQueue"]);

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
    throw new Error("Đây không phải file sao lưu của English Study.");
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

export function clearAllData(): number {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !isExcluded(key)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  return keys.length;
}

export function backupFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `english-study-backup-${y}-${m}-${d}.json`;
}
