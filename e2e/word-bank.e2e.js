// Word bank + generation job: no repeats, instant serving from the bank, resumable job, tab lock.
// AI endpoints are mocked; no real providers are called.
const { BASE, scenario, newPage, goto, json, clickText, waitText, bodyText, sleep } = require("./harness");

const bankOf = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("wordBank") || "[]"));
const jobOf = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("wordJob") || "null"));

/** Every generate-words call returns 20 unique words; `calls` counts them. */
function wordMocks(calls, { delayMs = 0 } = {}) {
  return (req) => {
    if (!req.url().endsWith("/api/generate-words")) return false;
    calls.n += 1;
    const batch = calls.n;
    const words = Array.from({ length: 20 }, (_, i) => ({
      word: `mockword${batch}_${i}`,
      meaning: `nghĩa ${batch}/${i}`,
    }));
    if (delayMs) setTimeout(() => json(req, words), delayMs);
    else json(req, words);
    return true;
  };
}

scenario("bank serves unseen words without repeating or re-asking the AI", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls) });
  await goto(page, "/");

  await clickText(page, "Gieo 5 từ mới");
  check("first batch renders", await waitText(page, "mockword1_", 15000));
  await sleep(500);

  const first = await bankOf(page);
  check("the whole batch is stored", first.length === 20, String(first.length));
  check("only the five shown are marked seen", first.filter((w) => w.seenAt).length === 5);

  await clickText(page, "Gieo 5 từ mới");
  await sleep(700);
  const second = await bankOf(page);
  check("second click makes no AI call", calls.n === 1, String(calls.n));
  check("ten words have now been shown", second.filter((w) => w.seenAt).length === 10);
  check(
    "bank never holds a duplicate",
    new Set(second.map((w) => w.word.toLowerCase())).size === second.length
  );
});

scenario("a 100-word job runs to completion with unique words", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls) });
  await goto(page, "/");

  await clickText(page, "100");
  await clickText(page, "Bắt đầu");
  check("progress strip appears", await waitText(page, "Đang tạo", 5000));
  check("job finishes", await waitText(page, "Đã đủ 100", 30000));

  const bank = await bankOf(page);
  check("100 words stored", bank.length === 100, String(bank.length));
  check(
    "all 100 are unique",
    new Set(bank.map((w) => w.word.toLowerCase())).size === bank.length
  );
  check("job status is done", (await jobOf(page))?.status === "done");
});

scenario("a reloaded job comes back paused and resumes without spending", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls, { delayMs: 400 }) });
  await goto(page, "/");

  await clickText(page, "300");
  await clickText(page, "Bắt đầu");
  check("job starts", await waitText(page, "Đang tạo", 5000));
  await sleep(1800);

  const before = (await bankOf(page)).length;
  check("progress exists before the reload", before > 0 && before < 300, String(before));

  await page.reload({ waitUntil: "networkidle2" });
  await sleep(900);
  check("resume prompt after reload", await waitText(page, "Chạy tiếp", 5000));

  const callsAtReload = calls.n;
  await sleep(1200);
  check("reloaded tab does not keep spending", calls.n === callsAtReload, `${callsAtReload} -> ${calls.n}`);

  await clickText(page, "Chạy tiếp");
  check("resume finishes the job", await waitText(page, "Đã đủ 300", 90000));
  const bank = await bankOf(page);
  check("300 unique words", bank.length === 300 && new Set(bank.map((w) => w.word.toLowerCase())).size === 300, String(bank.length));
});

scenario("a second tab shows the running job but makes no requests", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls, { delayMs: 500 }) });
  await goto(page, "/");
  await clickText(page, "300");
  await clickText(page, "Bắt đầu");
  check("job starts in tab one", await waitText(page, "Đang tạo", 5000));

  const second = await page.browserContext().newPage();
  const secondCalls = { n: 0 };
  await second.setRequestInterception(true);
  second.on("request", (req) => {
    if (req.url().endsWith("/api/generate-words")) {
      secondCalls.n += 1;
      json(req, []);
      return;
    }
    req.continue();
  });
  await second.goto(BASE + "/", { waitUntil: "networkidle2" });
  await sleep(1200);
  check("second tab shows the other-tab state", (await bodyText(second)).includes("tab khác"));

  await sleep(1500);
  check("second tab makes no job requests", secondCalls.n === 0, String(secondCalls.n));

  await second.close();
});

scenario("closing the job tab leaves a resumable job", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls, { delayMs: 300 }) });
  const context = page.browserContext();
  await goto(page, "/");
  await clickText(page, "300");
  await clickText(page, "Bắt đầu");
  check("job starts", await waitText(page, "Đang tạo", 5000));
  await sleep(1200);
  const before = (await bankOf(page)).length;
  check("progress before closing", before > 0, String(before));

  await page.close();
  await sleep(300);

  const next = await context.newPage();
  await next.setRequestInterception(true);
  next.on("request", (req) => {
    if (!wordMocks(calls, { delayMs: 300 })(req)) req.continue();
  });
  await next.goto(BASE + "/", { waitUntil: "networkidle2" });
  check("closed tab's job comes back paused", await waitText(next, "Chạy tiếp", 6000));
  const job = await jobOf(next);
  check("status is paused", job?.status === "paused", String(job?.status));
  check("progress kept", (await bankOf(next)).length >= before);

  await clickText(next, "Chạy tiếp");
  check("resume finishes the job", await waitText(next, "Đã đủ 300", 90000));
  const bank = await bankOf(next);
  check("300 unique words after takeover", bank.length === 300 && new Set(bank.map((w) => w.word.toLowerCase())).size === 300, String(bank.length));
});

scenario("an already-open tab adopts a job started elsewhere", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls, { delayMs: 300 }) });
  await goto(page, "/");

  const idle = await page.browserContext().newPage();
  await idle.setRequestInterception(true);
  idle.on("request", (req) => {
    if (!wordMocks(calls, { delayMs: 300 })(req)) req.continue();
  });
  await idle.goto(BASE + "/", { waitUntil: "networkidle2" });
  await sleep(600);
  check("idle tab has no strip yet", !(await bodyText(idle)).includes("Đang tạo"));

  await clickText(page, "300");
  await clickText(page, "Bắt đầu");
  check("idle tab learns about the job", await waitText(idle, "tab khác", 8000));
  check("idle tab shows progress", (await bodyText(idle)).includes("/300"));

  await idle.close();
});

scenario("a blocked-storage start shows an error and spends nothing", async ({ browser, check }) => {
  const calls = { n: 0 };
  const page = await newPage(browser, { intercept: wordMocks(calls) });
  await page.evaluateOnNewDocument(() => {
    Storage.prototype.setItem = function () {
      throw new Error("QuotaExceededError");
    };
  });
  await goto(page, "/");
  await clickText(page, "100");
  await clickText(page, "Bắt đầu");
  check("storage error is shown", await waitText(page, "Không lưu được", 6000));
  await sleep(1500);
  check("no AI calls were made", calls.n === 0, String(calls.n));
});
