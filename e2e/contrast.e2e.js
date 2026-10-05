// Every page, both themes: readable text (contrast >= 3), no hydration mismatches, no uncaught errors.
const { scenario, newPage, goto, scanContrast, sleep, json } = require("./harness");
const { baseSeed, aiMocks } = require("./fixtures");

const PAGES = ["/", "/today", "/review", "/exam", "/exam/mistakes", "/exam/mock", "/exam/drill/RC5", "/speak", "/speak/shadowing", "/speak/ielts/1", "/speak/roleplay/hotel", "/speak/history", "/write", "/write/task/task2-opinion", "/write/history", "/write/result/r1", "/write/rewrite/r1", "/grammar", "/grammar/quiz", "/vocab/quiz", "/vocab/context", "/mistakes", "/stats", "/history", "/diary", "/activity", "/library", "/import", "/settings", "/path"];

for (const theme of ["dark", "light"]) {
  scenario(`contrast and hydration on ${PAGES.length} pages (${theme} theme)`, async ({ browser, check }) => {
    const page = await newPage(browser, { theme, seed: baseSeed(), intercept: (req) => aiMocks(req, json) });
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
