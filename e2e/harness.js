// Shared helpers for the browser E2E suite (Node's built-in test runner + puppeteer-core).
// Needs a running app (npm run dev) and a Chrome/Chromium binary. Configure with E2E_BASE and CHROME_PATH.
const puppeteer = require("puppeteer-core");
const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
const AI = process.env.E2E_AI === "1"; // gates the checks that call the real AI providers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = new Date().toISOString();
const day = (d) => new Date(Date.now() - d * 86400000).toISOString();

async function launch() {
  assert.ok(CHROME, "No Chrome found: set CHROME_PATH");
  return puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"], protocolTimeout: 300000 });
}

/** A page in its own browser context (isolated storage), seeded once, with the theme and OS colour scheme set. */
async function newPage(browser, { theme = "dark", seed = {}, intercept, viewport, init } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport || { width: 1100, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
  await page.evaluateOnNewDocument((seed, theme) => {
    try {
      if (!localStorage.getItem("__seeded")) {
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        localStorage.setItem("theme", theme);
        localStorage.setItem("__seeded", "1");
      }
    } catch {
      /* storage deliberately blocked by the scenario */
    }
  }, seed, theme);
  if (init) await init(page);
  page.__errors = [];
  page.__hydration = [];
  // Firebase/Google (third party) and the sync backend can be unreachable on CI or offline machines. The SDK reports that as
  // "TypeError: Failed to fetch", which is not an app bug as long as the page keeps working.
  let lastExternalFail = 0;
  page.on("requestfailed", (r) => { if (/googleapis|google-analytics|googletagmanager|firebase|:54331/.test(r.url())) lastExternalFail = Date.now(); });
  const externalNoise = (text) => /Failed to fetch/.test(text) && Date.now() - lastExternalFail < 15000;
  page.on("pageerror", (e) => {
    if (externalNoise(String(e.message))) return;
    const frame = String(e.stack || "").split("\n").find((l, i) => i > 0 && /src\//.test(l));
    page.__errors.push(String(e.message).slice(0, 100) + (frame ? ` @ ${frame.trim().replace(/webpack-internal:\/\/\/\(app-pages-browser\)\/\.\//, "").slice(0, 70)}` : ""));
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (externalNoise(t)) return;
    if (/ydrat|did not match/.test(t)) page.__hydration.push(t.slice(0, 100));
    else if (!/Failed to load resource|favicon|Download the React DevTools|ERR_|status of [45]/.test(t)) page.__errors.push(t.slice(0, 140));
  });
  page.__failedRequests = [];
  page.on("requestfailed", (r) => { const u = r.url(); if (!/google-analytics|googletagmanager|_next\/static/.test(u)) page.__failedRequests.push(`${r.method()} ${u.slice(0, 80)} :: ${r.failure()?.errorText}`); });
  page.on("dialog", (d) => { (page.__dialogs ||= []).push(d.message()); d.dismiss(); });
  if (intercept) {
    await page.setRequestInterception(true);
    page.on("request", (req) => { if (!intercept(req)) req.continue(); });
  }
  return page;
}

const json = (req, body, status = 200) => {
  req.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
  return true;
};
const clickText = (page, text, sel = "button,a") => page.evaluate((text, sel) => { const e = [...document.querySelectorAll(sel)].find((b) => { const t = b.innerText.trim(); return t === text || t.startsWith(text); }); if (!e) return false; e.click(); return true; }, text, sel);
const clickContains = (page, text, sel = "button,a") => page.evaluate((text, sel) => { const e = [...document.querySelectorAll(sel)].find((b) => b.innerText.includes(text)); if (!e) return false; e.click(); return true; }, text, sel);
const clickIn = (page, scope, text) => page.evaluate((scope, text) => { const e = [...document.querySelectorAll(`${scope} button`)].find((b) => b.innerText.trim() === text); if (!e) return false; e.click(); return true; }, scope, text);
const waitText = async (page, text, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate((t) => document.body.innerText.includes(t), text)) return true; await sleep(250); } return false; };
const setValue = (page, sel, text) => page.evaluate((sel, text) => { const el = document.querySelector(sel); const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text); el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, text);
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const goto = async (page, path) => { await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 45000 }); await sleep(700); };

/** Contrast scan executed in the page: text whose colour/background ratio is below 3 (SVG text uses fill). */
function scanContrast() {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const canvas = getComputedStyle(document.body).backgroundColor;
  const bgOf = (el) => { let e = el; while (e && e.nodeType === 1) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g).map(Number); if (m.length < 4 || m[3] > 0.6) return c; e = e.parentElement; } return canvas; };
  const out = []; const seen = new Set();
  document.querySelectorAll("body *").forEach((el) => {
    if (["SCRIPT", "STYLE", "svg", "path"].includes(el.tagName)) return;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.opacity === "0" || el.disabled) return;
    if (el.closest('[aria-hidden="true"]')) return;
    const fg = el instanceof SVGElement ? cs.fill : cs.color; if (!/rgb/.test(fg)) return;
    const bg = bgOf(el); const ra = ratio(fg, bg);
    if (ra < 3) { const cls = String(el.className.baseVal ?? el.className).slice(0, 30); const key = el.tagName + cls + fg + bg; if (seen.has(key)) return; seen.add(key); out.push(`${(el.innerText ?? el.textContent).trim().slice(0, 20)} [${el.tagName}.${cls}] ${ra.toFixed(2)}`); }
  });
  return out.slice(0, 6);
}

/** Collects soft check failures so one scenario reports every problem, then asserts once. */
function scenario(name, fn, opts = {}) {
  test(name, { timeout: opts.timeout || 600000, skip: opts.skip }, async () => {
    const failures = [];
    const browser = await launch();
    const check = (label, ok, note = "") => { if (!ok) failures.push(`${label}${note ? "  — " + note : ""}`); };
    try { await fn({ browser, check }); } finally { await browser.close(); }
    assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}`);
  });
}

module.exports = { BASE, AI, sleep, now, day, launch, newPage, json, clickText, clickContains, clickIn, waitText, setValue, bodyText, goto, scanContrast, scenario };
