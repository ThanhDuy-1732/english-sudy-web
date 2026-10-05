import { asArray } from "../safe-json";
const KEY = "examTagAccuracies";

interface TagRecord {
  tag: string;
  correct: number;
  total: number;
}

export interface TagAccuracy {
  tag: string;
  correct: number;
  total: number;
  accuracy: number; // 0–100
}

function load(): TagRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? asArray<TagRecord>(JSON.parse(r)) : [];
  } catch {
    return [];
  }
}

function save(records: TagRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function recordTagResult(tag: string, correct: boolean) {
  const records = load();
  const existing = records.find((r) => r.tag === tag);
  if (existing) {
    existing.correct += correct ? 1 : 0;
    existing.total += 1;
    save(records);
  } else {
    save([...records, { tag, correct: correct ? 1 : 0, total: 1 }]);
  }
}

export function getTagAccuracies(): TagAccuracy[] {
  return load().map((r) => ({
    ...r,
    accuracy: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
  }));
}

export function getWeakTags(threshold = 60): TagAccuracy[] {
  return getTagAccuracies()
    .filter((t) => t.total >= 3 && t.accuracy < threshold)
    .sort((a, b) => a.accuracy - b.accuracy);
}

// 70% weak / 20% normal / 10% strong
const ADAPTIVE_WEIGHTS = { weak: 0.7, normal: 0.2, strong: 0.1 };

export function selectAdaptiveItems<T extends { tags?: string[] }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) return [...items];
  const tagMap = new Map(getTagAccuracies().map((t) => [t.tag, t.accuracy]));

  function score(item: T): number {
    // No tag data → treat as normal (not weak, not strong)
    if (!item.tags?.length) return 70;
    const accs = item.tags.map((t) => tagMap.get(t) ?? 70);
    return accs.reduce((s, a) => s + a, 0) / accs.length;
  }

  const shuffled = items.slice().sort(() => Math.random() - 0.5);
  const weak = shuffled.filter((i) => score(i) < 60);
  const normal = shuffled.filter((i) => { const s = score(i); return s >= 60 && s < 80; });
  const strong = shuffled.filter((i) => score(i) >= 80);

  const result: T[] = [];
  function pick(pool: T[], n: number) {
    result.push(...pool.slice(0, Math.min(n, pool.length)));
  }

  pick(weak, Math.round(count * ADAPTIVE_WEIGHTS.weak));
  pick(normal, Math.round(count * ADAPTIVE_WEIGHTS.normal));
  pick(strong, Math.round(count * ADAPTIVE_WEIGHTS.strong));

  if (result.length < count) {
    const picked = new Set(result);
    const remaining = shuffled.filter((i) => !picked.has(i));
    result.push(...remaining.slice(0, count - result.length));
  }

  return result.slice(0, count);
}
