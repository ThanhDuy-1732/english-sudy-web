import { createSupabase } from "./supabase";
import { type LearnedWord, getLearnedWords, saveLearnedWord } from "./storage";
import { type DailyChallenge } from "./daily-challenge";
import { getCustomTopics, saveCustomTopic } from "./custom-topics";

const SYNC_KEY_LS = "syncKey";
const LAST_SYNCED_LS = "lastSyncedAt";

const KEY_ALIASES: Record<string, string> = {
  thankz: "7468616e-6b7a-4000-8000-000000000000",
};

export function getSyncKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(SYNC_KEY_LS);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(SYNC_KEY_LS, key);
  }
  return key;
}

export function getLastSyncedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNCED_LS);
}

function setLastSyncedAt() {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_SYNCED_LS, new Date().toISOString());
  }
}

export async function pushWord(entry: LearnedWord): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("learned_words").upsert({
      sync_key: syncKey,
      word: entry.word,
      meaning: entry.meaning ?? null,
      example: entry.example ?? null,
      topic: entry.topic ?? null,
      learned_at: entry.learnedAt,
      next_review_at: entry.nextReviewAt ?? null,
      review_interval: entry.reviewInterval ?? 1,
      mastery: entry.mastery ?? 0,
      synonyms: entry.synonyms ?? null,
      antonyms: entry.antonyms ?? null,
    });
  } catch { /* fire-and-forget */ }
}

export async function deleteWord(word: string): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("learned_words").delete().match({ sync_key: syncKey, word });
  } catch { /* fire-and-forget */ }
}

export async function pushTopic(topic: string): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("custom_topics").upsert({ sync_key: syncKey, topic });
  } catch { /* fire-and-forget */ }
}

export async function pushChallenge(record: DailyChallenge): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await supabase.from("daily_challenges").upsert({
      sync_key: syncKey,
      date: record.date,
      words: record.words,
      completed: record.completed,
    });
  } catch { /* fire-and-forget */ }
}

export async function initSync(): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);

  try {
    const localWords = getLearnedWords();
    if (localWords.length > 0) {
      await supabase.from("learned_words").upsert(
        localWords.map((w) => ({
          sync_key: syncKey,
          word: w.word,
          meaning: w.meaning ?? null,
          example: w.example ?? null,
          topic: w.topic ?? null,
          learned_at: w.learnedAt,
          next_review_at: w.nextReviewAt ?? null,
          review_interval: w.reviewInterval ?? 1,
          mastery: w.mastery ?? 0,
          synonyms: w.synonyms ?? null,
          antonyms: w.antonyms ?? null,
        }))
      );
    }

    const localTopics = getCustomTopics();
    if (localTopics.length > 0) {
      await supabase
        .from("custom_topics")
        .upsert(localTopics.map((t) => ({ sync_key: syncKey, topic: t })));
    }

    const rawChallenges = localStorage.getItem("dailyChallenge");
    const localChallenges: DailyChallenge[] = rawChallenges
      ? (JSON.parse(rawChallenges) as DailyChallenge[])
      : [];
    if (localChallenges.length > 0) {
      await supabase.from("daily_challenges").upsert(
        localChallenges.map((c) => ({
          sync_key: syncKey,
          date: c.date,
          words: c.words,
          completed: c.completed,
        }))
      );
    }

    const { data: remoteWords } = await supabase
      .from("learned_words")
      .select("*")
      .eq("sync_key", syncKey);

    if (remoteWords && remoteWords.length > 0) {
      const wordMap = new Map(localWords.map((w) => [w.word.toLowerCase(), w]));
      for (const row of remoteWords) {
        const existing = wordMap.get((row.word as string).toLowerCase());
        if (!existing || new Date(row.learned_at as string) > new Date(existing.learnedAt)) {
          wordMap.set((row.word as string).toLowerCase(), {
            word: row.word as string,
            meaning: (row.meaning as string) ?? "",
            example: (row.example as string) ?? "",
            topic: (row.topic as string) ?? "",
            learnedAt: row.learned_at as string,
            nextReviewAt: (row.next_review_at as string | null) ?? undefined,
            reviewInterval: (row.review_interval as number) ?? 1,
            mastery: (row.mastery as number) ?? 0,
            synonyms: (row.synonyms as string[] | null) ?? undefined,
            antonyms: (row.antonyms as string[] | null) ?? undefined,
          });
        }
      }
      localStorage.setItem("learnedWords", JSON.stringify(Array.from(wordMap.values())));
    }

    const { data: remoteTopics } = await supabase
      .from("custom_topics")
      .select("topic")
      .eq("sync_key", syncKey);

    if (remoteTopics) {
      remoteTopics.forEach((row) => saveCustomTopic(row.topic as string));
    }

    const { data: remoteChallenges } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("sync_key", syncKey);

    if (remoteChallenges && remoteChallenges.length > 0) {
      const challengeMap = new Map(localChallenges.map((c) => [c.date, c]));
      for (const row of remoteChallenges) {
        if (!challengeMap.has(row.date as string) || (row.completed as boolean)) {
          challengeMap.set(row.date as string, {
            date: row.date as string,
            words: row.words as string[],
            completed: row.completed as boolean,
          });
        }
      }
      localStorage.setItem(
        "dailyChallenge",
        JSON.stringify(Array.from(challengeMap.values()))
      );
    }

    setLastSyncedAt();
  } catch { /* fire-and-forget */ }
}

export async function pullFromKey(key: string): Promise<number> {
  if (typeof window === "undefined") return 0;
  const trimmed = key.trim();
  const resolved = KEY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
  const supabase = createSupabase(resolved);

  const [wordsResult, topicsResult, challengesResult] = await Promise.all([
    supabase.from("learned_words").select("*").eq("sync_key", resolved),
    supabase.from("custom_topics").select("topic").eq("sync_key", resolved),
    supabase.from("daily_challenges").select("*").eq("sync_key", resolved),
  ]);

  if (wordsResult.error) throw wordsResult.error;
  if (topicsResult.error) throw topicsResult.error;
  if (challengesResult.error) throw challengesResult.error;

  let newWordsCount = 0;

  if (wordsResult.data) {
    const localWords = getLearnedWords();
    const localWordSet = new Set(localWords.map((w) => w.word.toLowerCase()));
    for (const row of wordsResult.data) {
      if (!localWordSet.has((row.word as string).toLowerCase())) {
        saveLearnedWord({
          word: row.word as string,
          meaning: (row.meaning as string) ?? "",
          example: (row.example as string) ?? "",
          topic: (row.topic as string) ?? "",
          learnedAt: row.learned_at as string,
          nextReviewAt: (row.next_review_at as string | null) ?? undefined,
          reviewInterval: (row.review_interval as number) ?? 1,
          mastery: (row.mastery as number) ?? 0,
          synonyms: (row.synonyms as string[] | null) ?? undefined,
          antonyms: (row.antonyms as string[] | null) ?? undefined,
        });
        newWordsCount++;
      }
    }
  }

  if (topicsResult.data) {
    topicsResult.data.forEach((row) => saveCustomTopic(row.topic as string));
  }

  if (challengesResult.data && challengesResult.data.length > 0) {
    const rawChallenges = localStorage.getItem("dailyChallenge");
    const localChallenges: DailyChallenge[] = rawChallenges
      ? (JSON.parse(rawChallenges) as DailyChallenge[])
      : [];
    const localDates = new Set(localChallenges.map((c) => c.date));
    const newChallenges = challengesResult.data
      .filter((row) => !localDates.has(row.date as string))
      .map((row) => ({
        date: row.date as string,
        words: row.words as string[],
        completed: row.completed as boolean,
      }));
    if (newChallenges.length > 0) {
      localStorage.setItem(
        "dailyChallenge",
        JSON.stringify([...localChallenges, ...newChallenges])
      );
    }
  }

  return newWordsCount;
}
