# English Study App — Development Plan

> **Nguồn đầu vào:** `APP_OVERVIEW.md`  
> **Mục tiêu:** Chuyển hiện trạng ứng dụng thành một roadmap triển khai có thể đưa trực tiếp cho Codex / Claude Code thực thi theo từng phase.
>
> **Nguyên tắc:** Không mở rộng feature lớn trước khi xử lý các điểm chưa nhất quán ở dữ liệu, sync, AI infrastructure và navigation.

---

## 1. Current Baseline

Ứng dụng hiện là một PWA học tiếng Anh cá nhân, tập trung vào:

- Vocabulary
- Grammar
- TOEIC / IELTS exam practice
- Speaking
- Writing
- Adaptive learning
- Statistics / progress tracking
- Multi-device sync

Tech stack hiện tại:

- Next.js 14 App Router
- TypeScript
- Tailwind
- Jest + Testing Library
- `localStorage` là nguồn dữ liệu chính
- IndexedDB cho audio
- Supabase cho sync
- Firebase Hosting
- AI providers: Gemini, Groq, OpenRouter, Mistral, Cohere, HuggingFace

Hiện trạng quan trọng:

- Batch 1–8 đã triển khai phần lớn.
- 342 tests / 64 suites đang pass.
- Adaptive learning core đã có.
- Exam engine, speaking, writing, grammar, SRS đã hoạt động.
- AI infrastructure mới migrate một phần.
- Một số debt về sync, mistakes, navigation và question reporting chưa được xử lý.

---

# 2. Development Strategy

Thứ tự phát triển đề xuất:

```text
Phase 0 — Repository Stabilization
        ↓
Phase 1 — Unified Mistake System
        ↓
Phase 2 — AI Infrastructure Completion
        ↓
Phase 3 — Sync Consistency & Data Reliability
        ↓
Phase 4 — Exam Question Quality Loop
        ↓
Phase 5 — Navigation & Learning UX
        ↓
Phase 6 — Study Engagement Features
        ↓
Phase 7 — Import / Data Portability
        ↓
Phase 8 — Authentication / Multi-user Readiness
```

Không nên phát triển các feature lớn mới trước Phase 0–3.

---

# 3. Global Engineering Rules

## 3.1 Preserve current architecture

Không thay đổi kiến trúc nền nếu chưa có lý do rõ ràng.

Giữ nguyên các nguyên tắc:

- API key chỉ tồn tại server-side.
- `src/lib/providers/` không được import từ client component.
- AI chỉ dùng để:
  - sinh nội dung;
  - giải thích;
  - chấm speaking/writing.
- Mastery và Today Plan tiếp tục deterministic.
- Local-first vẫn là hướng chính ở giai đoạn hiện tại.

---

## 3.2 Read `CONTEXT.md` before modifying storage or API contracts

`APP_OVERVIEW.md` không chứa:

- exact localStorage keys;
- Supabase schema đầy đủ;
- route request/response;
- data model chi tiết;
- component map.

Vì vậy:

> **Bất kỳ task nào thay đổi storage, sync, API contract hoặc entity schema đều phải đọc `CONTEXT.md` trước khi code.**

Không tự suy đoán schema.

---

## 3.3 Backward compatibility

Khi migrate:

- Không xoá dữ liệu cũ ngay.
- Ưu tiên migration layer.
- Nếu thay localStorage structure:
  - đọc format cũ;
  - convert;
  - ghi format mới;
  - giữ fallback ít nhất một release cycle nếu hợp lý.

---

## 3.4 Testing rule

Mỗi batch phải:

```bash
npm test
npm run build
npm run lint
```

Không merge phase mới nếu regression test chưa pass.

---

# 4. Phase 0 — Repository Stabilization

## Goal

Đưa repo về trạng thái sạch và có baseline ổn định trước khi tiếp tục phát triển.

## Why

Hiện repo đang ở branch:

```text
phase-6-exam-engine
```

và còn nhiều thay đổi chưa commit:

- migration rename;
- `mastery-all.ts`;
- unified mistakes sync;
- scripts;
- docs;
- các thay đổi khác đang dang dở.

Nếu tiếp tục feature trên trạng thái này, việc debug regression và rollback sẽ khó.

---

## Scope

### 0.1 Audit git state

Kiểm tra:

```bash
git status
git diff
git log --oneline --decorate -30
```

Phân loại thay đổi thành:

- finished;
- unfinished;
- experimental;
- generated;
- obsolete.

---

### 0.2 Commit pending work theo nhóm

Không gom toàn bộ thành một commit lớn.

Ví dụ:

```text
chore: normalize supabase migration filenames
feat: complete unified mistake sync
feat: finalize mastery-all engine
docs: update implementation notes
```

---

### 0.3 Verify migrations

Kiểm tra:

- migration order;
- duplicate migration timestamp;
- schema compatibility;
- Supabase local startup.

---

### 0.4 Establish baseline

Chạy:

```bash
npm test
npm run build
npm run lint
```

Lưu baseline test count.

Expected baseline hiện tại:

```text
342 tests
64 suites
```

Nếu khác, xác định rõ nguyên nhân trước khi tiếp tục.

---

## Likely impacted areas

- git history
- `supabase/migrations/`
- `src/lib/mastery-all.ts`
- unified mistake sync code
- docs / scripts

---

## Tests

- Full test suite
- Production build
- Lint
- Supabase local migrations

---

## Definition of Done

- Working tree sạch.
- Không còn migration rename dang dở.
- Branch build thành công.
- Test pass.
- Không còn code không xác định trạng thái.
- Có commit boundary rõ ràng để rollback.

---

# 5. Phase 1 — Unified Mistake System

## Priority

**Critical**

## Goal

Chỉ còn **một source of truth** cho mistake tracking.

---

## Current problem

Hiện tồn tại hai hệ thống:

```text
mistakeLog
unifiedMistakes
```

Luồng hiện tại:

```text
exam-storage.addMistake()
        ↓
mistakeLog
        ↓
unifiedMistakes
```

Nhưng resolve không đồng bộ hai chiều.

Ví dụ:

```text
/exam/mistakes
```

resolve một mistake không làm `/mistakes` cập nhật tương ứng.

Ngược lại cũng tương tự.

---

## Target architecture

Ưu tiên:

```text
UnifiedMistake = source of truth
```

Các UI exam cũ chỉ là filtered view trên unified mistakes.

Target:

```text
exam wrong answer
      ↓
addUnifiedMistake()
      ↓
UnifiedMistake store
      ↓
/mistakes
/exam/mistakes
/path
/library
/today
/mastery
```

---

## Implementation Tasks

### 1.1 Map old mistake model

Đọc `CONTEXT.md`.

So sánh:

```text
MistakeLogItem
UnifiedMistake
```

Xác định mapping:

- id
- source
- category
- question reference
- occurrenceCount
- createdAt
- updatedAt
- status
- resolvedAt

---

### 1.2 Stop double-write

Refactor:

```text
exam-storage.addMistake()
```

để không còn duy trì hai nguồn dữ liệu độc lập.

Có thể giữ compatibility adapter:

```ts
addMistake(...)
  -> addUnifiedMistake(...)
```

---

### 1.3 Convert `/exam/mistakes`

Thay vì đọc `mistakeLog`, route/page này nên:

```text
UnifiedMistake
WHERE source = exam
```

---

### 1.4 Resolve consistency

Một action:

```text
resolveMistake(id)
```

phải cập nhật cùng một entity.

Không có sync thủ công giữa hai store.

---

### 1.5 Migration

Nếu localStorage đang tồn tại `mistakeLog`:

```text
mistakeLog
   ↓
migration
   ↓
unifiedMistakes
```

Yêu cầu:

- dedupe;
- preserve occurrence count;
- preserve timestamps nếu có thể;
- không làm mất mistake history.

---

### 1.6 Deprecate legacy mistake storage

Giữ compatibility layer tạm thời.

Đánh dấu:

```ts
/** @deprecated */
```

Không thêm feature mới dựa trên `mistakeLog`.

---

## Tests

### Unit

- add mistake
- repeated mistake increments `occurrenceCount`
- resolve
- reopen nếu có rule
- dedupe

### Migration

Input:

```text
mistakeLog legacy
```

Expected:

```text
UnifiedMistake[]
```

### UI

- `/mistakes`
- `/exam/mistakes`
- `/path`
- `/library`

phải thấy cùng trạng thái.

---

## Definition of Done

- Một source of truth cho mistakes.
- Resolve đồng bộ ở mọi UI.
- Không double write.
- Không mất dữ liệu cũ.
- `Today Plan` và mastery đọc đúng mistake state.

---

## Risk

Migration có thể tạo duplicate mistake.

Mitigation:

- deterministic migration;
- backup localStorage key trước migrate;
- migration version flag.

---

# 6. Phase 2 — Complete AI Infrastructure

## Priority

**High**

## Goal

Tất cả AI routes dùng chung một infrastructure:

```text
API route
   ↓
callTask()
   ↓
task router
   ↓
prompt registry
   ↓
provider fallback
   ↓
metrics
```

---

## Current problem

Hiện chỉ khoảng:

```text
4 / 21 AI routes
```

đã migrate sang `callTask()`:

- generate-words
- speech/grade
- write/grade
- vocab/context

Các route khác vẫn gọi trực tiếp:

```text
callWithFallback()
```

---

# 6.1 Migrate all AI routes to `callTask`

## Tasks

Inventory toàn bộ:

```text
src/app/api/**
```

Tìm:

```ts
callWithFallback(
```

Mỗi route phải map sang task phù hợp.

Task hiện có:

```text
word-generation
sentence-generation
grammar-generation
grammar-explanation
exam-generation
exam-explanation
speaking-roleplay
speaking-grade
writing-grade
writing-feedback
vocab-context
```

---

## Important rule

Không tự tạo task mới nếu task hiện có phù hợp.

Nếu cần task mới:

1. xác định use case;
2. thêm type;
3. thêm provider routing;
4. thêm prompt registry;
5. thêm tests.

---

# 6.2 Complete Prompt Registry

Hiện:

```ts
Partial<Record<...>>
```

Prompt registry chưa phủ hết task.

Target:

```text
Every AI task
     ↓
central prompt definition
```

Không để prompt business logic phân tán trong route.

---

## Prompt structure recommendation

Mỗi prompt nên tách:

```text
system
instruction
output schema
examples / anchors
```

Nếu route cần JSON:

```text
prompt
  ↓
ai-json
  ↓
Zod validation
  ↓
auto repair once
```

---

# 6.3 Provider Routing from Settings

Hiện task → provider map chủ yếu static.

Target:

```text
User settings
      ↓
task preference
      ↓
callTask
```

Ví dụ:

```text
word-generation     → fast provider
exam-generation     → reliable structured output provider
speaking-grade      → grading provider
writing-grade       → grading provider
```

Không hard-code UI logic với provider name.

---

## Settings example concept

```text
AI routing

Generation
- Default
- Vocabulary
- Grammar
- Exam

Grading
- Speaking
- Writing
```

Chỉ implement sau khi đọc data model settings trong `CONTEXT.md`.

---

# 6.4 Persist AI Metrics

## Current problem

Metrics hiện in-memory:

```text
server instance memory
```

Cold start:

```text
metrics = lost
```

---

## Target

Persist tối thiểu:

```text
task
provider
latency
success / failure
error type
timestamp
```

Có thể dùng Supabase.

Không lưu prompt/user text nhạy cảm nếu không cần thiết.

---

## Aggregation

API admin metrics nên trả:

```text
provider success rate
average latency
P95 latency
task usage
fallback count
error distribution
```

---

# 6.5 Provider Health

Optional subtask.

Dựa trên metrics:

```text
provider health
```

có thể hiển thị:

```text
Healthy
Slow
Degraded
Unavailable
```

Không cần auto-disable ở phase đầu.

---

## Tests

- task → provider routing
- fallback order
- disabled providers
- JSON validation
- auto repair
- metrics write
- metrics read
- grading provider override

---

## Definition of Done

- Không còn route AI gọi `callWithFallback()` trực tiếp ngoại trừ infrastructure/internal abstraction hợp lý.
- Prompt registry phủ toàn bộ task.
- Metrics survive server restart.
- Provider routing configurable.
- Admin metrics phản ánh toàn bộ AI traffic.

---

# 7. Phase 3 — Sync Consistency & Data Reliability

## Priority

**High**

## Goal

Tất cả entity quan trọng dùng cùng conflict strategy.

---

## Current state

LWW đã áp dụng cho:

```text
words
exam_attempts
mistake_log
unified_mistakes
```

Chưa đồng nhất cho:

```text
speaking
writing
grammar topics
settings
```

---

# 7.1 Generic LWW merge

Nếu code đang duplicate logic:

```text
mergeWords
mergeExamAttempts
mergeMistakes
```

cân nhắc abstraction:

```ts
mergeByUpdatedAt<T>()
```

Rule hiện tại:

```text
newer updatedAt wins
tie → local wins
```

Không đổi rule nếu chưa có requirement mới.

---

# 7.2 Add LWW to Remaining Entities

Implement cho:

- speaking
- writing
- grammar topics
- settings

Mỗi entity phải xác định:

```text
id
updatedAt
deleted semantics
```

Nếu entity không có `updatedAt`, cần migration.

---

# 7.3 Offline Queue Hardening

Current flow:

```text
sync push fails
      ↓
enqueue
      ↓
online
      ↓
drainQueue
```

Bổ sung test cho:

```text
retry
duplicate enqueue
partial failure
network reconnect
```

---

# 7.4 Sync Status UX

Hiện có:

```text
synced
syncing
pending
offline
failed
```

Đảm bảo UI phân biệt rõ:

```text
Offline
Waiting to sync
Sync failed
Synced
```

Không coi offline là error.

---

# 7.5 Harden `syncKey`

## Current risk

`syncKey` đang hoạt động gần giống:

```text
bearer secret
```

và có alias hard-code:

```text
thankz
```

→ fixed UUID.

---

## Phase 3 target

Chưa cần full authentication.

Nhưng cần:

- loại bỏ alias hard-code khỏi production flow;
- validate sync key format;
- tránh log sync key;
- tránh expose key trong UI không cần thiết;
- có reset / regenerate key rõ ràng nếu phù hợp kiến trúc hiện tại.

---

## Definition of Done

- Các entity chính merge nhất quán.
- Offline changes không mất.
- Conflict resolution deterministic.
- Không còn fixed alias production.
- Sync test bao phủ reconnect và conflict.

---

# 8. Phase 4 — Exam Question Quality Loop

## Priority

**High**

## Goal

Nút:

```text
Report question
```

phải thực sự ảnh hưởng đến shared question bank.

---

## Current problem

Hiện chỉ ghi:

```text
reportedQuestions
```

ở local.

Question trong:

```text
exam_items
```

không được flag.

Do đó câu hỏi lỗi có thể tiếp tục xuất hiện.

---

# 8.1 Reporting API

Target:

```text
User report
    ↓
POST /api/exam/report
    ↓
exam_items.flagCount++
```

Có thể lưu thêm:

```text
reason
reportedAt
questionId
```

---

# 8.2 Question status

Suggested conceptual status:

```text
active
flagged
disabled
```

Không bắt buộc phải dùng đúng tên này; đọc schema trước khi triển khai.

---

# 8.3 Question selection rule

Drill generator / bank selector nên tránh:

```text
disabled question
```

và có thể giảm priority:

```text
flagged question
```

---

# 8.4 Admin review

Minimum admin functionality:

```text
GET flagged questions
```

Có thể reuse admin secret hiện tại.

Không cần xây admin dashboard lớn ở phase này.

---

# 8.5 Duplicate report protection

Một client không nên tăng flagCount vô hạn bằng cách spam cùng question.

Có thể dùng:

```text
reportedQuestions local
```

để UX prevent duplicate.

Server-side design phụ thuộc schema hiện tại.

---

## Tests

- report question
- duplicate report
- flagged question excluded / deprioritized
- disabled question never selected

---

## Definition of Done

- Report được persist.
- Question xấu không tiếp tục xuất hiện như trước.
- Có cách review flagged questions.

---

# 9. Phase 5 — Navigation & Learning UX

## Priority

**Medium / High**

## Goal

Các feature đã làm phải được user tìm thấy.

---

## Current orphan pages

Các route hiện chưa có entry point rõ trong UI:

```text
/path
/library
/stats
/vocab/context
/import
```

`/mistakes` cũng gần như bị ẩn gián tiếp.

---

# 9.1 Reorganize Navigation

Không nên đưa toàn bộ 30 route vào navbar.

Suggested information architecture:

```text
Home
Learn
Practice
Review
Progress
More
```

Ví dụ:

```text
Learn
 ├ Vocabulary
 ├ Grammar
 └ Context Practice

Practice
 ├ Exam
 ├ Speaking
 └ Writing

Review
 ├ SRS Review
 └ Mistakes

Progress
 ├ Today
 ├ Learning Path
 ├ Stats
 ├ Diary
 └ Activity

More
 ├ Library
 ├ Import
 └ Settings
```

Đây là gợi ý UX; có thể điều chỉnh theo component hiện tại.

---

# 9.2 Today as Primary Home Entry

`/today` đang là feature adaptive mạnh nhất.

Cân nhắc:

```text
Home
   ↓
Today's Plan
```

hoặc thêm CTA nổi bật trên `/`.

Không cần thay route `/` ngay.

---

# 9.3 Learning Path Integration

`/path` nên link trực tiếp sang:

```text
weak skill
      ↓
relevant drill
```

Ví dụ:

```text
Grammar weak
   ↓
grammar quiz

RC5 weak
   ↓
exam drill RC5

Speaking stale
   ↓
IELTS speaking
```

---

# 9.4 Library Discoverability

Add search entry:

```text
Navbar / global command
```

Search xuyên:

- vocabulary
- mistakes
- speaking
- writing

---

# 9.5 Flashcard Keyboard Shortcuts

Hiện exam đã có keyboard shortcut.

Add cho flashcard:

```text
Space → flip
1 → Forgot
2 → Hard
3 → Good
4 → Easy
Enter → next / confirm
```

Cho phép disable trong profile/settings nếu phù hợp.

---

# 9.6 Fix DayDrawer 182-day limitation

Hiện navigation quá 182 ngày có thể hiển thị:

```text
0 minutes
```

Task:

- xác định data source;
- sửa query/date window;
- thêm regression test.

---

## Definition of Done

- Không còn major orphan page.
- `/mistakes`, `/path`, `/stats`, `/library` reachable từ UI.
- Flashcard có keyboard flow.
- DayDrawer historical navigation đúng dữ liệu.

---

# 10. Phase 6 — Study Engagement

## Priority

**Medium**

## Feature 1 — Web Push Study Reminder

### Goal

Nhắc học khi có tín hiệu cần action.

Không spam notification.

---

## Notification candidates

### SRS due

```text
You have 24 words due for review.
```

### Streak risk

```text
You haven't studied today.
```

### Today plan

```text
Your 20-minute study plan is ready.
```

---

## Rules

Không push nếu:

```text
user already studied today
```

Không gửi nhiều notification cùng một ngày.

Settings:

```text
Study reminders
SRS reminders
Streak reminders
```

---

## Architecture

PWA đã có:

```text
public/sw.js
```

Nên tích hợp Web Push dựa trên service worker hiện tại.

Có thể cần server-side subscription storage.

Nếu dùng Supabase:

```text
push_subscriptions
```

Chỉ implement sau khi thiết kế security phù hợp với sync model.

---

## Definition of Done

- opt-in permission;
- unsubscribe;
- configurable reminder;
- no duplicate push;
- works after app close nếu browser/platform hỗ trợ.

---

# 11. Phase 7 — Import & Data Portability

## Priority

**Medium**

---

# 11.1 Anki Text Import

Ưu tiên `.txt` trước `.apkg`.

Reason:

```text
txt → low complexity
apkg → SQLite/package parsing complexity
```

Supported text format có thể gồm:

```text
word<TAB>meaning
word<TAB>meaning<TAB>example
```

---

## Import pipeline

```text
parse
  ↓
preview
  ↓
validation
  ↓
dedupe
  ↓
import
```

Không import trực tiếp ngay khi chọn file.

---

# 11.2 `.apkg` Import

Làm sau text import.

Pipeline:

```text
.apkg
  ↓
unpack
  ↓
read Anki SQLite
  ↓
extract notes/cards
  ↓
map fields
  ↓
preview
  ↓
import
```

Không cố hỗ trợ mọi custom Anki template trong version đầu.

---

# 11.3 Export

Nên bổ sung export:

```text
Vocabulary JSON
Vocabulary CSV
Mistakes JSON
Learning history JSON
```

Đây là backup hữu ích vì app hiện local-first.

---

## Definition of Done

- preview before import;
- validation errors visible;
- duplicate strategy rõ ràng;
- import không phá SRS existing data;
- export backup được.

---

# 12. Phase 8 — Authentication & Multi-user Readiness

## Priority

**Later**

Không triển khai ngay nếu app vẫn chỉ phục vụ cá nhân.

---

## Trigger để thực hiện phase này

Chỉ nên chuyển sang auth thật nếu có một trong các nhu cầu:

```text
multiple users
public release
shared devices
subscription/payment
teacher/student
social features
cloud-first data
```

---

## Possible direction

Supabase Auth:

```text
User
  ↓
Supabase Auth
  ↓
user_id
  ↓
RLS
```

Thay:

```text
syncKey
```

bằng:

```text
auth.uid()
```

---

## Migration requirement

Phải hỗ trợ:

```text
existing syncKey data
      ↓
link
      ↓
authenticated account
```

Không để user mất dữ liệu khi migrate.

---

# 13. Additional Feature Candidates

Các feature dưới đây chỉ nên làm sau Phase 0–5.

---

## 13.1 AI Study Coach

Dựa trên deterministic data hiện có:

```text
mastery
mistakes
sessions
streak
exam performance
```

AI chỉ làm nhiệm vụ:

```text
explain recommendation
```

Không để AI tự quyết Today Plan.

Example:

```text
"You've recently struggled with RC5 prepositions.
Today you should review 12 SRS words and complete one RC5 drill."
```

Plan vẫn đến từ `generatePlan()`.

---

## 13.2 Mistake Drill Generator

Từ UnifiedMistake:

```text
top categories
      ↓
generate practice
```

Ví dụ:

```text
preposition mistakes
      ↓
10 targeted grammar questions
```

---

## 13.3 Smart Review Session

Một session 20 phút:

```text
5 min SRS
5 min mistakes
5 min weak exam skill
5 min speaking/writing
```

Dùng `generatePlan()` làm input.

---

## 13.4 Monthly Progress Report

Từ deterministic stats:

```text
study time
mastery
exam accuracy
band trend
streak
mistakes
```

Sau đó AI tạo narrative summary.

---

# 14. Suggested Execution Batches

Để phù hợp Codex / Claude Code, chia thành các batch nhỏ.

---

## Batch A — Repository cleanup

```text
A1 Audit git changes
A2 Commit migration changes
A3 Commit mastery/unified mistake work
A4 Run full verification
```

---

## Batch B — Mistake consolidation

```text
B1 Map legacy + unified schema
B2 Implement migration
B3 Convert exam mistake page
B4 Remove double write
B5 Sync resolve state
B6 Tests
```

---

## Batch C — AI routes

```text
C1 Inventory routes
C2 Map routes → tasks
C3 Migrate grammar routes
C4 Migrate exam routes
C5 Migrate speaking routes
C6 Migrate writing routes
C7 Migrate remaining vocabulary routes
```

---

## Batch D — AI platform

```text
D1 Complete prompt registry
D2 Provider routing settings
D3 Persist metrics
D4 Admin metrics aggregation
```

---

## Batch E — Sync reliability

```text
E1 Speaking LWW
E2 Writing LWW
E3 Grammar LWW
E4 Settings LWW
E5 Queue retry tests
E6 syncKey hardening
```

---

## Batch F — Exam quality

```text
F1 Reporting API
F2 Persist flags
F3 Filter question selection
F4 Admin review endpoint
F5 Tests
```

---

## Batch G — UX

```text
G1 Navigation IA
G2 Add orphan pages
G3 Today/path integration
G4 Flashcard shortcuts
G5 DayDrawer fix
```

---

## Batch H — Engagement

```text
H1 Web Push subscription
H2 Reminder preferences
H3 SRS reminder
H4 Streak reminder
```

---

## Batch I — Import/export

```text
I1 TXT import
I2 Import preview
I3 Dedupe
I4 Export
I5 APKG import
```

---

# 15. Priority Matrix

| Priority | Work |
|---|---|
| P0 | Repository stabilization |
| P0 | Unified Mistake consolidation |
| P1 | Complete AI route migration |
| P1 | Complete prompt registry |
| P1 | LWW sync consistency |
| P1 | Question reporting → real flagging |
| P1 | Expose orphan pages |
| P2 | Persist AI metrics |
| P2 | Provider routing settings |
| P2 | Flashcard keyboard shortcuts |
| P2 | Web Push |
| P2 | TXT import |
| P3 | APKG import |
| P3 | Authentication |
| P3 | Multi-user |

---

# 16. Release Gates

Mỗi phase chỉ được coi là hoàn thành nếu:

```text
[ ] npm test
[ ] npm run build
[ ] npm run lint
[ ] no TypeScript error
[ ] no console error in main flows
[ ] localStorage migration tested
[ ] Supabase sync tested if affected
[ ] offline mode tested if affected
[ ] mobile layout checked
[ ] dark mode checked
```

---

# 17. Core User Flows to Protect

Regression test thủ công nên luôn kiểm tra:

---

## Vocabulary

```text
Generate words
→ Save
→ Review SRS
→ Rate word
→ Sync
```

---

## Grammar

```text
Open topic
→ Study rule
→ AI example
→ Quiz
→ Wrong answer
→ Mistake recorded
```

---

## Exam

```text
Select drill
→ Answer
→ Explanation
→ Wrong answer
→ Mistake
→ Mastery update
→ Today/path reflected
```

---

## Speaking

```text
Record
→ Whisper
→ Grade
→ Save history
→ Replay audio
```

---

## Writing

```text
Select task
→ Write
→ Grade
→ Feedback
→ Rewrite
→ Save history
```

---

## Offline

```text
Disable network
→ study
→ create changes
→ reconnect
→ queue drains
→ data sync
```

---

# 18. Do Not Do Yet

Không nên làm ngay:

### ❌ Full backend rewrite

Kiến trúc local-first hiện vẫn phù hợp sản phẩm cá nhân.

### ❌ Replace Supabase

Chưa có vấn đề đủ lớn để justify migration.

### ❌ Replace SM-2

SRS đang hoạt động ổn.

### ❌ AI-generated Today Plan

Today Plan deterministic là điểm mạnh hiện tại.

### ❌ Large social features

Không phù hợp core product hiện tại.

### ❌ Teacher dashboard

Chưa có multi-user/auth.

### ❌ Gamification phức tạp

Không nên ưu tiên trước reliability.

### ❌ Major UI redesign

Nên sửa information architecture trước.

---

# 19. Recommended Next Implementation

Nếu bắt đầu ngay từ trạng thái hiện tại:

```text
1. Stabilize repository
2. Consolidate mistake systems
3. Complete AI route migration
4. Complete prompt registry
5. Add LWW to remaining entities
6. Make question reporting functional
7. Fix navigation/orphan pages
8. Persist AI metrics
9. Add provider routing settings
10. Add Web Push
11. Add import/export
12. Evaluate authentication
```

---

# 20. Codex / Claude Code Working Instructions

Khi giao task cho AI coding agent, sử dụng format:

```text
Read:
- APP_OVERVIEW.md
- CONTEXT.md

Implement:
<one batch only>

Constraints:
- Preserve existing architecture.
- Do not change storage schema without migration.
- Do not expose AI provider keys to client.
- Keep deterministic mastery and planning logic.
- Add/update tests.
- Run npm test.
- Run npm run build.
- Run npm run lint.

Before coding:
1. Inspect related existing implementation.
2. Identify impacted files.
3. Write implementation plan.
4. Confirm migration/backward compatibility strategy.

After coding:
1. Summarize changed files.
2. Explain behavior changes.
3. Report tests.
4. Report remaining risks/TODOs.
```

---

# 21. Final Target State

Sau roadmap này, kiến trúc mong muốn:

```text
                    ┌─────────────────┐
                    │ Learning Actions │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
            SRS           Mistakes       Sessions
              │              │              │
              └──────────────┼──────────────┘
                             ↓
                       Skill Mastery
                             ↓
                         Today Plan
                             ↓
                       Learning Path
```

AI infrastructure:

```text
Feature
  ↓
API Route
  ↓
callTask
  ↓
Prompt Registry
  ↓
Task Router
  ↓
Provider Fallback
  ↓
Validated Output
  ↓
Persistent Metrics
```

Sync architecture:

```text
LocalStorage / IndexedDB
          ↓
       LWW Merge
          ↓
    Offline Queue
          ↓
       Supabase
```

Mistake architecture:

```text
Vocabulary
Grammar
Exam
Speaking
Writing
   ↓
UnifiedMistake
   ↓
Mistake Review
Today Plan
Learning Path
Stats
Targeted Drills
```

---

# 22. Recommended Product Direction

Ứng dụng đã vượt qua giai đoạn “English learning tools collection”.

Hướng phát triển tiếp theo nên tập trung vào:

```text
Adaptive Personal English Learning System
```

Core loop:

```text
Learn
  ↓
Practice
  ↓
Detect weakness
  ↓
Record mistake
  ↓
Update mastery
  ↓
Generate next actions
  ↓
Review
```

Feature mới chỉ nên được thêm nếu nó cải thiện ít nhất một phần của vòng lặp này.

