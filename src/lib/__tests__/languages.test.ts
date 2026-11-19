import { getLearningLanguages, langOf, languagePhrase, setLearningLanguages } from "../languages";

beforeEach(() => localStorage.clear());

test("default is english", () => {
  expect(getLearningLanguages()).toEqual(["en"]);
});

test("setLearningLanguages refuses an empty list", () => {
  expect(setLearningLanguages([])).toBe(false);
  expect(getLearningLanguages()).toEqual(["en"]);
});

test("order and unknown codes", () => {
  expect(setLearningLanguages(["ko", "xx" as never, "en"])).toBe(true);
  expect(getLearningLanguages()).toEqual(["en", "ko"]);
});

test("langOf", () => {
  expect(langOf({})).toBe("en");
  expect(langOf({ lang: "ja" })).toBe("ja");
  expect(langOf({ lang: "fr" })).toBe("en");
});

test("languagePhrase keeps the language name capitalized", () => {
  expect(languagePhrase("ko")).toBe("tiếng Hàn");
  expect(languagePhrase("zh")).toBe("tiếng Trung");
});
