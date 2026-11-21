// Sequential latency test of POST /api/translate with travel phrases.
//   node scripts/perf/translate-bench.mjs <baseUrl> <out.json> [runs]
// "first" = what /translate asks first (tone polite); "all" = the "Xem thêm sắc thái" request (3 tones);
// "convo" = conversation mode (tone polite). No `provider` is sent, so the server picks its own.
import { writeFileSync } from "node:fs";

const BASE = process.argv[2];
const OUT = process.argv[3];
const RUNS = Number(process.argv[4] ?? 2);

const VI = {
  short: "Nhà vệ sinh ở đâu?",
  mid: "Tôi bị dị ứng với hải sản, món này có hải sản không?",
  long: "Xin chào, tôi đã đặt phòng tên Nguyễn Văn An. Chuyến bay của tôi đến sớm, cho tôi nhận phòng sớm một chút được không?",
};
const HEARD = {
  ja: { short: "チェックインは何時からですか？", mid: "この電車は新宿駅に止まりますか？それとも次の電車に乗るべきですか？" },
  ko: { short: "여기서 사진 찍어도 돼요?", mid: "죄송하지만 이 자리는 예약되어 있어서 다른 자리로 옮겨 주시겠어요?" },
  zh: { short: "这个多少钱？", mid: "请问去火车站怎么走？走路大概要多久？" },
  en: { short: "Where can I catch a taxi?", mid: "Sorry, the kitchen is closed, but we can still serve drinks until ten." },
};

const cases = [];
for (const mode of ["first", "all"]) {
  const tone = mode === "first" ? { tone: "polite" } : {};
  for (const to of ["ja", "ko", "zh", "en"])
    for (const [size, text] of Object.entries(VI)) cases.push({ mode, group: `${mode} vi→${to}`, size, body: { text, from: "vi", to, ...tone } });
  for (const [lang, phrases] of Object.entries(HEARD))
    for (const [size, text] of Object.entries(phrases)) cases.push({ mode, group: `${mode} auto→vi (${lang})`, size, body: { text, from: "auto", to: "vi", ...tone } });
}
for (const to of ["ja", "ko"])
  for (const size of ["short", "mid"]) cases.push({ mode: "convo", group: `convo vi→${to}`, size, body: { text: VI[size], from: "vi", to, tone: "polite" } });
for (const [lang, phrases] of Object.entries(HEARD))
  if (lang !== "en") for (const [size, text] of Object.entries(phrases)) cases.push({ mode: "convo", group: `convo ${lang}→vi`, size, body: { text, from: lang, to: "vi", tone: "polite" } });

const rows = [];
for (let run = 0; run < RUNS; run++) {
  for (const c of cases) {
    const t = Date.now();
    let status = 0, provider = null, out = "", err = "";
    try {
      const res = await fetch(`${BASE}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.body), signal: AbortSignal.timeout(60_000) });
      status = res.status;
      provider = res.headers.get("x-provider-used");
      const j = await res.json();
      out = j.results?.map((r) => `${r.tone}:${r.text}`).join(" | ") ?? j.error ?? "";
    } catch (e) {
      err = String(e.message);
    }
    rows.push({ run, mode: c.mode, group: c.group, size: c.size, ms: Date.now() - t, status, provider, out: out.slice(0, 200), err });
    process.stderr.write(`${rows.length}/${cases.length * RUNS} ${c.group} ${c.size} ${Date.now() - t}ms ${status}\n`);
  }
}
writeFileSync(OUT, JSON.stringify(rows, null, 1));

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const line = (label, rs) => {
  const ok = rs.filter((r) => r.status === 200).map((r) => r.ms);
  const provs = [...new Set(rs.map((r) => r.provider).filter(Boolean))].join(",");
  console.log(`${label.padEnd(24)} n=${String(rs.length).padEnd(3)} ok=${String(ok.length).padEnd(3)} p50=${String(pct(ok, 0.5)).padEnd(6)} p95=${String(pct(ok, 0.95)).padEnd(6)} max=${String(Math.max(...ok)).padEnd(6)} >4s=${ok.filter((x) => x > 4000).length} ${provs}`);
};
for (const g of [...new Set(rows.map((r) => r.group))]) line(g, rows.filter((r) => r.group === g));
console.log("---");
line("ALL first (polite)", rows.filter((r) => r.mode === "first"));
line("ALL all (3 tones)", rows.filter((r) => r.mode === "all"));
line("ALL convo (polite)", rows.filter((r) => r.mode === "convo"));
for (const m of ["first", "all"]) for (const s of ["short", "mid", "long"]) line(`${m} size=${s}`, rows.filter((r) => r.mode === m && r.size === s));
const bad = rows.filter((r) => r.status !== 200);
console.log("non-200:", bad.length, bad.map((r) => `${r.group}/${r.size}:${r.status}${r.err}`).join("; "));
