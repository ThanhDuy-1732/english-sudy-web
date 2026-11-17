# CONTEXT.md — English Study App

Quick reference for Claude. Do not repeat what's already in CLAUDE.md.

---

## Tech Stack

Next.js 15 App Router · React 19 · TypeScript · Tailwind CSS · Jest (jsdom) · localStorage + JSON backup · Firebase (hosting only) · PWA (service worker in `public/sw.js`)

---

## Pages & Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Generate & study flashcards |
| `/history` | `src/app/history/page.tsx` | Browse saved words, filter by topic/mastery |
| `/activity` | `src/app/activity/page.tsx` | Completed learning sessions grouped by local date, with type, duration, and accuracy |
| `/review` | `src/app/review/page.tsx` | Spaced-repetition review of due words; records a learning session and shows a quality-count summary after the last card |
| `/stats` | `src/app/stats/page.tsx` | Learning analytics — 4 stat tiles (words, active days, mastery, today's study minutes), words-per-day chart, study-time chart, topic distribution, streak calendar, exam accuracy chart (weekly), weakness radar (by question type) |
| `/diary` | `src/app/diary/page.tsx` | Daily learning journal — interactive 26-week heatmap, click a day to see words learned and study time in a slide-in drawer |
| `/grammar` | `src/app/grammar/page.tsx` | Grammar study page — desktop sidebar/mobile selector, static grammar rules, AI examples/exercises, user-generated grammar topics |
| `/import` | `src/app/import/page.tsx` | Bulk import words |
| `/settings` | `src/app/settings/page.tsx` | 4 tabs (`Segmented`): Mô hình AI · Giọng đọc · Dữ liệu · Hồ sơ. Mô hình AI is a list (one row per provider: model id, `role=switch` toggle, Test, "Dùng mô hình này trước") that fits phones |
| `/exam` | `src/app/exam/page.tsx` | Exam dashboard — chọn TOEIC/IELTS, level, drill/mock |
| `/exam/drill/[part]` | `src/app/exam/drill/[part]/page.tsx` | Luyện 1 part (RC5/RC6/RC7/LC2/LC3/LC4/READ_P3/LISTEN_S1); records an exam session with part metadata and result totals |
| `/exam/mock` | `src/app/exam/mock/page.tsx` | Full mock test rút gọn với countdown timer; records an exam session with mock metadata and result totals |
| `/exam/mistakes` | `src/app/exam/mistakes/page.tsx` | Sổ lỗi exam: `getExamMistakes()` (unified, `source` `exam:*`), filter, resolve dùng chung với `/mistakes`, badge "sai N lần", drill lại; chạy `runMistakeMigration()` khi tải |
| `/speak` | `src/app/speak/page.tsx` | Chọn scenario giao tiếp hoặc IELTS Speaking part |
| `/speak/roleplay/[id]` | `src/app/speak/roleplay/[id]/page.tsx` | Roleplay hội thoại đa lượt với AI; speaking session ends on user/end-of-turn completion |
| `/speak/ielts/[part]` | `src/app/speak/ielts/[part]/page.tsx` | IELTS Speaking P1/P2/P3 — mic hoặc nhập text; speaking session ends when grading returns, retry starts a new session |
| `/write` | `src/app/write/page.tsx` | Chọn dạng bài viết IELTS/TOEIC |
| `/write/task/[id]` | `src/app/write/task/[id]/page.tsx` | Editor + wall-clock timer + word count + per-task local draft recovery (a draft past its deadline is still restored, shows "Đã hết giờ" and a "Làm lại từ đầu" button that discards it; submitting stays allowed); validates HTTP/feedback before saving; opens result by persisted record UUID; writing session ends after grading result is saved, cancels on early exit |
| `/write/result/[id]` | `src/app/write/result/[id]/page.tsx` | Kết quả chấm — annotated essay + model answer; reads saved record by UUID (survives PWA restart), with sessionStorage fallback for legacy task-ID URLs; title is derived from `kind` (IELTS Task 1 / IELTS Task 2 / TOEIC Writing – Business Email) |
| `/today` | `src/app/today/page.tsx` | Kế hoạch học tự động từ `generatePlan` (SRS debt, điểm yếu exam, lỗi chưa xử lý, grammar mastery, nhắc speaking/writing) |
| `/path` | `src/app/path/page.tsx` | Lộ trình: learning profile + mastery 6 kỹ năng (`recomputeMastery()`) + top nhóm lỗi; link tới quiz/mistakes |
| `/mistakes` | `src/app/mistakes/page.tsx` | Sổ lỗi hợp nhất (`unifiedMistakes`) — lọc theo skill/status, đổi status, resolve |
| `/library` | `src/app/library/page.tsx` | Tìm kiếm xuyên từ vựng / lỗi / speaking / writing |
| `/vocab/quiz` | `src/app/vocab/quiz/page.tsx` | Quiz điền từ trên từ đã học (`/api/generate-fillblank`); ghi session |
| `/vocab/context` | `src/app/vocab/context/page.tsx` | Luyện từ trong ngữ cảnh (story/dialogue/email/workplace) qua `/api/vocab/context` |
| `/grammar/quiz` | `src/app/grammar/quiz/page.tsx` | Quiz ngữ pháp nhiều câu; ghi `grammarAttempts`, lỗi → `unifiedMistakes`, session; ưu tiên sub-rule yếu/bookmark |
| `/speak/shadowing` | `src/app/speak/shadowing/page.tsx` | Nghe–nhắc lại: ghi âm → Whisper → lưu `SpeakingRecord` (mode `shadowing`); transcribe lỗi thì huỷ session, và session cũ luôn bị huỷ trước khi tạo session mới |
| `/speak/history` | `src/app/speak/history/page.tsx` | Lịch sử speaking + nghe lại audio (IndexedDB) |
| `/write/history` | `src/app/write/history/page.tsx` | Lịch sử bài viết; mở rewrite |
| `/write/rewrite/[id]` | `src/app/write/rewrite/[id]/page.tsx` | Viết lại đoạn sai; chấm qua `/api/exam/grade-open`; lỗi → `unifiedMistakes` |

**Navigation** (`AppNavigation.tsx`, mounted in `layout.tsx`): desktop (`lg+`) = sticky left sidebar grouped Hôm nay/Ôn tập · Học · Luyện · Tiến độ, with Cài đặt, `HeaderTimer` and `ProviderBadge` at the bottom; phones = top bar (brand + timer) and a fixed bottom tab bar (Hôm nay, Từ mới, Ôn tập, Luyện thi, Thêm). "Thêm" is a `<details>` sheet with every other link (≥44px targets, backdrop closes it, closes on route change). Active link uses `usePathname` + `aria-current`. `.app-content` reserves the tab bar height below `lg`. No footer.

---

## API Routes (POST, trừ `/api/providers` và `/api/admin/metrics` là GET)

| Route | Body | Response |
|---|---|---|
| `/api/generate-words` | `{ topic, provider?, disabledProviders? }` | `{ word, meaning }[]` |
| `/api/generate-sentence` | `{ word, provider?, disabledProviders? }` | `{ sentence }` |
| `/api/generate-synonyms` | `{ word, provider?, disabledProviders? }` | `{ synonyms: string[], antonyms: string[] }` |
| `/api/generate-batch` | `{ words, provider?, disabledProviders? }` | batch sentences+synonyms |
| `/api/generate-fillblank` | `{ word, provider?, disabledProviders? }` | `{ sentence }` (with blank) |
| `/api/generate-reading` | `{ words, provider?, disabledProviders? }` | `{ passage, questions[] }` |
| `/api/grade-sentence` | `{ word, sentence, provider?, disabledProviders? }` | grading result |
| `/api/grammar-generate` | `{ request, provider?, disabledProviders? }` | `GrammarTopic` JSON for a user-requested grammar topic |
| `/api/grammar-examples` | `{ topic, subRule, provider?, disabledProviders? }` | `{ examples: string[] }` |
| `/api/grammar-exercise` | `{ topic, subRule, provider?, disabledProviders? }` | `{ type: "fill"|"mcq", question, options?, answer }` |
| `/api/providers` | GET | `{ id, name, model }[]` of configured providers |
| `/api/providers/test` | `{ providerId }` | `{ ok, latency, error? }` |
| `/api/exam/generate-item` | `{ kind, part, level, topic? }` | `ExamItem` (zod validated, 1 auto-repair) |
| `/api/exam/grade-open` | `{ question, userAnswer, correctAnswer }` | `{ correct, feedback }` |
| `/api/exam/explain` | `{ question, userAnswer, correctAnswer, explanation? }` | `{ explanation }` |
| `/api/speech/transcribe` | FormData `audio` (WebM/MP4/M4A/Ogg; nonempty, max 25 MiB; `Content-Length` > 25 MiB + 64 KiB bị từ chối 413 trước khi đọc body) | `{ text, durationSec, segments[] }` via Groq Whisper |
| `/api/speech/grade` | `{ task, transcript, durationSec }` | `SpeakingFeedback` (4 band scores) |
| `/api/speak/roleplay` | `{ scenario, history, userText }` | `{ reply, correction, goalAchieved, suggestedReplies }` |
| `/api/write/grade` | `{ kind, prompt, content, chartData? }` | `WritingFeedback` (4 bands + annotations + model answer) |
| `/api/vocab/context` | `{ words: string[], format?: "mini_story"\|"dialogue"\|"email"\|"workplace" }` | `{ text }` (từ mục tiêu in **đậm**); 400 nếu `words` rỗng |
| `/api/admin/metrics` | GET, header `x-admin-secret` = `ADMIN_SECRET` | Metrics AI tổng hợp theo task; 503 nếu chưa set `ADMIN_SECRET`, 401 nếu sai |

Routes gọi AI dùng `callWithFallback` (qua `provider` + `disabledProviders`) hoặc `callTask` (task router, xem mục AI Provider System) — **chỉ 4 route dùng `callTask`**: `generate-words`, `speech/grade`, `write/grade`, `vocab/context`. Các route còn lại gọi `callWithFallback` trực tiếp (không có metrics). Chúng set header `X-Provider-Used`. Lời gọi AI thật nằm ở `src/lib/providers/`.
`GRADING_PROVIDER` env var pins a specific provider for band scoring (stability). `GROQ_API_KEY` + `GROQ_WHISPER_MODEL` env vars for STT.

---

## Data Models

### LearningSession (`src/lib/sessions.ts`)

`LearningSession` records an activity (`vocabulary`, `review`, `grammar`, `exam`, `speaking`, or `writing`) with an ID, ISO start/end times, duration in seconds, optional item totals, and optional metadata. `startSession`, `updateSession`, `finishSession`, and `cancelSession` manage records; `getSessions`, `getSessionsForDate`, and `getRecentSessions` read them. Records are stored newest-first, capped at 500; date filtering uses the local calendar date. `finishSession` is idempotent.

### LearnedWord (`src/lib/storage.ts`)
```ts
interface LearnedWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  learnedAt: string;           // ISO, set once on first save
  updatedAt?: string;          // ISO, set on every user-initiated mutation (LWW key)
  nextReviewAt?: string;       // ISO, defaults to +1 day
  reviewInterval?: number;     // days (SM-2: interval field)
  mastery?: number;            // 0–5 stars (derived from repetitions)
  synonyms?: string[];
  antonyms?: string[];
  // SM-2 fields (added by migrateToSm2):
  easiness?: number;           // EF, floor 1.3
  repetitions?: number;        // SM-2 repetition count
}
```
SRS uses SM-2 algorithm (`src/lib/srs.ts`). Use `updateWordReviewSm2(word, quality: 0|3|4|5)` for new reviews.

### DailyChallenge (`src/lib/daily-challenge.ts`)
```ts
interface DailyChallenge {
  date: string;   // YYYY-MM-DD
  words: string[];
  completed: boolean;
}
```

### VoiceSettings (`src/lib/voiceSettings.ts`)
```ts
interface VoiceSettings {
  voiceURI: string | null;
  rate: number;    // default 0.9
  pitch: number;   // default 1.0
  volume: number;  // default 1.0
}
```

### SpeakingRecord (`src/lib/speech/speaking-storage.ts`)
```ts
interface SpeakingRecord {
  id: string;
  mode: "ielts_p1" | "ielts_p2" | "ielts_p3" | "roleplay" | "shadowing";
  prompt: string;
  transcript: string;
  durationSec: number;
  feedback: SpeakingFeedback;  // { fluency, vocab, grammar, pronunciation, overall } — all 0–9 bands
  audioId?: string;             // idb-keyval key for IndexedDB audio blob replay
  createdAt: string;
  updatedAt?: string;
}
```

### WritingRecord (`src/lib/write/writing-storage.ts`)
```ts
interface WritingRecord {
  id: string;
  kind: "ielts_task1" | "ielts_task2" | "toeic_email";
  prompt: string;
  chartData?: unknown;
  content: string;
  wordCount: number;
  feedback: {
    bands: { task: number; coherence: number; lexical: number; grammar: number };
    overall: number;
    wordCount: number;
    annotations: { excerpt: string; issue: string; category: string; suggestion: string }[];
    modelAnswer: string;
    nextFocus: string;
  };
  createdAt: string;
  updatedAt?: string;
}
```

### GrammarTopic (`src/lib/grammar-data.ts`)
```ts
interface SubRule {
  id: string;
  name: string;
  formula: string;
  explanation: string;
  examples: string[];
}

interface GrammarTopic {
  id: string;
  name: string;
  rules: SubRule[];
  isUserGenerated?: boolean;
  createdAt?: string;
}
```

`STATIC_GRAMMAR_TOPICS` contains 8 built-in topics: Tenses, Modal Verbs, Conditionals, Passive Voice, Relative Clauses, Reported Speech, Articles, Prepositions.

### UnifiedMistake (`src/lib/mistakes.ts`)
```ts
type MistakeSkill = "vocabulary"|"grammar"|"reading"|"listening"|"speaking"|"writing";
type MistakeStatus = "new" | "reviewing" | "resolved";
interface UnifiedMistake {
  id: string; skill: MistakeSkill; category: string; source: string;
  userAnswer: string; correctAnswer: string; explanation: string;
  occurrenceCount: number; status: MistakeStatus;
  createdAt: string; updatedAt: string; reviewedAt?: string;   // updatedAt = LWW key
  exam?: { itemId; questionId; part: ExamPart; type: QuestionType; prompt };   // chỉ lỗi từ exam engine
}
type ExamMistake = UnifiedMistake & { exam: NonNullable<UnifiedMistake["exam"]> };
```
Local key `unifiedMistakes`, max 1000. `addMistake(input)` **dedupes** theo `source + category` trong các lỗi chưa `resolved`: gặp lại thì tăng `occurrenceCount`, không tạo bản ghi mới. Mọi mutation (`addMistake`, `resolveMistake`, `setMistakeStatus`) chỉ ghi localStorage. `saveMistakes(items)` ghi đè toàn bộ danh sách local. Truy vấn: `getMistakes`, `getMistakesBySkill`, `getMistakesByStatus`, `getTopCategories(skill?, limit)`, `getExamMistakes()` / `getUnresolvedExamMistakes()` (lỗi có `exam`), `examPartToSkill(part)`.

**Một sổ lỗi duy nhất**: `unifiedMistakes` là source of truth. `exam-storage.addMistake(entry)` (`@deprecated`, adapter cho `ExamRunner`) chỉ gọi `mistakes.addMistake` kèm `exam`, không còn ghi `mistakeLog`/`pushMistake`; resolve dùng `mistakes.resolveMistake` ở mọi UI. `pruneBank` pin theo `getUnresolvedExamMistakes()`. Dedupe theo `source = exam:<part>:<questionId>` + `category = type`: sai lặp lại tăng `occurrenceCount`; resolve rồi sai lại tạo bản ghi mới. Nguồn khác ghi thẳng unified: `/grammar/quiz`, `/write/rewrite/[id]`.

**Migration `mistakeLog` → unified** (`src/lib/mistake-migration.ts`): `migrateLegacyMistakes(legacy, unified)` thuần/deterministic (nhóm theo câu+type+resolved, id = id legacy mới nhất, không cộng đôi lỗi mà dual-write cũ đã đếm, propagate resolve nếu unified không mới hơn). `runMistakeMigration(remote?)` chạy đúng một lần, cờ `mistakeLogMigrated`, backup `mistakeLogBackup`, không xoá `mistakeLog`; gọi từ hai trang `/exam`, `/exam/mistakes` và khi app khởi động.

### LearningProfile (`src/lib/profile.ts`)
```ts
interface LearningProfile {
  goal: "communication"|"toeic"|"ielts"|"vocabulary"|"mixed";   // default "mixed"
  currentLevel: 1|2|3|4|5;          // default 2
  dailyStudyMinutes: number;        // default 30
  targetToeicScore?: number; targetIeltsScore?: number; targetDate?: string;
  shortcutsEnabled: boolean;        // default true; tắt phím tắt ExamRunner
}
```
`getProfile()` (merge defaults, SSR-safe), `saveProfile`, `updateProfile(partial)`. Local key `learningProfile`.

### Grammar progress & bookmarks
- `grammar-progress.ts`: `GrammarAttempt {id, topicId, subRuleId, correct, at}` (key `grammarAttempts`, max 2000); `recordGrammarAttempt`, `getGrammarProgress(topicId, subRuleId)`, `getTopicProgress`, `getWeakSubRules(threshold=70)`. `GrammarProgress.mastery` = accuracy 0–100. Sau attempt cập nhật mastery `grammar` trong cache.
- `grammar-bookmarks.ts`: key `grammarBookmarks`; `getBookmarks`, `isBookmarked`, `toggleBookmark(topicId, subRuleId)`.

### Exam tags (`src/lib/exam/exam-tags.ts`)
Key `examTagAccuracies` — `{tag, correct, total}[]`. `recordTagResult`, `getTagAccuracies`, `getWeakTags(threshold=60)` (cần ≥3 mẫu). `selectAdaptiveItems(items, …)` trộn đề 70% tag yếu / 20% thường / 10% mạnh cho drill.

### Streak, weekly report, mastery timeline
- `streak.ts`: `computeStreak(sessions, refDate?)` → `{currentStreak, longestStreak, activeDaysThisWeek}` (ngày local, dựa trên `learningSessions`).
- `weekly-report.ts`: `computeWeeklyReport(sessions, attempts)` → `{studyMinutes, sessions, wordsLearned, srsAccuracy|null, examAccuracy|null}` (tuần bắt đầu thứ Hai).
- `date.ts`: `localDateKey(date?)` → local `YYYY-MM-DD` (never use `toISOString().slice(0,10)` for day keys; it is UTC). Used by `/today`, `mastery-timeline`, `DayDrawer`, daily challenge push.
- `mastery-timeline.ts`: key `masteryTimeline` — `{date, skill, mastery 0–100}[]`, 1 snapshot/kỹ năng/ngày. `recordMasterySnapshot`, `getMasteryTimeline(skill)`, `getSkillTrend(skill)` → up/down/stable.

### Daily plan (`src/lib/plan/generate-plan.ts`)
`generatePlan(ctx: PlanContext): PlanBlock[]` — thuần (không đọc localStorage; caller truyền `dueWords`, `unifiedMistakes`, `skillMastery`, `attempts`, `lastSpeakingAt`, `lastWritingAt`, `settings`, `availableMin`). Thứ tự ưu tiên: (1) SRS nếu có từ đến hạn → (2) kiểu câu exam yếu nhất, 14 ngày, ≥10 mẫu → (3) ≥5 lỗi chưa resolved → (3b) grammar nếu mastery < 60 → (4) speaking nếu >2 ngày → (5) writing nếu >5 ngày → (6) từ mới nếu còn ngân sách phút. `PlanBlock.kind`: `srs_review | new_words | exam_drill | speaking | writing | grammar | mistakes`.

---

## localStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `learningSessions` | `LearningSession[]` | Recent activity sessions from review, exam, speaking, and writing; newest-first, max 500 |
| `learnedWords` | `LearnedWord[]` | All saved words |
| `dailyChallenge` | `DailyChallenge[]` | Full history |
| `customTopics` | `string[]` | User-added topics |
| `studyTime` | `Record<string, number>` | Daily study seconds — `{ "YYYY-MM-DD": seconds }` |
| `grammarTopics` | `GrammarTopic[]` | User-generated grammar topics |
| `voiceSettings` | `VoiceSettings` | TTS settings |
| `preferredProvider` | `string` | Provider id (e.g. `"gemini"`) |
| `disabledProviders` | `string[]` | Opt-out provider ids |
| `examBank` | `Record<string, ExamItem[]>` | Cache đề exam, key = `"TOEIC:RC5:3"`. Max 30/key |
| `examAttempts` | `ExamAttempt[]` | 100 attempts gần nhất |
| `mistakeLog` | `MistakeEntry[]` | **Legacy**: chỉ đọc để migration một lần, không còn ghi |
| `mistakeLogBackup` | string | Bản sao nguyên văn `mistakeLog` trước migration |
| `mistakeLogMigrated` · `mistakeLogRemoteMigrated` | `"1"` | Cờ migration local / remote (`mistake_log`) đã chạy |
| `examSettings` | `ExamSettings` | Primary exam, target score, level, listening rate |
| `dailyPlan` | `{ date, blocks }` | Kế hoạch `/today` — regenerate mỗi ngày |
| `lastSpeakingAt` | ISO string | Để /today nhắc luyện nói sau 2 ngày |
| `lastWritingAt` | ISO string | Để /today nhắc luyện viết sau 5 ngày |
| `speakingSessions` | `SpeakingRecord[]` | IELTS speaking session history; newest-first, max 200 |
| `writingTaskDraft:<taskId>` | `{content: string, deadline: number}` | Local unfinished writing task; saved synchronously on edits/start, restored on mount (even past its deadline), cleared after successful grading and local result save or by "Làm lại từ đầu" |
| `pwaInstallDismissed` | `"1"` | User hid the install guidance banner (`ServiceWorkerRegistration`) |
| `writingSubmissions` | `WritingRecord[]` | IELTS/TOEIC writing submission history; newest-first, max 100 |
| `unifiedMistakes` | `UnifiedMistake[]` | Sổ lỗi hợp nhất 6 kỹ năng, max 1000 |
| `learningProfile` | `LearningProfile` | Goal, level, phút/ngày, mục tiêu điểm, bật/tắt phím tắt |
| `skillMasteryCache` | `SkillMastery[]` | Cache mastery 6 kỹ năng; `recomputeMastery()` ghi lại mỗi lần gọi |
| `masteryTimeline` | `MasterySnapshot[]` | Snapshot mastery theo ngày/kỹ năng |
| `grammarAttempts` | `GrammarAttempt[]` | Lịch sử làm bài grammar, max 2000 |
| `grammarBookmarks` | `GrammarBookmark[]` | Sub-rule đã bookmark |
| `examTagAccuracies` | `{tag, correct, total}[]` | Accuracy theo tag cho drill thích ứng |
| `reportedQuestions` | `{questionId, itemId, reason, note, reportedAt}[]` | Câu hỏi exam người dùng báo lỗi; max 200, chỉ local |
| `theme` | `"system"\|"light"\|"dark"` | Lựa chọn của người dùng (Settings → Hồ sơ → Giao diện). `lib/theme.ts` có `THEME_INIT_SCRIPT` (inline trong `<head>`, chạy trước khi vẽ): đặt `data-theme` trên `<html>` luôn là giá trị **đã giải quyết** (`dark`\|`light`; "system" theo OS và cập nhật live), cập nhật `<meta name="theme-color">`, và tạo `window.__setTheme(pref)` (gọi qua `setThemePref`). Xem mục "Theming" |

---

## AI Provider System (`src/lib/providers/`)

**Types**: `src/lib/providers/types.ts` — `AIProvider` interface (`id`, `name`, `model`, `generateContent`)

**Implementations**:
- `gemini.ts` — Google Gemini (via `@google/generative-ai`)
- `openai-compat.ts` — OpenAI-compatible (Groq, OpenRouter, Mistral, Cohere, OpenCode Go; accepts optional `defaultHeaders`, used by OpenCode Go for `x-opencode-session`)

**Registry** (`src/lib/providers/index.ts`):
- Built from env vars at module load time
- `callWithFallback(prompt, preferredId?, disabledIds?, opts?: GenerateOpts)` — tries preferred first, falls back on 402 (provider wants billing), 404 (model retired), 408, 429, 5xx, network errors (no status) and per-provider timeout (`AI_PROVIDER_TIMEOUT_MS`, default 25 s; the abandoned request is not aborted). Other 4xx are thrown. `GenerateOpts = { temperature? }`
- `getRegisteredProviders()` — returns all configured providers
- Active providers: whichever env keys are set in `.env.local`

**Task router** (`src/lib/ai-tasks.ts`): `callTask({ task, prompt, provider?, disabledProviders?, temperature? })` → `{ text, providerId }`. Bọc `callWithFallback`, chọn provider theo `TASK_PROVIDER_MAP` (bảng tĩnh; chỉ `speaking-grade` và `writing-grade` ghim theo `GRADING_PROVIDER`) và ghi metric mỗi lần gọi. `AITaskName`: `word-generation`, `sentence-generation`, `grammar-generation`, `grammar-explanation`, `exam-generation`, `exam-explanation`, `speaking-roleplay`, `speaking-grade`, `writing-grade`, `writing-feedback`, `vocab-context`. Mới 4 route dùng (xem API Routes).
- `ai-prompts.ts` — `PROMPTS: Partial<Record<AITaskName, PromptDefinition>>`, `getPrompt(task)`; chưa phủ hết task.
- `ai-metrics.ts` — `recordMetric`, `getMetrics`, `getAggregatedMetrics`, `clearMetrics`; **in-memory theo server instance**, mất khi cold start. Đọc qua `GET /api/admin/metrics`.
- `ai-json.ts` — `stripFences`, `parseAiJson(schema, …)` (Zod validate; dùng cho exam item).

**Supported providers** (env key → default model):
- `GEMINI_API_KEY` → `gemini-flash-lite-latest`
- `GROQ_API_KEY` → `openai/gpt-oss-120b`
- `OPENROUTER_API_KEY` → `nvidia/nemotron-3-ultra-550b-a55b:free`
- `MISTRAL_API_KEY` → `mistral-small-latest`
- `COHERE_API_KEY` → `command-r7b-12-2024`
- `OPENCODE_API_KEY` → `deepseek-v4.1-flash` (OpenCode Go gateway `https://opencode.ai/inference/go/openai/v1`; sends `x-opencode-session` from `OPENCODE_SESSION_ID` or a per-process generated id; override the API base with `OPENCODE_BASE_URL` — pay-as-you-go uses `https://opencode.ai/inference/openai/v1`)
- HuggingFace đã bị bỏ khỏi registry: account hiện tại không có credit (`canPay:false`, không PRO) nên mọi call trả 402. Thêm lại block trong `buildRegistry` nếu mua credit.

Model can be overridden via env: `GEMINI_MODEL`, `GROQ_MODEL`, etc.

Registry order: `opencode` đứng đầu khi `OPENCODE_API_KEY` có mặt, nên nó là fallback mặc định khi client không gửi `provider`. `ProviderContext` cũng mặc định chọn `opencode` nếu localStorage chưa có `preferredProvider` (hoặc provider đó bị tắt); nếu không có OpenCode thì giữ thứ tự cũ.

**Client-side flow**: `useApiFetch` hook (reads `ProviderContext`) → POST with `{ provider, disabledProviders }` → API route → `callWithFallback` → sets `X-Provider-Used` header → `useApiFetch` updates context if provider changed.

---

## Flashcard Component (`src/components/Flashcard.tsx`)

4 study modes (tabs on card back):
- **study** — meaning + example sentence + synonyms/antonyms
- **write** — `WritingChallenge` (user writes a sentence, AI grades it)
- **fill** — `FillBlank` (fill-in-the-blank exercise)
- **dictation** — `DictationMode` (listen and type the sentence)

On first flip: fetches sentence + synonyms in parallel. Saved state is lazy (only after flip). Pronunciation button (`PronunciationButton`) floats on front face.

In **review mode** (`isReviewMode=true`): shows 4 SM-2 quality buttons — Quên (0), Khó (3), Được (4), Dễ (5) — instead of save. Updates SM-2 fields via `updateWordReviewSm2(word, quality)` and passes the quality to `onReviewed` for session tracking. `/review` cancels unfinished sessions on exit; its summary reports counts, accuracy (Được + Dễ), duration, and remaining due words.

---

## Custom Topics (`src/lib/custom-topics.ts`)

- `getCustomTopics()` — reads `localStorage["customTopics"]`
- `saveCustomTopic(topic)` — appends (deduplicates, case-insensitive, trims)
- `deleteCustomTopic(topic)` — removes by exact string match

Built-in topics (`"Daily Communication"`, `"TOEIC"`) are hardcoded in `TopicSelector.tsx` and cannot be deleted.

## Grammar Topics (`src/lib/grammar-storage.ts`)

- Built-in topics live in `STATIC_GRAMMAR_TOPICS` (`src/lib/grammar-data.ts`)
- `getUserGrammarTopics()` — reads `localStorage["grammarTopics"]`; returns `[]` on SSR or malformed JSON
- `saveUserGrammarTopic(topic)` — appends or updates by `id`
- `/grammar` combines static topics with user topics; AI-generated topics are saved locally

---

## Stats (`src/lib/stats.ts`)

- `getWordsPerDay(days)` → `DailyWordCount[]` — word counts from `learnedWords`
- `getTopicDistribution()` → `{ topic, count }[]`
- `getCalendarData(weeks)` → `CalendarDay[]` — heatmap levels 0–3
- `getStudyTimePerDay(days)` → `DailyStudyTime[]` — reads `localStorage["studyTime"]`, converts seconds → rounded minutes, fills missing days with 0

- `getWordsForDate(date)` — từ học trong ngày local `date`

```ts
interface DailyStudyTime { date: string; minutes: number; }
```

`src/lib/stats-skills.ts`: `weeklyBands(weeks = 12)` → band L/R/S/W theo tuần (TOEIC chuẩn hoá về 0–9); `skillRadar()` → accuracy 4 kỹ năng từ session gần nhất. Xem thêm streak / weekly report / mastery timeline ở mục Data Models.

---

## Skill Mastery (`src/lib/mastery.ts`, `src/lib/mastery-all.ts`)

`mastery.ts` holds the pure scoring functions (`computeSkillMastery`, decay-weighted accuracy) and the `skillMasteryCache` localStorage read/write (`getCachedMastery`/`saveMasteryCache`). It only knows about attempts `{ correct, at }[]` per category — it has no knowledge of where those attempts come from.

`grammar-progress.ts` computes and caches the `grammar` skill itself (called after quiz attempts).

`mastery-all.ts`'s `recomputeMastery()` computes the other five skills (`vocabulary`, `reading`, `listening`, `speaking`, `writing`) from their live source data each time it's called — `exam-storage.ts` attempts split by TOEIC/IELTS part into reading vs listening, `speaking-storage.ts`/`writing-storage.ts` records (feedback ≥ 6/9 = correct), and `learnedWords` (`mastery` star ≥ 3 = correct) — merges in the cached `grammar` entry, and persists the merged cache. `/today` and `/path` call `recomputeMastery()` rather than reading the cache directly, so a skill only appears once it has data.

---

## Spaced Repetition (`src/lib/storage.ts`)

- `getWordsForReview()` — returns words where `nextReviewAt <= now`
- `updateWordReviewSm2(word, quality: 0|3|4|5)` — **đường chính**, dùng SM-2 trong `src/lib/srs.ts` (EF ≥ 1.3; quality < 3 → interval 1; `nextReviewAt = now + interval * 86400000`), cập nhật `updatedAt`.

---

## Data Transfer / Backup (`src/lib/data-transfer.ts`)

Không dùng Supabase hay backend nào. Toàn bộ dữ liệu nằm trong localStorage của trình duyệt.

- `exportData()` → JSON string `{ app: "english-study", version: 1, exportedAt, data: { key: value } }`, giữ nguyên raw string của từng key. Bỏ qua key runtime (`syncKey`, `syncFailedQueue`).
- `importData(json)` → validate `app`/`version`/`data`, ghi đè từng key có trong file; key không có trong file được giữ nguyên. Trả `{ imported, skipped }`.
- `clearAllData()` → xoá mọi key của app (trừ key runtime), trả số key đã xoá.
- `backupFileName(date?)` → `english-study-backup-YYYY-MM-DD.json`.
- UI: Settings → tab **Dữ liệu** (`src/app/settings/page.tsx`) — xuất file, nhập file (confirm rồi reload), xoá toàn bộ (confirm 2 bước).
- Không đồng bộ tự động giữa các thiết bị; chuyển máy bằng xuất/nhập file.
- `exam_items`: đề sinh ra chỉ lưu local trong `examBank`; không còn kho đề dùng chung trên server.

---

## Key Constraints

1. **API keys are server-side only.** Never import `src/lib/providers/` or `src/lib/gemini.ts` from client components. Only API routes (`src/app/api/*/route.ts`) call them.
2. **`src/lib/gemini.ts`** is a legacy thin wrapper still used by some tests; new routes use `src/lib/providers/`.
3. **No auth / no user accounts.** All data lives in localStorage; backup/chuyển máy bằng file JSON (Settings → Dữ liệu).
4. **Firebase is hosting only.** No Firebase Firestore/Auth/Functions used. Config in `firebase.json` and `.firebaserc`.
5. **PWA**: production-only service worker `public/sw.js`, manifest `src/app/manifest.ts`. Core offline assets are mandatory; all static learning pages and built-in dynamic tasks are best-effort precached, so an optional route outage does not prevent installation. Navigations are network-first (5s timeout applies to time-to-headers only) and are answered immediately; the page HTML and its JS/CSS are cached afterwards via `event.waitUntil`, so caching never delays a navigation. JS/CSS/icons are cache-first. HTML is cached by pathname + search; RSC/Flight responses are never mixed with HTML, and successful Next Link/RSC requests warm the separate full-document cache. Next 14 falls back to document navigation if Flight fails offline. Visited pages cache their JS/CSS too (in the background). Asset downloads are deduplicated; retain the previous cache for older tabs. AI/API requests are not cached; offline supports saved vocab review, static grammar, cached exam questions, local history and writing drafts. See `docs/pwa.md`.

---

## Component Map

| Component | Purpose |
|---|---|
| `FlashcardGrid` | Renders word grid, passes `onFlip` counter up |
| `TopicSelector` | Preset + custom topics; custom topics have a × delete button |
| `QuizMode` | Multiple-choice quiz over current word set |
| `ReadingMode` | Reading passage with comprehension questions |
| `WritingChallenge` | User writes a sentence; calls `/api/grade-sentence` |
| `FillBlank` | Displays fill-in-the-blank; validates answer |
| `DictationMode` | Plays TTS; user types what they hear |
| `GrammarSidebar` | Topic list + add-topic form for desktop `/grammar` |
| `GrammarContent` | Displays grammar rules, formulas, static/AI examples, and exercise buttons |
| `GrammarExercise` | Inline fill-in-the-blank or MCQ answer checking |
| `PronunciationButton` | Web Speech API TTS button |
| `StreakCalendar` | 26-week calendar heatmap |
| `VoiceSettingsTab` | Voice picker + sliders |
| `FirebaseInitializer` | Initializes Firebase analytics in the browser when config is available |
| `ProviderBadge` | Shows current AI provider name |
| `HeaderTimer` | Sidebar/top-bar timer: shows today's study time or countdown; click to pause/resume; ＋ button opens SetCountdownModal; TimeUpModal shown when countdown ends |
| `charts/StudyTimeChart` | Bar chart — study minutes per day for last 30 days |
| `charts/ExamAccuracyChart` | Bar chart — weekly exam accuracy % for last 4 weeks |
| `charts/WeaknessRadar` | Radar chart — exam accuracy % grouped by QuestionType |
| `charts/BandTimelineChart` | Line chart — weekly speaking/writing/listening/reading band scores (last 12 weeks) |
| `charts/SkillRadar` | Radar chart — L/R/S/W skill accuracy % from recent sessions |
| `ExamRunner` | Stateful exam engine — phases: `loading → ready → running → reviewing → done` (+ `error`); falls back to the local bank when offline/API fails (without a topic filter), or displays an error rather than leaving a loading spinner; accepts `forceComplete` prop to transition directly to reviewing on timer expiry (mock mode); dispatches `LOADING_ERROR` when all API fetches fail |
| `DueBadge` | Client component — live SRS-due word count badge next to "Ôn tập" nav link, updates every 60 s |
| `DiaryCalendar` | Interactive 26-week heatmap calendar for /diary; purple color levels 0–3; click cell opens DayDrawer |
| `DayDrawer` | Slide-in right drawer for /diary; shows daily word list (expandable) + study minutes + prev/next nav |
| `AppNavigation` | Desktop grouped sidebar; phone top bar + bottom tab bar with "Thêm" sheet; timer, provider badge, due badge (marker yellow) |
| `ServiceWorkerRegistration` | Production worker registration; installs through `beforeinstallprompt` when available, native installation instructions otherwise (dismissible with ✕, remembered in `pwaInstallDismissed`); standalone detection and optional persistent storage request; offline notice; waiting-worker update button posts `SKIP_WAITING`, reloads only after user action |
| `ExamTimer` (prop `enabled`; mock timer starts via `ExamRunner.onRunning`, not while items load) · `ListeningPlayer` · `PassageReader` · `QuestionCard` | Thành phần của exam engine. Trang động (`[id]`/`[part]`) là client component đọc tham số bằng `useParams()` (countdown, phát TTS, đoạn đọc, thẻ câu hỏi) |
| `exam/ReportQuestionModal` | Báo câu hỏi lỗi (lý do + ghi chú) → chỉ lưu local vào `reportedQuestions` (max 200); **không** set `flagged` ở `exam_items` và không sync |
| `LinkList` | Titled list of destinations in one bordered card (rows divided by rules, chevron); used by `/exam`, `/speak`, `/write` |
| `Segmented` | Single-choice segmented control (`role=radiogroup`); used by `/exam` (kỳ thi, trình độ), `/stats` tabs, `/today` minutes, `/settings` tabs, `/mistakes` + `/exam/mistakes` + `/history` filters |
| `ImportWords` · `QuizCard` | Bulk import từ; thẻ quiz dùng chung |

---

## Context Providers

### `ProviderContext` (`src/contexts/ProviderContext.tsx`)

`ProviderContextProvider` wraps the app. Exposes:
- `currentProvider` — active provider id
- `availableProviders` — fetched from `/api/providers` on mount
- `setProvider(id)` — sets preferred provider (persisted to localStorage)
- `disabledProviders` — list of opted-out provider ids
- `toggleProvider(id)` — enable/disable; auto-switches away if current is disabled

### `TimerContext` (`src/contexts/TimerContext.tsx`)

`TimerContextProvider` wraps inside `ProviderContextProvider` in `layout.tsx`. A single `setInterval` refreshes timer state from wall-clock timestamps. Countdown uses an absolute deadline, catches up on visibility/pageshow, and manual pause freezes its remaining time. Study time counts only while running and visible. Exposes via `useTimer()`:

```ts
todaySeconds: number          // total seconds studied today (increments while isRunning)
isRunning: boolean            // false when paused
isCountdownMode: boolean      // true when countdownRemaining !== null
countdownTarget: number|null  // original duration of the active countdown session (kept until clearTimeUp)
countdownRemaining: number|null  // seconds left; null when not in countdown
showTimeUp: boolean           // true when countdown just hit 0

pause()                       // stops the interval
resume()                      // restarts the interval
startCountdown(seconds)       // sets countdownTarget + countdownRemaining, resumes timer
stopCountdown()               // cancels countdown without triggering time-up modal
clearTimeUp()                 // dismisses time-up state, clears countdownTarget
```

Persistence: writes `todaySeconds` to `localStorage["studyTime"][YYYY-MM-DD]` with 5 s debounce, flushes on hidden/pagehide/unmount. Reads on mount to restore today's value. `src/lib/useCountdown.ts` is shared by ExamTimer, writing tasks and IELTS speaking prep/recording; it derives remaining seconds from a deadline, checks visibility/pageshow after suspension, and resets to the full duration while disabled so a later run does not start at 0. Recording chooses a supported MediaRecorder MIME type, preserves it in Blob/file upload through transcription, releases microphone tracks on failure/unmount, and handles late permission results after disposal.

---

## Testing

Jest + `@testing-library/react`. Config: `jest.config.ts` + `jest.setup.ts`. Tests live alongside source in `__tests__/` folders. Run: `npm test`.


## Theming

- **Design tokens** ("sổ tay thẻ từ"): RGB triplets in `globals.css` per `data-theme` — `paper` (page), `card` (raised surfaces), `ink`, `muted`, `rule` (lines/borders), `primary` (+`strong`, `soft`; ballpoint blue for actions/links/focus), `marker` (highlighter yellow — only for what needs the learner now, e.g. due counts), `margin` (index-card red; errors). Tailwind exposes them as `bg-paper`, `text-ink`, `border-rule`, `bg-primary/10`… plus fixed `deep` (#16233f, ink on yellow/light pills). Use tokens for new UI; never hardcode hex.
- Tailwind remaps `purple`/`violet`/`indigo` → `blue` and `gray` → `slate`, so older accent classes fall into one palette.
- Status tokens: `ok`, `warn`, `margin` each with `-soft` (`bg-ok-soft`, `text-margin`). styled-jsx and inline styles use `rgb(var(--token))` — no hex, and no `:root[data-theme="dark"]` overrides (tokens already switch).
- **Shared classes** (`@layer components` in `globals.css`) — use them for every new screen:
  `page` (max-w-3xl column) / `page-wide` (max-w-6xl), `page-title` (h1), `page-lead` (one line under the title), `section-title`, `panel` (bordered card), `btn` + `btn-primary` / `btn-secondary`, `field` (input/textarea).
- Copy rules: sentence case, no emoji in labels or headings (✓ ✗ and media glyphs ▶ ⏹ are fine), no "→" on buttons, no ALL-CAPS eyebrow labels. Back links read "← <page name>".
- **Type**: `font-sans` = Be Vietnam Pro (Vietnamese UI); `font-en`/`font-display` = Literata — set English study content (words, example sentences, formulas, passages) in `font-en`.
- `.index-card`: ruled card (3.5rem header, red line, blue rules every 1.75rem). Content below the header uses `leading-7` and no vertical gaps so text sits on the rules (`Flashcard`, home empty state). `.marker-stroke`: highlighter behind a short number (plain marker colour on dark).
- `data-theme` is the resolved theme; `dark:` follows it (`darkMode: ["selector", '[data-theme="dark"]']`). Older pages written for a dark canvas (`text-white`, `white/NN`) or light cards (`bg-white`, grey ink, `*-50/100` tints) are re-mapped by the two blocks at the end of `globals.css`. styled-jsx uses `rgb(var(--token))` and `:global(:root[data-theme="dark"]) .x`.
- `dark-surface` keeps light text on deliberately dark elements in light theme; `keep-light` keeps a light button in dark theme.
- Rule when adding UI: text/background must read in **both** themes (contrast ≥3; `e2e/contrast.e2e.js`).
- Limits: `apple-mobile-web-app-status-bar-style` and manifest `theme_color` are static (#0e182b).

## Storage resilience

- Anything that runs during render or in an effect (providers, `DueBadge`, timer, session tracking, mastery cache, mistake migration) must never throw when `localStorage` is blocked (`SecurityError`), full (`QuotaExceededError`) or holds a value of the wrong top-level type. Use `lib/safe-json.ts` (`readStored`, `readString`, `asArray`, `asObject`) for reads and wrap writes in `try/catch`.
- Writes triggered by a user action may surface an error to the user (e.g. the writing draft warning); they must not be silently swallowed unless the data is a cache.
- `app/error.tsx` and `app/global-error.tsx` are the last-resort boundaries (a retry button instead of a blank page or a React update loop).

## E2E tests

`e2e/` holds a browser suite (Node test runner + puppeteer-core, `npm run e2e`, needs `npm run dev` and Chrome). Run it after UI, theming, storage or AI-error-handling changes; see `e2e/README.md`. Jest ignores it (files are named `*.e2e.js`). `pwa.e2e.js` needs a production server (see README); `npm run e2e` skips it; run `npm run build && npx next start -p 3100`, then `npm run e2e:pwa`.
