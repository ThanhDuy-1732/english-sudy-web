# Ngân hàng từ + job sinh 1.000 từ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm ngân hàng từ local để không bao giờ hiện lại từ đã sinh/đã học, và job sinh trước 1.000 từ có checkpoint, chạy tiếp sau reload.

**Architecture:** Toàn bộ trạng thái nằm trong localStorage (`wordBank`, `wordJob`). Module `word-bank` là nguồn sự thật về trùng lặp; module `word-job` + `word-job-runner` chạy vòng lặp 1 worker, mỗi lô 20 từ, có rate window 40 request/phút và backoff. `WordJobProvider` mount ở `layout.tsx` để job chạy xuyên trang; dải tiến trình toàn cục đảm bảo không có job vô hình.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Jest + Testing Library (jsdom), localStorage.

**Spec:** `docs/superpowers/specs/2026-11-18-word-bank-and-generation-job-design.md`

## Global Constraints

- Body `POST /api/*` ≤ 16 KB; rate limit 60 request/phút/IP; job tự giới hạn **40 request/phút**.
- Lô **20 từ**, **1 worker**, `count` API kẹp **1–30**, `exclude` tối đa **200**, `knownCount` kẹp **0–100.000**.
- `wordBank` tối đa **5.000** phần tử; `wordJob` là runtime, không vào backup nhưng `clearAllData` phải xoá.
- Mọi đọc localStorage dùng `readStored`/`asArray`; mọi ghi bọc `try/catch`; không ném lỗi từ render/effect.
- UI: câu chữ sentence case, không emoji, không "→" trên nút; dùng class chung (`panel`, `btn`, `page-title`…).
- Không thêm route API mới; không thêm backend/dịch vụ.

## Review Focus

1. **localStorage bị chặn/đầy** khi đang chạy job → job dừng với lỗi riêng, từ vừa tạo vẫn dùng được trong phiên, không crash render.
2. **429** giữa job → cooldown theo `Retry-After`, job sống tiếp, không bị tính là lỗi liên tiếp.
3. **Import backup** chứa từ đã học mà bank đang có → `getUnseen`/`countBank` không trả từ đó.
4. **Chủ đề cạn** (3 lô liền 0 từ mới) → job `paused` kèm giải thích, resume được, không phải `error`.
5. **Hai tab** cùng mở → tab thứ hai không gọi AI; chỉ tiếp quản khi heartbeat cũ hơn 30 s.

---

### Task 1: Ngân hàng từ (`word-bank`)

**Files:**
- Create: `src/lib/word-bank.ts`
- Test: `src/lib/__tests__/word-bank.test.ts`

**Interfaces:**
- Produces:
  - `interface BankWord { word: string; meaning: string; topic: string; createdAt: string; seenAt?: string }`
  - `WORD_BANK_KEY = "wordBank"`, `WORD_BANK_LIMIT = 5000`, `normalizeWord(word: string): string`
  - `getBank(): BankWord[]`, `addBankWords(entries: BankWord[]): { added: number; persisted: boolean }`
  - `getKnownWordSet(): Set<string>`, `getUnseen(topic: string, limit: number): BankWord[]`
  - `takeUnseen(topic: string, limit: number): BankWord[]` (get + mark seen)
  - `markBankWordsSeen(words: string[]): void`, `countBank(topic?: string): number`
  - `pickExcludeSample(topic: string, max?: number): string[]`

- [ ] **Step 1: Viết test thất bại**

```ts
// src/lib/__tests__/word-bank.test.ts
import {
  WORD_BANK_LIMIT, addBankWords, countBank, getBank, getKnownWordSet,
  getUnseen, markBankWordsSeen, normalizeWord, pickExcludeSample, takeUnseen,
} from "../word-bank";

const bankWord = (word: string, topic = "TOEIC", extra: Record<string, unknown> = {}) => ({
  word, meaning: `nghĩa ${word}`, topic, createdAt: "2026-11-01T00:00:00.000Z", ...extra,
});

beforeEach(() => localStorage.clear());

test("normalizeWord gộp khoảng trắng và hạ chữ", () => {
  expect(normalizeWord("  Take   Off ")).toBe("take off");
});

test("addBankWords bỏ từ trùng trong batch, trong bank và trong learnedWords", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("invoice")]));
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "Deadline" }]));
  const result = addBankWords([
    bankWord("Invoice"), bankWord("invoice "), bankWord("deadline"),
    bankWord("launch"), bankWord("launch"),
  ]);
  expect(result).toEqual({ added: 1, persisted: true });
  expect(getBank().map((w) => w.word)).toContain("launch");
});

test("addBankWords giữ batch trong bộ nhớ khi ghi localStorage lỗi", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  expect(addBankWords([bankWord("alpha"), bankWord("beta")])).toEqual({ added: 2, persisted: false });
  expect(getBank().map((w) => w.word)).toEqual(["alpha", "beta"]);
  spy.mockRestore();
  expect(addBankWords([bankWord("gamma")]).persisted).toBe(true);
  expect(getBank().map((w) => w.word)).toEqual(["alpha", "beta", "gamma"]);
});

test("getUnseen chỉ trả từ chưa xem đúng chủ đề, cũ trước", () => {
  localStorage.setItem("wordBank", JSON.stringify([
    bankWord("a", "TOEIC", { createdAt: "2026-11-02T00:00:00.000Z" }),
    bankWord("b", "IELTS"),
    bankWord("c", "TOEIC", { createdAt: "2026-11-01T00:00:00.000Z" }),
    bankWord("d", "TOEIC", { seenAt: "2026-11-03T00:00:00.000Z" }),
  ]));
  expect(getUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["c", "a"]);
});

test("getUnseen và countBank ẩn từ đã lưu trong learnedWords", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("alpha"), bankWord("beta")]));
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "Alpha" }]));
  expect(getUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["beta"]);
  expect(countBank("TOEIC")).toBe(1);
});

test("markBankWordsSeen đánh dấu không phân biệt hoa thường", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("Alpha"), bankWord("beta")]));
  markBankWordsSeen(["ALPHA"]);
  expect(getBank()[0].seenAt).toBeTruthy();
  expect(getBank()[1].seenAt).toBeUndefined();
});

test("takeUnseen đánh dấu đã xem và không trả lại lần sau", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("a"), bankWord("b")]));
  expect(takeUnseen("TOEIC", 1).map((w) => w.word)).toEqual(["a"]);
  expect(takeUnseen("TOEIC", 5).map((w) => w.word)).toEqual(["b"]);
});

test("bank giới hạn WORD_BANK_LIMIT, bỏ cũ nhất", () => {
  const entries = Array.from({ length: WORD_BANK_LIMIT + 1 }, (_, i) =>
    bankWord(`w${i}`, "TOEIC", { createdAt: `2026-11-01T00:00:${String(i % 60).padStart(2, "0")}.000Z` }));
  localStorage.setItem("wordBank", JSON.stringify(entries));
  addBankWords([bankWord("last")]);
  const words = getBank().map((w) => w.word);
  expect(words).toHaveLength(WORD_BANK_LIMIT);
  expect(words[0]).toBe("w1");
  expect(words.at(-1)).toBe("last");
});

test("đọc JSON hỏng trả mảng rỗng", () => {
  localStorage.setItem("wordBank", "{}");
  expect(getBank()).toEqual([]);
});

test("pickExcludeSample tối đa max, ưu tiên từ mới và không trùng", () => {
  const entries = Array.from({ length: 300 }, (_, i) => bankWord(`w${i}`));
  localStorage.setItem("wordBank", JSON.stringify(entries));
  const sample = pickExcludeSample("TOEIC", 200);
  expect(sample).toHaveLength(200);
  expect(new Set(sample).size).toBe(200);
  expect(sample).toContain("w299");
  expect(sample).toContain("w0");
});

test("getKnownWordSet gồm bank và learnedWords", () => {
  localStorage.setItem("wordBank", JSON.stringify([bankWord("alpha")]));
  localStorage.setItem("learnedWords", JSON.stringify([{ word: "Beta" }]));
  expect([...getKnownWordSet()].sort()).toEqual(["alpha", "beta"]);
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/lib/__tests__/word-bank.test.ts`
Expected: FAIL — `Cannot find module '../word-bank'`.

- [ ] **Step 3: Triển khai `src/lib/word-bank.ts`**

Dùng `readStored` và `getLearnedWords`. `getBank()` đọc mảng đã lưu, cộng overlay `pending` (Map theo `normalizeWord`, phần tử sau thắng), lọc phần tử không có `word` string, giữ thứ tự. `addBankWords` lọc theo `getKnownWordSet()` + batch, ghi `localStorage.setItem`, lỗi thì `pending = next` và trả `persisted: false`. `takeUnseen` = `getUnseen` rồi `markBankWordsSeen` các từ vừa lấy. `pickExcludeSample` lấy 120 từ cuối của bank (mới nhất) + phần còn lại cộng `learnedWords`, xáo phần sau bằng Math.random, cắt `max`.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx jest src/lib/__tests__/word-bank.test.ts`
Expected: PASS (10 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/word-bank.ts src/lib/__tests__/word-bank.test.ts
git commit -m "feat(vocab): ngân hàng từ local chặn trùng tuyệt đối"
```

---

### Task 2: Backup, merge và xoá dữ liệu

**Files:**
- Modify: `src/lib/data-transfer.ts` (`EXCLUDED_KEYS`, `IDENTITY`, `incomingWins`, `clearAllData`, `needsBackup`)
- Test: `src/lib/__tests__/data-transfer.test.ts`

**Interfaces:**
- Consumes: `WORD_BANK_KEY` không cần import — dùng chuỗi `"wordBank"` như các key khác trong file.
- Produces: `wordBank` được export/merge; `wordJob` không export và bị `clearAllData` xoá; `needsBackup` tính cả `wordBank`.

- [ ] **Step 1: Viết test thất bại (thêm vào file test hiện có)**

```ts
it("exports wordBank but not wordJob", () => {
  localStorage.setItem("wordBank", '[{"word":"alpha"}]');
  localStorage.setItem("wordJob", '{"id":"j1"}');
  const backup = parseBackup(exportData());
  expect(backup.data.wordBank).toBe('[{"word":"alpha"}]');
  expect(backup.data.wordJob).toBeUndefined();
});

it("mergeData hợp nhất wordBank theo word và giữ seenAt", () => {
  localStorage.setItem("wordBank", JSON.stringify([
    { word: "alpha", meaning: "a", topic: "TOEIC", createdAt: "2026-11-01T00:00:00.000Z" },
  ]));
  const json = makeBackup({
    wordBank: JSON.stringify([
      { word: "Alpha", meaning: "a", topic: "TOEIC", createdAt: "2026-11-01T00:00:00.000Z", seenAt: "2026-11-02T00:00:00.000Z" },
      { word: "beta", meaning: "b", topic: "TOEIC", createdAt: "2026-11-01T00:00:00.000Z" },
    ]),
  });
  mergeData(json);
  const bank = JSON.parse(localStorage.getItem("wordBank") ?? "[]");
  expect(bank).toHaveLength(2);
  expect(bank[0].seenAt).toBe("2026-11-02T00:00:00.000Z");
});

it("clearAllData xoá wordJob dù nó là key runtime", () => {
  localStorage.setItem("wordBank", "[]");
  localStorage.setItem("wordJob", '{"id":"j1"}');
  clearAllData();
  expect(localStorage.getItem("wordJob")).toBeNull();
  expect(localStorage.getItem("wordBank")).toBeNull();
});

it("needsBackup thấy dữ liệu khi chỉ có wordBank", () => {
  localStorage.setItem("wordBank", '[{"word":"alpha"}]');
  expect(needsBackup()).toBe(true);
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/lib/__tests__/data-transfer.test.ts`
Expected: FAIL ở 4 test mới.

- [ ] **Step 3: Sửa `data-transfer.ts`**

Thêm `"wordJob"` vào `EXCLUDED_KEYS`; thêm `wordBank: (x) => String(x.word).trim().toLowerCase()` vào `IDENTITY`; trong `incomingWins`: `if (key === "wordBank") return Boolean(incoming.seenAt) && !local.seenAt;`; `clearAllData` xoá thêm `localStorage.removeItem("wordJob")` sau vòng lặp; `needsBackup` thêm `"wordBank"` vào mảng key.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx jest src/lib/__tests__/data-transfer.test.ts`
Expected: PASS toàn bộ file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-transfer.ts src/lib/__tests__/data-transfer.test.ts
git commit -m "feat(data): backup và merge ngân hàng từ; xoá job khi xoá dữ liệu"
```

---

### Task 3: API `count`, `knownCount`, `exclude` 200

**Files:**
- Modify: `src/lib/gemini.ts`, `src/app/api/generate-words/route.ts`
- Test: `src/lib/__tests__/gemini.test.ts`, `src/app/api/__tests__/generate-words.test.ts`

**Interfaces:**
- Consumes: `generateWords(topic, fn, { exclude, count })` đã có.
- Produces: `GenerateWordsOptions` thêm `knownCount?: number`; prompt chứa `The learner already knows N words on this topic; avoid them and prefer less common words.` khi `N > 0`.

- [ ] **Step 1: Viết test thất bại**

```ts
// gemini.test.ts
test("generateWords đưa count và knownCount vào prompt", async () => {
  mockFn.mockResolvedValue(JSON.stringify([{ word: "launch", meaning: "ra mắt" }]));
  await generateWords("TOEIC", mockFn, { count: 20, knownCount: 640 });
  const prompt = mockFn.mock.calls[0][0];
  expect(prompt).toContain("Generate 20 English");
  expect(prompt).toContain("already knows 640 words");
});

// generate-words.test.ts
test("kẹp count trong 1–30 và forward knownCount", async () => {
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC", count: 99, knownCount: 12 }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(req);
  expect(mockGenerateWords).toHaveBeenCalledWith("TOEIC", expect.any(Function), {
    exclude: [], count: 30, knownCount: 12,
  });
});

test("cắt exclude còn 200 từ", async () => {
  const exclude = Array.from({ length: 250 }, (_, i) => `w${i}`);
  const req = new NextRequest("http://localhost/api/generate-words", {
    method: "POST",
    body: JSON.stringify({ topic: "TOEIC", exclude }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(req);
  const args = mockGenerateWords.mock.calls.at(-1)?.[2] as { exclude: string[] };
  expect(args.exclude).toHaveLength(200);
});
```

Cập nhật 2 test cũ đang assert `{ exclude: [...] }` thành `{ exclude: [...], count: 5, knownCount: 0 }`.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/lib/__tests__/gemini.test.ts src/app/api/__tests__/generate-words.test.ts`
Expected: FAIL ở 3 test mới + 2 test cũ.

- [ ] **Step 3: Triển khai**

`gemini.ts`: thêm `knownCount?: number` vào `GenerateWordsOptions`; trong `buildPrompt` chèn dòng trên khi `(options.knownCount ?? 0) > 0`.
`route.ts`: `MAX_EXCLUDE = 200`; `clampInt(value, min, max, fallback)` cho `count` (1–30, mặc định 5) và `knownCount` (0–100.000, mặc định 0); truyền `{ exclude: sanitizeExclude(exclude), count, knownCount }`.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx jest src/lib/__tests__/gemini.test.ts src/app/api/__tests__/generate-words.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts src/app/api/generate-words/route.ts src/lib/__tests__/gemini.test.ts src/app/api/__tests__/generate-words.test.ts
git commit -m "feat(vocab): API sinh từ nhận count và knownCount cho job"
```

---

### Task 4: Trạng thái job và helper thuần (`word-job`)

**Files:**
- Create: `src/lib/word-job.ts`
- Test: `src/lib/__tests__/word-job.test.ts`

**Interfaces:**
- Produces:
  - `type WordJobStatus = "running" | "paused" | "done" | "error"`
  - `interface WordJob { id; topic; target; status; createdAt; updatedAt; lastError?; lock?: { tabId: string; heartbeatAt: string } }`
  - `WORD_JOB_KEY = "wordJob"`, `getJob(): WordJob | null`, `saveJob(job): boolean`, `clearJob(): void`
  - `makeJob(topic: string, target: number, now?: Date): WordJob`
  - `shouldStopJob({ count, target, emptyStreak, failures }): "done" | "exhausted" | "error" | null`
  - `nextBackoffMs(failures: number): number` (1 s · 2^n, tối đa 30 s)
  - `classifyFailure(status?: number): "cooldown" | "retry" | "fail"`
  - `isLockStale(lock, now = Date.now(), staleMs = 30_000): boolean`
  - `createRateWindow(limit = 40, windowMs = 60_000): { waitMs(now?): number; record(now?): void }`

- [ ] **Step 1: Viết test thất bại**

```ts
import {
  classifyFailure, clearJob, createRateWindow, getJob, isLockStale,
  makeJob, nextBackoffMs, saveJob, shouldStopJob,
} from "../word-job";

beforeEach(() => localStorage.clear());

test("makeJob tạo job running đúng target và topic", () => {
  const job = makeJob("TOEIC", 1000, new Date("2026-11-18T00:00:00.000Z"));
  expect(job).toMatchObject({ topic: "TOEIC", target: 1000, status: "running" });
  expect(job.createdAt).toBe("2026-11-18T00:00:00.000Z");
});

test("shouldStopJob ưu tiên done, rồi exhausted, rồi error", () => {
  expect(shouldStopJob({ count: 1000, target: 1000, emptyStreak: 9, failures: 9 })).toBe("done");
  expect(shouldStopJob({ count: 400, target: 1000, emptyStreak: 3, failures: 9 })).toBe("exhausted");
  expect(shouldStopJob({ count: 400, target: 1000, emptyStreak: 0, failures: 3 })).toBe("error");
  expect(shouldStopJob({ count: 400, target: 1000, emptyStreak: 2, failures: 2 })).toBeNull();
});

test("nextBackoffMs tăng gấp đôi và chặn ở 30 s", () => {
  expect([0, 1, 2, 3, 10].map(nextBackoffMs)).toEqual([1000, 2000, 4000, 8000, 30000]);
});

test("classifyFailure coi 429 là cooldown, 5xx/network là retry", () => {
  expect(classifyFailure(429)).toBe("cooldown");
  expect(classifyFailure(500)).toBe("retry");
  expect(classifyFailure(undefined)).toBe("retry");
  expect(classifyFailure(400)).toBe("fail");
});

test("isLockStale sau 30 s", () => {
  const now = Date.parse("2026-11-18T00:01:00.000Z");
  expect(isLockStale({ tabId: "a", heartbeatAt: "2026-11-18T00:00:45.000Z" }, now)).toBe(false);
  expect(isLockStale({ tabId: "a", heartbeatAt: "2026-11-18T00:00:20.000Z" }, now)).toBe(true);
  expect(isLockStale(undefined, now)).toBe(true);
});

test("rate window chặn request thứ 41 trong 60 s", () => {
  const window = createRateWindow(40, 60_000);
  const t0 = 1_000_000;
  for (let i = 0; i < 40; i++) window.record(t0 + i);
  expect(window.waitMs(t0 + 40)).toBe(0);
  expect(window.waitMs(t0 + 100)).toBeGreaterThan(0);
  expect(window.waitMs(t0 + 60_000)).toBe(0);
});

test("saveJob/getJob/clearJob roundtrip và bỏ qua JSON hỏng", () => {
  expect(saveJob(makeJob("TOEIC", 100))).toBe(true);
  expect(getJob()?.topic).toBe("TOEIC");
  clearJob();
  expect(getJob()).toBeNull();
  localStorage.setItem("wordJob", "{");
  expect(getJob()).toBeNull();
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/lib/__tests__/word-job.test.ts`
Expected: FAIL — chưa có module.

- [ ] **Step 3: Triển khai `src/lib/word-job.ts`**

`getJob` validate tối thiểu (`id`, `topic`, `target`, `status` hợp lệ) rồi trả object, sai thì `null`. `saveJob` bọc `try/catch`. `createRateWindow` giữ mảng timestamp trong closure; `record` đẩy `now`, `waitMs` xoá mốc cũ hơn `now - windowMs` và trả `Math.max(0, oldest + windowMs - now)` khi đã đủ `limit`, ngược lại 0.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx jest src/lib/__tests__/word-job.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/word-job.ts src/lib/__tests__/word-job.test.ts
git commit -m "feat(vocab): trạng thái job và helper backoff/rate window"
```

---

### Task 5: Vòng lặp job (`word-job-runner`)

**Files:**
- Create: `src/lib/word-job-runner.ts`
- Test: `src/lib/__tests__/word-job-runner.test.ts`

**Interfaces:**
- Consumes: `shouldStopJob`, `nextBackoffMs`, `classifyFailure`, `createRateWindow` từ Task 4.
- Produces:
  - `type JobBatch = { word: string; meaning: string }[]`
  - `interface JobRunnerDeps { topic; target; countBank(): number; fetchBatch(args: { exclude: string[]; count: number; knownCount: number }): Promise<{ ok: true; words: JobBatch } | { ok: false; status?: number; retryAfterSec?: number }>; addWords(words: JobBatch): { added: number; persisted: boolean }; pickExclude(): string[]; wait(ms: number): Promise<void>; shouldContinue(): boolean; onProgress?(state: { count: number; added: number }): void; rateWindow?; maxFailures?; maxEmptyBatches? }`
  - `runWordJob(deps): Promise<{ reason: "done" | "exhausted" | "error" | "cancelled" | "storage"; wordsAdded: number }>`
  - Hằng: `JOB_BATCH_SIZE = 20`, `MAX_FAILURES = 3`, `MAX_EMPTY_BATCHES = 3`.

- [ ] **Step 1: Viết test thất bại**

```ts
import { runWordJob } from "../word-job-runner";

function makeDeps(overrides: Partial<Parameters<typeof runWordJob>[0]> = {}) {
  let count = 0;
  let added = 0;
  const deps = {
    topic: "TOEIC",
    target: 40,
    countBank: () => count,
    fetchBatch: jest.fn(async () => ({
      ok: true as const,
      words: [{ word: `w${count + 1}`, meaning: "m" }, { word: `w${count + 2}`, meaning: "m" }],
    })),
    addWords: (words: { word: string }[]) => {
      const n = words.length;
      count += n; added += n;
      return { added: n, persisted: true };
    },
    pickExclude: () => [],
    wait: jest.fn(async () => {}),
    shouldContinue: () => true,
    ...overrides,
  };
  return { deps, getCount: () => count, getAdded: () => added };
}

test("dừng khi đạt target", async () => {
  const { deps, getAdded } = makeDeps({ target: 6 });
  await expect(runWordJob(deps)).resolves.toEqual({ reason: "done", wordsAdded: 6 });
  expect(getAdded()).toBe(6);
});

test("dừng exhausted sau 3 lô không thêm từ", async () => {
  const { deps } = makeDeps({ addWords: () => ({ added: 0, persisted: true }) });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "exhausted" });
  expect(deps.fetchBatch).toHaveBeenCalledTimes(3);
});

test("429 chờ retryAfter rồi chạy tiếp, không tính lỗi", async () => {
  let first = true;
  const { deps } = makeDeps({
    target: 2,
    fetchBatch: jest.fn(async () => {
      if (first) { first = false; return { ok: false as const, status: 429, retryAfterSec: 7 }; }
      return { ok: true as const, words: [{ word: "a" }] };
    }),
    addWords: () => ({ added: 1, persisted: true }),
  });
  const result = await runWordJob(deps);
  expect(result.reason).toBe("done");
  expect(deps.wait).toHaveBeenCalledWith(7000);
});

test("ghi bank thất bại dừng ngay với reason storage", async () => {
  const { deps } = makeDeps({ addWords: () => ({ added: 2, persisted: false }) });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "storage" });
  expect(deps.fetchBatch).toHaveBeenCalledTimes(1);
});

test("huỷ giữa chừng không gọi thêm", async () => {
  let calls = 0;
  const { deps } = makeDeps({
    target: 100,
    shouldContinue: () => calls < 2,
    fetchBatch: jest.fn(async () => { calls++; return { ok: true as const, words: [{ word: `w${calls}` }] }; }),
    addWords: () => ({ added: 1, persisted: true }),
  });
  await expect(runWordJob(deps)).resolves.toMatchObject({ reason: "cancelled" });
  expect(calls).toBe(2);
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/lib/__tests__/word-job-runner.test.ts`
Expected: FAIL — chưa có module.

- [ ] **Step 3: Triển khai vòng lặp**

```ts
// Thuật toán (rút gọn, deps đã có trong chữ ký):
let wordsAdded = 0, emptyStreak = 0, failures = 0;
while (deps.shouldContinue()) {
  const stop = shouldStopJob({ count: deps.countBank(), target: deps.target, emptyStreak, failures });
  if (stop) return { reason: stop, wordsAdded };
  const waitMs = rate.waitMs(Date.now());
  if (waitMs > 0) await deps.wait(waitMs);
  rate.record(Date.now());
  const res = await deps.fetchBatch({ exclude: deps.pickExclude(), count: 20, knownCount: deps.countBank() });
  if (!res.ok) {
    const kind = classifyFailure(res.status);
    if (kind === "cooldown") { await deps.wait((res.retryAfterSec ?? 30) * 1000); continue; }
    failures += 1;
    await deps.wait(nextBackoffMs(failures));
    continue;
  }
  failures = 0;
  const result = deps.addWords(res.words);
  wordsAdded += result.added;
  if (!result.persisted) return { reason: "storage", wordsAdded };
  emptyStreak = result.added === 0 ? emptyStreak + 1 : 0;
  deps.onProgress?.({ count: deps.countBank(), added: wordsAdded });
}
return { reason: "cancelled", wordsAdded };
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx jest src/lib/__tests__/word-job-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/word-job-runner.ts src/lib/__tests__/word-job-runner.test.ts
git commit -m "feat(vocab): vòng lặp job có rate window, backoff và checkpoint"
```

---

### Task 6: `WordJobProvider` + dải tiến trình toàn cục

**Files:**
- Create: `src/contexts/WordJobContext.tsx`, `src/components/WordJobStrip.tsx`
- Modify: `src/app/layout.tsx:61-71`
- Test: `src/components/__tests__/WordJobStrip.test.tsx`

**Interfaces:**
- Consumes: `useApiFetch`, `runWordJob`, `getJob/saveJob/clearJob/makeJob/isLockStale`, `pickExcludeSample`, `addBankWords`, `countBank`.
- Produces:
  - `useWordJob(): { job; count; wordsPerMinute; isOwner; startJob(topic, target); pauseJob(); resumeJob(); cancelJob() }`
  - `<WordJobProvider>` (client) và `<WordJobStrip />` (connected).
  - `WordJobStrip(props: { job: WordJob | null; count: number; isOwner: boolean; onPause; onResume; onCancel })` để test.

- [ ] **Step 1: Viết test thất bại cho strip**

```tsx
import { render, screen } from "@testing-library/react";
import { WordJobStrip } from "../WordJobStrip";

const base = { id: "j1", topic: "TOEIC", target: 1000, createdAt: "", updatedAt: "" };

test("job đang chạy hiện tiến trình và nút Dừng", () => {
  const onPause = jest.fn();
  render(<WordJobStrip job={{ ...base, status: "running" }} count={420} isOwner onPause={onPause} onResume={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.getByText(/420\/1\.000/)).toBeInTheDocument();
  screen.getByRole("button", { name: "Dừng" }).click();
  expect(onPause).toHaveBeenCalled();
});

test("tab khác đang chạy thì không có nút điều khiển", () => {
  render(<WordJobStrip job={{ ...base, status: "running" }} count={420} isOwner={false} onPause={jest.fn()} onResume={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.getByText(/tab khác/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dừng" })).toBeNull();
});

test("job dở hiện Chạy tiếp và Huỷ", () => {
  const onResume = jest.fn();
  render(<WordJobStrip job={{ ...base, status: "paused" }} count={420} isOwner onPause={jest.fn()} onResume={onResume} onCancel={jest.fn()} />);
  screen.getByRole("button", { name: "Chạy tiếp" }).click();
  expect(onResume).toHaveBeenCalled();
});

test("lỗi lưu trữ hiện thông báo riêng", () => {
  render(<WordJobStrip job={{ ...base, status: "error", lastError: "Không lưu được vào bộ nhớ trình duyệt." }} count={420} isOwner onPause={jest.fn()} onResume={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.getByText(/Không lưu được/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/components/__tests__/WordJobStrip.test.tsx`
Expected: FAIL — chưa có component.

- [ ] **Step 3: Triển khai provider + strip + layout**

Provider: `tabId` tạo một lần; state `job`, `count`, `wordsPerMinute`; `runRef` giữ controller/cancel flag. `startJob`: nếu job hiện tại đang `running` và lock không cũ → không làm gì; ngược lại `makeJob`, lưu, chạy. `run()`: `runWordJob` với `fetchBatch` gọi `fetchWithProvider("/api/generate-words", { topic, exclude, count, knownCount })`, map kết quả sang `BankWord` (thêm `topic`, `createdAt: new Date().toISOString()`), `addWords` gọi `addBankWords`; `pickExclude` gọi `pickExcludeSample(topic)`; `wait` = `new Promise(setTimeout)`; `shouldContinue` = cancel flag + job mới nhất còn `running`. Heartbeat 5 s cập nhật `lock`. Khi runner trả reason: `done|exhausted` → `paused`/`done`, `error` → `error` + `lastError` lỗi chung, `storage` → `error` + câu "Không lưu được vào bộ nhớ trình duyệt. Job đã dừng; từ vừa tạo vẫn dùng được trong phiên này."; `cancelled` → giữ trạng thái người dùng chọn. On mount: đọc job; nếu `running` và lock cũ → lưu `paused`; nếu lock mới → theo dõi (poll 5 s). `pauseJob/resumeJob/cancelJob` cập nhật job + abort.

Strip: trả `null` khi không có job hoặc `done`; chạy → progress + `Dừng`; paused → `Chạy tiếp` + `Huỷ`; error → thông báo + `Huỷ`; không phải owner → "Đang chạy ở tab khác · 420/1.000". Dùng class `panel`, `btn btn-secondary`.

Layout: bọc `WordJobProvider` trong `ProviderContextProvider` (ngoài `TimerContextProvider`), đặt `<WordJobStrip />` ngay trước `<StudyReminder />`.

- [ ] **Step 4: Chạy test + typecheck**

Run: `npx jest src/components/__tests__/WordJobStrip.test.tsx && npx tsc --noEmit`
Expected: PASS, không lỗi type.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/WordJobContext.tsx src/components/WordJobStrip.tsx src/components/__tests__/WordJobStrip.test.tsx src/app/layout.tsx
git commit -m "feat(vocab): job chạy xuyên trang với dải tiến trình toàn cục"
```

---

### Task 7: Trang chủ dùng ngân hàng + panel tạo trước

**Files:**
- Create: `src/components/WordBankPanel.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/__tests__/WordBankPanel.test.tsx`

**Interfaces:**
- Consumes: `takeUnseen`, `countBank`, `pickExcludeSample`, `addBankWords`, `useWordJob`, `useApiFetch`.
- Produces: `WordBankPanel({ topic }: { topic: string })` — hiện số từ chưa học, chọn mốc 100/300/1.000, bắt đầu job; khoá nút khi job khác đang chạy.

- [ ] **Step 1: Viết test thất bại cho panel**

```tsx
import { render, screen } from "@testing-library/react";
import { useWordJob } from "@/contexts/WordJobContext";
import { WordBankPanel } from "../WordBankPanel";

jest.mock("@/contexts/WordJobContext", () => ({ useWordJob: jest.fn() }));

const mockedUseWordJob = useWordJob as jest.Mock;

function mockJob(overrides: Record<string, unknown> = {}) {
  const startJob = jest.fn();
  mockedUseWordJob.mockReturnValue({
    job: null, count: 0, wordsPerMinute: 0, isOwner: true,
    startJob, pauseJob: jest.fn(), resumeJob: jest.fn(), cancelJob: jest.fn(),
    ...overrides,
  });
  return startJob;
}

beforeEach(() => localStorage.clear());

test("hiện số từ chưa học và mốc mặc định 1.000", () => {
  mockJob();
  render(<WordBankPanel topic="TOEIC" />);
  expect(screen.getByText(/từ chưa học/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1.000" })).toHaveAttribute("aria-pressed", "true");
});

test("bấm Bắt đầu gọi startJob với chủ đề và mốc đang chọn", () => {
  const startJob = mockJob();
  render(<WordBankPanel topic="TOEIC" />);
  screen.getByRole("button", { name: "Bắt đầu" }).click();
  expect(startJob).toHaveBeenCalledWith("TOEIC", 1000);
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx jest src/components/__tests__/WordBankPanel.test.tsx`
Expected: FAIL — chưa có component.

- [ ] **Step 3: Triển khai panel + sửa `page.tsx`**

Panel dùng `Segmented` có sẵn cho 100/300/1.000; đọc `countBank(topic)` trong `useEffect` (dependency `job`) để cập nhật sau mỗi lô. Nút "Bắt đầu" gọi `startJob(topic, target)`; nếu `job` đang `running` và khác job của panel → disable + chú thích "Đang có job khác".

`page.tsx`: bỏ state `seenWords`; `handleGenerate`:

```ts
const ready = takeUnseen(topic, 5);
if (ready.length === 5) { setWords(ready.map(({ word, meaning }) => ({ word, meaning }))); return; }
const res = await fetchWithProvider("/api/generate-words", {
  topic, exclude: pickExcludeSample(topic), count: 20, knownCount: countBank(topic),
});
const data = (await res.json()) as Word[];
addBankWords(data.map((w) => ({ ...w, topic, createdAt: new Date().toISOString() })));
const picked = takeUnseen(topic, 5);
setWords(picked.map(({ word, meaning }) => ({ word, meaning })));
```

Giữ nguyên loading/error; nếu `picked.length === 0` → error "Chủ đề này đã cạn từ mới. Thử chủ đề khác."; nhúng `<WordBankPanel topic={topic} />` dưới nút Sinh từ mới.

- [ ] **Step 4: Chạy test + typecheck**

Run: `npx jest src/components/__tests__/WordBankPanel.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WordBankPanel.tsx src/components/__tests__/WordBankPanel.test.tsx src/app/page.tsx
git commit -m "feat(vocab): trang chủ phục vụ từ từ ngân hàng và tạo trước 1.000 từ"
```

---

### Task 8: Tài liệu, kiểm thử toàn bộ và e2e tay

**Files:**
- Modify: `CONTEXT.md`

**Interfaces:** không có.

- [ ] **Step 1: Cập nhật `CONTEXT.md`**

Thêm `wordBank` / `wordJob` vào bảng localStorage; mục "Word bank & generation job" mô tả `word-bank.ts`, `word-job.ts`, `word-job-runner.ts`, `WordJobContext`, `WordBankPanel`, `WordJobStrip`; cập nhật dòng `/` (trang chủ) và `/api/generate-words` (`count`, `knownCount`, exclude 200); ghi chú `wordJob` không backup và `clearAllData` xoá nó.

- [ ] **Step 2: Chạy toàn bộ kiểm tra**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: toàn bộ PASS, lint sạch, typecheck sạch.

- [ ] **Step 3: E2E tay (dev server)**

Run: `npm run dev` → trên `/`:

1. Bấm "Sinh từ mới" 3 lần: không từ nào lặp; lần 2–3 hiện tức thì (có sẵn trong ngân hàng).
2. "Tạo trước" 100 từ: theo dõi tiến trình; thử reload giữa chừng → hiện "Chạy tiếp", bấm và đợi đủ.
3. Lưu 1 từ vào `learnedWords` rồi kiểm tra từ đó không xuất hiện lại (DevTools → Application → localStorage).
4. Đặt `wordBank` = `"{}"` → trang vẫn chạy, bấm sinh từ hoạt động lại.
5. Mở 2 tab, chạy job ở tab 1 → tab 2 hiện "Đang chạy ở tab khác" và không gọi API.

- [ ] **Step 4: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: ghi lại ngân hàng từ và job sinh từ"
```

---

## Self-review notes

- Spec §5.1 → Task 1; §5.2 → Task 7; §5.3 → Task 5/6; §5.4 → Task 5/6; §5.5 → Task 6/7; §5.6 → Task 2; §5.7 → Task 3.
- Review Focus 1 → Task 1 (`persisted`), Task 5 (`storage`), Task 6 (copy); 2 → Task 4 (`classifyFailure`) + Task 5; 3 → Task 1; 4 → Task 4 + 5; 5 → Task 4 (`isLockStale`) + Task 6.
