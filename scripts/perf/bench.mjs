#!/usr/bin/env node
/**
 * Perf bench for the deployed English Study app.
 *
 *   node scripts/perf/bench.mjs pages   # page TTFB / total, 3 samples each
 *   node scripts/perf/bench.mjs api     # one call per API feature + provider GET
 *   node scripts/perf/bench.mjs assets  # static asset weight of key pages
 *   node scripts/perf/bench.mjs all
 *
 * Results are written to scripts/perf/results.json.
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.PERF_BASE ?? "https://english-sudy-web-taupe.vercel.app";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PERF_OUT ?? join(__dirname, "results.json");
// PERF_PROVIDER=opencode: send that provider and disable every other one, so a failure is not hidden by the fallback chain.
const ONLY = process.env.PERF_PROVIDER;
const ALL_PROVIDERS = ["opencode", "groq", "cohere", "openrouter", "gemini"];

const PAGES = [
  "/",
  "/today",
  "/review",
  "/history",
  "/activity",
  "/stats",
  "/diary",
  "/grammar",
  "/import",
  "/settings",
  "/exam",
  "/exam/mock",
  "/exam/mistakes",
  "/translate",
  "/speak",
  "/speak/shadowing",
  "/speak/history",
  "/write",
  "/write/history",
  "/path",
  "/mistakes",
  "/library",
  "/vocab/quiz",
  "/vocab/context",
  "/grammar/quiz",
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function timedFetch(url, init = {}, timeoutMs = 180_000) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const ttfb = performance.now() - t0;
    const body = await res.text();
    const total = performance.now() - t0;
    return {
      ok: res.ok,
      status: res.status,
      ttfbMs: Math.round(ttfb),
      totalMs: Math.round(total),
      bytes: Buffer.byteLength(body),
      provider: res.headers.get("x-provider-used"),
      cache: res.headers.get("x-vercel-cache"),
      body,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ttfbMs: Math.round(performance.now() - t0),
      totalMs: Math.round(performance.now() - t0),
      bytes: 0,
      error: String(err),
    };
  }
}

async function benchPages() {
  const runs = Number(process.env.PERF_PAGE_RUNS ?? 5);
  const samples = new Map(PAGES.map((p) => [p, []]));
  // Interleave pages in a different order every round so a periodic latency spike
  // does not land on the same page each time.
  for (let round = 0; round < runs; round++) {
    const order = [...PAGES].sort(() => Math.random() - 0.5);
    for (const path of order) {
      const r = await timedFetch(BASE + path);
      samples.get(path).push({ ttfb: r.ttfbMs, total: r.totalMs, status: r.status, bytes: r.bytes, cache: r.cache });
      await delay(120);
    }
  }
  const out = [];
  for (const path of PAGES) {
    const s = samples.get(path);
    const ttfb = s.map((x) => x.ttfb).sort((a, b) => a - b);
    const total = s.map((x) => x.total).sort((a, b) => a - b);
    const med = (arr) => arr[Math.floor(arr.length / 2)];
    const row = {
      path,
      status: s[0].status,
      cache: s[0].cache,
      bytes: s[0].bytes,
      ttfbMedian: med(ttfb),
      ttfbMin: ttfb[0],
      ttfbMax: ttfb[ttfb.length - 1],
      ttfbSamples: ttfb,
      totalMedian: med(total),
      totalMin: total[0],
      totalMax: total[total.length - 1],
      totalSamples: total,
    };
    out.push(row);
    console.log(
      `${path.padEnd(18)} ${String(row.status).padEnd(4)} ttfb_med=${String(row.ttfbMedian).padStart(5)}ms (${row.ttfbMin}-${row.ttfbMax})  total_med=${String(row.totalMedian).padStart(5)}ms  ${(row.bytes / 1024).toFixed(0)}KB  ${row.cache ?? ""}`,
    );
  }
  return out;
}

const AI_CALLS = [
  {
    feature: "Từ mới – sinh từ vựng",
    path: "/api/generate-words",
    body: { topic: "Daily Communication", count: 5, exclude: [] },
  },
  { feature: "Flashcard – câu ví dụ", path: "/api/generate-sentence", body: { word: "resilient" } },
  { feature: "Flashcard – từ đồng/trái nghĩa", path: "/api/generate-synonyms", body: { word: "happy" } },
  { feature: "Flashcard – sinh hàng loạt", path: "/api/generate-batch", body: { words: ["apple", "banana", "travel"] } },
  { feature: "Flashcard – điền từ", path: "/api/generate-fillblank", body: { word: "resilient" } },
  { feature: "Đọc hiểu – sinh đoạn đọc", path: "/api/generate-reading", body: { words: ["resilient", "harvest", "community"] } },
  {
    feature: "Flashcard – chấm câu viết",
    path: "/api/grade-sentence",
    body: { word: "resilient", sentence: "She stayed resilient despite many setbacks." },
  },
  {
    feature: "Ngữ pháp – tạo chủ đề",
    path: "/api/grammar-generate",
    body: { request: "Present perfect vs past simple" },
  },
  {
    feature: "Ngữ pháp – ví dụ",
    path: "/api/grammar-examples",
    body: { topic: "Tenses", subRule: "Present Simple" },
  },
  {
    feature: "Ngữ pháp – bài tập",
    path: "/api/grammar-exercise",
    body: { topic: "Tenses", subRule: "Present Simple" },
  },
  {
    feature: "Exam – sinh câu hỏi",
    path: "/api/exam/generate-item",
    body: { kind: "TOEIC", part: "RC5", level: 3 },
  },
  {
    feature: "Exam – chấm câu trả lời mở",
    path: "/api/exam/grade-open",
    body: { question: "The company _____ its profits last year.", userAnswer: "increased", correctAnswer: "increased" },
  },
  {
    feature: "Exam – giải thích đáp án",
    path: "/api/exam/explain",
    body: {
      question: "The company _____ its profits last year.",
      userAnswer: "increase",
      correctAnswer: "increased",
      explanation: "Past simple is needed.",
    },
  },
  { feature: "Dịch – 3 sắc thái", path: "/api/translate", body: { text: "Hello, how are you today?", from: "en", to: "vi" } },
  {
    feature: "Từ trong ngữ cảnh",
    path: "/api/vocab/context",
    body: { words: ["resilient", "harvest"], format: "mini_story" },
  },
  {
    feature: "Speaking – roleplay",
    path: "/api/speak/roleplay",
    body: {
      scenario: {
        id: "cafe",
        title: "Order coffee",
        level: 2,
        aiRole: "barista",
        userRole: "customer",
        goal: "Order a coffee and ask for the price",
        maxTurns: 6,
      },
      history: [],
      userText: "Hi, can I get a latte please?",
    },
  },
  {
    feature: "Speaking – chấm IELTS",
    path: "/api/speech/grade",
    body: {
      task: { id: "p1", mode: "ielts_p1", prompt: "Describe your hometown.", prepSec: 0, speakSec: 60 },
      transcript:
        "I come from a small city in the north of Vietnam. It is quite peaceful and the people are friendly. There are a few parks and a river, and I enjoy walking there at the weekend.",
      durationSec: 30,
    },
  },
  {
    feature: "Writing – chấm bài IELTS",
    path: "/api/write/grade",
    body: {
      kind: "ielts_task2",
      prompt: "Some people think students should study abroad. Discuss both views and give your opinion.",
      content:
        "Studying abroad has become increasingly popular among students. Some people believe it offers better opportunities, while others argue that studying at home is safer and cheaper. In my opinion, both options have advantages. On the one hand, students who study abroad can improve their language skills and experience a different culture. They also learn to live independently, which is valuable for their future careers. On the other hand, studying in their own country is less expensive and allows them to stay close to their families. However, I believe the benefits of international study usually outweigh the drawbacks, as long as students are well prepared.",
    },
  },
  { feature: "Cấu hình – danh sách provider", path: "/api/providers", method: "GET" },
  { feature: "Cấu hình – test provider", path: "/api/providers/test", body: { providerId: "opencode" } },
];

async function benchTranscribe(audioPath) {
  try {
    const bytes = readFileSync(audioPath);
    const form = new FormData();
    form.append("audio", new Blob([bytes], { type: "audio/mp4" }), "perf-test.m4a");
    form.append("language", "en");
    const r = await timedFetch(BASE + "/api/speech/transcribe", { method: "POST", body: form });
    let snippet = "";
    try {
      const parsed = JSON.parse(r.body);
      snippet = parsed.error ? `ERR: ${parsed.error}` : "";
    } catch {
      /* non-JSON */
    }
    const row = {
      feature: "Speaking – Whisper transcribe",
      path: "/api/speech/transcribe",
      status: r.status,
      provider: r.provider,
      totalMs: r.totalMs,
      ttfbMs: r.ttfbMs,
      error: r.error,
      snippet,
    };
    console.log(
      `${row.feature.padEnd(34)} ${String(row.status).padEnd(4)} total=${String(row.totalMs).padStart(6)}ms  ttfb=${String(row.ttfbMs).padStart(6)}ms  ${snippet}`,
    );
    return row;
  } catch (err) {
    console.log(`transcribe skipped: ${err}`);
    return null;
  }
}

async function benchApi() {
  const out = [];
  const apiRuns = Number(process.env.PERF_API_RUNS ?? 2);
  for (const call of AI_CALLS) {
    const headers = { "content-type": "application/json" };
    // GET runs get several samples because they hit a function, not the AI.
    const runs = call.method === "GET" ? 3 : apiRuns;
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const r = await timedFetch(BASE + call.path, {
        method: call.method ?? "POST",
        headers: call.method === "GET" ? undefined : headers,
        body:
          call.method === "GET"
            ? undefined
            : JSON.stringify(
                ONLY && call.path !== "/api/providers/test"
                  ? { ...(call.body ?? {}), provider: ONLY, disabledProviders: ALL_PROVIDERS.filter((id) => id !== ONLY) }
                  : (call.body ?? {}),
              ),
      });
      let snippet = "";
      try {
        const parsed = JSON.parse(r.body);
        snippet = parsed.error ? `ERR: ${parsed.error}` : "";
      } catch {
        snippet = "";
      }
      samples.push({ ttfb: r.ttfbMs, total: r.totalMs, status: r.status, provider: r.provider, error: r.error, snippet, head: r.body?.slice(0, 160) });
      if (runs > 1) await delay(300);
    }
    const totals = samples.map((s) => s.total).sort((a, b) => a - b);
    const ttfbs = samples.map((s) => s.ttfb).sort((a, b) => a - b);
    const last = samples[samples.length - 1];
    const row = {
      feature: call.feature,
      path: call.path,
      samples,
      status: last.status,
      provider: last.provider,
      totalMs: totals[Math.floor(totals.length / 2)],
      ttfbMs: ttfbs[Math.floor(ttfbs.length / 2)],
      totalSamples: totals,
      error: last.error,
      snippet: last.snippet,
    };
    out.push(row);
    console.log(
      `${call.feature.padEnd(34)} ${String(row.status).padEnd(4)} total_med=${String(row.totalMs).padStart(6)}ms  [${totals.join(", ")}]  provider=${row.provider ?? "-"} ${row.snippet ?? ""}`,
    );
    await delay(500);
  }
  if (ONLY) return out; // Whisper is not a chat provider
  const transcribe = await benchTranscribe(
    process.env.PERF_AUDIO ?? "/private/var/folders/8l/832126v52fn5kd9ypc96hn4h0000gn/T/opencode/perf-test.m4a",
  );
  if (transcribe) out.push(transcribe);
  return out;
}

/** Download the JS/CSS a browser needs after the HTML for a few key pages, to estimate first-load weight. */
async function benchAssets() {
  const pages = ["/", "/today", "/exam", "/translate", "/write"];
  const out = [];
  for (const path of pages) {
    const t0 = performance.now();
    const page = await timedFetch(BASE + path);
    const urls = [...page.body.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    const unique = [...new Set(urls)];
    const fetched = await Promise.all(
      unique.map(async (u) => {
        const r = await timedFetch(BASE + u);
        return { url: u, bytes: r.bytes, total: r.totalMs, status: r.status };
      }),
    );
    const bytes = fetched.reduce((sum, f) => sum + f.bytes, 0);
    const row = {
      path,
      htmlBytes: page.bytes,
      htmlTotalMs: page.totalMs,
      assetCount: unique.length,
      assetBytes: bytes,
      assetTotalMs: Math.round(performance.now() - t0),
    };
    out.push(row);
    console.log(
      `${path.padEnd(10)} html=${(row.htmlBytes / 1024).toFixed(0)}KB in ${row.htmlTotalMs}ms | ${row.assetCount} assets ${(row.assetBytes / 1024).toFixed(0)}KB, all in ${row.assetTotalMs}ms`,
    );
  }
  return out;
}

const section = process.argv[2] ?? "all";
let results = {};
if (section === "pages" || section === "all") results.pages = await benchPages();
if (section === "api" || section === "all") results.api = await benchApi();
if (section === "assets" || section === "all") results.assets = await benchAssets();

try {
  const previous = JSON.parse(readFileSync(OUT, "utf8"));
  results = { ...previous, ...results };
} catch {
  /* no previous run */
}
results.measuredAt = new Date().toISOString();
results.base = BASE;
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nSaved to ${OUT}`);
