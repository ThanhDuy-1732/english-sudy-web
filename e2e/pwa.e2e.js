// Production-only: needs `npm run build && npm start` (service worker registers only when NODE_ENV=production).
// Run with E2E_BASE=http://localhost:3100. Covers offline launch, the update banner and the theme script in a prod build.
const http = require("node:http");
const { scenario, newPage, goto, bodyText, clickText, sleep, BASE } = require("./harness");

const url = new URL(BASE);
let variant = 0; // bump to make the proxy serve a byte-different sw.js, i.e. a "new deployment"

/** Same-origin-for-the-browser proxy in front of the app, so the test controls what /sw.js returns. */
function startProxy() {
  const server = http.createServer((req, res) => {
    const up = http.request({ host: url.hostname, port: url.port, path: req.url, method: req.method, headers: { ...req.headers, "accept-encoding": "identity" } }, (r) => {
      if (req.url.startsWith("/sw.js") && variant) {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => { const body = Buffer.concat(chunks) + `\n// variant ${variant}\n`; res.writeHead(r.statusCode, { ...r.headers, "content-length": Buffer.byteLength(body) }); res.end(body); });
      } else { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
    });
    up.on("error", () => { res.statusCode = 502; res.end(); });
    req.pipe(up);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

scenario("service worker: offline launch, update banner and theme script on a production build", async ({ browser, check }) => {
  const proxy = await startProxy();
  const origin = `http://127.0.0.1:${proxy.address().port}`;
  try {
    const page = await newPage(browser, { theme: "light" });
    await page.goto(origin + "/", { waitUntil: "networkidle2" });
    const controlled = await page.evaluate(async () => {
      for (let i = 0; i < 40; i++) { if (navigator.serviceWorker.controller) return true; await new Promise((r) => setTimeout(r, 500)); }
      return false;
    }).catch(() => false);
    if (!controlled) { check("service worker registered (is this a production server?)", false, `no controller at ${BASE}`); return; }
    check("theme script resolves the saved theme before paint", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light");
    check("no hydration errors in the production build", page.__hydration.length === 0 && page.__errors.length === 0, page.__errors[0] || page.__hydration[0]);

    // Precaching finishes after activation; give it time, then go offline and open pages cold.
    await sleep(8000);
    await page.setOfflineMode(true);
    for (const path of ["/", "/review", "/grammar", "/settings"]) {
      await page.goto(origin + path, { waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(1500);
      const text = await bodyText(page);
      check(`offline: ${path} opens from the cache`, text.length > 200 && !/Bạn đang ngoại tuyến\b.*chưa được lưu/s.test(text) && (await page.evaluate(() => !!document.querySelector("nav, main"))), text.slice(0, 80));
    }
    check("offline: status bar is shown", /ngoại tuyến/i.test(await bodyText(page)));
    await page.goto(origin + "/exam/drill/NOPE", { waitUntil: "domcontentloaded" }).catch(() => {});
    check("offline: an unvisited route still shows the app or offline page, never a browser error", (await bodyText(page)).length > 50 && !/ERR_INTERNET_DISCONNECTED/.test(await bodyText(page)));
    await page.setOfflineMode(false);

    // New deployment → waiting worker → banner → update reloads onto the new worker.
    await goto(page, origin + "/review".replace(origin, ""), {}).catch(() => {});
    await page.goto(origin + "/review", { waitUntil: "networkidle2" });
    const before = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
    variant = 1;
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await page.waitForFunction(() => /Có phiên bản mới/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
    const banner = await bodyText(page);
    check("update banner appears when a new version is waiting", /Có phiên bản mới/.test(banner));
    const reloaded = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).then(() => true).catch(() => false);
    await clickText(page, "Cập nhật và tải lại");
    check("'Cập nhật và tải lại' reloads the page", await reloaded);
    await sleep(1500);
    check("banner is gone after the update", !/Có phiên bản mới/.test(await bodyText(page)));
    check("the page works on the new worker", (await bodyText(page)).length > 200 && (await page.evaluate(() => !!navigator.serviceWorker.controller)), before);
  } finally { proxy.close(); }
}, { timeout: 240000 });
