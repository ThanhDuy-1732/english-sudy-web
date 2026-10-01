process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

import { createSupabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  createSupabase: jest.fn(),
}));

import {
  getSyncKey,
  getLastSyncedAt,
  initSync,
  pullFromKey,
  pushWord,
  registerSyncProcessors,
} from "../sync";
import { drainQueue, peekQueue, enqueue, getSyncStatus } from "../sync-queue";

const mockCreateSupabase = createSupabase as jest.Mock;
const mockFrom = jest.fn();

function makeFromImpl(
  words: unknown[] = [],
  topics: unknown[] = [],
  challenges: unknown[] = [],
  error: unknown = null,
  userSettings: unknown = null,
) {
  // Returns a chainable mock that resolves at the end
  const chainEnd = (data: unknown) => Promise.resolve({ data: error ? null : data, error });
  const chain = (data: unknown) => ({
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(() => chainEnd(data)),
    maybeSingle: jest.fn(() => chainEnd(data)),
    // allow final .eq() to resolve too (for simple queries)
    then: undefined as unknown,
  });

  return (table: string) => {
    if (table === "user_settings") {
      return {
        upsert: jest.fn().mockResolvedValue({ data: null, error }),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: userSettings, error }),
          })),
        })),
      };
    }

    if (table === "exam_attempts" || table === "mistake_log") {
      const c = chain([]);
      return {
        upsert: jest.fn(() => ({ catch: jest.fn() })),
        select: jest.fn(() => c),
      };
    }

    const data = table === "learned_words" ? words
               : table === "custom_topics" ? topics
               : challenges;
    return {
      upsert: jest.fn().mockResolvedValue({ data: null, error }),
      delete: jest.fn(() => ({
        match: jest.fn().mockResolvedValue({ data: null, error }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: error ? null : data, error }),
      })),
    };
  };
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
  mockFrom.mockReset();
  mockFrom.mockImplementation(makeFromImpl());
  mockCreateSupabase.mockReturnValue({ from: mockFrom });
});

// --- getSyncKey ---

test("getSyncKey generates a UUID on first call", () => {
  const key = getSyncKey();
  expect(key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test("getSyncKey returns the same key on subsequent calls", () => {
  expect(getSyncKey()).toBe(getSyncKey());
});

test("getSyncKey persists the key in localStorage", () => {
  const key = getSyncKey();
  expect(localStorage.getItem("syncKey")).toBe(key);
});

// --- getLastSyncedAt ---

test("getLastSyncedAt returns null before first sync", () => {
  expect(getLastSyncedAt()).toBeNull();
});

// --- initSync ---

test("initSync does nothing when offline", async () => {
  Object.defineProperty(navigator, "onLine", {
    value: false,
    writable: true,
    configurable: true,
  });
  await expect(initSync()).resolves.toBeUndefined();
  expect(getLastSyncedAt()).toBeNull();
});

test("Supabase error responses stay queued until a retry succeeds", async () => {
  mockFrom.mockImplementation(makeFromImpl([], [], [], { message: "server unavailable" }));
  const word = { word: "hello", meaning: "xin chào", example: "Hello!", topic: "test", learnedAt: new Date().toISOString() };
  await pushWord(word);
  expect(peekQueue()).toHaveLength(1);
  registerSyncProcessors();
  await drainQueue();
  expect(peekQueue()).toHaveLength(1);
  expect(peekQueue()[0].retryCount).toBe(1);
});

test("failed initial sync never claims success", async () => {
  mockFrom.mockImplementation(makeFromImpl([], [], [], { message: "server unavailable" }));
  await initSync();
  expect(getLastSyncedAt()).toBeNull();
  expect(getSyncStatus()).toBe("failed");
});

test("initial sync does not resurrect a word whose offline deletion is pending", async () => {
  enqueue({ entity: "learnedWords", entityId: "deleted", op: "delete", payload: { word: "deleted" } });
  await initSync();
  expect(mockFrom).not.toHaveBeenCalled();
  expect(peekQueue()).toHaveLength(1);
});

test("initSync sets lastSyncedAt after running", async () => {
  await initSync();
  expect(getLastSyncedAt()).not.toBeNull();
});

test("initSync creates Supabase client with home sync key", async () => {
  const homeKey = getSyncKey();
  await initSync();
  expect(mockCreateSupabase).toHaveBeenCalledWith(homeKey);
});

// --- pullFromKey ---

test("pullFromKey does not change the device home key", async () => {
  const homeKey = getSyncKey();
  await pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(localStorage.getItem("syncKey")).toBe(homeKey);
});

test("pullFromKey adds new words from external key and returns count", async () => {
  mockFrom.mockImplementation(
    makeFromImpl(
      [
        {
          word: "apple",
          meaning: "quả táo",
          example: "I eat an apple.",
          topic: "Food",
          learned_at: "2026-07-01T00:00:00.000Z",
          next_review_at: null,
          review_interval: 1,
          mastery: 0,
          synonyms: null,
          antonyms: null,
        },
      ],
      [],
      []
    )
  );
  const count = await pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(count).toBe(1);
  const words = JSON.parse(localStorage.getItem("learnedWords") ?? "[]") as { word: string }[];
  expect(words.some((w) => w.word === "apple")).toBe(true);
});

test("pullFromKey does not overwrite existing local words (local wins)", async () => {
  localStorage.setItem(
    "learnedWords",
    JSON.stringify([
      {
        word: "apple",
        meaning: "local meaning",
        example: "local example",
        topic: "Local",
        learnedAt: "2026-07-10T00:00:00.000Z",
      },
    ])
  );
  mockFrom.mockImplementation(
    makeFromImpl(
      [
        {
          word: "apple",
          meaning: "remote meaning",
          example: "remote example",
          topic: "Remote",
          learned_at: "2026-07-15T00:00:00.000Z",
          next_review_at: null,
          review_interval: 1,
          mastery: 0,
          synonyms: null,
          antonyms: null,
        },
      ],
      [],
      []
    )
  );
  const count = await pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  expect(count).toBe(0);
  const words = JSON.parse(localStorage.getItem("learnedWords") ?? "[]") as { word: string; meaning: string }[];
  expect(words[0].meaning).toBe("local meaning");
});

test('pullFromKey resolves "ThankZ" alias to fixed UUID and keeps home key', async () => {
  const homeKey = getSyncKey();
  await pullFromKey("ThankZ");
  expect(localStorage.getItem("syncKey")).toBe(homeKey);
  expect(localStorage.getItem("syncKey")).not.toBe("7468616e-6b7a-4000-8000-000000000000");
  // Verify client was created with ThankZ UUID (this is what gets sent as x-sync-key header)
  expect(mockCreateSupabase).toHaveBeenCalledWith("7468616e-6b7a-4000-8000-000000000000");
  expect(mockFrom).toHaveBeenCalledWith("learned_words");
  const selectCall = mockFrom.mock.results[0].value.select.mock.results[0].value;
  expect(selectCall.eq).toHaveBeenCalledWith("sync_key", "7468616e-6b7a-4000-8000-000000000000");
});

test('pullFromKey resolves "thankz" (lowercase) to the same fixed UUID', async () => {
  await pullFromKey("thankz");
  expect(mockCreateSupabase).toHaveBeenCalledWith("7468616e-6b7a-4000-8000-000000000000");
  const selectCall = mockFrom.mock.results[0].value.select.mock.results[0].value;
  expect(selectCall.eq).toHaveBeenCalledWith("sync_key", "7468616e-6b7a-4000-8000-000000000000");
});

test("pullFromKey throws when Supabase returns an error", async () => {
  mockFrom.mockImplementation(makeFromImpl([], [], [], { message: "network error" }));
  await expect(pullFromKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).rejects.toBeTruthy();
});

// --- voice settings sync ---

test("initSync pushes voiceSettings to user_settings table", async () => {
  localStorage.setItem("voiceSettings", JSON.stringify({ voiceURI: null, rate: 1.2, pitch: 1.0, volume: 0.8 }));
  const upsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "user_settings") {
      return {
        upsert: upsertMock,
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    }

    return {
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
  });
  await initSync();
  expect(upsertMock).toHaveBeenCalledWith(
    expect.objectContaining({ voice_settings: expect.objectContaining({ rate: 1.2 }) })
  );
});

test("initSync applies pulled voice_settings when voiceURI is null", async () => {
  const remoteSettings = { voiceURI: null, rate: 1.5, pitch: 0.8, volume: 0.9 };
  mockFrom.mockImplementation(makeFromImpl([], [], [], null, { voice_settings: remoteSettings }));
  await initSync();
  const saved = JSON.parse(localStorage.getItem("voiceSettings")!);
  expect(saved.rate).toBe(1.5);
  expect(saved.voiceURI).toBeNull();
});

test("pullFromKey applies voice_settings from remote key", async () => {
  const remoteSettings = { voiceURI: null, rate: 1.3, pitch: 1.1, volume: 1.0 };
  mockFrom.mockImplementation(makeFromImpl([], [], [], null, { voice_settings: remoteSettings }));
  await pullFromKey("7468616e-6b7a-4000-8000-000000000000");
  const saved = JSON.parse(localStorage.getItem("voiceSettings")!);
  expect(saved.rate).toBe(1.3);
});

// --- mistake_log → unifiedMistakes migration ---

function fromWithMistakeLog(result: { data: unknown; error: unknown }) {
  const base = makeFromImpl();
  return (table: string) =>
    table === "mistake_log"
      ? {
          upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
          select: jest.fn(() => ({ eq: jest.fn().mockResolvedValue(result) })),
        }
      : base(table);
}

const remoteLegacy = {
  id: "r1", questionId: "q5", itemId: "i5", type: "incomplete_sentence", part: "RC5",
  prompt: "Remote prompt", userAnswer: "A", correctAnswer: "B", explanation: "e",
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", resolved: false,
};

test("initSync migrates remote mistake_log into unifiedMistakes once", async () => {
  mockFrom.mockImplementation(
    fromWithMistakeLog({ data: [{ payload: remoteLegacy, updated_at: remoteLegacy.updatedAt }], error: null })
  );
  await initSync();
  const stored = JSON.parse(localStorage.getItem("unifiedMistakes") ?? "[]");
  expect(stored.map((m: { source: string }) => m.source)).toContain("exam:RC5:q5");
  expect(localStorage.getItem("mistakeLogRemoteMigrated")).toBe("1");
});

test("initSync does not set the remote migration flag when the mistake_log fetch fails", async () => {
  mockFrom.mockImplementation(fromWithMistakeLog({ data: null, error: { message: "boom" } }));
  await initSync();
  expect(localStorage.getItem("mistakeLogRemoteMigrated")).toBeNull();
  expect(getLastSyncedAt()).not.toBeNull();
});

test("initSync no longer writes mistakeLog to localStorage", async () => {
  mockFrom.mockImplementation(
    fromWithMistakeLog({ data: [{ payload: remoteLegacy, updated_at: remoteLegacy.updatedAt }], error: null })
  );
  await initSync();
  expect(localStorage.getItem("mistakeLog")).toBeNull();
});
