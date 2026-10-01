/**
 * Per-entity conflict strategies:
 *
 * learnedWords        → LWW (last-write-wins by updatedAt)
 * learningSessions    → append (never overwrite, client id is unique)
 * examAttempts        → append
 * mistakeLog          → legacy; migrated once into unifiedMistakes (see mistake-migration.ts)
 * unifiedMistakes     → LWW by updatedAt
 * grammarAttempts     → append
 * speakingSessions    → append (audio stays local-only)
 * writingSubmissions  → LWW by updatedAt; versions array merges by version number
 * dailyChallenges     → completed wins (once completed, stays completed)
 * grammarTopics       → LWW by updatedAt
 * voiceSettings       → LWW by updatedAt
 * Audio (IndexedDB)   → local-only, never synced
 * Deletes             → tombstone: set deletedAt, filter out on read
 *
 * Only learnedWords, examAttempts, and unifiedMistakes currently route through
 * mergeLww() below; dailyChallenges/grammarTopics/voiceSettings apply their
 * strategy inline in sync.ts's initSync().
 */

/**
 * stamp() — extracts the best comparable timestamp from an object.
 * Falls back: updatedAt → learnedAt → createdAt → ''
 */
export function stamp(obj: Record<string, unknown>): string {
  return (
    (obj.updatedAt as string | undefined) ??
    (obj.learnedAt as string | undefined) ??
    (obj.createdAt as string | undefined) ??
    ""
  );
}

export interface MergeResult<T> {
  merged: T[];
  toPush: T[];
}

/**
 * LWW (Last-Write-Wins) merge of local and remote arrays.
 * - Tie goes to local (no push needed).
 * - Returns merged list and the items that must be pushed to remote.
 */
export function mergeLww<T>(
  local: T[],
  remote: T[],
  getId: (item: T) => string,
): MergeResult<T> {
  const s = (item: T) => stamp(item as unknown as Record<string, unknown>);
  const localMap = new Map(local.map((item) => [getId(item), item]));
  const remoteMap = new Map(remote.map((item) => [getId(item), item]));

  const merged = new Map<string, T>();
  const toPush: T[] = [];

  // Start with all local items
  for (const [id, loc] of Array.from(localMap.entries())) {
    const rem = remoteMap.get(id);
    if (!rem) {
      // Local-only → need to push
      merged.set(id, loc);
      toPush.push(loc);
    } else if (s(rem) > s(loc)) {
      // Remote is newer → take remote (no push)
      merged.set(id, rem);
    } else {
      // Local is newer or equal → keep local, push if strictly newer
      merged.set(id, loc);
      if (s(loc) > s(rem)) toPush.push(loc);
    }
  }

  // Remote-only items → pull in (no push needed)
  for (const [id, rem] of Array.from(remoteMap.entries())) {
    if (!merged.has(id)) merged.set(id, rem);
  }

  return { merged: Array.from(merged.values()), toPush };
}
