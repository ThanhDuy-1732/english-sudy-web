// Vocabulary (topics, study modes) and grammar (quiz modes, failures, examples). AI endpoints are mocked.
const { scenario, newPage, goto, json, clickText, clickContains, clickIn, waitText, setValue, bodyText, sleep, now, day, AI } = require("./harness");
const { baseSeed, aiMocks } = require("./fixtures");

const face = (page, fn, arg) => page.evaluate((src, arg) => { const f = [...document.querySelectorAll('div[aria-hidden="false"]')].find((d) => /Quên/.test(d.innerText)); return new Function("f", "arg", src)(f, arg); }, fn, arg);
const faceText = (page) => face(page, "return f?.innerText.replace(/\\n+/g,' | ')");
async function openMode(page, mode) {
  await goto(page, "/review");
  await page.click('button[aria-label^="Xem nghĩa của"]'); await sleep(1200);
  await face(page, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()===arg)?.click()", mode); await sleep(800);
}
const typeIn = async (page, sel, text) => { await face(page, "f.querySelector(arg).focus()", sel); await page.keyboard.type(text); };

scenario("custom and TOEIC topics drive word generation", async ({ browser, check }) => {
  const topics = [];
  const page = await newPage(browser, { intercept: (req) => { if (req.url().endsWith("/api/generate-words")) topics.push(JSON.parse(req.postData() || "{}").topic); return aiMocks(req, json); } });
  await goto(page, "/");
  await page.type('input[placeholder^="Chủ đề khác"]', "Travel and tourism"); await page.keyboard.press("Enter"); await sleep(500);
  check("custom topic chip added", (await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Travel and tourism/.test(b.innerText)))));
  check("custom topic persisted", /Travel and tourism/.test((await page.evaluate(() => localStorage.getItem("customTopics"))) || ""));
  await clickText(page, "Gieo 5 từ mới"); await sleep(1000);
  check("generation uses the custom topic", topics.at(-1) === "Travel and tourism", String(topics.at(-1)));
  await clickText(page, "TOEIC"); await sleep(300); await clickText(page, "Gieo 5 từ mới"); await sleep(1000);
  check("TOEIC chip switches the topic", topics.at(-1) === "TOEIC", String(topics.at(-1)));
});

scenario("generates English and Chinese words", async ({ browser, check }) => {
  const page = await newPage(browser, { seed: { ...baseSeed(), learningLanguages: JSON.stringify(["en", "zh"]) }, intercept: (req) => aiMocks(req, json, { "/api/generate-sentence": (r) => (/"lang":"zh"/.test(r.postData() || "") ? { sentence: "我们互相问候。", reading: "wǒmen hùxiāng wènhòu.", translation: "Chúng tôi chào hỏi nhau." } : { sentence: "A warm greeting." }) }) });
  await goto(page, "/"); await clickText(page, "Gieo 5 từ mới"); await sleep(1200);
  const cards = await page.evaluate(() => [...document.querySelectorAll("article.postcard")].map((a) => a.innerText));
  check("five concept cards", cards.length === 5, String(cards.length));
  check("cards show the Chinese word and pinyin", cards.some((t) => /问候/.test(t) && /wènhòu/.test(t)), cards[0]);
  await page.evaluate(() => document.querySelector('button[aria-label^="Xem nghĩa của greeting"]')?.click()); await sleep(1200);
  await clickText(page, "Gieo vào vườn"); await sleep(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("learnedWords") || "[]").filter((w) => w.conceptId).map((w) => `${w.lang}:${w.word}`));
  check("saving plants both languages", saved.includes("en:greeting") && saved.includes("zh:问候"), saved.join(","));
});

scenario("practise a Chinese card: fill-blank and quiz", async ({ browser, check }) => {
  const zh = (word, meaning, reading) => ({ word, meaning, reading, lang: "zh", example: "我是学生。", topic: "TOEIC", learnedAt: "2026-11-01T00:00:00.000Z", nextReviewAt: "2026-11-02T00:00:00.000Z" });
  const seed = { ...baseSeed(), learningLanguages: ["en", "zh"], learnedWords: [zh("学生", "học sinh", "xuéshēng"), zh("老师", "giáo viên", "lǎoshī"), zh("朋友", "bạn bè", "péngyou"), zh("医生", "bác sĩ", "yīshēng")] };
  const page = await newPage(browser, { seed, intercept: (req) => aiMocks(req, json) });
  await openMode(page, "Điền từ");
  check("Chinese fill-blank shows the reading", /wǒ shì/.test(await faceText(page)), await faceText(page));
  await typeIn(page, "input", "学生 。"); await face(page, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Kiểm tra')?.click()"); await sleep(600);
  check("Chinese answer with a space and 。 is accepted", /Đúng rồi/.test(await faceText(page)), await faceText(page));
  await goto(page, "/vocab/quiz"); await sleep(800);
  await page.evaluate(() => [...document.querySelectorAll('[role="radio"]')].find((r) => r.innerText.trim() === "中文")?.click()); await sleep(200);
  await clickText(page, "5"); await clickText(page, "Bắt đầu"); await sleep(600);
  const question = await page.evaluate(() => document.querySelector("main .postcard p")?.innerText ?? "");
  check("quiz asks a Chinese word", /^(学生|老师|朋友|医生)$/.test(question), question);
});

scenario("review study modes: fill-blank, write-sentence, dictation", async ({ browser, check }) => {
  const page = await newPage(browser, { seed: baseSeed(), intercept: (req) => aiMocks(req, json, { "/api/grade-sentence": { score: 10, feedback: "Câu đúng ngữ pháp và dùng từ đúng.", corrected: "I greet my teacher every morning." } }) });
  await openMode(page, "Điền từ");
  await typeIn(page, "input", "greet"); await face(page, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Kiểm tra')?.click()"); await sleep(700);
  check("fill-blank accepts the right word", /Đúng rồi/.test(await faceText(page)));
  await openMode(page, "Điền từ");
  await typeIn(page, "input", "xyz"); await face(page, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Kiểm tra')?.click()"); await sleep(700);
  check("fill-blank shows the answer for a wrong word", /Sai rồi\. Đáp án: "greet"/.test(await faceText(page)), await faceText(page));
  await openMode(page, "Viết câu");
  await typeIn(page, "textarea", "I greet my teacher every morning."); await face(page, "[...f.querySelectorAll('button')].find(b=>b.innerText.trim()==='Chấm điểm')?.click()"); await sleep(1000);
  check("write-sentence shows grading feedback", /10\/10/.test(await faceText(page)), await faceText(page));
  await openMode(page, "Nghe");
  await typeIn(page, "textarea", "I greet my neighbours."); await face(page, "[...f.querySelectorAll('button')].find(b=>/Kiểm tra/.test(b.innerText))?.click()"); await sleep(700);
  check("dictation compares the typed sentence", /Kết quả/.test(await faceText(page)) && /Câu đúng/.test(await faceText(page)), await faceText(page));
});

scenario("grammar quiz: result, weak and bookmarked modes", async ({ browser, check }) => {
  const wrong = (t, r, n) => Array.from({ length: n }, (_, i) => ({ id: t + r + i, topicId: t, subRuleId: r, correct: false, at: day(i) }));
  const page = await newPage(browser, { seed: { grammarBookmarks: [{ topicId: "tenses", subRuleId: "present-simple", createdAt: now }] }, intercept: (req) => aiMocks(req, json) });
  await goto(page, "/grammar/quiz");
  await clickIn(page, "main", "5"); await clickText(page, "Bắt đầu");
  check("quiz starts", await waitText(page, "1/5", 15000));
  for (let i = 0; i < 5; i++) {
    await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.innerText.trim() && !/Tiếp theo|Xem kết quả/.test(b.innerText))[0]?.click());
    await sleep(300);
    await clickText(page, i < 4 ? "Tiếp theo" : "Xem kết quả");
  }
  await waitText(page, "chính xác", 8000);
  const t = await bodyText(page);
  check("result screen with a score and retry", /chính xác/.test(t) && /Làm lại/.test(t) && /\d\/5/.test(t), t.match(/\d\/5/)?.[0]);
  check("every answer is recorded", (await page.evaluate(() => JSON.parse(localStorage.getItem("grammarAttempts") || "[]").length)) === 5);
  await goto(page, "/grammar/quiz");
  await clickIn(page, "main", "Đã lưu"); await clickText(page, "Bắt đầu");
  check("bookmarked mode starts", await waitText(page, "1/10", 15000) || await waitText(page, "1/5", 5000));
  const empty = await newPage(browser, { intercept: (req) => aiMocks(req, json) });
  await goto(empty, "/grammar/quiz");
  await clickIn(empty, "main", "Điểm yếu"); await clickText(empty, "Bắt đầu"); await sleep(600);
  check("weak mode without history explains the rule inline (no alert)", /ít nhất 3 lượt/.test(await bodyText(empty)) && !(empty.__dialogs || []).length, (empty.__dialogs || [])[0]);
  const weak = await newPage(browser, { seed: { grammarAttempts: [...wrong("tenses", "present-simple", 4), ...wrong("modal-verbs", "would", 3)] }, intercept: (req) => aiMocks(req, json) });
  await goto(weak, "/grammar/quiz");
  await clickIn(weak, "main", "5"); await clickIn(weak, "main", "Điểm yếu"); await clickText(weak, "Bắt đầu");
  check("weak mode with history starts on a weak topic", await waitText(weak, "1/5", 15000) && /(Tenses|Modal Verbs)/.test(await bodyText(weak)));
});

scenario("grammar quiz survives failures", async ({ browser, check }) => {
  const fail = await newPage(browser, { intercept: (req) => (req.url().endsWith("/api/grammar-exercise") ? json(req, { error: "boom" }, 502) : aiMocks(req, json)) });
  await goto(fail, "/grammar/quiz");
  await clickText(fail, "Bắt đầu"); await sleep(1200);
  check("shows an inline error and can retry", /Không thể tạo câu hỏi/.test(await bodyText(fail)) && (await fail.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.innerText.trim() === "Bắt đầu")?.disabled === false)));
  check("no uncaught errors", fail.__errors.length === 0, fail.__errors[0]);
  let calls = 0;
  const flaky = await newPage(browser, { intercept: (req) => { if (req.url().endsWith("/api/grammar-exercise")) { calls++; return calls === 2 ? json(req, { error: "boom" }, 502) : json(req, { type: "mcq", question: `Question ${calls}?`, options: ["a", "b"], answer: "a" }); } return aiMocks(req, json); } });
  await goto(flaky, "/grammar/quiz");
  await clickIn(flaky, "main", "5"); await clickText(flaky, "Bắt đầu"); await waitText(flaky, "1/5", 10000); await sleep(500);
  await flaky.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.innerText.trim() === "a")?.click()); await sleep(300);
  await clickText(flaky, "Tiếp theo"); await sleep(1500);
  check("a failed prefetch is retried on demand", /1?\/?5/.test(await bodyText(flaky)) && /2\/5/.test(await bodyText(flaky)), (await bodyText(flaky)).match(/\d\/5/)?.[0]);
});

scenario("grammar page: bookmarking a rule", async ({ browser, check }) => {
  const page = await newPage(browser, { intercept: (req) => aiMocks(req, json) });
  await goto(page, "/grammar");
  await page.evaluate(() => [...document.querySelectorAll("main button")].find((x) => /☆ Lưu/.test(x.innerText))?.click());
  await sleep(500);
  check("the rule is stored as a bookmark", /present-simple/.test((await page.evaluate(() => localStorage.getItem("grammarBookmarks"))) || ""));
  check("the button reflects the saved state", /Đã lưu/.test(await bodyText(page)));
});

scenario("context practice accepts words typed by the learner", async ({ browser, check }) => {
  const bodies = [];
  const page = await newPage(browser, {
    intercept: (req) => {
      if (req.url().endsWith("/api/vocab/context")) {
        bodies.push(JSON.parse(req.postData() || "{}"));
        return json(req, { text: "**invoice** and **deadline** are due." });
      }
      return aiMocks(req, json);
    },
  });
  await goto(page, "/vocab/context");
  await page.type("#custom-word", "invoice, deadline");
  await page.keyboard.press("Enter");
  check("both typed words are selected", /Đã chọn: 2 từ/.test(await bodyText(page)));

  await clickText(page, "Tạo nội dung");
  check("request carries the typed words", JSON.stringify(bodies.at(-1)?.words) === JSON.stringify(["invoice", "deadline"]), JSON.stringify(bodies.at(-1)?.words));
  check("result renders with the words", /invoice/.test(await bodyText(page)) && /deadline/.test(await bodyText(page)));
});

scenario("translate vi→zh and save a tone", async ({ browser, check }) => {
  const page = await newPage(browser, { intercept: (req) => aiMocks(req, json) });
  await goto(page, "/");
  await clickText(page, "Dịch");
  await waitText(page, "Tự nhận", 8000);
  await setValue(page, 'textarea[aria-label="Nội dung cần dịch"]', "Xin chào");

  await clickIn(page, "main", "Dịch");
  check("three tone cards render", await waitText(page, "Trang trọng", 8000));
  check("reading is shown", /nǐ hǎo/.test(await bodyText(page)));
  // Cặp mặc định được ghi nhớ ngay sau lần dịch đầu.
  check(
    "default pair Việt → Anh",
    /"from":"vi"/.test((await page.evaluate(() => localStorage.getItem("translatePair"))) || "") &&
      /"to":"en"/.test((await page.evaluate(() => localStorage.getItem("translatePair"))) || "")
  );

  await page.evaluate(() => {
    const select = document.querySelector('select[aria-label="Ngôn ngữ đích"]');
    select.value = "zh";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await sleep(300);
  await clickIn(page, "main", "Dịch");
  check("history is kept on device", /Gần đây/.test(await bodyText(page)) && /Xin chào/.test(await bodyText(page)));
  check("pair is remembered", /"from":"vi"/.test((await page.evaluate(() => localStorage.getItem("translatePair"))) || ""));

  await clickContains(page, "Gieo vào vườn");
  check("tone is saved to the garden", await waitText(page, "Đã gieo", 8000));
  check(
    "garden entry keeps lang, reading and Vietnamese meaning",
    /"lang":"zh"/.test((await page.evaluate(() => localStorage.getItem("learnedWords"))) || "") &&
      /"topic":"Dịch"/.test((await page.evaluate(() => localStorage.getItem("learnedWords"))) || "")
  );
});

scenario("a remembered pair hydrates without mismatch", async ({ browser, check }) => {
  const page = await newPage(browser, {
    seed: { translatePair: { from: "auto", to: "zh" } },
    intercept: (req) => aiMocks(req, json),
  });
  await goto(page, "/translate");
  check(
    "hydrated select keeps the remembered pair",
    (await page.evaluate(() => document.querySelector('select[aria-label="Ngôn ngữ nguồn"]')?.value)) === "auto"
  );
  check("no hydration mismatch", page.__hydration.length === 0, page.__hydration.join("; "));
});
