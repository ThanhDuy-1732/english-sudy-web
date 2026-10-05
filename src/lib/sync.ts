import { syncRequest } from "@/lib/sync-request";
import { createSupabase } from "./supabase";
import { type LearnedWord, getLearnedWords, saveLearnedWord } from "./storage";
import { mergeLww } from "./sync-merge";
import { type DailyChallenge } from "./daily-challenge";
import { getCustomTopics, saveCustomTopic } from "./custom-topics";
import { type GrammarTopic } from "./grammar-data";
import { getUserGrammarTopics, saveUserGrammarTopic } from "./grammar-storage";
import { getVoiceSettings, saveVoiceSettings, type VoiceSettings } from "./voiceSettings";
import type { ExamItem, ExamAttempt, MistakeEntry } from "./exam/types";
import type { UnifiedMistake } from "./mistakes";
import { enqueue, registerProcessor, getQueueLength, setSyncInitializationFailed, type QueueEntry } from "./sync-queue";

const SYNC_KEY_LS = "syncKey";
const LAST_SYNCED_LS = "lastSyncedAt";

const KEY_ALIASES: Record<string, string> = {
  thankz: "7468616e-6b7a-4000-8000-000000000000",
};

// Used when storage is blocked or full: the key then lives only for this page session.
let sessionOnlyKey: string | null = null;

export function getSyncKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let key = localStorage.getItem(SYNC_KEY_LS);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(SYNC_KEY_LS, key);
    }
    return key;
  } catch {
    return (sessionOnlyKey ??= crypto.randomUUID());
  }
}

export function getLastSyncedAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_SYNCED_LS);
  } catch {
    return null;
  }
}

function setLastSyncedAt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_SYNCED_LS, new Date().toISOString());
  } catch {
    // Storage blocked or full: the sync itself already succeeded.
  }
}

function resolveVoiceSettings(remote: VoiceSettings): VoiceSettings {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return { ...remote, voiceURI: null };
  }

  const availableURIs = window.speechSynthesis.getVoices().map((voice) => voice.voiceURI);
  const voiceURI = remote.voiceURI && availableURIs.includes(remote.voiceURI) ? remote.voiceURI : null;
  return { ...remote, voiceURI };
}

function wordToRow(syncKey: string, w: LearnedWord) {
  return {
    sync_key: syncKey,
    word: w.word,
    meaning: w.meaning ?? null,
    example: w.example ?? null,
    topic: w.topic ?? null,
    learned_at: w.learnedAt,
    updated_at: w.updatedAt ?? w.learnedAt,
    next_review_at: w.nextReviewAt ?? null,
    review_interval: w.reviewInterval ?? 1,
    mastery: w.mastery ?? 0,
    easiness: w.easiness ?? 2.5,
    repetitions: w.repetitions ?? 0,
    synonyms: w.synonyms ?? null,
    antonyms: w.antonyms ?? null,
  };
}

function rowToWord(row: Record<string, unknown>): LearnedWord {
  return {
    word: row.word as string,
    meaning: (row.meaning as string) ?? "",
    example: (row.example as string) ?? "",
    topic: (row.topic as string) ?? "",
    learnedAt: row.learned_at as string,
    updatedAt: (row.updated_at as string | null) ?? undefined,
    nextReviewAt: (row.next_review_at as string | null) ?? undefined,
    reviewInterval: (row.review_interval as number) ?? 1,
    mastery: (row.mastery as number) ?? 0,
    easiness: (row.easiness as number) ?? 2.5,
    repetitions: (row.repetitions as number) ?? 0,
    synonyms: (row.synonyms as string[] | null) ?? undefined,
    antonyms: (row.antonyms as string[] | null) ?? undefined,
  };
}

export async function pushWord(entry: LearnedWord): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("learned_words").upsert(wordToRow(syncKey, entry)));
  } catch {
    enqueue({ entity: "learnedWords", entityId: entry.word, op: "upsert", payload: entry });
  }
}

export async function deleteWord(word: string): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("learned_words").delete().match({ sync_key: syncKey, word }));
  } catch {
    enqueue({ entity: "learnedWords", entityId: word, op: "delete", payload: { word } });
  }
}

export async function pushTopic(topic: string): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("custom_topics").upsert({ sync_key: syncKey, topic }));
  } catch {
    enqueue({ entity: "customTopics", entityId: topic, op: "upsert", payload: { topic } });
  }
}

export async function pushGrammarTopic(topic: GrammarTopic): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("grammar_topics").upsert({
      sync_key: syncKey,
      id: topic.id,
      name: topic.name,
      rules: topic.rules,
      created_at: topic.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    enqueue({ entity: "grammarTopics", entityId: topic.id, op: "upsert", payload: topic });
  }
}

export async function pushChallenge(record: DailyChallenge): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("daily_challenges").upsert({
      sync_key: syncKey,
      date: record.date,
      words: record.words,
      completed: record.completed,
    }));
  } catch {
    enqueue({ entity: "dailyChallenges", entityId: record.date, op: "upsert", payload: record });
  }
}

export async function pushExamItem(item: ExamItem): Promise<void> {
  if (typeof window === "undefined") return;
  const supabase = createSupabase(getSyncKey());
  try {
    await syncRequest(supabase.from("exam_items").upsert({
      id: item.id,
      exam_type: item.kind,
      part: item.part,
      level: item.level,
      payload: item,
      flagged: false,
    }, { onConflict: "id", ignoreDuplicates: true }));
  } catch {
    enqueue({ entity: "examItems", entityId: item.id, op: "upsert", payload: item });
  }
}

export async function pushAttempt(attempt: ExamAttempt): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("exam_attempts").upsert({
      id: attempt.id,
      sync_key: syncKey,
      exam_type: attempt.kind,
      mode: attempt.mode,
      parts: attempt.parts,
      started_at: attempt.startedAt,
      finished_at: attempt.finishedAt ?? null,
      answers: attempt.answers,
      score: attempt.score ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" }));
  } catch {
    enqueue({ entity: "examAttempts", entityId: attempt.id, op: "upsert", payload: attempt });
  }
}

export async function pushUnifiedMistake(mistake: UnifiedMistake): Promise<void> {
  if (typeof window === "undefined") return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);
  try {
    await syncRequest(supabase.from("unified_mistakes").upsert({
      sync_key: syncKey,
      id: mistake.id,
      payload: mistake,
      updated_at: mistake.updatedAt,
    }));
  } catch {
    enqueue({ entity: "unifiedMistakes", entityId: mistake.id, op: "upsert", payload: mistake });
  }
}

export async function pullExamItems(
  kind: string,
  part: string,
  level: number,
  limit = 10,
): Promise<ExamItem[]> {
  if (typeof window === "undefined") return [];
  const supabase = createSupabase(getSyncKey());
  const { data, error } = await supabase
    .from("exam_items")
    .select("payload")
    .eq("exam_type", kind)
    .eq("part", part)
    .eq("level", level)
    .eq("flagged", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => r.payload as ExamItem);
}

export async function initSync(): Promise<void> {
  // Flush queued deletions/edits before pulling remote state back onto the device.
  if (typeof window === "undefined" || !navigator.onLine || getQueueLength() > 0) return;
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);

  try {
    const localWords = getLearnedWords();

    // Pull remote first, then merge LWW, then push only the diff
    const { data: remoteWordRows } = await syncRequest(supabase
      .from("learned_words")
      .select("*")
      .eq("sync_key", syncKey));

    const remoteWords: LearnedWord[] = (remoteWordRows ?? []).map(
      (r) => rowToWord(r as Record<string, unknown>)
    );
    const { merged, toPush } = mergeLww(localWords, remoteWords, (w) => w.word.toLowerCase());
    localStorage.setItem("learnedWords", JSON.stringify(merged));

    if (toPush.length > 0) {
      await syncRequest(supabase.from("learned_words").upsert(
        toPush.map((w) => wordToRow(syncKey, w))
      ));
    }

    const localTopics = getCustomTopics();
    if (localTopics.length > 0) {
      await syncRequest(supabase
        .from("custom_topics")
        .upsert(localTopics.map((t) => ({ sync_key: syncKey, topic: t }))));
    }

    const rawChallenges = localStorage.getItem("dailyChallenge");
    const localChallenges: DailyChallenge[] = rawChallenges
      ? (JSON.parse(rawChallenges) as DailyChallenge[])
      : [];
    if (localChallenges.length > 0) {
      await syncRequest(supabase.from("daily_challenges").upsert(
        localChallenges.map((c) => ({
          sync_key: syncKey,
          date: c.date,
          words: c.words,
          completed: c.completed,
        }))
      ));
    }

    const { data: remoteTopics } = await syncRequest(supabase
      .from("custom_topics")
      .select("topic")
      .eq("sync_key", syncKey));

    if (remoteTopics) {
      remoteTopics.forEach((row) => saveCustomTopic(row.topic as string));
    }

    const localGrammarTopics = getUserGrammarTopics();
    if (localGrammarTopics.length > 0) {
      await syncRequest(supabase.from("grammar_topics").upsert(
        localGrammarTopics.map((topic) => ({
          sync_key: syncKey,
          id: topic.id,
          name: topic.name,
          rules: topic.rules,
          created_at: topic.createdAt ?? new Date().toISOString(),
        }))
      ));
    }

    const { data: remoteGrammarTopics } = await syncRequest(supabase
      .from("grammar_topics")
      .select("*")
      .eq("sync_key", syncKey));

    if (remoteGrammarTopics) {
      const localGrammarMap = new Map(localGrammarTopics.map((topic) => [topic.id, topic]));
      for (const row of remoteGrammarTopics) {
        if (!localGrammarMap.has(row.id as string)) {
          saveUserGrammarTopic({
            id: row.id as string,
            name: row.name as string,
            rules: row.rules as GrammarTopic["rules"],
            isUserGenerated: true,
            createdAt: row.created_at as string,
          });
        }
      }
    }

    const { data: remoteChallenges } = await syncRequest(supabase
      .from("daily_challenges")
      .select("*")
      .eq("sync_key", syncKey));

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

    await syncRequest(supabase.from("user_settings").upsert({
      sync_key: syncKey,
      voice_settings: getVoiceSettings(),
    }));

    const { data: remoteUserSettings } = await syncRequest(supabase
      .from("user_settings")
      .select("voice_settings")
      .eq("sync_key", syncKey)
      .maybeSingle());

    if (remoteUserSettings?.voice_settings) {
      saveVoiceSettings(resolveVoiceSettings(remoteUserSettings.voice_settings as VoiceSettings));
    }

    // Pull exam attempts (LWW merge by id + updated_at)
    const { data: remoteAttempts } = await syncRequest(supabase
      .from("exam_attempts")
      .select("*")
      .eq("sync_key", syncKey)
      .order("started_at", { ascending: false })
      .limit(100));

    if (remoteAttempts && remoteAttempts.length > 0) {
      const { getAttempts } = await import("./exam/exam-storage");
      const local = getAttempts();
      const remote = remoteAttempts.map((r) => ({
        id: r.id as string,
        kind: r.exam_type as ExamAttempt["kind"],
        mode: r.mode as ExamAttempt["mode"],
        parts: r.parts as ExamAttempt["parts"],
        startedAt: r.started_at as string,
        finishedAt: (r.finished_at as string | null) ?? undefined,
        updatedAt: (r.updated_at as string | null) ?? undefined,
        answers: r.answers as ExamAttempt["answers"],
        score: (r.score as ExamAttempt["score"] | null) ?? undefined,
      }));
      const { merged } = mergeLww(local, remote, (a) => a.id);
      localStorage.setItem("examAttempts", JSON.stringify(merged.slice(0, 100)));
    }

    // Legacy mistake_log: one-time migration into unifiedMistakes, then never read again.
    // Isolated so a failure here leaves the flag unset and does not abort the rest of initSync.
    try {
      const { needsRemoteMistakeMigration, runMistakeMigration } = await import("./mistake-migration");
      if (needsRemoteMistakeMigration()) {
        const { data: remoteLegacy } = await syncRequest(supabase
          .from("mistake_log")
          .select("payload, updated_at")
          .eq("sync_key", syncKey));
        runMistakeMigration(
          (remoteLegacy ?? []).map((r) => ({
            ...(r.payload as MistakeEntry),
            updatedAt: (r.updated_at as string) ?? (r.payload as MistakeEntry).updatedAt,
          }))
        );
      }
    } catch {
      // retried on next initSync
    }

    // Pull unified mistakes — LWW by updatedAt, push local-only diffs
    const { getMistakes: getUnifiedMistakes, saveMistakes: saveUnifiedMistakes } =
      await import("./mistakes");
    const localUnifiedMistakes = getUnifiedMistakes();
    const { data: remoteUnifiedMistakes } = await syncRequest(supabase
      .from("unified_mistakes")
      .select("payload, updated_at")
      .eq("sync_key", syncKey));

    const remote = (remoteUnifiedMistakes ?? []).map((r) => ({
      ...(r.payload as UnifiedMistake),
      updatedAt: (r.updated_at as string) ?? (r.payload as UnifiedMistake).updatedAt,
    }));
    const unifiedMerge = mergeLww(localUnifiedMistakes, remote, (m) => m.id);
    saveUnifiedMistakes(unifiedMerge.merged);
    if (unifiedMerge.toPush.length > 0) {
      await syncRequest(supabase.from("unified_mistakes").upsert(
        unifiedMerge.toPush.map((m) => ({ sync_key: syncKey, id: m.id, payload: m, updated_at: m.updatedAt }))
      ));
    }

    setLastSyncedAt();
    setSyncInitializationFailed(false);
  } catch {
    setSyncInitializationFailed(true);
  }
}

export function registerSyncProcessors(): void {
  const syncKey = getSyncKey();
  const supabase = createSupabase(syncKey);

  registerProcessor("learnedWords", async (entry: QueueEntry) => {
    if (entry.op === "delete") {
      const { word } = entry.payload as { word: string };
      await syncRequest(supabase.from("learned_words").delete().match({ sync_key: syncKey, word }));
      return;
    }
    const word = entry.payload as LearnedWord;
    await syncRequest(supabase.from("learned_words").upsert(wordToRow(syncKey, word)));
  });

  registerProcessor("examAttempts", async (entry: QueueEntry) => {
    const attempt = entry.payload as ExamAttempt;
    await syncRequest(supabase.from("exam_attempts").upsert({
      id: attempt.id, sync_key: syncKey, exam_type: attempt.kind, mode: attempt.mode,
      parts: attempt.parts, started_at: attempt.startedAt, finished_at: attempt.finishedAt ?? null,
      answers: attempt.answers, score: attempt.score ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "id" }));
  });

  registerProcessor("mistakeLog", async (entry: QueueEntry) => {
    const mistake = entry.payload as MistakeEntry;
    await syncRequest(supabase.from("mistake_log").upsert({
      id: mistake.id, sync_key: syncKey, payload: mistake,
      resolved: mistake.resolved, updated_at: new Date().toISOString(),
    }, { onConflict: "id" }));
  });

  registerProcessor("dailyChallenges", async (entry: QueueEntry) => {
    const record = entry.payload as DailyChallenge;
    await syncRequest(supabase.from("daily_challenges").upsert({
      sync_key: syncKey, date: record.date, words: record.words, completed: record.completed,
    }));
  });

  registerProcessor("grammarTopics", async (entry: QueueEntry) => {
    const topic = entry.payload as GrammarTopic;
    await syncRequest(supabase.from("grammar_topics").upsert({
      sync_key: syncKey, id: topic.id, name: topic.name,
      rules: topic.rules, created_at: topic.createdAt ?? new Date().toISOString(),
    }));
  });

  registerProcessor("customTopics", async (entry: QueueEntry) => {
    const { topic } = entry.payload as { topic: string };
    await syncRequest(supabase.from("custom_topics").upsert({ sync_key: syncKey, topic }));
  });

  registerProcessor("examItems", async (entry: QueueEntry) => {
    const item = entry.payload as ExamItem;
    await syncRequest(supabase.from("exam_items").upsert({
      id: item.id, exam_type: item.kind, part: item.part, level: item.level,
      payload: item, flagged: false,
    }, { onConflict: "id", ignoreDuplicates: true }));
  });

  registerProcessor("unifiedMistakes", async (entry: QueueEntry) => {
    const mistake = entry.payload as UnifiedMistake;
    await syncRequest(supabase.from("unified_mistakes").upsert({
      sync_key: syncKey, id: mistake.id, payload: mistake, updated_at: mistake.updatedAt,
    }));
  });

  registerProcessor("voiceSettings", async (entry: QueueEntry) => {
    await syncRequest(supabase.from("user_settings").upsert({
      sync_key: syncKey, voice_settings: entry.payload,
    }));
  });
  registerProcessor("speakingSessions", async (entry) => {
    const { pushSpeaking } = await import("./speech/speaking-storage");
    await pushSpeaking(entry.payload as import("./speech/speaking-storage").SpeakingRecord, false);
  });
  registerProcessor("writingSubmissions", async (entry) => {
    const { pushWriting } = await import("./write/writing-storage");
    await pushWriting(entry.payload as import("./write/writing-storage").WritingRecord, false);
  });
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

  const settingsResult = await supabase
    .from("user_settings")
    .select("voice_settings")
    .eq("sync_key", resolved)
    .maybeSingle();

  if (!settingsResult.error && settingsResult.data?.voice_settings) {
    saveVoiceSettings(resolveVoiceSettings(settingsResult.data.voice_settings as VoiceSettings));
  }

  return newWordsCount;
}
