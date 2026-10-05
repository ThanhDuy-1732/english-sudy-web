// Device sync against the local Supabase (NEXT_PUBLIC_SUPABASE_URL): push from device A, pull on device B, and the offline queue.
const { scenario, newPage, goto, json, clickText, clickContains, clickIn, setValue, bodyText, sleep, now } = require("./harness");
const { aiMocks, word } = require("./fixtures");

const KEY_A = "aaaaaaaa-" + Math.random().toString(16).slice(2, 6) + "-4aaa-8aaa-" + Date.now().toString(16).padStart(12, "0").slice(-12);
const SUPABASE = ":54331";
const words = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("learnedWords") || "[]").map((w) => w.word).sort());
const queue = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("syncQueue") || "[]").length);

async function pull(page, key) {
  await goto(page, "/settings");
  await clickIn(page, "main", "Sync"); await sleep(400);
  await setValue(page, 'main input[type=text]', key);
  await clickContains(page, "Pull data"); await sleep(2500);
}

scenario("two devices share data through the sync key, including changes made offline", async ({ browser, check }) => {
  let offline = false;
  const A = await newPage(browser, { seed: { syncKey: KEY_A, learnedWords: [word("alpha", "một", "Alpha example."), word("beta", "hai", "Beta example.")] },
    intercept: (req) => { if (offline && req.url().includes(SUPABASE)) { req.abort("connectionrefused"); return true; } return aiMocks(req, json); } });
  await goto(A, "/"); await sleep(5000); // initSync pushes the local words
  check("device A keeps its own sync key", (await A.evaluate(() => localStorage.getItem("syncKey"))) === KEY_A);

  const B = await newPage(browser, { intercept: (req) => aiMocks(req, json) });
  await pull(B, KEY_A);
  const got = await words(B);
  check("device B pulls A's words with A's key", got.includes("alpha") && got.includes("beta"), JSON.stringify(got));
  check("pull reports success", !/Không thể/.test(await bodyText(B)), (await bodyText(B)).match(/Đồng bộ[^\n]*|Không thể[^\n]*|Đã thêm[^\n]*/)?.[0]);

  // A saves a new word while the backend is unreachable → queued, then replayed when connectivity returns.
  offline = true;
  await goto(A, "/");
  await clickText(A, "Sinh từ mới"); await sleep(1200);
  await A.evaluate(() => document.querySelector('button[aria-label^="Xem nghĩa của"]')?.click()); await sleep(1800);
  await clickContains(A, "Đã học"); await sleep(1500);
  const savedLocally = (await words(A)).some((w) => w === "greeting");
  check("word is saved locally even though the backend is down", savedLocally, JSON.stringify(await words(A)));
  check("the change waits in the sync queue", (await queue(A)) >= 1, `queue=${await queue(A)}`);
  offline = false;
  await A.evaluate(() => window.dispatchEvent(new Event("online"))); await sleep(5000);
  check("queue drains once the connection returns", (await queue(A)) === 0, `queue=${await queue(A)}`);

  const C = await newPage(browser, { intercept: (req) => aiMocks(req, json) });
  await pull(C, KEY_A);
  check("a third device receives the word that was queued offline", (await words(C)).includes("greeting"), JSON.stringify(await words(C)));

  // Invalid keys are rejected clearly.
  await goto(C, "/settings"); await clickIn(C, "main", "Sync"); await setValue(C, 'main input[type=text]', "not-a-key"); await clickContains(C, "Pull data"); await sleep(1200);
  check("an invalid key shows a message", /Key không hợp lệ/.test(await bodyText(C)), (await bodyText(C)).match(/Pull data[\s\S]{0,120}/)?.[0]?.replace(/\n+/g, " | "));
}, { timeout: 300000 });
