// Interactive states (flipped cards, quizzes, modals, drawers, menus) stay readable in both themes.
const { scenario, newPage, goto, scanContrast, sleep, json, clickText, clickContains, clickIn, waitText, bodyText } = require("./harness");
const { baseSeed, aiMocks } = require("./fixtures");

const states = {
  "review card flipped": async (p) => { await goto(p, "/review"); await p.click('button[aria-label^="Xem nghĩa của"]'); await sleep(1800); },
  "vocab quiz question": async (p) => { await goto(p, "/vocab/quiz"); await clickText(p, "5"); await clickText(p, "Bắt đầu"); await sleep(1000); },
  "vocab quiz answered": async (p) => { await goto(p, "/vocab/quiz"); await clickText(p, "5"); await clickText(p, "Bắt đầu"); await sleep(800); await p.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.innerText.length > 1 && !/Tiếp/.test(b.innerText))[0]?.click()); await sleep(600); },
  "grammar quiz question": async (p) => { await goto(p, "/grammar/quiz"); await clickText(p, "5"); await clickText(p, "Bắt đầu"); await waitText(p, "1/5", 15000); },
  "home flashcards flipped": async (p) => { await goto(p, "/"); await clickText(p, "Gieo 5 từ mới"); await sleep(1500); await p.evaluate(() => document.querySelectorAll('button[aria-label^="Xem nghĩa của"]').forEach((b, i) => i < 3 && b.click())); await sleep(2000); },
  "home quiz modal": async (p) => { await goto(p, "/"); await clickText(p, "Gieo 5 từ mới"); await sleep(1500); await p.evaluate(() => document.querySelectorAll('button[aria-label^="Xem nghĩa của"]').forEach((b) => b.click())); await sleep(2000); await clickText(p, "Kiểm tra kiến thức"); await sleep(800); },
  "exam question selected": async (p) => { await goto(p, "/exam/drill/RC5"); await waitText(p, "Bắt đầu", 8000); await clickText(p, "Bắt đầu"); await sleep(800); await clickIn(p, "main", "has completed"); await sleep(400); },
  "exam report modal": async (p) => { await goto(p, "/exam/drill/RC5"); await waitText(p, "Bắt đầu", 8000); await clickText(p, "Bắt đầu"); await sleep(800); await clickIn(p, "main", "had completed"); await clickContains(p, "Báo câu hỏi lỗi"); await sleep(600); },
  "exam drill done": async (p) => { await goto(p, "/exam/drill/RC5"); await waitText(p, "Bắt đầu", 8000); await clickText(p, "Bắt đầu"); await sleep(800); for (let i = 0; i < 2; i++) { await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => ["had completed", "by"].includes(b.innerText.trim()))?.click()); await sleep(300); await clickText(p, "Câu tiếp"); await clickText(p, "Xem kết quả"); await sleep(500); } await sleep(800); },
  "timer modal": async (p) => { await goto(p, "/exam"); await p.evaluate(() => document.querySelector('button[aria-label="Đặt countdown"]')?.click()); await sleep(600); },
  "provider dropdown": async (p) => { await goto(p, "/exam"); await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Gemini|Groq/.test(b.innerText))?.click()); await sleep(600); },
  "diary day drawer": async (p) => { await goto(p, "/diary"); await p.evaluate(() => { const c = [...document.querySelectorAll("button[aria-label*=' từ,']")]; (c.reverse().find((x) => /: [1-9]/.test(x.getAttribute("aria-label"))) || c[0])?.click(); }); await sleep(800); },
  "settings voice": async (p) => { await goto(p, "/settings"); await clickIn(p, "main", "Giọng đọc"); await sleep(600); },
  "settings sync": async (p) => { await goto(p, "/settings"); await clickIn(p, "main", "Sync"); await sleep(600); },
  "settings profile": async (p) => { await goto(p, "/settings"); await clickIn(p, "main", "Hồ sơ"); await sleep(600); },
  "writing editor": async (p) => { await goto(p, "/write/task/task2-opinion"); await clickContains(p, "Bắt đầu viết"); await sleep(500); await p.type("textarea", "Technology improves education."); },
  "mobile menu": async (p) => { await p.setViewport({ width: 390, height: 844 }); await goto(p, "/"); await clickText(p, "Thêm", "summary"); await sleep(500); },
  "mistakes with all statuses": async (p) => { await goto(p, "/exam/mistakes"); await clickText(p, "Tất cả"); await sleep(500); },
};

for (const theme of ["dark", "light"]) {
  scenario(`${Object.keys(states).length} interactive states are readable (${theme} theme)`, async ({ browser, check }) => {
    for (const [name, run] of Object.entries(states)) {
      const page = await newPage(browser, { theme, seed: baseSeed(), intercept: (req) => aiMocks(req, json) });
      const t0 = Date.now();
      try {
        await run(page);
        const low = await page.evaluate(scanContrast);
        check(name, low.length === 0, low.join(" | "));
        check(`${name} hydration/errors`, page.__hydration.length === 0 && page.__errors.length === 0, [page.__hydration[0], page.__errors[0], page.__failedRequests[0]].filter(Boolean).join(" | "));
      } catch (e) { check(name, false, "script error: " + e.message.slice(0, 80)); }
      if (process.env.E2E_DEBUG) console.error(`  ${theme} ${name}: ${Date.now() - t0}ms`);
      await page.close();
    }
  });
}
