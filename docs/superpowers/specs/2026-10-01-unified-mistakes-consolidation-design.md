# Stabilize + Unified Mistakes — Design

Sub-project 1 of `docs/requirement/ENGLISH_STUDY_APP_DEVELOPMENT_PLAN.md` (Phase 0 + Phase 1).

## Goal

`unifiedMistakes` là source of truth duy nhất cho sổ lỗi. `mistakeLog` chỉ còn là nguồn migration một lần. Resolve ở bất kỳ UI nào (`/mistakes`, `/exam/mistakes`) cập nhật cùng một entity.

## Success criteria

- Resolve ở `/exam/mistakes` thì `/mistakes`, `/path`, `/today`, `/library` thấy ngay; ngược lại cũng vậy.
- Không còn ghi `mistakeLog` hoặc `mistake_log` (Supabase) sau migration.
- Dữ liệu `mistakeLog` cũ không mất, không nhân đôi; backup còn trong localStorage.
- `npm test`, `npm run build`, `npm run lint` pass; không regress mock/drill exam.

## Part A — Phase 0 (repo stabilization)

Việc git, làm trước code. Mỗi bước hỏi user trước khi commit.

1. `git status` / `git diff`, phân loại: finished / unfinished / generated.
2. Commit theo nhóm: migration rename (`chore`), unified mistakes sync + mastery-all (`feat`), docs/plans (`docs`), scripts + supabase config (`chore`).
3. Chạy `npm test && npm run build && npm run lint`, ghi baseline (kỳ vọng 342 tests / 64 suites; nếu khác thì tìm nguyên nhân trước).
4. Xác nhận `supabase start` + migrations chạy sạch (đã làm 2026-09-30; chỉ re-check nếu migration đổi).

## Part B — Phase 1 (unified mistakes)

### Data model (`src/lib/mistakes.ts`)

Thêm trường optional vào `UnifiedMistake`:

```ts
exam?: { itemId: string; questionId: string; part: ExamPart; type: QuestionType; prompt: string };
```

`addMistake(input)` nhận thêm `exam?`. Dedupe giữ nguyên (`source + category`, chưa resolved): gặp lại thì `occurrenceCount++`, cập nhật `userAnswer`, `explanation`, `updatedAt`; trường `exam` giữ bản mới nhất. Resolve rồi sai lại thì tạo dòng mới.

Thêm `getExamMistakes()` = `getMistakes().filter(m => m.exam)` và `getUnresolvedExamMistakes()`.

### exam-storage becomes an adapter (`src/lib/exam/exam-storage.ts`)

- `addMistake(entry: MistakeEntry)` giữ chữ ký (để `ExamRunner` không đổi); bên trong chỉ gọi `mistakes.addMistake({..., exam})`. Bỏ ghi `mistakeLog`, bỏ `pushMistake`. Đánh dấu `@deprecated` và ghi chú dùng `mistakes.ts` cho code mới.
- `getMistakes` / `resolveMistake` / `getUnresolvedMistakes` ở exam-storage bị xóa; caller đổi sang `mistakes.ts`.
- `pruneBank` lấy `itemId` pin từ `getUnresolvedExamMistakes()`.

### Callers

- `/exam/mistakes/page.tsx`: đọc `getExamMistakes()`, hiển thị `exam.type`, `exam.prompt`, `exam.part`, thêm badge `occurrenceCount` khi > 1; resolve qua `mistakes.resolveMistake`. `status === "resolved"` thay `resolved`.
- `/exam/page.tsx`: đếm bằng `getUnresolvedExamMistakes().length`.
- `ExamRunner.tsx`: không đổi.
- `/today`, `/mistakes`, `/library`, `/path`: đã đọc unified, không đổi.

### Migration (`src/lib/mistake-migration.ts`, mới)

`migrateLegacyMistakes(legacy: MistakeEntry[], unified: UnifiedMistake[]): UnifiedMistake[]` — hàm thuần, deterministic.

1. Nhóm legacy theo `source = exam:${part}:${questionId}` + `category = type` + `resolved`.
2. Nếu unified đã có mục cùng `source+category` (do dual-write cũ đã đếm rồi) thì **không cộng thêm**. Riêng nếu nhóm legacy đều `resolved` mà mục unified chưa resolved, thì resolve mục unified (user đã resolve ở UI exam), giữ `reviewedAt` từ legacy.
3. Nếu chưa có thì tạo mục mới: `id` = id của entry legacy mới nhất trong nhóm (để nhiều thiết bị hội tụ dưới LWW, không nhân đôi), `occurrenceCount` = số entry trong nhóm, `createdAt` = sớm nhất, `userAnswer`/`explanation`/`updatedAt` = mới nhất, `exam` điền từ legacy.
4. Mục unified cũ chưa có `exam` mà khớp legacy thì bổ sung `exam` (để hiện ở `/exam/mistakes`).

`runMistakeMigration()` (client, idempotent):
- Cờ `mistakeLogMigrated` (localStorage). Nếu đã set thì return.
- Backup: `localStorage.mistakeLogBackup = mistakeLog` (nếu chưa có).
- Đọc `mistakeLog`, gọi hàm thuần, `saveMistakes(result)`, `pushUnifiedMistake` cho mục thay đổi, set cờ. Không xóa `mistakeLog`.
- Gọi từ `initSync()` trước bước merge unified, và từ `SyncInit` để chạy cả khi chưa có `syncKey`/offline.

### Sync (`src/lib/sync.ts`, `sync-queue.ts`)

- Bỏ `pushMistake` ghi mới. Khi `initSync` lần đầu (cờ chưa set) vẫn pull `mistake_log` từ remote, đưa qua `migrateLegacyMistakes` cùng bước local, rồi set cờ. Sau đó không pull bảng này nữa.
- `registerProcessor("mistakeLog")` giữ lại để drain các mục đã nằm trong queue; xóa dần khi bản sau không còn mục nào.
- Bảng Supabase `mistake_log` giữ nguyên (không migration SQL).

## Testing

- `mistakes.test.ts`: `addMistake` với `exam`, dedupe giữ `exam` mới nhất, resolve rồi sai lại tạo dòng mới.
- `mistake-migration.test.ts` (mới): nhóm + đếm; không nhân đôi khi unified đã có; propagate resolve; id deterministic; chạy hai lần cho kết quả giống nhau; input rỗng.
- `exam-storage.test.ts`: `addMistake` chỉ ghi unified, không ghi `mistakeLog`; `pruneBank` pin theo unified.
- Component/page: `/exam/mistakes` hiển thị từ unified và resolve cập nhật `/mistakes`.
- `sync` test: không còn push `mistake_log`; migration chạy một lần.

## Risks

| Risk | Mitigation |
|---|---|
| Migration nhân đôi lỗi do dual-write cũ | Quy tắc bước 2, test riêng |
| Mất dữ liệu legacy | Backup `mistakeLogBackup`, không xóa `mistakeLog` |
| `UnifiedMistake.payload` jsonb thêm `exam` | Không cần SQL migration (payload tự do); client cũ bỏ qua trường lạ |
| Đổi dedupe làm số liệu cũ khác | Đã được user chấp nhận (1 dòng "sai N lần") |

## Out of scope

AI routes, LWW cho speaking/writing/settings, report câu hỏi, navbar. Xóa hẳn `mistakeLog`/`mistake_log` để cho release sau.

## Docs to update

`CONTEXT.md` (mục UnifiedMistake, localStorage keys, Supabase Sync, `/exam/mistakes`, Component Map) và `docs/APP_OVERVIEW.md`.
