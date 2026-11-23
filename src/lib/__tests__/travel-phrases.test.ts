import { PHRASE_LANGS, TRAVEL_PHRASES } from "../travel-phrases";

const SCRIPT = { zh: /\p{Script=Han}/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}]/u, ko: /\p{Script=Hangul}/u };

test("every phrase has text in each language, the right script and a reading for CJK", () => {
  const vi = new Set<string>();
  for (const { phrases } of TRAVEL_PHRASES) {
    expect(phrases.length).toBeGreaterThan(0);
    for (const phrase of phrases) {
      expect(vi.has(phrase.vi)).toBe(false); // used as React key
      vi.add(phrase.vi);
      for (const lang of PHRASE_LANGS) {
        const [text, reading] = phrase[lang];
        expect(text.trim()).not.toBe("");
        if (lang !== "en") {
          expect(text).toMatch(SCRIPT[lang]);
          expect(reading?.trim()).toBeTruthy();
        }
      }
    }
  }
});
