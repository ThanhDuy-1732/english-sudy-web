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
} from "../sync";

const mockCreateSupabase = createSupabase as jest.Mock;
const mockFrom = jest.fn();

function makeFromImpl(words: unknown[] = [], topics: unknown[] = [], challenges: unknown[] = [], error: unknown = null) {
  return (table: string) => {
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
