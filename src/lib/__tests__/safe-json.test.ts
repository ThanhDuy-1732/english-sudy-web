import { asArray, asObject, readStored, readString } from "../safe-json";
import { getLearnedWords } from "../storage";
import { getSyncKey } from "../sync";
import { startSession, getSessions } from "../sessions";
import { runMistakeMigration } from "../mistake-migration";

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

test("asArray/asObject reject values of the wrong top-level type", () => {
  expect(asArray([1, 2])).toEqual([1, 2]);
  expect(asArray({})).toEqual([]);
  expect(asArray(null)).toEqual([]);
  expect(asObject({ a: 1 }, {})).toEqual({ a: 1 });
  expect(asObject([1], { fallback: true })).toEqual({ fallback: true });
  expect(asObject("x", { fallback: true })).toEqual({ fallback: true });
});

test("readStored falls back on malformed JSON and on the wrong type", () => {
  localStorage.setItem("k", "{bad");
  expect(readStored("k", [])).toEqual([]);
  localStorage.setItem("k", "{}");
  expect(readStored<number[]>("k", [])).toEqual([]);
  localStorage.setItem("k", "[1,2]");
  expect(readStored<number[]>("k", [])).toEqual([1, 2]);
  localStorage.setItem("k", "[1]");
  expect(readStored("k", { a: 1 })).toEqual({ a: 1 });
});

test("storage modules survive wrong-typed stored values", () => {
  localStorage.setItem("learnedWords", "{}");
  localStorage.setItem("unifiedMistakes", "123");
  expect(getLearnedWords()).toEqual([]);
  expect(() => runMistakeMigration()).not.toThrow();
});

describe("when storage throws", () => {
  const block = (method: "getItem" | "setItem") =>
    jest.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

  test("reads return defaults instead of throwing", () => {
    block("getItem");
    expect(readString("x")).toBeNull();
    expect(getLearnedWords()).toEqual([]);
  });

  test("getSyncKey falls back to a stable session-only key", () => {
    block("getItem");
    const key = getSyncKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(getSyncKey()).toBe(key);
  });

  test("a full storage never breaks session tracking or the mistake migration", () => {
    block("setItem");
    expect(() => startSession("grammar")).not.toThrow();
    expect(getSessions()).toEqual([]);
    expect(() => runMistakeMigration()).not.toThrow();
  });
});
