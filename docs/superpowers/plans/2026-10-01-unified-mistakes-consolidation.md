# Stabilize + Unified Mistakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `unifiedMistakes` trở thành nguồn duy nhất của sổ lỗi; `mistakeLog` chỉ còn là nguồn migration một lần, và resolve ở mọi UI cập nhật cùng một entity.

**Architecture:** `UnifiedMistake` có thêm trường `exam?` (itemId, questionId, part, type, prompt). `exam-storage.addMistake` thành adapter mỏng ghi vào `mistakes.ts`. Một hàm migration thuần (`migrateLegacyMistakes`) cộng một wrapper client có cờ (`runMistakeMigration`) chuyển `mistakeLog` cũ sang unified. `/exam/mistakes`, `/exam` và `pruneBank` đọc unified.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest + Testing Library (jsdom), localStorage, Supabase (sync).

**Spec:** `docs/superpowers/specs/2026-10-01-unified-mistakes-consolidation-design.md`

## Global Constraints

- Đọc `CONTEXT.md` trước khi đổi storage/sync (đã làm khi viết plan; executor đọc lại các mục UnifiedMistake, Supabase Sync).
- API key chỉ ở server; không import `src/lib/providers/` từ client.
- Không xóa key localStorage `mistakeLog`; backup vào `mistakeLogBackup`.
- Không thêm migration SQL; bảng Supabase `mistake_log` giữ nguyên, chỉ còn được pull một lần.
- Dedupe unified giữ nguyên: theo `source + category` trong các mục chưa `resolved`.
- Mỗi task kết thúc với `npm test` pass cho phần liên quan; Task 6 chạy `npm test`, `npm run build`, `npm run lint` đầy đủ.
- Cập nhật `CONTEXT.md` và `docs/APP_OVERVIEW.md` (Task 6).

## Review Focus

Các input mà spec ngụ ý nhưng dễ bị bỏ sót; mỗi dòng có test ở task sở hữu code đó.

1. Entry legacy trùng `id` (local + remote chồng nhau) — không đếm đôi (Task 2).
2. Câu đã resolve rồi sai lại (legacy có cả nhóm resolved và unresolved) — unified vẫn unresolved, count đúng (Task 2).
3. Entry legacy cũ thiếu `updatedAt` — không throw, dùng `reviewedAt`/`createdAt` thay thế (Task 2).
4. User resolve mục unified rồi app khởi động lại — migration không "hồi sinh" mục đó (Task 5, cờ).
5. `mistakeLog` JSON hỏng, hoặc fetch remote lỗi — không throw; lỗi remote không set cờ remote (Task 5).

---

### Task 1: Phase 0 — Repository stabilization

**Files:** không sửa code; chỉ git.

**Interfaces:**
- Consumes: working tree hiện tại (44 file chưa commit, branch `phase-6-exam-engine`).
- Produces: working tree sạch, baseline test count ghi lại, làm mốc rollback cho các task sau.

Mỗi lệnh `git commit` ở task này cần user xác nhận trước (ghi rõ nhóm file cho user thấy).

- [ ] **Step 1: Audit**

Run: `git status --short && git diff --stat && git log --oneline --decorate -10`
Expected: danh sách file chưa commit. Phân loại từng file: finished / unfinished / generated / obsolete. Với `src/lib/providers/*`, `src/app/api/admin/metrics/route.ts`, `src/lib/plan/*`, `src/app/today|path/page.tsx` chạy `git diff <file>` để biết thuộc nhóm nào.

- [ ] **Step 2: Chạy baseline trước khi commit**

Run: `npm test 2>&1 | tail -15`
Expected: ghi lại số tests/suites (kỳ vọng 342 tests / 64 suites). Nếu khác hoặc có fail, dừng lại và báo user nguyên nhân trước khi commit.

- [ ] **Step 3: Commit theo nhóm (đã được user xác nhận từng nhóm)**

Nhóm gợi ý, điều chỉnh theo Step 1:

```bash
# 1. Supabase config + migration rename
git add supabase/ && git commit -m "chore(supabase): normalize migration filenames and add local config"

# 2. Unified mistakes sync + mastery-all
git add src/lib/mastery-all.ts src/lib/__tests__/mastery-all.test.ts src/lib/mistakes.ts \
  src/lib/__tests__/mistakes.test.ts src/lib/sync.ts src/lib/sync-merge.ts src/lib/sync-queue.ts \
  src/lib/exam/__tests__/exam-storage.test.ts src/app/path/page.tsx src/app/today/page.tsx
git commit -m "feat(sync): unified mistakes LWW sync and recomputeMastery"

# 3. Plan generator, providers, admin metrics (nếu diff thuộc các thay đổi riêng)
git add src/lib/plan src/lib/providers src/app/api/admin/metrics/route.ts
git commit -m "fix: plan generator, provider and admin metrics updates"

# 4. Docs + scripts
git add CONTEXT.md docs/ scripts/
git commit -m "docs: update overview, requirements and implementation plans"
```

- [ ] **Step 4: Xác nhận sạch**

Run: `git status --short`
Expected: không còn file nào (hoặc chỉ file user chủ động bỏ lại). Chạy `npm run build && npm run lint` một lần để chắc baseline build/lint xanh; ghi kết quả vào ghi chú PR.

---

### Task 2: `UnifiedMistake.exam` + pure migration function

**Files:**
- Modify: `src/lib/mistakes.ts`
- Create: `src/lib/mistake-migration.ts` (phần hàm thuần; phần client ở Task 5)
- Modify test: `src/lib/__tests__/mistakes.test.ts`
- Create test: `src/lib/__tests__/mistake-migration.test.ts`

**Interfaces:**
- Consumes: `MistakeEntry`, `ExamPart`, `QuestionType` từ `src/lib/exam/types.ts`; `UnifiedMistake`, `MistakeSkill` từ `src/lib/mistakes.ts`.
- Produces (Task 3, 4, 5 dùng):
  - `export interface ExamMistakeMeta { itemId: string; questionId: string; part: ExamPart; type: QuestionType; prompt: string }`
  - `UnifiedMistake.exam?: ExamMistakeMeta`
  - `export type ExamMistake = UnifiedMistake & { exam: ExamMistakeMeta }`
  - `addMistake(input: {...; exam?: ExamMistakeMeta}): UnifiedMistake`
  - `getExamMistakes(): ExamMistake[]`, `getUnresolvedExamMistakes(): ExamMistake[]`
  - `examPartToSkill(part: string): MistakeSkill`
  - `migrateLegacyMistakes(legacy: MistakeEntry[], unified: UnifiedMistake[]): { merged: UnifiedMistake[]; changed: UnifiedMistake[] }`

- [ ] **Step 1: Viết test cho `mistakes.ts`**

Thêm vào cuối `src/lib/__tests__/mistakes.test.ts` (và thêm `getExamMistakes, getUnresolvedExamMistakes, examPartToSkill` vào import đầu file):

```ts
const exam = {
  itemId: "i1",
  questionId: "q1",
  part: "RC5" as const,
  type: "incomplete_sentence" as const,
  prompt: "Which?",
};

test("addMistake stores exam meta and getExamMistakes returns only exam entries", () => {
  addMistake({ ...base, source: "exam:RC5:q1", exam });
  addMistake({ ...base, source: "grammar:t1" });
  expect(getMistakes()).toHaveLength(2);
  expect(getExamMistakes()).toHaveLength(1);
  expect(getExamMistakes()[0].exam.prompt).toBe("Which?");
});

test("dedupe keeps the latest exam meta and increments occurrenceCount", () => {
  addMistake({ ...base, source: "exam:RC5:q1", exam });
  const m2 = addMistake({
    ...base,
    source: "exam:RC5:q1",
    exam: { ...exam, itemId: "i2" },
  });
  expect(getExamMistakes()).toHaveLength(1);
  expect(m2.occurrenceCount).toBe(2);
  expect(getExamMistakes()[0].exam.itemId).toBe("i2");
});

test("getUnresolvedExamMistakes excludes resolved; a new wrong answer after resolve creates a new entry", () => {
  const m = addMistake({ ...base, source: "exam:RC5:q1", exam });
  resolveMistake(m.id);
  expect(getUnresolvedExamMistakes()).toHaveLength(0);
  addMistake({ ...base, source: "exam:RC5:q1", exam });
  expect(getExamMistakes()).toHaveLength(2);
  expect(getUnresolvedExamMistakes()).toHaveLength(1);
});

test("examPartToSkill maps listening parts and defaults to reading", () => {
  expect(examPartToSkill("LC2")).toBe("listening");
  expect(examPartToSkill("LISTEN_S1")).toBe("listening");
  expect(examPartToSkill("RC5")).toBe("reading");
  expect(examPartToSkill("READ_P3")).toBe("reading");
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- --testPathPattern=lib/__tests__/mistakes.test`
Expected: FAIL (`getExamMistakes is not a function` / type errors).

- [ ] **Step 3: Sửa `src/lib/mistakes.ts`**

Thêm import type ở đầu file (dưới import `pushUnifiedMistake`):

```ts
import type { ExamPart, QuestionType } from "./exam/types";
```

Thêm vào sau `MistakeStatus`:

```ts
export interface ExamMistakeMeta {
  itemId: string;
  questionId: string;
  part: ExamPart;
  type: QuestionType;
  prompt: string;
}
```

Trong `UnifiedMistake` thêm sau `reviewedAt?: string;`:

```ts
  /** Present for mistakes recorded by the exam engine (drives /exam/mistakes and bank pinning). */
  exam?: ExamMistakeMeta;
```

Sau `UnifiedMistake` thêm:

```ts
export type ExamMistake = UnifiedMistake & { exam: ExamMistakeMeta };

export function examPartToSkill(part: string): MistakeSkill {
  if (part.startsWith("LC") || part.startsWith("LISTEN")) return "listening";
  return "reading";
}
```

Đổi chữ ký `addMistake` — thêm `exam?: ExamMistakeMeta;` vào type của `input`. Trong nhánh `existing`, thêm vào object `updated`: `exam: input.exam ?? existing.exam,`. Nhánh tạo mới đã `...input` nên tự mang `exam`.

Thêm sau `getMistakesByStatus`:

```ts
const hasExam = (m: UnifiedMistake): m is ExamMistake => !!m.exam;

export function getExamMistakes(): ExamMistake[] {
  return ls().filter(hasExam);
}

export function getUnresolvedExamMistakes(): ExamMistake[] {
  return getExamMistakes().filter((m) => m.status !== "resolved");
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- --testPathPattern=lib/__tests__/mistakes.test`
Expected: PASS.

- [ ] **Step 5: Viết test cho migration thuần**

Create `src/lib/__tests__/mistake-migration.test.ts`:

```ts
jest.mock("../sync", () => ({ pushUnifiedMistake: jest.fn().mockResolvedValue(undefined) }));

import { migrateLegacyMistakes } from "../mistake-migration";
import type { MistakeEntry } from "../exam/types";
import type { UnifiedMistake } from "../mistakes";

const legacy = (o: Partial<MistakeEntry> = {}): MistakeEntry => ({
  id: "l1",
  questionId: "q1",
  itemId: "i1",
  type: "incomplete_sentence",
  part: "RC5",
  prompt: "P?",
  userAnswer: "A",
  correctAnswer: "B",
  explanation: "e",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  resolved: false,
  ...o,
});

const uni = (o: Partial<UnifiedMistake> = {}): UnifiedMistake => ({
  id: "u1",
  skill: "reading",
  category: "incomplete_sentence",
  source: "exam:RC5:q1",
  userAnswer: "A",
  correctAnswer: "B",
  explanation: "e",
  occurrenceCount: 1,
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...o,
});

test("empty legacy changes nothing", () => {
  const u = [uni()];
  const r = migrateLegacyMistakes([], u);
  expect(r.merged).toEqual(u);
  expect(r.changed).toEqual([]);
});

test("groups repeated wrong answers into one entry with count, latest id and answer, earliest createdAt", () => {
  const r = migrateLegacyMistakes(
    [
      legacy({ id: "l1", updatedAt: "2026-09-01T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z", userAnswer: "A" }),
      legacy({ id: "l3", updatedAt: "2026-09-03T00:00:00.000Z", createdAt: "2026-09-03T00:00:00.000Z", userAnswer: "C" }),
      legacy({ id: "l2", updatedAt: "2026-09-02T00:00:00.000Z", createdAt: "2026-09-02T00:00:00.000Z", userAnswer: "D" }),
    ],
    []
  );
  expect(r.merged).toHaveLength(1);
  expect(r.merged[0]).toMatchObject({
    id: "l3",
    skill: "reading",
    category: "incomplete_sentence",
    source: "exam:RC5:q1",
    occurrenceCount: 3,
    status: "new",
    userAnswer: "C",
    createdAt: "2026-09-01T00:00:00.000Z",
    exam: { itemId: "i1", questionId: "q1", part: "RC5", type: "incomplete_sentence", prompt: "P?" },
  });
  expect(r.changed).toHaveLength(1);
});

test("different questions stay separate", () => {
  const r = migrateLegacyMistakes(
    [legacy({ id: "a", questionId: "q1" }), legacy({ id: "b", questionId: "q2" })],
    []
  );
  expect(r.merged.map((m) => m.source).sort()).toEqual(["exam:RC5:q1", "exam:RC5:q2"]);
});

test("does not add counts when unified already has the entry (old dual-write), only attaches exam meta", () => {
  const r = migrateLegacyMistakes(
    [legacy({ id: "l1" }), legacy({ id: "l2" })],
    [uni({ occurrenceCount: 2 })]
  );
  expect(r.merged).toHaveLength(1);
  expect(r.merged[0].occurrenceCount).toBe(2);
  expect(r.merged[0].exam).toMatchObject({ itemId: "i1", prompt: "P?" });
  expect(r.changed).toHaveLength(1);
});

test("propagates a legacy resolve to the unresolved unified entry", () => {
  const r = migrateLegacyMistakes(
    [legacy({ resolved: true, reviewedAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z" })],
    [uni()]
  );
  expect(r.merged[0].status).toBe("resolved");
  expect(r.merged[0].reviewedAt).toBe("2026-09-05T00:00:00.000Z");
});

test("does not resolve a unified entry that was updated after the legacy resolve", () => {
  const r = migrateLegacyMistakes(
    [legacy({ resolved: true, updatedAt: "2026-09-05T00:00:00.000Z" })],
    [uni({ updatedAt: "2026-09-10T00:00:00.000Z" })]
  );
  expect(r.merged[0].status).toBe("new");
});

test("resolved then wrong again: unified stays unresolved and keeps its count", () => {
  const r = migrateLegacyMistakes(
    [
      legacy({ id: "l1", resolved: true, updatedAt: "2026-09-02T00:00:00.000Z" }),
      legacy({ id: "l2", resolved: false, updatedAt: "2026-09-04T00:00:00.000Z" }),
    ],
    [uni({ occurrenceCount: 2, updatedAt: "2026-09-04T00:00:00.000Z" })]
  );
  expect(r.merged).toHaveLength(1);
  expect(r.merged[0].status).toBe("new");
  expect(r.merged[0].occurrenceCount).toBe(2);
});

test("resolved legacy with no unified counterpart becomes a resolved entry", () => {
  const r = migrateLegacyMistakes(
    [legacy({ resolved: true, reviewedAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z" })],
    []
  );
  expect(r.merged[0]).toMatchObject({ status: "resolved", reviewedAt: "2026-09-05T00:00:00.000Z" });
});

test("duplicate legacy ids (local + remote overlap) are counted once", () => {
  const e = legacy({ id: "same" });
  const r = migrateLegacyMistakes([e, { ...e }], []);
  expect(r.merged[0].occurrenceCount).toBe(1);
});

test("legacy entries without updatedAt fall back to reviewedAt/createdAt instead of throwing", () => {
  const old = legacy({ id: "old" }) as Partial<MistakeEntry>;
  delete old.updatedAt;
  expect(() => migrateLegacyMistakes([old as MistakeEntry], [])).not.toThrow();
  const r = migrateLegacyMistakes([old as MistakeEntry], []);
  expect(r.merged[0].updatedAt).toBe("2026-09-01T00:00:00.000Z");
});

test("is idempotent: running again on its own output changes nothing", () => {
  const input = [legacy({ id: "l1" }), legacy({ id: "l2", resolved: true, updatedAt: "2026-09-02T00:00:00.000Z" }), legacy({ id: "l3", questionId: "q2" })];
  const first = migrateLegacyMistakes(input, []);
  const second = migrateLegacyMistakes(input, first.merged);
  expect(second.changed).toEqual([]);
  expect(second.merged).toEqual(first.merged);
});
```

- [ ] **Step 6: Chạy test, xác nhận fail**

Run: `npm test -- --testPathPattern=mistake-migration`
Expected: FAIL (`Cannot find module '../mistake-migration'`).

- [ ] **Step 7: Viết hàm thuần**

Create `src/lib/mistake-migration.ts`:

```ts
import type { MistakeEntry } from "./exam/types";
import { examPartToSkill, type ExamMistakeMeta, type UnifiedMistake } from "./mistakes";

const sourceOf = (e: MistakeEntry) => `exam:${e.part}:${e.questionId}`;

/**
 * Converts legacy `mistakeLog` entries into UnifiedMistake entries. Pure and deterministic:
 * - groups by question + type + resolved flag; the entry id is the newest legacy id so devices converge under LWW
 * - never adds counts to a unified entry that old dual-write already counted
 * - a fully-resolved legacy question resolves its unified entry unless the unified entry is newer
 */
export function migrateLegacyMistakes(
  legacy: MistakeEntry[],
  unified: UnifiedMistake[]
): { merged: UnifiedMistake[]; changed: UnifiedMistake[] } {
  const merged = unified.map((m) => ({ ...m }));
  const changedIds = new Set<string>();

  const byId = new Map<string, MistakeEntry>();
  for (const raw of legacy) {
    const e = { ...raw, updatedAt: raw.updatedAt ?? raw.reviewedAt ?? raw.createdAt };
    const prev = byId.get(e.id);
    if (!prev || e.updatedAt >= prev.updatedAt) byId.set(e.id, e);
  }

  const groups = new Map<string, MistakeEntry[]>();
  for (const e of byId.values()) {
    const key = `${sourceOf(e)}|${e.type}|${e.resolved ? "r" : "u"}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const unresolvedQuestions = new Set<string>();
  for (const key of groups.keys()) {
    if (key.endsWith("|u")) unresolvedQuestions.add(key.slice(0, -2));
  }

  for (const [key, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const resolved = key.endsWith("|r");
    if (resolved && unresolvedQuestions.has(key.slice(0, -2))) continue;

    const sorted = [...entries].sort(
      (a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id)
    );
    const latest = sorted[sorted.length - 1];
    const source = sourceOf(latest);
    const exam: ExamMistakeMeta = {
      itemId: latest.itemId,
      questionId: latest.questionId,
      part: latest.part,
      type: latest.type,
      prompt: latest.prompt,
    };
    const match = merged.find(
      (m) =>
        m.source === source &&
        m.category === latest.type &&
        (resolved || m.status !== "resolved")
    );

    if (!match) {
      merged.push({
        id: latest.id,
        skill: examPartToSkill(latest.part),
        category: latest.type,
        source,
        userAnswer: latest.userAnswer,
        correctAnswer: latest.correctAnswer,
        explanation: latest.explanation,
        occurrenceCount: sorted.length,
        status: resolved ? "resolved" : "new",
        createdAt: sorted.map((e) => e.createdAt).sort()[0],
        updatedAt: latest.updatedAt,
        ...(latest.reviewedAt ? { reviewedAt: latest.reviewedAt } : {}),
        exam,
      });
      changedIds.add(latest.id);
      continue;
    }

    if (!match.exam) {
      match.exam = exam;
      changedIds.add(match.id);
    }
    if (resolved && match.status !== "resolved" && match.updatedAt <= latest.updatedAt) {
      match.status = "resolved";
      match.reviewedAt = latest.reviewedAt ?? latest.updatedAt;
      match.updatedAt = latest.updatedAt;
      changedIds.add(match.id);
    }
  }

  return { merged, changed: merged.filter((m) => changedIds.has(m.id)) };
}
```

- [ ] **Step 8: Chạy test, xác nhận pass**

Run: `npm test -- --testPathPattern="mistake-migration|lib/__tests__/mistakes.test"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/mistakes.ts src/lib/mistake-migration.ts src/lib/__tests__/mistakes.test.ts src/lib/__tests__/mistake-migration.test.ts
git commit -m "feat(mistakes): exam meta on UnifiedMistake and pure legacy migration"
```

---

### Task 3: exam-storage becomes an adapter

**Files:**
- Modify: `src/lib/exam/exam-storage.ts`
- Modify test: `src/lib/exam/__tests__/exam-storage.test.ts`
- Modify test mock: `src/lib/__tests__/mastery-all.test.ts:3` (bỏ `pushMistake` khỏi mock nếu còn)

**Interfaces:**
- Consumes (Task 2): `addMistake`, `getUnresolvedExamMistakes`, `examPartToSkill` từ `@/lib/mistakes`.
- Produces: `exam-storage.addMistake(entry: MistakeEntry): void` giữ nguyên chữ ký (ExamRunner không đổi). `getMistakes`, `resolveMistake`, `getUnresolvedMistakes` **bị xóa** khỏi exam-storage. `pruneBank` pin theo unified.

- [ ] **Step 1: Sửa test**

Trong `src/lib/exam/__tests__/exam-storage.test.ts`:
- Bỏ dòng `pushMistake: jest.fn()...` trong `jest.mock`.
- Sửa import: bỏ `getMistakes`, `resolveMistake` khỏi import từ `../exam-storage`, thêm:

```ts
import { getMistakes, getUnresolvedExamMistakes, resolveMistake } from "@/lib/mistakes";
```

- Thay toàn bộ `describe("mistakes", ...)` bằng:

```ts
describe("mistakes adapter", () => {
  const entry = (o: Partial<MistakeEntry> = {}): MistakeEntry => ({
    id: "m1",
    questionId: "q1",
    itemId: "i1",
    type: "incomplete_sentence",
    part: "RC5",
    prompt: "test?",
    userAnswer: "A",
    correctAnswer: "B",
    explanation: "because B",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolved: false,
    ...o,
  });

  it("writes only to unifiedMistakes, with exam meta", () => {
    addMistake(entry());
    expect(store["mistakeLog"]).toBeUndefined();
    const [m] = getMistakes();
    expect(m).toMatchObject({
      skill: "reading",
      category: "incomplete_sentence",
      source: "exam:RC5:q1",
      exam: { itemId: "i1", questionId: "q1", part: "RC5", prompt: "test?" },
    });
  });

  it("maps listening parts to the listening skill", () => {
    addMistake(entry({ part: "LC2", type: "question_response", questionId: "q9" }));
    expect(getMistakes()[0].skill).toBe("listening");
  });

  it("repeated wrong answers increment occurrenceCount; resolve is visible everywhere", () => {
    addMistake(entry({ id: "a" }));
    addMistake(entry({ id: "b" }));
    expect(getMistakes()).toHaveLength(1);
    expect(getMistakes()[0].occurrenceCount).toBe(2);
    resolveMistake(getMistakes()[0].id);
    expect(getUnresolvedExamMistakes()).toHaveLength(0);
  });

  it("pruneBank keeps items pinned by unresolved exam mistakes even when old", () => {
    const items = Array.from({ length: 35 }, (_, i) =>
      makeItem({ id: `id-${i}`, createdAt: new Date(1000 + i).toISOString() })
    );
    addMistake(entry({ itemId: "id-0" }));
    const pruned = pruneBank({ "TOEIC:RC5:3": items });
    expect(pruned["TOEIC:RC5:3"]).toHaveLength(30);
    expect(pruned["TOEIC:RC5:3"].map((i) => i.id)).toContain("id-0");
  });
});
```

Nếu `src/lib/__tests__/mastery-all.test.ts` mock `pushMistake` thì xóa dòng đó (không còn export).

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `npm test -- --testPathPattern=exam-storage`
Expected: FAIL (`mistakeLog` vẫn được ghi / `getMistakes` cũ).

- [ ] **Step 3: Sửa `src/lib/exam/exam-storage.ts`**

- Import: bỏ `MistakeEntry`? Không — vẫn cần cho `addMistake`. Thay:

```ts
import { pushAttempt } from "@/lib/sync";
import { addMistake as addUnifiedMistake, examPartToSkill, getUnresolvedExamMistakes } from "@/lib/mistakes";
```
  và xóa `import type { MistakeSkill }`, hàm `partToSkill`, hằng `MISTAKES_KEY`.
- `pruneBank`: `const pinnedIds = new Set(getUnresolvedExamMistakes().map((m) => m.exam.itemId));`
- Thay toàn bộ khối `// ─── Mistake Log` (từ `getMistakes` đến hết `getUnresolvedMistakes`) bằng:

```ts
// ─── Mistakes ────────────────────────────────────────────────────────────────
/**
 * @deprecated Compatibility adapter for ExamRunner. Writes only to unifiedMistakes;
 * new code should call `addMistake` from "@/lib/mistakes" directly.
 */
export function addMistake(entry: MistakeEntry) {
  try {
    addUnifiedMistake({
      skill: examPartToSkill(entry.part),
      category: entry.type,
      source: `exam:${entry.part}:${entry.questionId}`,
      userAnswer: entry.userAnswer,
      correctAnswer: entry.correctAnswer,
      explanation: entry.explanation,
      exam: {
        itemId: entry.itemId,
        questionId: entry.questionId,
        part: entry.part,
        type: entry.type,
        prompt: entry.prompt,
      },
    });
  } catch {
    // don't disrupt the exam flow on storage failure
  }
}
```

- [ ] **Step 4: Chạy, xác nhận pass và tsc không còn lỗi do import đã xóa**

Run: `npm test -- --testPathPattern="exam-storage|mastery-all" && npx tsc --noEmit 2>&1 | head -20`
Expected: tests PASS; `tsc` còn lỗi ở `src/app/exam/page.tsx`, `src/app/exam/mistakes/page.tsx` (`getUnresolvedMistakes`/`getMistakes` không còn) — sửa ở Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exam/exam-storage.ts src/lib/exam/__tests__/exam-storage.test.ts src/lib/__tests__/mastery-all.test.ts
git commit -m "refactor(exam): route exam mistakes through unifiedMistakes only"
```

---

### Task 4: `/exam/mistakes` and `/exam` read unified (+ migration on page load)

**Files:**
- Modify: `src/app/exam/mistakes/page.tsx`
- Modify: `src/app/exam/page.tsx:5-10,30`
- Create test: `src/app/exam/__tests__/mistakes-page.test.tsx`
- Modify: `src/lib/mistake-migration.ts` (thêm `runMistakeMigration`; xem Task 5 Step 3 — Task 4 chỉ cần chữ ký bên dưới)

**Interfaces:**
- Consumes: `getExamMistakes`, `getUnresolvedExamMistakes`, `resolveMistake`, `ExamMistake` (Task 2); `runMistakeMigration(remote?: MistakeEntry[]): void` (định nghĩa ở Task 5 — **thực hiện Task 5 Step 1–4 trước Task 4 nếu thực hiện tuần tự không theo thứ tự**; thứ tự khuyến nghị: Task 5 trước Task 4).
- Produces: UI chỉ đọc/ghi unified.

> Thứ tự thực thi khuyến nghị: Task 1 → 2 → 3 → **5 → 4** → 6, vì trang gọi `runMistakeMigration`.

- [ ] **Step 1: Viết test trang**

Create `src/app/exam/__tests__/mistakes-page.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import MistakesPage from "../mistakes/page";
import ExamPage from "../page";
import { addMistake, getMistakes } from "@/lib/mistakes";

jest.mock("@/lib/sync", () => ({ pushUnifiedMistake: jest.fn().mockResolvedValue(undefined) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const input = {
  skill: "reading" as const,
  category: "incomplete_sentence",
  source: "exam:RC5:q1",
  userAnswer: "A",
  correctAnswer: "B",
  explanation: "because B",
  exam: { itemId: "i1", questionId: "q1", part: "RC5" as const, type: "incomplete_sentence" as const, prompt: "Which one?" },
};

beforeEach(() => localStorage.clear());

test("lists unified exam mistakes with an occurrence badge, and resolve updates the shared entity", () => {
  addMistake(input);
  addMistake(input);
  render(<MistakesPage />);
  expect(screen.getByText("Which one?")).toBeInTheDocument();
  expect(screen.getByText("sai 2 lần")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "✓ Đánh dấu xử lý" }));
  expect(getMistakes()[0].status).toBe("resolved");
  expect(screen.getByText("🎉 Không có lỗi chưa giải quyết!")).toBeInTheDocument();
});

test("migrates a legacy mistakeLog on first load so old mistakes are not lost", () => {
  localStorage.setItem(
    "mistakeLog",
    JSON.stringify([
      {
        id: "l1", questionId: "q7", itemId: "i7", type: "incomplete_sentence", part: "RC5",
        prompt: "Legacy prompt", userAnswer: "A", correctAnswer: "B", explanation: "e",
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", resolved: false,
      },
    ])
  );
  render(<MistakesPage />);
  expect(screen.getByText("Legacy prompt")).toBeInTheDocument();
});

test("/exam shows the unresolved exam mistake count from unified", () => {
  addMistake(input);
  render(<ExamPage />);
  expect(screen.getByText(/Sổ lỗi/)).toBeInTheDocument();
});
```

Nếu `ExamPage` không render đúng chuỗi "Sổ lỗi" (kiểm tra `src/app/exam/page.tsx` nơi dùng `unresolvedCount`), đổi assertion cuối thành chuỗi/số thực tế hiển thị `unresolvedCount` (ví dụ `getByText(/1/)` trong khối đó). Không bỏ test.

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `npm test -- --testPathPattern=mistakes-page`
Expected: FAIL (trang vẫn đọc `mistakeLog`).

- [ ] **Step 3: Sửa `src/app/exam/mistakes/page.tsx`**

Thay phần đầu file (import → hết `handleAddToSRS`) bằng:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getExamMistakes, resolveMistake, type ExamMistake } from "@/lib/mistakes";
import { runMistakeMigration } from "@/lib/mistake-migration";
import { saveLearnedWord } from "@/lib/storage";
import type { QuestionType } from "@/lib/exam/types";

const TYPE_LABELS: Partial<Record<QuestionType, string>> = {
  incomplete_sentence: "Part 5",
  text_completion: "Part 6",
  single_passage: "Part 7",
  multiple_passage: "Part 7",
  conversation: "Part 3",
  short_talk: "Part 4",
  question_response: "Part 2",
  true_false_ng: "IELTS T/F/NG",
  sentence_completion: "IELTS Completion",
  form_completion: "IELTS S1",
};

export default function MistakesPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<ExamMistake[]>(() => {
    runMistakeMigration();
    return getExamMistakes();
  });
  const [filter, setFilter] = useState<"all" | "unresolved">("unresolved");

  const shown = filter === "all" ? mistakes : mistakes.filter((m) => m.status !== "resolved");

  function handleResolve(id: string) {
    resolveMistake(id);
    setMistakes(getExamMistakes());
  }

  function handleAddToSRS(mistake: ExamMistake, word: string) {
    saveLearnedWord({
      word,
      meaning: "",
      example: mistake.exam.prompt,
      topic: `exam:${mistake.exam.part}`,
      learnedAt: new Date().toISOString(),
      mastery: 0,
      nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      reviewInterval: 1,
    });
    alert(`Đã thêm "${word}" vào flashcard!`);
  }
```

Trong JSX, thay:
- `mistakes.filter((m) => !m.resolved).length` → `mistakes.filter((m) => m.status !== "resolved").length`
- `className={`mistake-card ${m.resolved ? "resolved" : ""}`}` → `${m.status === "resolved" ? "resolved" : ""}`
- `{TYPE_LABELS[m.type] ?? m.type}` → `{TYPE_LABELS[m.exam.type] ?? m.exam.type}`
- `{m.resolved && <span ...>}` → `{m.status === "resolved" && <span ...>}` và ngay sau đó thêm `{m.occurrenceCount > 1 && <span className="date">sai {m.occurrenceCount} lần</span>}`
- `{m.prompt}` → `{m.exam.prompt}`
- `/exam/drill/${m.part}` → `/exam/drill/${m.exam.part}`
- `{!m.resolved && (` → `{m.status !== "resolved" && (`

(`Number` của text "sai 2 lần" phải render thành một text node duy nhất; dùng template: `{`sai ${m.occurrenceCount} lần`}` để `getByText("sai 2 lần")` khớp.)

- [ ] **Step 4: Sửa `src/app/exam/page.tsx`**

Đổi import (dòng 5–10):

```tsx
import { getExamSettings, saveExamSettings, getAttempts } from "@/lib/exam/exam-storage";
import { getUnresolvedExamMistakes } from "@/lib/mistakes";
import { runMistakeMigration } from "@/lib/mistake-migration";
```

Đổi dòng `const unresolvedCount = getUnresolvedMistakes().length;` thành:

```tsx
const [unresolvedCount] = useState(() => {
  runMistakeMigration();
  return getUnresolvedExamMistakes().length;
});
```

- [ ] **Step 5: Chạy, xác nhận pass**

Run: `npm test -- --testPathPattern="mistakes-page|exam"` và `npx tsc --noEmit 2>&1 | head`
Expected: PASS; `tsc` sạch.

- [ ] **Step 6: Commit**

```bash
git add src/app/exam/mistakes/page.tsx src/app/exam/page.tsx src/app/exam/__tests__/mistakes-page.test.tsx
git commit -m "feat(exam): mistakes pages read unifiedMistakes"
```

---

### Task 5: Client migration runner + sync wiring

**Files:**
- Modify: `src/lib/mistake-migration.ts` (thêm runner)
- Modify: `src/lib/sync.ts` (bỏ `pushMistake`, đổi khối pull `mistake_log`)
- Modify: `src/components/SyncInit.tsx`
- Modify: `src/lib/sync-merge.ts` (comment)
- Modify test: `src/lib/__tests__/mistake-migration.test.ts`, `src/lib/__tests__/sync.test.ts`

**Interfaces:**
- Consumes (Task 2): `migrateLegacyMistakes`; `getMistakes`, `saveMistakes` từ `./mistakes`; `pushUnifiedMistake` từ `./sync`.
- Produces:
  - `runMistakeMigration(remote?: MistakeEntry[]): void` — idempotent, guarded bởi cờ.
  - `needsRemoteMistakeMigration(): boolean`
  - localStorage: `mistakeLogMigrated`, `mistakeLogRemoteMigrated`, `mistakeLogBackup`.

- [ ] **Step 1: Viết test runner**

Sửa import đầu `src/lib/__tests__/mistake-migration.test.ts` (đã có `jest.mock("../sync", ...)` từ Task 2) thành:

```ts
import { migrateLegacyMistakes, runMistakeMigration, needsRemoteMistakeMigration } from "../mistake-migration";
import { getMistakes, resolveMistake } from "../mistakes";
import { pushUnifiedMistake } from "../sync";
```

Thêm vào cuối file:

```ts
describe("runMistakeMigration", () => {
  beforeEach(() => {
    localStorage.clear();
    (pushUnifiedMistake as jest.Mock).mockClear();
  });

  it("migrates local mistakeLog, backs it up, keeps the legacy key, pushes changed entries, sets the flag", () => {
    const raw = JSON.stringify([legacy({ id: "l1" }), legacy({ id: "l2" })]);
    localStorage.setItem("mistakeLog", raw);
    runMistakeMigration();
    expect(getMistakes()).toHaveLength(1);
    expect(getMistakes()[0].occurrenceCount).toBe(2);
    expect(localStorage.getItem("mistakeLog")).toBe(raw);
    expect(localStorage.getItem("mistakeLogBackup")).toBe(raw);
    expect(localStorage.getItem("mistakeLogMigrated")).toBe("1");
    expect(pushUnifiedMistake).toHaveBeenCalledTimes(1);
  });

  it("runs only once: resolving a unified entry afterwards is not undone by a restart", () => {
    localStorage.setItem("mistakeLog", JSON.stringify([legacy({ id: "l1" })]));
    runMistakeMigration();
    resolveMistake(getMistakes()[0].id);
    runMistakeMigration();
    expect(getMistakes()).toHaveLength(1);
    expect(getMistakes()[0].status).toBe("resolved");
  });

  it("does not throw on corrupt mistakeLog JSON and still sets the flag", () => {
    localStorage.setItem("mistakeLog", "{not json");
    expect(() => runMistakeMigration()).not.toThrow();
    expect(localStorage.getItem("mistakeLogMigrated")).toBe("1");
    expect(getMistakes()).toEqual([]);
  });

  it("no mistakeLog at all is a no-op that sets the flag", () => {
    runMistakeMigration();
    expect(localStorage.getItem("mistakeLogMigrated")).toBe("1");
    expect(localStorage.getItem("mistakeLogBackup")).toBeNull();
  });

  it("migrates remote entries once, skipping ids already in the local legacy log", () => {
    localStorage.setItem("mistakeLog", JSON.stringify([legacy({ id: "l1" })]));
    runMistakeMigration();
    expect(needsRemoteMistakeMigration()).toBe(true);
    runMistakeMigration([legacy({ id: "l1" }), legacy({ id: "r1", questionId: "q9" })]);
    expect(getMistakes().map((m) => m.source).sort()).toEqual(["exam:RC5:q1", "exam:RC5:q9"]);
    expect(needsRemoteMistakeMigration()).toBe(false);
    runMistakeMigration([legacy({ id: "r2", questionId: "q10" })]);
    expect(getMistakes()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `npm test -- --testPathPattern=mistake-migration`
Expected: FAIL (`runMistakeMigration is not a function`).

- [ ] **Step 3: Thêm runner vào `src/lib/mistake-migration.ts`**

Thêm import ở đầu file:

```ts
import { getMistakes, saveMistakes } from "./mistakes";
import { pushUnifiedMistake } from "./sync";
```

Thêm cuối file:

```ts
const LEGACY_KEY = "mistakeLog";
const BACKUP_KEY = "mistakeLogBackup";
const LOCAL_FLAG = "mistakeLogMigrated";
const REMOTE_FLAG = "mistakeLogRemoteMigrated";

function readLegacy(): { raw: string | null; entries: MistakeEntry[] } {
  const raw = localStorage.getItem(LEGACY_KEY);
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return { raw, entries: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { raw, entries: [] };
  }
}

export function needsRemoteMistakeMigration(): boolean {
  return typeof window !== "undefined" && !localStorage.getItem(REMOTE_FLAG);
}

/**
 * One-time move of legacy `mistakeLog` into `unifiedMistakes`. Local and remote
 * (`mistake_log` table) sources have separate flags so each runs exactly once;
 * re-running would resurrect entries the user already resolved. `mistakeLog` is
 * never deleted and is backed up to `mistakeLogBackup`.
 */
export function runMistakeMigration(remote?: MistakeEntry[]): void {
  if (typeof window === "undefined") return;
  const runLocal = !localStorage.getItem(LOCAL_FLAG);
  const runRemote = remote !== undefined && !localStorage.getItem(REMOTE_FLAG);
  if (!runLocal && !runRemote) return;

  const { raw, entries: local } = readLegacy();
  const input: MistakeEntry[] = [];
  if (runLocal) {
    if (raw && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, raw);
    input.push(...local);
  }
  if (runRemote) {
    const localIds = new Set(local.map((e) => e.id));
    input.push(...remote.filter((e) => !localIds.has(e.id)));
  }

  const { merged, changed } = migrateLegacyMistakes(input, getMistakes());
  if (changed.length > 0) {
    saveMistakes(merged);
    for (const m of changed) void pushUnifiedMistake(m);
  }
  if (runLocal) localStorage.setItem(LOCAL_FLAG, "1");
  if (runRemote) localStorage.setItem(REMOTE_FLAG, "1");
}
```

- [ ] **Step 4: Chạy, xác nhận pass**

Run: `npm test -- --testPathPattern=mistake-migration`
Expected: PASS.

- [ ] **Step 5: Viết test sync**

Thêm vào cuối `src/lib/__tests__/sync.test.ts`:

```ts
// --- mistake_log → unifiedMistakes migration ---

function fromWithMistakeLog(result: { data: unknown; error: unknown }) {
  const base = makeFromImpl();
  return (table: string) =>
    table === "mistake_log"
      ? {
          upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
          select: jest.fn(() => ({ eq: jest.fn().mockResolvedValue(result) })),
        }
      : base(table);
}

const remoteLegacy = {
  id: "r1", questionId: "q5", itemId: "i5", type: "incomplete_sentence", part: "RC5",
  prompt: "Remote prompt", userAnswer: "A", correctAnswer: "B", explanation: "e",
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", resolved: false,
};

test("initSync migrates remote mistake_log into unifiedMistakes once", async () => {
  mockFrom.mockImplementation(
    fromWithMistakeLog({ data: [{ payload: remoteLegacy, updated_at: remoteLegacy.updatedAt }], error: null })
  );
  await initSync();
  const stored = JSON.parse(localStorage.getItem("unifiedMistakes") ?? "[]");
  expect(stored.map((m: { source: string }) => m.source)).toContain("exam:RC5:q5");
  expect(localStorage.getItem("mistakeLogRemoteMigrated")).toBe("1");
});

test("initSync does not set the remote migration flag when the mistake_log fetch fails", async () => {
  mockFrom.mockImplementation(fromWithMistakeLog({ data: null, error: { message: "boom" } }));
  await initSync();
  expect(localStorage.getItem("mistakeLogRemoteMigrated")).toBeNull();
});

test("initSync no longer writes mistakeLog to localStorage", async () => {
  mockFrom.mockImplementation(
    fromWithMistakeLog({ data: [{ payload: remoteLegacy, updated_at: remoteLegacy.updatedAt }], error: null })
  );
  await initSync();
  expect(localStorage.getItem("mistakeLog")).toBeNull();
});
```

- [ ] **Step 6: Chạy, xác nhận fail**

Run: `npm test -- --testPathPattern=lib/__tests__/sync.test`
Expected: FAIL (3 test mới; code cũ ghi `mistakeLog`).

- [ ] **Step 7: Sửa `src/lib/sync.ts`**

- Xóa hàm `pushMistake` (khối `export async function pushMistake ... }`).
- Giữ `import type { ... MistakeEntry }` (còn dùng cho processor và migration).
- Thay toàn bộ khối từ `// Pull mistake log — include updated_at ...` đến hết `if (remoteMistakes && ...) { ... }` bằng:

```ts
    // Legacy mistake_log: one-time migration into unifiedMistakes, then never read again
    const { needsRemoteMistakeMigration, runMistakeMigration } = await import("./mistake-migration");
    if (needsRemoteMistakeMigration()) {
      const { data: remoteLegacy, error: legacyError } = await supabase
        .from("mistake_log")
        .select("payload, updated_at")
        .eq("sync_key", syncKey);
      if (!legacyError) {
        runMistakeMigration(
          (remoteLegacy ?? []).map((r) => ({
            ...(r.payload as MistakeEntry),
            updatedAt: (r.updated_at as string) ?? (r.payload as MistakeEntry).updatedAt,
          }))
        );
      }
    }
```

(Phải đứng **trước** khối `// Pull unified mistakes` để merge LWW thấy dữ liệu đã migrate.) Giữ nguyên `registerProcessor("mistakeLog", ...)` để drain queue cũ.

- [ ] **Step 8: Gọi migration ở `SyncInit`**

`src/components/SyncInit.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { initSyncQueueManager } from "@/lib/sync-queue";
import { registerSyncProcessors } from "@/lib/sync";
import { runMistakeMigration } from "@/lib/mistake-migration";

export function SyncInit() {
  useEffect(() => {
    runMistakeMigration();
    registerSyncProcessors();
    const cleanup = initSyncQueueManager();
    return cleanup;
  }, []);
  return null;
}
```

- [ ] **Step 9: Cập nhật comment `src/lib/sync-merge.ts`**

Dòng `* mistakeLog          → LWW by updatedAt` → `* mistakeLog          → legacy; migrated once into unifiedMistakes (see mistake-migration.ts)`. Dòng `Only learnedWords, examAttempts, and mistakeLog currently route through` → `Only learnedWords, examAttempts, and unifiedMistakes currently route through`.

- [ ] **Step 10: Chạy toàn bộ liên quan**

Run: `npm test -- --testPathPattern="sync|mistake" && npx tsc --noEmit 2>&1 | head`
Expected: PASS, `tsc` sạch.

- [ ] **Step 11: Commit**

```bash
git add src/lib/mistake-migration.ts src/lib/sync.ts src/lib/sync-merge.ts src/components/SyncInit.tsx src/lib/__tests__/mistake-migration.test.ts src/lib/__tests__/sync.test.ts
git commit -m "feat(sync): one-time mistakeLog to unifiedMistakes migration, stop writing mistake_log"
```

---

### Task 6: Docs + full verification

**Files:**
- Modify: `CONTEXT.md`
- Modify: `docs/APP_OVERVIEW.md`

**Interfaces:** không.

- [ ] **Step 1: Cập nhật `CONTEXT.md`**

- Mục `UnifiedMistake`: thêm `exam?: ExamMistakeMeta` ({itemId, questionId, part, type, prompt}); thêm `getExamMistakes`, `getUnresolvedExamMistakes`, `examPartToSkill`; **xóa** đoạn "**Hai sổ lỗi song song**" và thay bằng: sổ lỗi exam ghi thẳng unified qua `exam-storage.addMistake` (adapter, `@deprecated`); `mistakeLog` chỉ còn là nguồn migration một lần (`src/lib/mistake-migration.ts`, cờ `mistakeLogMigrated`/`mistakeLogRemoteMigrated`, backup `mistakeLogBackup`).
- Bảng Pages: `/exam/mistakes` — "Sổ lỗi exam: `getExamMistakes()` (unified, source `exam:*`); resolve dùng chung với `/mistakes`; hiển thị 'sai N lần'".
- Bảng localStorage keys: `mistakeLog` → "Legacy, chỉ đọc cho migration; không còn ghi"; thêm `mistakeLogBackup`, `mistakeLogMigrated`, `mistakeLogRemoteMigrated`.
- Mục Supabase Sync: ghi chú `mistake_log` không còn được ghi; chỉ pull một lần trong `initSync` để migrate; xóa dòng `pushMistake(mistake)` khỏi danh sách Operations và sửa dòng "LWW" không còn nhắc `mistake_log`.
- Mục Offline queue: `mistakeLog` processor giữ lại chỉ để drain queue cũ.

- [ ] **Step 2: Cập nhật `docs/APP_OVERVIEW.md`**

Tìm bằng `grep -n "mistakeLog\|dual-write\|Dual-write\|hai sổ" docs/APP_OVERVIEW.md` các đoạn mô tả hai sổ lỗi / dual-write bất đối xứng và sửa theo kiến trúc mới (một nguồn unified, resolve đồng bộ).

- [ ] **Step 3: Verification đầy đủ (release gate)**

Run:
```bash
npm test 2>&1 | tail -15
npm run build 2>&1 | tail -15
npm run lint 2>&1 | tail -15
```
Expected: test/suite count ≥ baseline Task 1 (tăng do test mới), build và lint không lỗi.

- [ ] **Step 4: Kiểm thử thủ công (dev server)**

Run: `npm run dev`. Trong browser: (a) đặt `localStorage.mistakeLog` giả lập vài mục + xóa cờ `mistakeLogMigrated` rồi mở `/exam/mistakes` → thấy mục, key `mistakeLogBackup` có dữ liệu; (b) làm một drill RC5 sai một câu hai lần → `/exam/mistakes` hiện "sai 2 lần"; (c) resolve ở `/exam/mistakes` → `/mistakes` không còn mục đó và ngược lại; (d) kiểm tra dark mode + mobile width của `/exam/mistakes`.

- [ ] **Step 5: Commit**

```bash
git add CONTEXT.md docs/APP_OVERVIEW.md
git commit -m "docs: unified mistakes is the single source of truth"
```
