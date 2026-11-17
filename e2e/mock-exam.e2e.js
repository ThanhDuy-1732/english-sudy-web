// Mock TOEIC: generation, timer start, answering, scoring, persistence and time-up.
const { scenario, newPage, goto, json, clickText, waitText, bodyText, sleep, now } = require("./harness");
const { baseSeed } = require("./fixtures");

const item = (part, type, n, opts = 4, extra = {}) => ({ id: "it-" + part, kind: "TOEIC", part, level: 3, topic: "business", createdAt: now, ...extra,
  questions: Array.from({ length: n }, (_, i) => ({ id: `${part}-q${i}`, type, prompt: `Question ${i + 1} for ${type}?`, options: ["A. first", "B. second", "C. third", "D. fourth"].slice(0, opts), answer: "A. first", explanation: "The first option is correct because of the context." })) });
const ITEMS = {
  LC2: item("LC2", "question_response", 3, 3),
  LC3: item("LC3", "conversation", 3, 4, { script: [{ speaker: "M1", text: "Good morning." }, { speaker: "W1", text: "Good morning." }] }),
  LC4: item("LC4", "short_talk", 3, 4, { script: [{ speaker: "NARRATOR", text: "Welcome to the briefing." }] }),
  RC5: item("RC5", "incomplete_sentence", 3),
  RC6: item("RC6", "text_completion", 3, 4, { passage: "Dear team, a new policy starts next week." }),
  RC7: item("RC7", "single_passage", 3, 4, { passage: "Subject: Product launch on November 15." }),
};
const intercept = (req) => { if (!req.url().endsWith("/api/exam/generate-item")) return false; const b = JSON.parse(req.postData() || "{}"); return json(req, ITEMS[b.part || (b.parts || [])[0]] || ITEMS.RC5); };
const timer = (page) => page.evaluate(() => document.querySelector(".exam-timer")?.innerText);

scenario("mock exam runs end to end", async ({ browser, check }) => {
  const page = await newPage(browser, { seed: baseSeed(), intercept });
  await goto(page, "/exam/mock");
  check("start screen shows parts and duration", /6 parts/.test(await bodyText(page)) && /45 phút/.test(await bodyText(page)));
  await clickText(page, "Bắt đầu thi");
  check("all six parts are generated", await waitText(page, "Sẵn sàng chưa?", 20000), (await bodyText(page)).match(/\d+ câu hỏi · [A-Z0-9, ]+/)?.[0]);
  check("timer is frozen at full time while loading", /45:00/.test((await timer(page)) || ""), await timer(page));
  await clickText(page, "Bắt đầu"); await sleep(1200);
  check("timer runs once the first question starts", /44:[45]\d/.test((await timer(page)) || ""), await timer(page));
  const total = Number((await bodyText(page)).match(/\d+ \/ (\d+)/)?.[1] || 0);
  check("question counter shows all 18 questions", total === 18, `total=${total}`);
  for (let i = 0; i < total; i++) {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.className.includes("option-btn"))?.click());
    await sleep(150);
    if (await clickText(page, "Xem kết quả")) break;
    await clickText(page, "Câu tiếp"); await sleep(200);
  }
  await sleep(2000);
  const t = await bodyText(page);
  check("result page with score", /Kết quả thi thử/.test(t) && /18 \/ 18 câu đúng/.test(t), t.match(/\d+ \/ \d+ câu đúng/)?.[0]);
  check("TOEIC estimate with listening, reading and total", /Listening \(ước lượng\)/.test(t) && /Reading \(ước lượng\)/.test(t) && /\/ 990/.test(t));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("examAttempts") || "[]").filter((a) => a.mode === "mock").length);
  check("mock attempt saved", saved === 1, `saved=${saved}`);
  check("no hydration or page errors", page.__hydration.length === 0 && page.__errors.length === 0, page.__errors[0] || page.__hydration[0]);
});

scenario("mock exam ends automatically when time runs out", async ({ browser, check }) => {
  const page = await newPage(browser, { seed: baseSeed(), intercept });
  await goto(page, "/exam/mock");
  await clickText(page, "Bắt đầu thi"); await waitText(page, "Sẵn sàng chưa?", 20000); await clickText(page, "Bắt đầu"); await sleep(600);
  await page.evaluate(() => { const real = Date.now.bind(Date); Date.now = () => real() + 46 * 60 * 1000; });
  await sleep(2500);
  check("result shown after time-up", /Kết quả thi thử/.test(await bodyText(page)));
});
