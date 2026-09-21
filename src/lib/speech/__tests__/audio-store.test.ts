jest.mock("idb-keyval", () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, val: unknown) => {
      store.set(key, val);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    __store: store,
  };
});

import * as idbKeyval from "idb-keyval";
import { saveAudio, loadAudio, clearAllAudio, getAudioCount } from "../audio-store";

beforeEach(() => {
  (idbKeyval as unknown as { __store: Map<string, unknown> }).__store.clear();
  jest.clearAllMocks();
});

it("saveAudio and loadAudio round-trip", async () => {
  const blob = new Blob(["audio data"], { type: "audio/webm" });
  await saveAudio("rec1", blob);
  const loaded = await loadAudio("rec1");
  expect(loaded).toBe(blob);
});

it("saveAudio caps at 20 recordings", async () => {
  for (let i = 0; i < 25; i++) {
    await saveAudio(`r${i}`, new Blob([`data${i}`]));
  }
  const count = await getAudioCount();
  expect(count).toBeLessThanOrEqual(20);
});

it("loadAudio returns undefined for missing key", async () => {
  const result = await loadAudio("nonexistent-key");
  expect(result).toBeUndefined();
});

it("clearAllAudio removes all recordings", async () => {
  await saveAudio("x", new Blob(["x"]));
  await clearAllAudio();
  expect(await getAudioCount()).toBe(0);
});
