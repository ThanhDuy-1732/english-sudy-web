export interface GrammarBookmark {
  topicId: string;
  subRuleId: string;
  createdAt: string;
}

const KEY = "grammarBookmarks";

function ls(): GrammarBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as GrammarBookmark[]) : [];
  } catch { return []; }
}

export function getBookmarks(): GrammarBookmark[] { return ls(); }

export function isBookmarked(topicId: string, subRuleId: string): boolean {
  return ls().some((b) => b.topicId === topicId && b.subRuleId === subRuleId);
}

export function toggleBookmark(topicId: string, subRuleId: string): boolean {
  const all = ls();
  const idx = all.findIndex((b) => b.topicId === topicId && b.subRuleId === subRuleId);
  if (idx >= 0) {
    localStorage.setItem(KEY, JSON.stringify(all.filter((_, i) => i !== idx)));
    return false;
  }
  localStorage.setItem(KEY, JSON.stringify([
    ...all,
    { topicId, subRuleId, createdAt: new Date().toISOString() },
  ]));
  return true;
}
