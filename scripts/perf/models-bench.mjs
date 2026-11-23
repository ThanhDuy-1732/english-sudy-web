// Benchmarks OpenCode Go models on the real translate / generate-words / vocab-context route handlers.
// Each model runs in its own child process whose env holds ONLY the opencode key (no other providers, so no
// fallback hides a failure; no DATABASE_URL, so nothing is logged to Neon).
// Usage: node scripts/perf/models-bench.mjs [model ...]   (no args = every chat model the gateway lists)
//        PERF_RUNS=1 PERF_CONCURRENCY=6 PERF_CASES=tr,words (case-id prefixes) PERF_OUT=path.json
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNS = Number(process.env.PERF_RUNS ?? 1);

const CASES = [
  { id: "tr vi→ja", route: "translate", body: { text: "Cho tôi hỏi nhà ga gần nhất ở đâu?", from: "vi", to: "ja" } },
  { id: "tr vi→ko", route: "translate", body: { text: "Tôi bị dị ứng đậu phộng, món này có không?", from: "vi", to: "ko" } },
  { id: "tr vi→zh", route: "translate", body: { text: "Làm ơn giảm giá một chút được không?", from: "vi", to: "zh" } },
  { id: "tr ko→vi", route: "translate", body: { text: "이 버스가 공항까지 가나요?", from: "auto", to: "vi" } },
  { id: "tr ja→vi", route: "translate", body: { text: "すみません、チェックインは何時からですか？", from: "auto", to: "vi" } },
  { id: "tr en→vi", route: "translate", body: { text: "Could you recommend a quiet place to work nearby?", from: "auto", to: "vi" } },
  { id: "words", route: "generate-words", body: { topic: "travel", count: 5 } },
  { id: "context", route: "vocab/context", body: { words: ["itinerary", "delay", "boarding pass"], format: "dialogue" } },
];

function child(model) {
  // Runs inside the child: import the route handlers through jiti (TS + @/ alias) and time each case.
  globalThis.process.env.OPENCODE_MODEL = model;
  const jiti = require("jiti")(join(root, "x.js"), { alias: { "@": join(root, "src") } });
  return (async () => {
    const out = [];
    for (let run = 0; run < RUNS; run++) {
      for (const c of CASES.filter((c) => !process.env.PERF_CASES || process.env.PERF_CASES.split(",").some((p) => c.id.startsWith(p)))) {
        const { POST } = jiti(join(root, "src/app/api", c.route, "route.ts"));
        const req = new Request("http://x/api/" + c.route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.body) });
        const t = Date.now();
        let status = 0, body = null;
        // The routes log the real cause (timeout, HTTP error, bad JSON) with console.error before answering 503.
        const logs = [];
        console.error = (...a) => logs.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(" ").slice(0, 160));
        try {
          const res = await POST(req);
          status = res.status;
          body = await res.json();
        } catch (e) {
          body = { error: String(e).slice(0, 120) };
        }
        out.push({ case: c.id, ms: Date.now() - t, status, body, ...(logs.length && { errors: logs }) });
      }
    }
    return out;
  })();
}

if (process.env.BENCH_CHILD) {
  const { createRequire } = await import("node:module");
  globalThis.require = createRequire(import.meta.url);
  const res = await child(process.env.BENCH_CHILD);
  process.stdout.write("\n@@RESULT@@" + JSON.stringify(res));
  process.exit(0);
}

const key = readFileSync(join(root, ".env.local"), "utf8").match(/^OPENCODE_API_KEY=["']?([^"'\n]+)/m)?.[1];
if (!key) throw new Error("OPENCODE_API_KEY missing in .env.local");

let models = process.argv.slice(2);
if (!models.length) {
  const res = await fetch("https://opencode.ai/inference/go/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
  models = (await res.json()).data.filter((m) => m.type === "chat").map((m) => m.id);
}

const runModel = (model) =>
  new Promise((resolve) => {
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", OPENCODE_API_KEY: key, BENCH_CHILD: model, PERF_RUNS: String(RUNS) };
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...env, ...(process.env.PERF_CASES && { PERF_CASES: process.env.PERF_CASES }) }, cwd: root });
    let stdout = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", () => {});
    const kill = setTimeout(() => p.kill(), 600_000);
    p.on("close", () => {
      clearTimeout(kill);
      const raw = stdout.split("@@RESULT@@")[1];
      resolve({ model, results: raw ? JSON.parse(raw) : [{ case: "crash", ms: 0, status: 0, body: { error: stdout.slice(-200) } }] });
    });
  });

const all = [];
const queue = [...models];
await Promise.all(
  Array.from({ length: Number(process.env.PERF_CONCURRENCY ?? 6) }, async () => {
    while (queue.length) {
      const m = queue.shift();
      const r = await runModel(m);
      all.push(r);
      const ok = r.results.filter((x) => x.status === 200).length;
      console.log(`${m.padEnd(28)} ok ${ok}/${r.results.length}  ` + r.results.map((x) => `${x.case}:${x.status === 200 ? (x.ms / 1000).toFixed(1) + "s" : "✗" + x.status}`).join("  "));
    }
  })
);
writeFileSync(process.env.PERF_OUT ?? join(root, "scripts/perf/models-results.json"), JSON.stringify(all, null, 2));
