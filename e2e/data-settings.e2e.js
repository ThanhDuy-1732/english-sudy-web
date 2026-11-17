// Pages that render stored data (stats, activity, path, library, mistakes, histories) and the settings screen.
const { scenario, newPage, goto, json, clickText, clickContains, clickIn, setValue, bodyText, sleep, now, day } = require("./harness");
const { feedbackW, feedbackS, unified } = require("./fixtures");

const mistakes = [unified(1, "vocabulary", "new"), unified(2, "grammar", "new"), unified(3, "grammar", "reviewing"), unified(4, "reading", "new"), unified(5, "listening", "resolved"), unified(6, "speaking", "new"), unified(7, "writing", "new")];
const speaking = [{ id: "sp1", mode: "ielts_p1", prompt: "Tell me about your hometown", transcript: "I live in Hanoi.", durationSec: 40, feedback: feedbackS, createdAt: day(1) }, { id: "sp2", mode: "roleplay", prompt: "Hotel check-in", transcript: "Hello.", durationSec: 30, feedback: { ...feedbackS, overall: 7 }, createdAt: day(2) }];
const writing = [{ id: "w1", taskId: "task2-opinion", kind: "ielts_task2", prompt: "Discuss both views", content: "v3", wordCount: 270, feedback: feedbackW(7), createdAt: day(1), versions: [{ version: 1, content: "v1", wordCount: 250, feedback: feedbackW(6), createdAt: day(3) }, { version: 2, content: "v2", wordCount: 260, feedback: feedbackW(6.5), createdAt: day(2) }] }, { id: "w2", taskId: "task1-line", kind: "ielts_task1", prompt: "Line graph", content: "Essay", wordCount: 160, feedback: feedbackW(7), createdAt: day(2) }];
const exams = [0, 1, 2].map((i) => ({ id: "a" + i, kind: "TOEIC", mode: "drill", parts: ["RC5"], startedAt: day(i), answers: [{ itemId: "i", questionId: "q" + i, type: "incomplete_sentence", part: "RC5", userAnswer: "a", correct: i % 2 === 0, timeSpentSec: 6 }, { itemId: "i", questionId: "r" + i, type: "text_completion", part: "RC6", userAnswer: "a", correct: false, timeSpentSec: 8 }], score: { raw: { correct: 1, total: 2 }, toeic: { total: 450 + i * 20, listening: 220, reading: 230 } } }));
const gram = ["tenses", "modal-verbs", "conditionals"].flatMap((t) => [true, false, true].map((c, i) => ({ id: t + i, topicId: t, subRuleId: t + "-r", correct: c, at: day(i) })));
const words = [["greet", "chào hỏi"], ["clarify", "làm rõ"], ["interrupt", "ngắt lời"], ["respond", "phản hồi"], ["suggestion", "gợi ý"]].map(([w, m]) => ({ word: w, meaning: m, example: `${w} example`, topic: "Daily Communication", learnedAt: now, updatedAt: now, reviewInterval: 1, mastery: 1, easiness: 2.5, repetitions: 0, nextReviewAt: now }));
const seed = { learnedWords: words, unifiedMistakes: mistakes, speakingSessions: speaking, writingSubmissions: writing, examAttempts: exams, grammarAttempts: gram, lastWritingAt: day(2), lastSpeakingAt: day(1),
  learningSessions: [0, 1, 2, 5, 8, 12].map((d, i) => ({ id: "s" + i, type: ["exam", "writing", "vocab", "grammar"][i % 4], startedAt: day(d), finishedAt: now, durationSeconds: 600, totalItems: 5, correctItems: 3 })), studyTime: { [now.slice(0, 10)]: 1200 } };
const shownMistakes = async (page) => ((await bodyText(page)).match(/wrong\d/g) || []).length;

scenario("data pages render stored data", async ({ browser, check }) => {
  const page = await newPage(browser, { seed });
  await goto(page, "/stats");
  const charts = await page.evaluate(() => ({ wrappers: document.querySelectorAll(".recharts-wrapper").length, marks: document.querySelectorAll(".recharts-bar-rectangle, .recharts-line-curve, .recharts-pie-sector, .recharts-radar-polygon, .recharts-area-curve").length }));
  check("stats charts render with data", charts.wrappers >= 3 && charts.marks > 0, JSON.stringify(charts));
  await clickIn(page, "main", "Tuần này"); await sleep(800);
  check("stats weekly tab has a report", /Streak hiện tại/.test(await bodyText(page)));
  await goto(page, "/activity");
  check("activity lists sessions", !/Chưa có hoạt động/.test(await bodyText(page)));
  await goto(page, "/path");
  check("path shows linked blocks", (await page.evaluate(() => document.querySelectorAll("main a[href]").length)) >= 3);
  await goto(page, "/library");
  await page.type("main input", "g"); await sleep(400);
  check("library: one character shows the minimum-length hint", /ít nhất 2 ký tự/.test(await bodyText(page)));
  const search = async (q) => { await page.evaluate(() => { const i = document.querySelector("main input"); i.focus(); i.select(); }); await page.keyboard.type(q); await sleep(700); return page.evaluate(() => document.querySelector("main").innerText); };
  check("library finds a saved word", /greet/.test(await search("greet")));
  check("library finds a speaking prompt", /Hotel check-in/.test(await search("Hotel check-in")));
  check("library shows a message for no match", /Không tìm thấy/.test(await search("zzzqqq")));
  for (const q of ["(", "[a", "\\", "*+", "?", ".*", "$&"]) await search(q);
  check("library tolerates regex special characters", page.__errors.length === 0, page.__errors[0]);
});

scenario("unified mistakes filters", async ({ browser, check }) => {
  const page = await newPage(browser, { seed });
  await goto(page, "/mistakes");
  const chips = await page.evaluate(() => [...document.querySelectorAll("main button")].map((b) => b.innerText.trim()));
  check("skill and status chips are present", ["Từ vựng", "Ngữ pháp", "Đọc", "Nghe", "Nói", "Viết", "Mới", "Đang học", "Đã giải quyết"].every((c) => chips.includes(c)));
  await page.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.innerText.trim() === "Tất cả")[1]?.click()); await sleep(300);
  check("'Tất cả' status shows all seven", (await shownMistakes(page)) === 7, String(await shownMistakes(page)));
  await clickIn(page, "main", "Ngữ pháp"); await sleep(300);
  check("grammar filter shows two", (await shownMistakes(page)) === 2, String(await shownMistakes(page)));
  await clickIn(page, "main", "Đang học"); await sleep(300);
  check("grammar + 'Đang học' shows one", (await shownMistakes(page)) === 1, String(await shownMistakes(page)));
});

scenario("speaking and writing histories", async ({ browser, check }) => {
  const page = await newPage(browser, { seed });
  await goto(page, "/speak/history");
  const t = await bodyText(page);
  check("speaking history lists both sessions", /Tell me about your hometown/.test(t) && /Hotel check-in/.test(t));
  await goto(page, "/write/history");
  await page.evaluate(() => document.querySelector("main li button")?.click()); await sleep(400);
  const w = await bodyText(page);
  check("writing history expands with bands and next focus", /Paragraphing/.test(w));
  check("version scores are shown when there are several versions", /v1: 6\.0/.test(w) && /v2: 6\.5/.test(w));
  const links = await page.evaluate(() => [...document.querySelectorAll("main li a")].map((a) => a.getAttribute("href")));
  check("detail and rewrite links", links.includes("/write/result/w1") && links.includes("/write/rewrite/w1"), links.join(" "));
});

scenario("settings: providers, voice, data and profile", async ({ browser, check }) => {
  const sent = [];
  const page = await newPage(browser, { intercept: (req) => {
    const u = req.url();
    if (u.endsWith("/api/providers/test")) { const id = JSON.parse(req.postData() || "{}").providerId; return json(req, id === "gemini" ? { ok: true, latency: 321 } : { ok: false, error: "404 model not found", latency: 90 }); }
    if (u.endsWith("/api/generate-words")) { sent.push(JSON.parse(req.postData() || "{}")); return json(req, [{ word: "greeting", meaning: "lời chào" }]); }
    return false; } });
  await goto(page, "/settings");
  let t = await bodyText(page);
  const names = await page.evaluate(() => fetch("/api/providers").then((r) => r.json()).then((ps) => ps.map((p) => p.name)));
  check("all configured providers are listed", names.length > 0 && names.every((n) => t.includes(n)), names.join(", "));
  await page.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.innerText.trim() === "Test").slice(0, 2).forEach((b) => b.click())); await sleep(900);
  t = await bodyText(page);
  check("test button shows latency or the failure reason", /321ms/.test(t) && /model not found/.test(t));
  await page.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => !b.innerText.trim())[0]?.click()); await sleep(500);
  check("toggling a provider persists it", /gemini/.test((await page.evaluate(() => localStorage.getItem("disabledProviders"))) || ""));
  await goto(page, "/"); await clickText(page, "Sinh từ mới"); await sleep(1000);
  check("disabled providers travel with AI requests", (sent.at(-1)?.disabledProviders || []).includes("gemini"), JSON.stringify(sent.at(-1)));
  await goto(page, "/settings"); await clickIn(page, "main", "Voice"); await sleep(400);
  await page.evaluate(() => { const r = document.querySelector("main input[type=range]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, "1.5"); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(400);
  check("speech rate persists", /1\.5/.test((await page.evaluate(() => localStorage.getItem("voiceSettings"))) || ""));
  await page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => /Reset/.test(b.innerText))?.click()); await sleep(400);
  check("reset restores the default rate", !/1\.5/.test((await page.evaluate(() => localStorage.getItem("voiceSettings"))) || ""));
  await clickIn(page, "main", "Dữ liệu"); await sleep(400);
  check("data tab offers backup export", /Xuất/.test(await bodyText(page)));
  await clickIn(page, "main", "Hồ sơ"); await sleep(400);
  for (const l of ["TOEIC", "Trung cấp", "45 phút"]) await clickIn(page, "main", l);
  await sleep(400);
  check("profile choices persist", /"goal":"toeic"/.test((await page.evaluate(() => localStorage.getItem("learningProfile"))) || "") && /45/.test((await page.evaluate(() => localStorage.getItem("learningProfile"))) || ""));
});

scenario("theme setting switches the whole UI and survives reload", async ({ browser, check }) => {
  const page = await newPage(browser, { theme: "dark" });
  await goto(page, "/settings"); await clickIn(page, "main", "Hồ sơ"); await sleep(300);
  const state = () => page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), pref: localStorage.getItem("theme"), bg: getComputedStyle(document.body).backgroundColor }));
  await clickIn(page, "main", "Sáng"); await sleep(300);
  let s = await state();
  check("light applies instantly", s.attr === "light" && s.pref === "light" && s.bg === "rgb(247, 244, 255)", JSON.stringify(s));
  await page.reload({ waitUntil: "networkidle2" });
  s = await state();
  check("light survives a reload", s.attr === "light", JSON.stringify(s));
  await clickIn(page, "main", "Hồ sơ"); await clickIn(page, "main", "Hệ thống"); await sleep(300);
  s = await state();
  check("system follows the OS colour scheme (dark here)", s.attr === "dark" && s.pref === "system", JSON.stringify(s));
});
