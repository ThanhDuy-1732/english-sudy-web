// Writing tasks: submit, result, draft recovery, rewrite practice and failure handling (grading is mocked).
const { scenario, newPage, goto, json, clickText, clickContains, setValue, bodyText, sleep, now, AI } = require("./harness");
const { feedbackW } = require("./fixtures");

const words = (n) => Array.from({ length: n }, (_, i) => ["technology", "education", "students", "learning"][i % 4]).join(" ") + ".";
const fb = () => feedbackW(6.5, [{ excerpt: "technology education", issue: "Repetitive", category: "lexical", suggestion: "Use synonyms" }]);
const rec = (n) => ({ id: "rw1", taskId: "task2-opinion", kind: "ielts_task2", prompt: "P", content: "E", wordCount: 120, createdAt: now,
  feedback: feedbackW(6, Array.from({ length: n }, (_, i) => ({ excerpt: `bad sentence ${i + 1}`, issue: `issue ${i + 1}`, category: "grammar", suggestion: `good sentence ${i + 1}` }))) });
const grade = (req) => (req.url().endsWith("/api/write/grade") ? json(req, fb()) : false);

async function submit(page, id, n) {
  await goto(page, `/write/task/${id}`);
  await clickContains(page, "Bắt đầu viết"); await sleep(400);
  await setValue(page, "textarea", words(n)); await sleep(300);
  const enabled = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Nộp bài/.test(x.innerText)); return !!b && !b.disabled; });
  await clickContains(page, "Nộp bài");
  const ok = await page.waitForFunction(() => location.pathname.startsWith("/write/result/"), { timeout: 60000 }).then(() => true).catch(() => false);
  await sleep(600);
  return { enabled, ok, text: await bodyText(page) };
}

scenario("writing tasks can be submitted and graded", async ({ browser, check }) => {
  const page = await newPage(browser, { intercept: grade });
  const r1 = await submit(page, "task2-opinion", 262);
  check("Task 2: enabled at the minimum, grading returns a result page", r1.enabled && r1.ok);
  check("Task 2: result shows bands, annotations and model answer", /OVERALL/i.test(r1.text) && /BÀI MẪU/i.test(r1.text) && /BÀI VIẾT CÓ CHÚ THÍCH/i.test(r1.text));
  const saved = await page.evaluate(() => { const r = JSON.parse(localStorage.getItem("writingSubmissions") || "[]")[0]; return r && { taskId: r.taskId, drafts: Object.keys(localStorage).filter((k) => k.startsWith("writingTaskDraft")).length }; });
  check("record keeps its taskId and the draft is cleared", saved?.taskId === "task2-opinion" && saved.drafts === 0, JSON.stringify(saved));
  const r2 = await submit(page, "task1-bar", 155);
  check("Task 1 bar chart submits with the right title", r2.ok && /IELTS Task 1/.test(r2.text));
  const r3 = await submit(page, "toeic-email", 110);
  check("TOEIC email submits with the right title", r3.ok && /TOEIC Writing/.test(r3.text));
  await goto(page, "/write/task/task2-discuss"); await clickContains(page, "Bắt đầu viết"); await sleep(300); await setValue(page, "textarea", words(40)); await sleep(300);
  check("submit stays disabled below the minimum word count", await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Nộp bài/.test(x.innerText))?.disabled === true));
});

scenario("'Viết lại' returns to the task the essay came from", async ({ browser, check }) => {
  const page = await newPage(browser, { seed: { writingSubmissions: [{ ...rec(1), id: "w1", kind: "ielts_task1", taskId: "task1-line" }] } });
  await goto(page, "/write/result/w1");
  await clickContains(page, "Viết lại"); await sleep(1500);
  check("goes to /write/task/task1-line", /\/write\/task\/task1-line/.test(page.url()), page.url());
});

scenario("writing drafts are recovered and expire cleanly", async ({ browser, check }) => {
  const expired = await newPage(browser, { seed: { "writingTaskDraft:task2-discuss": { content: "My unfinished draft text", deadline: Date.now() - 60000 } } });
  await goto(expired, "/write/task/task2-discuss"); await sleep(800);
  check("expired draft: text restored and time-up notice shown", /My unfinished draft/.test((await expired.evaluate(() => document.querySelector("textarea")?.value)) || "") && /Đã hết giờ/.test(await bodyText(expired)));
  await clickContains(expired, "Làm lại từ đầu"); await sleep(500);
  const after = await expired.evaluate(() => ({ draft: localStorage.getItem("writingTaskDraft:task2-discuss"), start: [...document.querySelectorAll("button")].some((b) => /Bắt đầu viết/.test(b.innerText)) }));
  check("'Làm lại từ đầu' clears the draft and returns to the start screen", after.draft === null && after.start, JSON.stringify(after));
  const live = await newPage(browser, { seed: { "writingTaskDraft:task2-discuss": { content: "Draft still in time", deadline: Date.now() + 30 * 60000 } } });
  await goto(live, "/write/task/task2-discuss"); await sleep(800);
  const s = await live.evaluate(() => ({ v: document.querySelector("textarea")?.value, timer: document.querySelector(".timer")?.innerText }));
  check("in-time draft restored with a running timer", /Draft still in time/.test(s.v || "") && /\d\d:\d\d/.test(s.timer || ""), JSON.stringify(s));
});

scenario("rewrite practice: complete all sentences, and a failed grading is not a wrong answer", async ({ browser, check }) => {
  const calls = [];
  const ok = await newPage(browser, { seed: { writingSubmissions: [rec(3)] }, intercept: (req) => { if (req.url().endsWith("/api/exam/grade-open")) { calls.push(1); return json(req, { correct: true, feedback: "Well done." }); } return false; } });
  await goto(ok, "/write/rewrite/rw1");
  check("starts at 1/3 with the first flagged sentence", /1\/3/.test(await bodyText(ok)) && /bad sentence 1/.test(await bodyText(ok)));
  for (let i = 0; i < 3; i++) {
    await setValue(ok, "textarea", `good sentence ${i + 1}`); await clickContains(ok, "Kiểm tra"); await sleep(900);
    if (i < 2) { await clickContains(ok, "Câu tiếp"); await sleep(300); }
  }
  await sleep(500);
  check("completion state after all sentences", calls.length === 3 && /Đã hoàn thành tất cả lỗi/.test(await ok.evaluate(() => document.querySelector("main").innerText)));
  const bad = await newPage(browser, { seed: { writingSubmissions: [rec(2)] }, intercept: (req) => (req.url().endsWith("/api/exam/grade-open") ? json(req, { error: "Unable to grade" }, 502) : false) });
  await goto(bad, "/write/rewrite/rw1");
  await setValue(bad, "textarea", "good sentence 1"); await clickContains(bad, "Kiểm tra"); await sleep(1200);
  const t = await bad.evaluate(() => document.querySelector("main").innerText);
  check("failed grading shows an error message", /Không thể chấm/.test(t), t.replace(/\n+/g, " | ").slice(0, 120));
  check("failed grading gives no verdict or answer hint", !/Chưa chính xác/.test(t) && !/Gợi ý/.test(t));
  check("failed grading logs no mistake", (await bad.evaluate(() => JSON.parse(localStorage.getItem("unifiedMistakes") || "[]").length)) === 0);
});

scenario("Task 2 is graded by the real AI", async ({ browser, check }) => {
  const page = await newPage(browser);
  const r = await submit(page, "task2-opinion", 262);
  check("real grading returns a result page with bands", r.ok && /OVERALL/i.test(r.text));
}, { skip: !AI && "set E2E_AI=1 to call the real AI providers" });
