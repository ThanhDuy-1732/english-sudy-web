import { SHADOW_SENTENCES } from "../shadow-sentences";

test("every language has 8 sentences, CJK with readings and all with Vietnamese translations", () => {
  for (const lang of ["en", "zh", "ja", "ko"] as const) {
    expect(SHADOW_SENTENCES[lang]).toHaveLength(8);
    for (const s of SHADOW_SENTENCES[lang]) {
      expect(s.text.trim()).not.toBe("");
      expect(s.translation.trim()).not.toBe("");
      if (lang !== "en") expect(s.reading?.trim()).toBeTruthy();
    }
  }
});

test("english sentences unchanged", () => {
  expect(SHADOW_SENTENCES.en[0].text).toBe("The meeting has been postponed until next Thursday.");
  expect(SHADOW_SENTENCES.en[7].text).toBe("Please make sure to submit the application before the deadline.");
});
