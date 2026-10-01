# Plan bổ sung — Đóng Phase 6 & 7

> Bổ sung cho `APP_OVERVIEW.md` (cập nhật 2026-09-21) và `ROADMAP_PHASE_6_7.md`.
> Mục tiêu: xử lý các hạng mục còn thiếu sau khi đã ship UI của Phase 6 và Phase 7.
> Dùng file này làm context cho các phiên làm việc với AI (Claude Code).
>
> Ngày lập: 2026-09-21

---

## 0. Tóm tắt trạng thái

Tính năng người dùng nhìn thấy đã có gần đủ. Còn thiếu 3 nhóm việc:

1. **Sync.** Toàn bộ dữ liệu mới của Phase 6/7 chưa được đẩy lên Supabase. Ngoài ra rule merge `learnedAt` hiện tại **đang làm mất tiến độ SM-2** khi dùng nhiều thiết bị.
2. **Lịch sử điểm.** Hiện không có điểm scaled/band cho exam và không lưu lịch sử band của speaking/writing, nên không theo dõi được tiến bộ.
3. **Các cầu nối và tính năng phụ.** Gồm mistake → SRS, flag câu lỗi, shadowing, audio replay, và các part IELTS còn thiếu.

Các stream dưới đây xếp theo **thứ tự bắt buộc**. S1 phải làm trước vì đang có lỗi mất dữ liệu.

| Stream | Nội dung | Mức | Phase gốc |
|---|---|---|---|
| S0 | Script kiểm tra trạng thái | Chuẩn bị | — |
| S1 | Sửa merge sync: `updatedAt` + thứ tự pull-trước-push | 🔴 Bug mất dữ liệu | 7 |
| S2 | Sync exam: `exam_items`, `exam_attempts`, `mistake_log` | 🟠 Cao | 6 |
| S3 | Scoring TOEIC/IELTS + trang result | 🟠 Cao | 6 |
| S4 | Lịch sử speaking/writing + band timeline + skill radar | 🟠 Cao | 7 |
| S5 | Mistake → SRS bridge + flag câu lỗi + slim `MistakeEntry` | 🟡 Trung bình | 6 |
| S6 | Pin grading provider + few-shot anchor | 🟡 Trung bình | 7 |
| S7 | Audio replay (IndexedDB) + shadowing mode | 🟢 Nice-to-have | 7 |
| S8 | Mở rộng part: IELTS READ_P1/P2, LISTEN_S2–S4, TOEIC LC1 | 🟢 Nice-to-have | 6 |
| S9 | Cập nhật `APP_OVERVIEW.md` | Bắt buộc cuối | — |

---

## S0 — Script kiểm tra trạng thái

Một số mục không được nhắc trong tài liệu nhưng **có thể đã làm trong code**. Chạy script này trước để bỏ các stream đã xong.

```bash
mkdir -p scripts
cat > scripts/check-phase-6-7.sh << 'EOF'
#!/usr/bin/env bash
# Kiểm tra nhanh các hạng mục Phase 6/7. Kết quả ✅ chỉ là heuristic grep — mở file để xác nhận.
cd "$(dirname "$0")/.."

check() {
  local label="$1"; shift
  if eval "$@" >/dev/null 2>&1; then echo "✅ $label"; else echo "❌ $label"; fi
}

echo "── S1 Sync SM-2"
check "updatedAt trong LearnedWord"           "grep -q 'updatedAt' src/lib/storage.ts"
check "sync.ts merge theo updatedAt"          "grep -q 'updatedAt\|updated_at' src/lib/sync.ts"
check "sync.ts đẩy easiness/repetitions"      "grep -q 'easiness' src/lib/sync.ts"

echo "── S2 Sync exam"
check "exam_attempts trong sync.ts"           "grep -q 'exam_attempts' src/lib/sync.ts"
check "mistake_log trong sync.ts"             "grep -q 'mistake_log' src/lib/sync.ts"
check "exam_items trong sync.ts"              "grep -q 'exam_items' src/lib/sync.ts"

echo "── S3 Scoring"
check "scoring.ts tồn tại"                    "test -f src/lib/exam/scoring.ts"
check "trang /exam/result/[attemptId]"        "test -d 'src/app/exam/result'"

echo "── S4 Speaking/Writing history"
check "speakingSessions storage"              "grep -rq 'speakingSessions' src/lib"
check "writingSubmissions storage"            "grep -rq 'writingSubmissions' src/lib"
check "BandTimelineChart"                     "test -f src/components/charts/BandTimelineChart.tsx"

echo "── S5 Mistake bridge"
check "keyVocabulary dùng ở UI"               "grep -rq 'keyVocabulary' src/components src/app/exam"
check "flag câu lỗi"                          "grep -rq 'flagged' src/lib/exam"
check "Grammar → drill RC5"                   "grep -rq 'exam/drill' src/components/Grammar*"

echo "── S6 Grading"
check "GRADING_PROVIDER trong route"          "grep -rq 'GRADING_PROVIDER' src/app/api"
check "pronunciation trả null"                "grep -q 'pronunciation' src/app/api/speech/grade/route.ts"

echo "── S7 Audio & shadowing"
check "IndexedDB cho audio"                   "grep -rq 'idb-keyval\|indexedDB' src/lib"
check "shadowing"                             "grep -rqi 'shadow' src/app src/lib"

echo "── S8 Parts"
for p in LC1 READ_P1 READ_P2 LISTEN_S2 LISTEN_S3 LISTEN_S4; do
  check "part $p" "grep -rq \"'$p'\" src/lib/exam"
done
EOF
chmod +x scripts/check-phase-6-7.sh
./scripts/check-phase-6-7.sh
```

Hướng dẫn: stream nào toàn ✅ thì mở file xác nhận nhanh rồi đánh dấu xong trong §10. Stream nào còn ❌ thì làm theo plan bên dưới.

```bash
git checkout -b phase-6-7-completion
```

---

## S1 — Sửa merge sync (🔴 bug mất dữ liệu)

### Vấn đề

Có hai lỗi chồng lên nhau trong `initSync()`:

1. **Merge theo `learnedAt`.** `learnedAt` chỉ được set một lần lúc lưu từ. Review SM-2 đổi `nextReviewAt`, `easiness`, `repetitions` nhưng không đổi `learnedAt`. Hai thiết bị luôn hoà nhau, nên bên thắng là ngẫu nhiên và tiến độ ôn bị ghi đè âm thầm.
2. **Thứ tự push-trước-pull.** Bước 1 upsert toàn bộ local lên remote *trước khi* merge. Thiết bị mở lại sau nhiều ngày sẽ đẩy dữ liệu cũ đè lên dữ liệu mới trên remote, trước khi kịp pull về.

Nếu bảng `learned_words` chưa có cột `easiness`/`repetitions`, thiết bị thứ hai pull về sẽ bị `migrateToSm2` reset EF về 2.5.

### 1.1 Supabase migration

```sql
-- supabase/migrations/20260921_sm2_updated_at.sql
alter table learned_words add column if not exists easiness      numeric default 2.5;
alter table learned_words add column if not exists repetitions   int     default 0;
alter table learned_words add column if not exists review_interval int;
alter table learned_words add column if not exists next_review_at timestamptz;
alter table learned_words add column if not exists mastery       int;
alter table learned_words add column if not exists updated_at    timestamptz;

update learned_words set updated_at = coalesce(updated_at, learned_at::timestamptz);

-- Tương tự cho các bảng mirror khác có thể bị sửa sau khi tạo
alter table grammar_topics add column if not exists updated_at timestamptz;
update grammar_topics set updated_at = coalesce(updated_at, created_at);
```

> Kiểm tra tên cột thực tế trong bảng hiện có trước khi chạy (`\d learned_words` trong psql hoặc Table Editor). Một số cột ở trên có thể đã tồn tại với tên khác.

### 1.2 `updatedAt` trên mọi mutation

```ts
// src/lib/storage.ts
export interface LearnedWord {
  // ... các field hiện có
  updatedAt?: string   // ISO — set ở MỌI mutation
}

export function touch<T extends { updatedAt?: string }>(x: T): T {
  return { ...x, updatedAt: new Date().toISOString() }
}
```

Áp dụng `touch()` ở mọi chỗ ghi `LearnedWord`:

```bash
grep -n "learnedWords" src/lib/storage.ts
# Mỗi hàm ghi (saveWord, updateWordReviewSm2, deleteWord → tombstone, editWord...) phải gọi touch()
```

```ts
export function updateWordReviewSm2(word: string, quality: 0 | 3 | 4 | 5) {
  const words = getLearnedWords()
  const i = words.findIndex(w => w.word === word)
  if (i < 0) return
  const next = sm2(toSrsState(words[i]), quality)
  words[i] = touch({ ...words[i], ...fromSrsState(next) })
  saveLearnedWords(words)
  pushWord(words[i])
}
```

`migrateToSm2` **không được** gọi `touch()`. Migration không phải là thay đổi của người dùng, nếu touch thì bản đã migrate sẽ thắng bản thật trên remote.

### 1.3 Merge generic + đổi thứ tự initSync

```ts
// src/lib/sync-merge.ts
export function stamp(x: { updatedAt?: string; learnedAt?: string; createdAt?: string }) {
  return x.updatedAt ?? x.learnedAt ?? x.createdAt ?? ''
}

/** Last-write-wins theo updatedAt. Hoà nhau → giữ local. */
export function mergeLww<T extends { updatedAt?: string }>(
  local: T[], remote: T[], keyOf: (t: T) => string,
): { merged: T[]; toPush: T[] } {
  const map = new Map<string, T>()
  for (const l of local) map.set(keyOf(l), l)

  for (const r of remote) {
    const k = keyOf(r)
    const l = map.get(k)
    if (!l || stamp(r) > stamp(l)) map.set(k, r)
  }

  const remoteByKey = new Map(remote.map(r => [keyOf(r), r]))
  const merged = [...map.values()]
  const toPush = merged.filter(m => {
    const r = remoteByKey.get(keyOf(m))
    return !r || stamp(m) > stamp(r)
  })
  return { merged, toPush }
}
```

```ts
// src/lib/sync.ts — initSync mới: PULL → MERGE → PUSH phần chênh lệch
export async function initSync() {
  const key = getSyncKey()

  const { data: remoteRows, error } = await supabase
    .from('learned_words').select('*').eq('sync_key', key)
  if (error) { console.warn('[sync] pull failed', error); return }

  const local = getLearnedWords().map(migrateToSm2)
  const remote = (remoteRows ?? []).map(rowToWord)

  const { merged, toPush } = mergeLww(local, remote, w => w.word.toLowerCase())
  saveLearnedWords(merged)

  if (toPush.length) {
    await supabase.from('learned_words')
      .upsert(toPush.map(w => wordToRow(w, key)), { onConflict: 'sync_key,word' })
  }
  // lặp lại pattern cho grammar_topics, custom_topics, user_settings, và các bảng S2/S4
}

function wordToRow(w: LearnedWord, key: string) {
  return {
    sync_key: key, word: w.word, meaning: w.meaning, example: w.example, topic: w.topic,
    learned_at: w.learnedAt, next_review_at: w.nextReviewAt ?? null,
    review_interval: w.reviewInterval ?? null, mastery: w.mastery ?? null,
    easiness: w.easiness ?? 2.5, repetitions: w.repetitions ?? 0,
    synonyms: w.synonyms ?? null, antonyms: w.antonyms ?? null,
    updated_at: w.updatedAt ?? w.learnedAt,
  }
}

function rowToWord(r: any): LearnedWord {
  return {
    word: r.word, meaning: r.meaning, example: r.example, topic: r.topic,
    learnedAt: r.learned_at, nextReviewAt: r.next_review_at ?? undefined,
    reviewInterval: r.review_interval ?? undefined, mastery: r.mastery ?? undefined,
    easiness: r.easiness != null ? Number(r.easiness) : undefined,
    repetitions: r.repetitions ?? undefined,
    synonyms: r.synonyms ?? undefined, antonyms: r.antonyms ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  }
}
```

> `onConflict: 'sync_key,word'` yêu cầu có unique constraint tương ứng. Kiểm tra bằng:
> `select conname from pg_constraint where conrelid = 'learned_words'::regclass;`
> Nếu chưa có: `alter table learned_words add constraint learned_words_key_word unique (sync_key, word);`

### 1.4 Delete không được "sống lại"

Hiện `deleteWord` là hard delete fire-and-forget. Sau khi đổi sang LWW, một thiết bị offline còn giữ từ đó sẽ đẩy nó lên lại. Hai lựa chọn:

- **Tombstone (khuyến nghị):** thêm `deletedAt?: string`. Xoá = `touch({ ...w, deletedAt: now })`. UI lọc `!w.deletedAt`. Merge LWW xử lý tự động.
- Chấp nhận rủi ro: với 2 người dùng và thao tác xoá hiếm, có thể để sau. Nếu chọn cách này thì ghi vào §10 Known issues.

### 1.5 Test

```ts
// src/lib/__tests__/sync-merge.test.ts
describe('mergeLww', () => {
  it('remote review mới hơn thắng dù learnedAt bằng nhau', () => { /* ... */ })
  it('local mới hơn → nằm trong toPush', () => { /* ... */ })
  it('hoà nhau → giữ local, không push', () => { /* ... */ })
  it('word chỉ có trên remote → merged có, toPush không', () => { /* ... */ })
  it('bản ghi thiếu updatedAt → fallback learnedAt', () => { /* ... */ })
  it('tombstone mới hơn thắng bản còn sống', () => { /* ... */ })
})
// src/lib/__tests__/storage.test.ts
it('migrateToSm2 không set updatedAt', () => { /* ... */ })
it('updateWordReviewSm2 set updatedAt', () => { /* ... */ })
```

**Commit:** `fix(sync): LWW merge by updatedAt, pull-before-push, sync SM-2 fields`

---

## S2 — Sync dữ liệu exam

### 2.1 DDL

```sql
-- supabase/migrations/20260921_exam_sync.sql

-- Bank dùng chung giữa 2 user: KHÔNG gắn sync_key
create table if not exists exam_items (
  id          text primary key,
  exam_type   text not null,
  part        text not null,
  level       text not null,
  payload     jsonb not null,          -- nguyên ExamItem, tránh đổi schema mỗi lần thêm field
  flagged     boolean default false,
  created_at  timestamptz default now()
);
create index if not exists exam_items_lookup on exam_items (exam_type, part, level) where not flagged;

create table if not exists exam_attempts (
  id          text primary key,
  sync_key    text not null,
  exam_type   text not null,
  part        text not null,
  level       text not null,
  started_at  timestamptz not null,
  finished_at timestamptz,
  answers     jsonb not null,
  score       jsonb,
  updated_at  timestamptz default now()
);
create index if not exists exam_attempts_user on exam_attempts (sync_key, started_at desc);

create table if not exists mistake_log (
  id          text primary key,
  sync_key    text not null,
  payload     jsonb not null,          -- MistakeEntry (bản đã slim ở S5)
  resolved    boolean default false,
  updated_at  timestamptz default now()
);
create index if not exists mistake_log_user on mistake_log (sync_key, resolved);
```

Lý do dùng cột `payload jsonb` cho `exam_items` và `mistake_log`: model exam vẫn đang thay đổi (S3 thêm `score`, S5 slim mistake). Chỉ tách ra cột riêng những field cần dùng để lọc.

### 2.2 Hàm sync

```ts
// src/lib/sync.ts — giữ phong cách fire-and-forget

export function pushExamItem(item: ExamItem) {
  void supabase.from('exam_items').upsert({
    id: item.id, exam_type: item.examType, part: item.part, level: String(item.level),
    payload: item,
  }, { onConflict: 'id', ignoreDuplicates: true })
}

export function pushAttempt(a: ExamAttempt) {
  void supabase.from('exam_attempts').upsert({
    id: a.id, sync_key: getSyncKey(), exam_type: a.examType, part: a.part, level: a.level,
    started_at: a.startedAt, finished_at: a.finishedAt, answers: a.answers,
    score: a.score ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
}

export function pushMistake(m: MistakeEntry) {
  void supabase.from('mistake_log').upsert({
    id: m.id, sync_key: getSyncKey(), payload: m, resolved: m.resolved,
    updated_at: m.updatedAt ?? new Date().toISOString(),
  }, { onConflict: 'id' })
}

/** Gọi TRƯỚC khi generate bằng AI. Trả về item chưa có trong bank local. */
export async function pullExamItems(examType: string, part: string, level: string, limit = 10) {
  const { data } = await supabase.from('exam_items')
    .select('payload').eq('exam_type', examType).eq('part', part).eq('level', level)
    .eq('flagged', false).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []).map(r => r.payload as ExamItem)
}
```

### 2.3 Tích hợp

| Chỗ gọi | Thêm |
|---|---|
| Sau khi `/api/exam/generate-item` trả về và lưu `examBank` | `pushExamItem(item)` |
| Trước khi gọi generate trong drill/mock | `pullExamItems(...)` → nạp vào bank, chỉ gọi AI khi bank cạn |
| `finishAttempt` / `saveAttempt` | `pushAttempt(a)` |
| `saveMistake`, `resolveMistake` | `pushMistake(m)` |
| `initSync()` | pull `exam_attempts` + `mistake_log` theo `sync_key`, merge bằng `mergeLww` |

```bash
grep -rn "generate-item" src/app/exam src/components   # tìm chỗ gọi để chèn pullExamItems
grep -n  "export function" src/lib/exam/exam-storage.ts
```

### 2.4 Test

- `pullExamItems` không trả item `flagged`
- Merge attempts: attempt chỉ có ở remote → xuất hiện local, và giới hạn max 100 vẫn giữ đúng
- Bank đầy (30/key) + pull thêm 10 → `pruneBank` vẫn giữ tối đa 30

**Commit:** `feat(sync): exam items (shared bank), attempts, mistake log`

---

## S3 — Scoring TOEIC/IELTS + trang result

### 3.1 Mở rộng model

```ts
// src/lib/exam/types.ts
export interface ScoreResult {
  raw: { correct: number; total: number }
  byType: Record<string, { correct: number; total: number }>
  toeic?: { section: 'LC' | 'RC'; scaled: number }
  ielts?: { skill: 'listening' | 'reading'; band: number }
}

export interface ExamAttempt {
  // ... field hiện có
  score?: ScoreResult
  mode?: 'drill' | 'mock'
}
```

### 3.2 `src/lib/exam/scoring.ts`

```ts
import type { ExamAttempt, ScoreResult } from './types'

/** Nội suy tuyến tính. KHÔNG phải bảng ETS/IDP chính thức — chỉ để theo dõi xu hướng. */
const TOEIC_LC: [number, number][] = [
  [0,5],[10,40],[20,85],[30,130],[40,185],[50,255],[60,315],[70,370],[80,415],[90,460],[96,495],[100,495],
]
const TOEIC_RC: [number, number][] = [
  [0,5],[10,25],[20,65],[30,115],[40,170],[50,225],[60,280],[70,335],[80,390],[90,445],[96,490],[100,495],
]
const IELTS_READING: [number, number][] = [
  [39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],
]
const IELTS_LISTENING: [number, number][] = [
  [39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[6,3.5],[4,3],
]

function interpolate(anchors: [number, number][], x: number) {
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i]
    if (x <= x1) return Math.round((y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)) / 5) * 5
  }
  return anchors[anchors.length - 1][1]
}

export function toeicScaled(correct: number, total: number, section: 'LC' | 'RC') {
  if (total === 0) return 5
  return interpolate(section === 'LC' ? TOEIC_LC : TOEIC_RC, (correct / total) * 100)
}

export function ieltsBand(correct: number, total: number, skill: 'listening' | 'reading') {
  if (total === 0) return 0
  const of40 = Math.round((correct / total) * 40)
  const table = skill === 'reading' ? IELTS_READING : IELTS_LISTENING
  return table.find(([r]) => of40 >= r)?.[1] ?? 2.5
}

export function sectionOf(part: string): { exam: 'TOEIC' | 'IELTS'; section: 'LC' | 'RC' } {
  if (part.startsWith('LC')) return { exam: 'TOEIC', section: 'LC' }
  if (part.startsWith('RC')) return { exam: 'TOEIC', section: 'RC' }
  if (part.startsWith('LISTEN')) return { exam: 'IELTS', section: 'LC' }
  return { exam: 'IELTS', section: 'RC' }
}

/** Mẫu quá nhỏ thì không quy đổi — tránh hiện "TOEIC 495" sau 3 câu đúng */
export const MIN_ANSWERS_FOR_SCALED = 10

export function scoreAttempt(a: ExamAttempt): ScoreResult {
  const correct = a.answers.filter(x => x.correct).length
  const total = a.answers.length
  const byType: ScoreResult['byType'] = {}
  for (const x of a.answers) {
    byType[x.type] ??= { correct: 0, total: 0 }
    byType[x.type].total++
    if (x.correct) byType[x.type].correct++
  }

  const result: ScoreResult = { raw: { correct, total }, byType }
  if (total < MIN_ANSWERS_FOR_SCALED) return result

  const { exam, section } = sectionOf(a.part)
  if (exam === 'TOEIC') result.toeic = { section, scaled: toeicScaled(correct, total, section) }
  else result.ielts = {
    skill: section === 'LC' ? 'listening' : 'reading',
    band: ieltsBand(correct, total, section === 'LC' ? 'listening' : 'reading'),
  }
  return result
}
```

> Mock test có nhiều part: nếu `ExamAttempt.part` hiện là một chuỗi đơn, mock cần lưu `part = 'MOCK'` và scoring gom `answers` theo part của từng câu. Cần kiểm tra `AnswerRecord` có field `part` chưa. Nếu chưa, thêm `part` vào mỗi answer khi ghi.

### 3.3 Backfill attempt cũ

```ts
// chạy một lần khi mount /exam hoặc /stats
export function backfillScores() {
  const attempts = getAttempts()
  let changed = false
  for (const a of attempts) if (!a.score && a.finishedAt) { a.score = scoreAttempt(a); changed = true }
  if (changed) saveAttempts(attempts)
}
```

### 3.4 Trang result

```bash
mkdir -p "src/app/exam/result/[attemptId]"
touch "src/app/exam/result/[attemptId]/page.tsx" src/components/exam/ResultBreakdown.tsx
```

Nội dung trang:

- Header: điểm scaled/band lớn, kèm raw `x/y`. Dòng disclaimer nhỏ: *"Điểm ước lượng từ đề AI sinh, không phải điểm chính thức."*
- Nếu `total < 10`: hiện "Cần ít nhất 10 câu để quy đổi điểm" thay cho điểm scaled.
- `ResultBreakdown`: bảng accuracy theo `QuestionType`, sắp xếp từ thấp đến cao.
- Danh sách câu sai → link sang `/exam/mistakes?attempt=<id>`.
- Nút: "Thêm từ khó vào flashcard" (S5), "Làm lại part này".

Drill và mock khi kết thúc: `router.push(\`/exam/result/${attempt.id}\`)`.

### 3.5 Test

```ts
// src/lib/exam/__tests__/scoring.test.ts
it('toeicScaled biên: 0 → 5, 100% → 495', ...)
it('toeicScaled luôn là bội số của 5', ...)
it('ieltsBand reading 30/40 → 7, 29/40 → 6.5', ...)
it('ieltsBand listening 32/40 → 7.5', ...)
it('scoreAttempt < 10 câu → không có toeic/ielts', ...)
it('byType gom đúng', ...)
it('total = 0 không chia cho 0', ...)
```

**Commit:** `feat(exam): scaled scoring + result page + backfill`

---

## S4 — Lịch sử Speaking/Writing + band timeline

### 4.1 Hiện trạng cần xác nhận trước

`/write/result/[id]` phải lấy dữ liệu từ đâu đó. Kiểm tra:

```bash
grep -rn "localStorage\|sessionStorage\|getSession" "src/app/write/result/[id]/page.tsx"
grep -rn "metadata" src/app/speak src/app/write | head
```

Nếu feedback đang nằm trong `LearningSession.metadata` thì không cần tạo storage mới. Chỉ cần viết selector đọc từ đó và bỏ qua §4.2. Tuy vậy, giới hạn max 500 session áp chung cho mọi hoạt động nên lịch sử band sẽ bị đẩy ra khỏi bộ nhớ khá nhanh. Nên tách riêng.

### 4.2 Storage

```ts
// src/lib/speech/speaking-storage.ts
export interface SpeakingRecord {
  id: string
  mode: 'ielts_p1' | 'ielts_p2' | 'ielts_p3' | 'roleplay' | 'shadowing'
  prompt: string
  transcript: string
  durationSec: number
  feedback: SpeakingFeedback          // từ src/lib/speech/types.ts
  audioId?: string                    // S7
  createdAt: string
  updatedAt?: string
}
const KEY = 'speakingSessions', MAX = 200

export function saveSpeaking(r: SpeakingRecord) {
  const all = getSpeaking().filter(x => x.id !== r.id)
  all.unshift(touch(r))
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)))
  localStorage.setItem('lastSpeakingAt', r.createdAt)
  pushSpeaking(all[0])
}
export function getSpeaking(): SpeakingRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
```

`src/lib/write/writing-storage.ts` làm tương tự, với key `writingSubmissions` và `WritingRecord { id, kind, prompt, chartData?, content, wordCount, feedback, createdAt, updatedAt? }`.

Sau khi có storage này, `lastSpeakingAt`/`lastWritingAt` trở thành dữ liệu dẫn xuất. `/today` có thể đọc `getSpeaking()[0]?.createdAt`, và nên làm vậy để hai giá trị không lệch nhau khi sync.

### 4.3 DDL

```sql
-- supabase/migrations/20260921_speaking_writing.sql
create table if not exists speaking_sessions (
  id text primary key, sync_key text not null, mode text not null,
  payload jsonb not null, overall numeric, created_at timestamptz not null,
  updated_at timestamptz default now()
);
create index if not exists speaking_user on speaking_sessions (sync_key, created_at desc);

create table if not exists writing_submissions (
  id text primary key, sync_key text not null, kind text not null,
  payload jsonb not null, overall numeric, created_at timestamptz not null,
  updated_at timestamptz default now()
);
create index if not exists writing_user on writing_submissions (sync_key, created_at desc);
```

Tách cột `overall` ra để sau này có thể vẽ timeline bằng query mà không cần parse jsonb.

### 4.4 Charts

```bash
touch src/components/charts/BandTimelineChart.tsx src/components/charts/SkillRadar.tsx
touch src/lib/stats-skills.ts
```

```ts
// src/lib/stats-skills.ts
export interface WeeklyBand { week: string; speaking?: number; writing?: number; reading?: number; listening?: number }

/** Trung bình band theo tuần ISO, 12 tuần gần nhất. Reading/Listening lấy từ attempt IELTS có score. */
export function weeklyBands(weeks = 12): WeeklyBand[] { /* group by weekKey(createdAt) → avg */ }

/** Radar 4 kỹ năng, chuẩn hoá về 0–100 để so sánh được giữa TOEIC và IELTS.
 *  - L/R: accuracy % của 20 câu gần nhất (mọi exam)
 *  - S/W: overall band trung bình 5 bài gần nhất / 9 × 100
 *  Trả null cho kỹ năng chưa đủ mẫu — radar vẽ trống, không vẽ 0. */
export function skillRadar(): { skill: 'L' | 'R' | 'S' | 'W'; value: number | null; samples: number }[] {
  /* ... */
}
```

Hai chart đều dùng `recharts`, cùng pattern với `WeaknessRadar`. Đặt chúng ở `/stats` phía trên `ExamAccuracyChart`.

Quy tắc "trả null, không trả 0" là quan trọng. Nếu vẽ 0 cho Writing khi chưa viết bài nào, radar sẽ trông như điểm yếu thật và `/today` có thể hiểu sai.

### 4.5 Test

- `saveSpeaking` giới hạn 200, newest-first, cập nhật `lastSpeakingAt`
- `weeklyBands` bỏ tuần không có dữ liệu thay vì trả 0
- `skillRadar` trả `null` khi `samples === 0`

**Commits:**
- `feat(speak,write): persist history + sync tables`
- `feat(stats): band timeline + 4-skill radar`

---

## S5 — Mistake → SRS, flag câu lỗi, slim MistakeEntry

### 5.1 Slim `MistakeEntry`

Hiện mỗi entry lưu nguyên `question: ExamItem`. Một item P7 nặng khoảng 5 KB, nên vài trăm lỗi sẽ chiếm hơn 1 MB localStorage.

```ts
// src/lib/exam/types.ts
export interface MistakeEntry {
  id: string
  itemId: string
  questionId: string
  type: QuestionType
  part: string
  /** Snapshot tối thiểu để hiện trong sổ lỗi mà không cần tra bank */
  snapshot: {
    prompt: string
    options?: string[]
    answer: string
    explanation: string
    keyVocabulary?: string[]
    context?: string        // ≤ 300 ký tự quanh đáp án, cắt từ passage/script
  }
  userAnswer: string
  resolved: boolean
  timestamp: string
  updatedAt?: string
  /** @deprecated — chỉ còn ở dữ liệu cũ, bị xoá sau migrateMistakes() */
  question?: ExamItem
}
```

```ts
// src/lib/exam/exam-storage.ts
export function migrateMistakes() {
  const list = getMistakes()
  let changed = false
  for (const m of list) {
    if (!m.question) continue
    const q = m.question.questions.find(q => q.id === m.questionId)
    if (!q) continue
    m.itemId = m.question.id
    m.part = m.question.part
    m.snapshot = {
      prompt: q.prompt, options: q.options, answer: q.answer,
      explanation: q.explanation, keyVocabulary: q.keyVocabulary,
      context: excerptAround(m.question.passage ?? scriptText(m.question), q.answer, 300),
    }
    upsertBankItem(m.question)   // giữ item gốc trong bank để "làm lại" còn đủ passage
    delete m.question
    changed = true
  }
  if (changed) saveMistakes(list)
}
```

### 5.2 `pruneBank` không được xoá item đang có lỗi chưa resolve

```ts
export function pruneBank(bank: Record<string, ExamItem[]>, max = 30) {
  const pinned = new Set(getMistakes().filter(m => !m.resolved).map(m => m.itemId))
  for (const k of Object.keys(bank)) {
    const sorted = bank[k].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const keep = sorted.filter(i => pinned.has(i.id))
    const rest = sorted.filter(i => !pinned.has(i.id)).slice(0, Math.max(0, max - keep.length))
    bank[k] = [...keep, ...rest]
  }
  return bank
}
```

Nếu item vẫn thiếu khi làm lại (ví dụ bank bị xoá trên thiết bị khác), fallback sang `pullExamItems` theo `itemId` từ Supabase (S2).

### 5.3 Bridge mistake → SRS

```bash
touch src/components/exam/AddVocabModal.tsx
```

```ts
// src/lib/exam/vocab-bridge.ts
export function collectVocabFromMistakes(mistakes: MistakeEntry[]) {
  const existing = new Set(getLearnedWords().map(w => w.word.toLowerCase()))
  const out = new Map<string, { word: string; context: string; part: string }>()
  for (const m of mistakes) for (const v of m.snapshot.keyVocabulary ?? []) {
    const k = v.toLowerCase().trim()
    if (!existing.has(k) && !out.has(k))
      out.set(k, { word: v, context: m.snapshot.context ?? m.snapshot.prompt, part: m.part })
  }
  return [...out.values()]
}
```

Luồng xử lý: trang result (S3) → nút **"Thêm N từ khó vào flashcard"** → `AddVocabModal` hiện checklist, mặc định chọn hết → với các từ được chọn, gọi `/api/generate-words` hoặc một route nhẹ để lấy `meaning` tiếng Việt → `saveWord({ word, meaning, example: context, topic: \`exam:${part}\`, ... })`. Từ mới đi vào SM-2 như bình thường.

Nên dùng một route riêng `/api/exam/define` nhận tối đa 10 từ trong 1 call để tiết kiệm quota, thay vì gọi mỗi từ một lần.

### 5.4 Flag câu lỗi

```ts
// exam-storage.ts
export function flagItem(itemId: string) {
  const bank = getBank()
  for (const k of Object.keys(bank)) bank[k] = bank[k].filter(i => i.id !== itemId)
  saveBank(bank)
  const flagged = new Set<string>(JSON.parse(localStorage.getItem('flaggedItems') ?? '[]'))
  flagged.add(itemId)
  localStorage.setItem('flaggedItems', JSON.stringify([...flagged]))
  void supabase.from('exam_items').update({ flagged: true }).eq('id', itemId)
}
```

UI: icon 🚩 ở góc `QuestionCard` và trong trang result → confirm → `flagItem`. Câu đã flag trong attempt hiện tại **không tính vào điểm**: lọc ra trước khi gọi `scoreAttempt`.

Vì bank dùng chung, một người flag thì người kia cũng không gặp lại câu đó.

### 5.5 Grammar → Part 5

```tsx
// GrammarContent.tsx — trong mỗi sub-rule, cạnh nút "Bài tập"
<Link href={`/exam/drill/RC5?topic=${encodeURIComponent(rule.name)}`}
      className="text-sm underline">Luyện TOEIC Part 5</Link>
```

Drill page đọc `searchParams.topic` và truyền vào `/api/exam/generate-item`. Nhớ **không** cache item có topic ngữ pháp vào bank chung với key thường. Dùng key `TOEIC:RC5:3:grammar=<slug>` để không làm lệch phân bố đề drill thông thường.

### 5.6 Test

- `migrateMistakes` idempotent: chạy 2 lần cho cùng kết quả, sau lần đầu không còn `question`
- `pruneBank` giữ item được pin kể cả khi vượt `max`
- `collectVocabFromMistakes` bỏ từ đã có trong `learnedWords`, không phân biệt hoa thường
- `flagItem` xoá khỏi mọi key của bank

**Commits:**
- `refactor(exam): slim MistakeEntry + migration + pinned prune`
- `feat(exam): mistake vocab → SRS bridge`
- `feat(exam): flag bad items (shared)`
- `feat(grammar): link sub-rule to RC5 drill`

---

## S6 — Ổn định chấm band

### 6.1 Pin provider

`callWithFallback` có thể chuyển sang provider khác khi gặp 429. Với chấm band, điều này khiến hai bài giống nhau nhận band lệch nhau chỉ vì model khác nhau.

```ts
// src/app/api/speech/grade/route.ts  và  src/app/api/write/grade/route.ts
const GRADING = process.env.GRADING_PROVIDER            // ví dụ 'gemini'
const preferred = GRADING ?? body.provider
const { text, providerUsed } = await callWithFallback(prompt, preferred, body.disabledProviders)

return NextResponse.json({ ...feedback, gradedBy: providerUsed }, {
  headers: { 'X-Provider-Used': providerUsed },
})
```

Lưu `gradedBy` vào `SpeakingRecord.feedback`/`WritingRecord.feedback`. `BandTimelineChart` (S4) có thể đánh dấu những điểm được chấm bởi provider khác với `GRADING_PROVIDER` bằng tooltip "chấm bởi provider dự phòng".

```bash
echo 'GRADING_PROVIDER=gemini' >> .env.local
```

### 6.2 Temperature

Kiểm tra `callWithFallback` có nhận option không:

```bash
grep -n "export async function callWithFallback" -A 10 src/lib/providers/index.ts
```

Nếu chưa có, thêm tham số thứ tư và truyền xuống từng provider:

```ts
export async function callWithFallback(
  prompt: string, preferredId?: string, disabledIds?: string[],
  opts: { temperature?: number } = {},
)
// gemini.ts: generationConfig: { temperature: opts.temperature ?? 0.7 }
// openai-compat.ts: body.temperature = opts.temperature ?? 0.7
```

Các route chấm điểm gọi với `{ temperature: 0.2 }`.

### 6.3 Few-shot anchor

```bash
mkdir -p src/lib/grading
touch src/lib/grading/anchors.ts
```

```ts
// src/lib/grading/anchors.ts
/** 2 mẫu cố định band 6 và band 8 cho mỗi dạng. Tự viết hoặc lấy từ bài của chính mình đã được giáo viên chấm.
 *  KHÔNG copy bài mẫu có bản quyền. */
export const WRITING_T2_ANCHORS = [
  { band: 6, essay: `...`, why: 'Task response đủ nhưng ý phát triển mỏng; lỗi mạo từ lặp lại.' },
  { band: 8, essay: `...`, why: 'Lập luận rõ, từ vựng chính xác, lỗi hiếm.' },
]
export const SPEAKING_P2_ANCHORS = [ /* transcript + band + why */ ]
```

Chèn vào prompt chấm điểm, trước bài của người học:

```
Calibration examples (do not grade these, use them as reference points):
[BAND 6] ... — reason: ...
[BAND 8] ... — reason: ...
```

### 6.4 Pronunciation

```bash
grep -n "pronunciation" src/app/api/speech/grade/route.ts src/lib/speech/types.ts
```

Chuẩn cần đạt: `pronunciation: number | null`. Prompt ghi rõ "Do NOT score pronunciation". Zod schema cho phép `null`. UI hiện "—" kèm tooltip "Không chấm được phát âm từ bản ghi chữ". Nếu route đang trả số cho pronunciation thì sửa lại, vì điểm đó không có cơ sở.

### 6.5 Kiểm tra độ ổn định (thủ công)

```bash
# chấm cùng 1 bài 5 lần, xem độ lệch
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3000/api/write/grade \
    -H 'Content-Type: application/json' \
    -d @scripts/fixtures/essay-t2.json | jq '.overall'
done
```

Mục tiêu: 5 lần chấm lệch nhau không quá 0.5 band. Nếu lệch 1 band trở lên thì tăng số anchor hoặc hạ temperature.

**Commit:** `feat(grading): pin provider, low temperature, calibration anchors`

---

## S7 — Audio replay + Shadowing

### 7.1 Lưu audio vào IndexedDB

```bash
npm i idb-keyval
touch src/lib/speech/audio-store.ts
```

```ts
// src/lib/speech/audio-store.ts
import { get, set, del } from 'idb-keyval'

const INDEX_KEY = 'audioIndex'   // string[] newest-first
const MAX = 20

export async function saveAudio(id: string, blob: Blob) {
  await set(`audio:${id}`, blob)
  const index: string[] = (await get(INDEX_KEY)) ?? []
  const next = [id, ...index.filter(x => x !== id)]
  for (const old of next.slice(MAX)) await del(`audio:${old}`)
  await set(INDEX_KEY, next.slice(0, MAX))
}

export const loadAudio = (id: string) => get<Blob>(`audio:${id}`)

export async function clearAllAudio() {
  const index: string[] = (await get(INDEX_KEY)) ?? []
  await Promise.all(index.map(id => del(`audio:${id}`)))
  await set(INDEX_KEY, [])
}
```

Tích hợp:

- `/speak/ielts/[part]`: sau khi `recorder.stop()` → `saveAudio(record.id, blob)` → `record.audioId = record.id`.
- Trang kết quả speaking: `<audio controls src={URL.createObjectURL(blob)} />`. Nhớ gọi `URL.revokeObjectURL` khi unmount.
- `/settings` → tab Voice: thêm nút **"Xoá bản ghi âm (N)"** → `clearAllAudio()`.

Audio **không sync** lên Supabase. Với 2 người dùng, nghe lại trên chính thiết bị đã ghi là đủ.

### 7.2 Shadowing mode

```bash
mkdir -p src/app/speak/shadowing
touch src/app/speak/shadowing/page.tsx src/lib/speech/word-diff.ts
```

```ts
// src/lib/speech/word-diff.ts — so khớp LCS theo từ
export function diffWords(target: string, spoken: string) {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean)
  const a = norm(target), b = norm(spoken)

  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])

  const tokens: { word: string; ok: boolean }[] = []
  let i = 0, j = 0
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) { tokens.push({ word: a[i], ok: true }); i++; j++ }
    else if (j < b.length && dp[i][j + 1] >= dp[i + 1][j]) j++
    else { tokens.push({ word: a[i], ok: false }); i++ }
  }
  return { tokens, accuracy: a.length ? tokens.filter(t => t.ok).length / a.length : 0 }
}
```

Luồng một câu:

1. Lấy câu mẫu. Nguồn ưu tiên: `example` của các từ SRS đến hạn, sau đó đến câu trong `script` của item LC gần nhất. Không cần gọi AI.
2. Phát TTS (dùng lại `voiceSettings`), cho phép phát lại ở rate 0.8.
3. Ghi âm → `/api/speech/transcribe` → `diffWords` → hiện từng từ màu xanh/đỏ và % accuracy.
4. Cho thử lại tối đa 3 lần/câu, lưu lần tốt nhất.
5. Kết thúc 10 câu → `saveSpeaking({ mode: 'shadowing', ... })` và `finishSession`.

Shadowing không gọi `/api/speech/grade`, nên không tốn quota LLM mà chỉ tốn quota Whisper.

Thêm card "Shadowing" vào `/speak/page.tsx`. Cho `/today` đề xuất shadowing khi `lastSpeakingAt` quá 2 ngày và thời gian người dùng chọn ≤ 15 phút.

### 7.3 Test

- `diffWords('I went to the bank', 'I want to bank')` → `went` và `the` sai, accuracy 0.6
- `diffWords` không phân biệt hoa thường và dấu câu
- Input rỗng không crash

**Commits:**
- `feat(speak): persist audio in IndexedDB + replay`
- `feat(speak): shadowing mode`

---

## S8 — Mở rộng part

Làm từng part một. Mỗi part cần 4 việc: prompt template, zod schema cho question type, renderer trong `QuestionCard`, và 1 test cho schema.

| Part | Question type mới | Ghi chú |
|---|---|---|
| READ_P1 | `true_false_ng` | Options cố định `['TRUE','FALSE','NOT GIVEN']`. Prompt phải ép ít nhất 1 câu NOT GIVEN |
| READ_P2 | `matching_headings` | Passage chia đoạn A–F, đưa list heading dư 2 cái. Renderer là dropdown mỗi đoạn |
| LISTEN_S2 | `mcq` + `sentence_completion` | Monologue 1 người, dùng giọng NARRATOR |
| LISTEN_S3 | `mcq` | 2–3 người, học thuật |
| LISTEN_S4 | `summary_completion` | Lecture, chấm bằng `isCompletionCorrect` (có sẵn từ roadmap) |
| LC1 | `photo_description` | v1 render `imagePrompt` thành đoạn mô tả bằng chữ, TTS đọc 4 câu A–D. Ghi rõ trên UI là bản không có ảnh |

```bash
grep -n "case '" src/components/exam/QuestionCard.tsx   # xem type nào đã có renderer
grep -n "RC5\|LC2" src/lib/exam/*.ts                     # xem nơi đăng ký part
```

Thứ tự khuyến nghị: READ_P1 → LISTEN_S2 → READ_P2 → LISTEN_S3/S4 → LC1. IELTS Reading P1 dùng nhiều nhất và dễ làm nhất. LC1 để cuối vì thiếu ảnh nên giá trị thấp.

**Commit mỗi part:** `feat(exam): add <PART> (<question_type>)`

---

## S9 — Cập nhật APP_OVERVIEW.md

Làm cuối cùng, sau khi mọi stream khác đã merge.

- [ ] §7: thêm các key `speakingSessions`, `writingSubmissions`, `flaggedItems`. Ghi chú `lastSpeakingAt`/`lastWritingAt` là dẫn xuất. Thêm IndexedDB `audio:*`
- [ ] §8: thêm 5 bảng mới (`exam_items`, `exam_attempts`, `mistake_log`, `speaking_sessions`, `writing_submissions`). Cập nhật mô tả `initSync` thành "pull → LWW merge theo `updatedAt` → push phần chênh lệch"
- [ ] §6: cập nhật `MistakeEntry` (dạng slim), `ExamAttempt.score`, `LearnedWord.updatedAt`/`deletedAt`
- [ ] §10: đánh dấu fixed bug merge SM-2. Thêm known issue "điểm scaled là ước lượng"
- [ ] §11: thêm mục **Phase 6 ✅** và **Phase 7 ✅**. Chuyển các mục chưa làm (ví dụ LC1) sang backlog
- [ ] §12: thêm các file mới (`scoring.ts`, `sync-merge.ts`, `audio-store.ts`, `word-diff.ts`, `stats-skills.ts`, `grading/anchors.ts`, trang result, trang shadowing)
- [ ] §13: cập nhật số test
- [ ] Sửa chữ "WebRTC" trong §4 và §12 thành "MediaRecorder". Recorder không dùng WebRTC

**Commit:** `docs: update APP_OVERVIEW for phase 6/7 completion`

---

## 10. Thứ tự commit tổng

| # | Stream | Commit | Phụ thuộc |
|---|---|---|---|
| 1 | S1 | `fix(sync): LWW merge by updatedAt, pull-before-push, sync SM-2 fields` | — |
| 2 | S2 | `feat(sync): exam items (shared bank), attempts, mistake log` | 1 |
| 3 | S3 | `feat(exam): scaled scoring + result page + backfill` | — |
| 4 | S5 | `refactor(exam): slim MistakeEntry + migration + pinned prune` | 2 |
| 5 | S5 | `feat(exam): mistake vocab → SRS bridge` | 3, 4 |
| 6 | S5 | `feat(exam): flag bad items (shared)` | 2 |
| 7 | S5 | `feat(grammar): link sub-rule to RC5 drill` | — |
| 8 | S6 | `feat(grading): pin provider, low temperature, calibration anchors` | — |
| 9 | S4 | `feat(speak,write): persist history + sync tables` | 1, 8 |
| 10 | S4 | `feat(stats): band timeline + 4-skill radar` | 3, 9 |
| 11 | S7 | `feat(speak): persist audio in IndexedDB + replay` | 9 |
| 12 | S7 | `feat(speak): shadowing mode` | 11 |
| 13+ | S8 | `feat(exam): add <PART>` (mỗi part một commit) | 3 |
| cuối | S9 | `docs: update APP_OVERVIEW for phase 6/7 completion` | tất cả |

Nên làm S6 (commit 8) trước S4 (commit 9). Như vậy lịch sử band được lưu từ đầu đã là điểm chấm ổn định, không bị lẫn dữ liệu chấm bởi nhiều provider khác nhau.

Sau mỗi commit:

```bash
npm test && npm run lint && npm run build && ./scripts/check-phase-6-7.sh
```

---

## 11. Definition of Done — đóng Phase 6 & 7

**Sync & dữ liệu**
- [ ] Ôn 10 từ trên thiết bị A → mở thiết bị B → EF và `nextReviewAt` khớp với A
- [ ] Mở thiết bị có dữ liệu cũ 1 tuần → không ghi đè tiến độ mới hơn trên remote
- [ ] Người dùng 1 generate đề → người dùng 2 mở cùng part/level → nhận đề từ bank, không gọi AI
- [ ] Sổ lỗi và lịch sử attempt hiện đầy đủ trên cả 2 thiết bị

**Exam**
- [ ] Kết thúc drill ≥ 10 câu → trang result hiện điểm scaled/band và bảng accuracy theo type
- [ ] Từ khó trong câu sai thêm được vào flashcard trong 2 click
- [ ] Câu bị flag không xuất hiện lại cho cả 2 người và không tính vào điểm
- [ ] Làm lại một lỗi cũ vẫn có đủ passage/script

**Speaking & Writing**
- [ ] Xem lại được toàn bộ bài nói/viết trước đây kèm band
- [ ] Chấm cùng 1 bài 5 lần lệch không quá 0.5 band
- [ ] Nghe lại được 20 bản ghi âm gần nhất
- [ ] Hoàn thành 1 phiên shadowing 10 câu

**Stats**
- [ ] Band timeline 12 tuần cho S/W/R/L
- [ ] Radar 4 kỹ năng, kỹ năng chưa có dữ liệu vẽ trống chứ không vẽ 0

**Chất lượng**
- [ ] `npm test` ≥ 290 test (hiện 237)
- [ ] `./scripts/check-phase-6-7.sh` toàn ✅ cho S1–S7
- [ ] `APP_OVERVIEW.md` phản ánh đúng trạng thái
