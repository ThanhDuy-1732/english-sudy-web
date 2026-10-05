// Failure modes: AI endpoints failing, hostile browser storage, and HTML injection through AI/stored content.
const { scenario, newPage, goto, json, clickText, clickContains, waitText, setValue, bodyText, sleep, now } = require("./harness");
const { baseSeed, feedbackW, aiMocks, WORDS } = require("./fixtures");

const words = (n) => Array.from({ length: n }, () => "technology").join(" ") + ".";
const rwSeed = { writingSubmissions: [{ id: "rw1", taskId: "task2-opinion", kind: "ielts_task2", prompt: "P", content: "E", wordCount: 120, createdAt: now, feedback: feedbackW(6, [{ excerpt: "bad", issue: "i", category: "grammar", suggestion: "good" }]) }] };
const face = (page, src, arg) => page.evaluate((src, arg) => { const f = [...document.querySelectorAll('div[aria-hidden="false"]')].find((d) => /Quên/.test(d.innerText)); return new Function("f", "arg", src)(f, arg); }, src, arg);
const flip = async (p) => { await p.click('button[aria-label^="Xem nghĩa của"]'); await sleep(1000); };

// api: endpoint to break; expect: text the user must see; setup/steps run after the page loads.
const CASES = [
  { name: "generate words", api: "/api/generate-words", url: "/", expect: /Không thể sinh từ mới/, run: (p) => clickText(p, "Sinh từ mới") },
  { name: "flashcard example", api: "/api/generate-sentence", url: "/", expect: /Không thể tạo câu ví dụ/, run: async (p) => { await clickText(p, "Sinh từ mới"); await sleep(900); await p.evaluate(() => document.querySelector('button[aria-label^="Xem nghĩa của"]')?.click()); } },
  { name: "review write-sentence grading", api: "/api/grade-sentence", url: "/review", expect: /Không thể chấm/, run: async (p) => { await flip(p); await face(p, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Viết câu')?.click()"); await sleep(400); await face(p, "f.querySelector('textarea').focus()"); await p.keyboard.type("I greet my teacher."); await face(p, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Chấm điểm')?.click()"); } },
  { name: "review fill-blank", api: "/api/generate-fillblank", url: "/review", expect: /Không thể tạo bài điền từ/, run: async (p) => { await flip(p); await face(p, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Điền từ')?.click()"); } },
  { name: "vocab in context", api: "/api/vocab/context", url: "/vocab/context", expect: /(Không thể|thử lại)/i, run: async (p) => { await p.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => ["greet", "clarify"].includes(b.innerText.trim())).forEach((b) => b.click())); await sleep(300); await clickContains(p, "Tạo nội dung"); } },
  { name: "import word list", api: "/api/generate-batch", url: "/import", expect: /(Không thể|thử lại)/i, run: async (p) => { await p.evaluate(() => document.querySelector("textarea").focus()); await p.keyboard.type("negotiate\nfacilitate"); await clickContains(p, "Tra nghĩa"); } },
  { name: "grammar quiz question", api: "/api/grammar-exercise", url: "/grammar/quiz", expect: /Không thể tạo câu hỏi/, run: (p) => p.evaluate(() => { const f = (t) => [...document.querySelectorAll("main button")].find((b) => b.innerText.trim() === t)?.click(); f("5"); setTimeout(() => f("Bắt đầu"), 150); }) },
  { name: "grammar add topic", api: "/api/grammar-generate", url: "/grammar", expect: /Không thể tạo chủ đề/, run: async (p) => { await p.type('input[placeholder^="Nhập chủ đề"]', "Gerunds"); await clickText(p, "+ Thêm chủ đề"); } },
  { name: "exam drill generation", api: "/api/exam/generate-item", url: "/exam/drill/RC5", expect: /Không thể tải câu hỏi/, run: async () => {}, wait: 6000 },
  { name: "write submit", api: "/api/write/grade", url: "/write/task/task2-opinion", expect: /Không thể chấm bài/, run: async (p) => { await clickContains(p, "Bắt đầu viết"); await sleep(300); await setValue(p, "textarea", words(262)); await sleep(300); await clickContains(p, "Nộp bài"); } },
  { name: "roleplay message", api: "/api/speak/roleplay", url: "/speak/roleplay/hotel", expect: /Lỗi kết nối/, run: async (p) => { await p.evaluate(() => document.querySelector("input").focus()); await p.keyboard.type("Hello"); await p.keyboard.press("Enter"); } },
  { name: "rewrite grading", api: "/api/exam/grade-open", url: "/write/rewrite/rw1", seed: rwSeed, expect: /Không thể chấm/, run: async (p) => { await setValue(p, "textarea", "good"); await clickContains(p, "Kiểm tra"); } },
];
const ABORT_TOO = new Set(["generate words", "grammar quiz question", "write submit", "roleplay message", "exam drill generation"]);

for (const mode of ["502", "network-abort"]) {
  scenario(`AI failures (${mode}): every feature tells the user and recovers`, async ({ browser, check }) => {
    for (const c of CASES) {
      if (mode === "network-abort" && !ABORT_TOO.has(c.name)) continue;
      const page = await newPage(browser, { seed: { ...baseSeed(), ...(c.seed || {}) }, intercept: (req) => {
        const u = req.url();
        if (u.endsWith(c.api)) { if (mode === "network-abort") { req.abort("failed"); return true; } return json(req, { error: "boom" }, 502); }
        return aiMocks(req, json); } });
      await goto(page, c.url);
      const mistakesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("unifiedMistakes") || "[]").length);
      await c.run(page); await sleep(c.wait || 3500);
      const t = await bodyText(page);
      const body = t.slice(t.indexOf("Cài đặt") + 7);
      const label = `${c.name} (${mode})`;
      check(`${label}: message shown`, c.expect.test(body), body.replace(/\n+/g, " | ").slice(0, 100));
      check(`${label}: not stuck loading`, !/(Đang sinh|Đang tải câu hỏi|Đang chấm|Đang tra nghĩa|Đang kiểm tra\.\.\.)/.test(body));
      check(`${label}: no native alert`, !(page.__dialogs || []).length, (page.__dialogs || [])[0]);
      check(`${label}: no uncaught error`, page.__errors.length === 0, page.__errors[0]);
      check(`${label}: no mistake logged`, (await page.evaluate(() => JSON.parse(localStorage.getItem("unifiedMistakes") || "[]").length)) === mistakesBefore);
      await page.close();
    }
  });
}

// ---- hostile storage ----
const PAGES = ["/", "/today", "/review", "/exam", "/exam/mock", "/exam/mistakes", "/speak", "/write", "/write/task/task2-opinion", "/write/result/r1", "/grammar", "/grammar/quiz", "/vocab/quiz", "/vocab/context", "/mistakes", "/stats", "/history", "/diary", "/activity", "/library", "/import", "/settings", "/path", "/speak/history", "/write/history", "/speak/shadowing"];
const KEYS = ["learnedWords", "examAttempts", "learningSessions", "writingSubmissions", "unifiedMistakes", "grammarAttempts", "dailyPlan", "studyTime", "customTopics", "voiceSettings", "learningProfile", "examBank", "examSettings", "dailyChallenge", "speakingSessions", "grammarBookmarks", "grammarTopics", "skillMasteryCache", "masteryTimeline", "syncKey", "lastSyncedAt", "reportedQuestions", "lastWritingAt", "lastSpeakingAt"];
const HOSTILE = {
  "wrong-typed or malformed stored values": (page) => page.evaluateOnNewDocument((keys) => { const junk = ["{bad", "[", "null", "123", '"str"', "{}", "[1,2,{]"]; keys.forEach((k, i) => localStorage.setItem(k, junk[i % junk.length])); localStorage.setItem("__seeded", "1"); localStorage.setItem("theme", "dark"); }, KEYS),
  "storage blocked (SecurityError)": (page) => page.evaluateOnNewDocument(() => { const err = () => { throw new DOMException("The operation is insecure.", "SecurityError"); }; Object.defineProperty(window, "localStorage", { get: err, configurable: true }); Object.defineProperty(window, "sessionStorage", { get: err, configurable: true }); }),
  "storage full (QuotaExceededError)": (page) => page.evaluateOnNewDocument(() => { const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "theme" || k === "__seeded") return real.call(this, k, v); throw new DOMException("quota", "QuotaExceededError"); }; }),
};
for (const [label, setup] of Object.entries(HOSTILE)) {
  scenario(`${PAGES.length} pages load with ${label}`, async ({ browser, check }) => {
    const page = await newPage(browser, { init: setup, intercept: (req) => aiMocks(req, json) });
    for (const path of PAGES) {
      page.__errors.length = 0;
      try { await goto(page, path); } catch (e) { check(path, false, "navigation: " + e.message.slice(0, 60)); continue; }
      const r = await page.evaluate(() => ({ len: (document.querySelector("main")?.innerText || document.body.innerText).length, crash: document.body.innerText.includes("Application error") || (document.querySelector("nextjs-portal")?.shadowRoot?.textContent || "").includes("Unhandled Runtime Error") }));
      check(path, r.len >= 20 && !r.crash && page.__errors.length === 0, `len=${r.len} crash=${r.crash} ${page.__errors[0] || ""}`);
    }
  }, { timeout: 900000 });
}

// ---- HTML injection ----
const P = '<img src=x onerror="window.__xss=(window.__xss||0)+1"><script>window.__xss=(window.__xss||0)+100</script><svg onload="window.__xss=(window.__xss||0)+1000">';
const fbP = { ...feedbackW(6, [{ excerpt: "My essay", issue: P, category: P, suggestion: P }]), modelAnswer: P, nextFocus: P };
const wordP = { word: "greet", meaning: P, example: P, topic: P, learnedAt: now, updatedAt: now, reviewInterval: 1, mastery: 1, easiness: 2.5, repetitions: 0, nextReviewAt: now };
const xssMock = (req) => {
  const u = req.url(); const t = {
    "/api/generate-words": [{ word: P, meaning: P }, ...WORDS.slice(0, 2)], "/api/generate-sentence": { sentence: P }, "/api/generate-synonyms": { synonyms: [P], antonyms: [P] }, "/api/generate-fillblank": { sentence: P + " ____" },
    "/api/generate-batch": [{ word: P, meaning: P, example: P }], "/api/speak/roleplay": { reply: P, correction: { original: P, fixed: P, note: P }, goalAchieved: false, suggestedReplies: [P] },
    "/api/exam/generate-item": { id: "i", kind: "TOEIC", part: "RC5", level: 3, topic: P, createdAt: now, questions: [{ id: "q", type: "incomplete_sentence", prompt: "Choose " + P + " the word ____", options: [P + "a", "b", "c", "d"], answer: "b", explanation: P + " explanation here" }] },
    "/api/write/grade": fbP, "/api/exam/grade-open": { correct: false, feedback: P }, "/api/grammar-exercise": { type: "mcq", question: P, options: [P, "b"], answer: "b" },
  };
  for (const [k, v] of Object.entries(t)) if (u.endsWith(k)) return json(req, v);
  return false;
};
scenario("AI and stored content is rendered as text, never executed", async ({ browser, check }) => {
  const seed = { learnedWords: [wordP], writingSubmissions: [{ id: "w1", taskId: "task2-opinion", kind: "ielts_task2", prompt: P, content: "My essay " + P, wordCount: 100, feedback: fbP, createdAt: now }], unifiedMistakes: [{ id: "m1", skill: "grammar", category: P, source: "grammar:x", userAnswer: P, correctAnswer: P, explanation: P, occurrenceCount: 1, status: "new", createdAt: now, updatedAt: now }], customTopics: [P] };
  const page = await newPage(browser, { seed, intercept: xssMock });
  const visit = async (label, url, act) => {
    await goto(page, url);
    if (act) { try { await act(); } catch { /* the page under test may legitimately lack the control */ } await sleep(1200); }
    const r = await page.evaluate(() => ({ xss: window.__xss || 0, attrs: document.querySelectorAll("[onerror],[onload]").length, scripts: [...document.querySelectorAll("script")].filter((s) => /__xss/.test(s.textContent)).length, img: document.querySelectorAll('img[src="x"]').length }));
    check(label, !r.xss && !r.attrs && !r.scripts && !r.img, JSON.stringify(r));
  };
  await visit("home: generate, flip, reading", "/", async () => { await clickText(page, "Sinh từ mới"); await sleep(1200); await page.evaluate(() => document.querySelectorAll('button[aria-label^="Xem nghĩa của"]').forEach((b) => b.click())); await sleep(2000); });
  await visit("review", "/review", async () => { await flip(page); });
  await visit("history", "/history");
  await visit("library (stored payload)", "/library", async () => { await page.type("main input", "greet"); });
  await visit("import", "/import", async () => { await page.evaluate(() => document.querySelector("textarea").focus()); await page.keyboard.type("negotiate"); await clickContains(page, "Tra nghĩa"); });
  await visit("write result", "/write/result/w1");
  await visit("write history", "/write/history", async () => { await page.evaluate(() => document.querySelector("main li button")?.click()); });
  await visit("rewrite", "/write/rewrite/w1", async () => { await setValue(page, "textarea", "x"); await clickContains(page, "Kiểm tra"); });
  await visit("exam drill", "/exam/drill/RC5", async () => { await clickText(page, "Bắt đầu"); await sleep(600); await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "b")?.click()); });
  await visit("mistakes", "/mistakes");
  await visit("roleplay reply", "/speak/roleplay/hotel", async () => { await page.evaluate(() => document.querySelector("input").focus()); await page.keyboard.type("hi"); await page.keyboard.press("Enter"); });
  await visit("grammar quiz", "/grammar/quiz", async () => { await page.evaluate(() => { const f = (t) => [...document.querySelectorAll("main button")].find((b) => b.innerText.trim() === t)?.click(); f("5"); f("Bắt đầu"); }); });
  await visit("stats", "/stats");
});
