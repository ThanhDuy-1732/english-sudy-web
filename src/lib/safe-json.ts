/**
 * Top-level-type guard for values read back from storage (older versions, sync merges or manual edits can leave
 * `{}` where an array is expected). Callers keep their own try/catch for storage access and JSON.parse errors.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asObject<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : fallback;
}

/** Reads JSON from localStorage; returns `fallback` when storage is unavailable, malformed, or the wrong top-level type. */
export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(value) ? (value as T) : fallback;
    if (fallback && typeof fallback === "object") return asObject(value, fallback as object) as T;
    return typeof value === typeof fallback ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

/** localStorage.getItem that returns null instead of throwing when storage is blocked. */
export function readString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
