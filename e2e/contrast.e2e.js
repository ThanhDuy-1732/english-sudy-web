// Every page, both themes: readable text (contrast >= 3), no hydration mismatches, no uncaught errors.
const { scenario, newPage, goto, scanContrast, sleep, json } = require("./harness");
const { baseSeed, aiMocks } = require("./fixtures");

const PAGES = ["/", "/today", "/review", "/exam", "/exam/mistakes", "/exam/mock", "/exam/drill/RC5", "/speak", "/speak/shadowing", "/speak/ielts/1", "/speak/roleplay/hotel", "/speak/history", "/write", "/write/task/task2-opinion", "/write/history", "/write/result/r1", "/write/rewrite/r1", "/grammar", "/grammar/quiz", "/vocab/quiz", "/vocab/context", "/mistakes", "/stats", "/history", "/diary", "/activity", "/library", "/import", "/settings", "/path"];

for (const theme of ["dark", "light"]) {
  scenario(`contrast and hydration on ${PAGES.length} pages (${theme} theme)`, async ({ browser, check }) => {
    // Chinese and Japanese words too (same characters, two languages), learning en + zh + ja: CJK text in every theme.
    const seed = baseSeed();
    const learned = seed.learnedWords ?? [];
    const cjk = (word, lang, reading) => ({ word, lang, reading, meaning: "học sinh", example: "", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", nextReviewAt: "2026-11-02T00:00:00.000Z", conceptId: "cjk" });
    seed.learnedWords = [...learned, cjk("学生", "zh", "xuéshēng"), cjk("学生", "ja", "がくせい")];
    seed.learningLanguages = ["en", "zh", "ja"];
    const page = await newPage(browser, { theme, seed, intercept: (req) => aiMocks(req, json) });
    for (const path of PAGES) {
      page.__errors.length = 0; page.__hydration.length = 0;
      await goto(page, path);
      const applied = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      const low = await page.evaluate(scanContrast);
      check(`${path} data-theme`, applied === theme, `got ${applied}`);
      check(`${path} contrast`, low.length === 0, low.join(" | "));
      check(`${path} hydration`, page.__hydration.length === 0, page.__hydration[0]);
      check(`${path} page errors`, page.__errors.length === 0, page.__errors[0]);
    }
  });
}
