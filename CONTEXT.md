# CONTEXT.md — English Study App

Quick reference for Claude. Do not repeat what's already in CLAUDE.md.

---

## Tech Stack

Next.js 15 App Router · React 19 · TypeScript · Tailwind CSS · Jest (jsdom) · localStorage + JSON backup · Firebase (hosting only) · PWA (service worker in `public/sw.js`)

---

## Pages & Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/page.tsx` | Generate & study flashcards; serves unseen words from the local word bank before calling AI, plus a "Tạo trước" job panel |
| `/history` | `src/app/history/page.tsx` | Browse saved words, filter by topic/mastery |
| `/activity` | `src/app/activity/page.tsx` | Completed learning sessions grouped by local date, with type, duration, and accuracy |
| `/review` | `src/app/review/page.tsx` | "Tưới vườn": spaced-repetition review of due words (passes `learned` to `Flashcard`); records a learning session and shows a quality-count summary after the last card |
| `/stats` | `src/app/stats/page.tsx` | Learning analytics — 4 stat tiles (words, active days, mastery, today's study minutes), words-per-day chart, study-time chart, topic distribution, streak calendar, exam accuracy chart (weekly), weakness radar (by question type) |
| `/diary` | `src/app/diary/page.tsx` | Daily learning journal — interactive 26-week heatmap, click a day to see words learned and study time in a slide-in drawer |
| `/grammar` | `src/app/grammar/page.tsx` | Grammar study page — desktop sidebar/mobile selector, static grammar rules, AI examples/exercises, user-generated grammar topics |
| `/import` | `src/app/import/page.tsx` | Bulk import words |
| `/settings` | `src/app/settings/page.tsx` | 4 tabs (`Segmented`): Mô hình AI · Giọng đọc · Dữ liệu · Hồ sơ. Mô hình AI is a list (one row per provider: model id, `role=switch` toggle, Test, "Dùng mô hình này trước") that fits phones |
| `/exam` | `src/app/exam/page.tsx` | Exam dashboard — chọn TOEIC/IELTS, level, drill/mock; `SkillGrove` ("Rừng kỹ năng"): one tree per part, height = % correct over all attempts (coral <60, sun <80, green), grey stump when not practised |
| `/exam/drill/[part]` | `src/app/exam/drill/[part]/page.tsx` | Luyện 1 part (TOEIC RC5/RC6/RC7/LC2/LC3/LC4; IELTS READ_P1/READ_P2/READ_P3, LISTEN_S1–S4; prompt từng part trong `lib/exam/prompts.ts`); records an exam session with part metadata and result totals |
| `/exam/mock` | `src/app/exam/mock/page.tsx` | Full mock test rút gọn với countdown timer; records an exam session with mock metadata and result totals |
| `/exam/mistakes` | `src/app/exam/mistakes/page.tsx` | Sổ lỗi exam: `getExamMistakes()` (unified, `source` `exam:*`), filter, resolve dùng chung với `/mistakes`, badge "sai N lần", drill lại; chạy `runMistakeMigration()` khi tải |
| `/speak` | `src/app/speak/page.tsx` | Chọn scenario giao tiếp hoặc IELTS Speaking part |
| `/speak/roleplay/[id]` | `src/app/speak/roleplay/[id]/page.tsx` | Roleplay hội thoại đa lượt với AI; speaking session ends on user/end-of-turn completion |
| `/speak/ielts/[part]` | `src/app/speak/ielts/[part]/page.tsx` | IELTS Speaking P1/P2/P3 — mic hoặc nhập text; speaking session ends when grading returns, retry starts a new session |
| `/write` | `src/app/write/page.tsx` | Chọn dạng bài viết IELTS/TOEIC |
| `/write/task/[id]` | `src/app/write/task/[id]/page.tsx` | Editor + wall-clock timer + word count + per-task local draft recovery (a draft past its deadline is still restored, shows "Đã hết giờ" and a "Làm lại từ đầu" button that discards it; submitting stays allowed); validates HTTP/feedback before saving; opens result by persisted record UUID; writing session ends after grading result is saved, cancels on early exit |
| `/write/result/[id]` | `src/app/write/result/[id]/page.tsx` | Kết quả chấm — annotated essay + model answer; reads saved record by UUID (survives PWA restart), with sessionStorage fallback for legacy task-ID URLs; title is derived from `kind` (IELTS Task 1 / IELTS Task 2 / TOEIC Writing – Business Email) |
| `/today` | `src/app/today/page.tsx` | Kế hoạch học tự động từ `generatePlan` (SRS debt, điểm yếu exam, lỗi chưa xử lý, grammar mastery, nhắc speaking/writing). Trang "Vườn hôm nay": `GardenBed` ở đầu, cột phải có chuỗi ngày tưới (`computeStreak`) và cây mục tiêu. Khung **mục tiêu** (`goalProgress` trong `lib/goal-progress.ts`) khi hồ sơ có goal TOEIC/IELTS: điểm mục tiêu, điểm thi thử gần nhất (chỉ tính bài `mock`; IELTS = trung bình band Listening/Reading làm tròn 0.5), còn thiếu bao nhiêu, còn bao nhiêu ngày tới `targetDate` |
| `/path` | `src/app/path/page.tsx` | Lộ trình: learning profile + mastery 6 kỹ năng (`recomputeMastery()`) + top nhóm lỗi; link tới quiz/mistakes |
| `/mistakes` | `src/app/mistakes/page.tsx` | Sổ lỗi hợp nhất (`unifiedMistakes`) — lọc theo skill/status, đổi status, resolve |
| `/library` | `src/app/library/page.tsx` | Tìm kiếm xuyên từ vựng / lỗi / speaking / writing |
| `/vocab/quiz` | `src/app/vocab/quiz/page.tsx` | Quiz điền từ trên từ đã học (`/api/generate-fillblank`); ghi session |
| `/vocab/context` | `src/app/vocab/context/page.tsx` | Luyện từ trong ngữ cảnh (story/dialogue/email/workplace) qua `/api/vocab/context`; chọn từ đã lưu hoặc tự nhập từ (`parseWordInput`, tối đa 20, chỉ dùng cho lần tạo) |
| `/grammar/quiz` | `src/app/grammar/quiz/page.tsx` | Quiz ngữ pháp nhiều câu; ghi `grammarAttempts`, lỗi → `unifiedMistakes`, session; ưu tiên sub-rule yếu/bookmark |
| `/speak/shadowing` | `src/app/speak/shadowing/page.tsx` | Nghe–nhắc lại: ghi âm → Whisper → lưu `SpeakingRecord` (mode `shadowing`); transcribe lỗi thì huỷ session, và session cũ luôn bị huỷ trước khi tạo session mới |
| `/speak/history` | `src/app/speak/history/page.tsx` | "Bài nói đã làm": lịch sử speaking + nghe lại audio (IndexedDB); bản ghi âm cũ hơn 90 ngày bị xoá |
| `/write/history` | `src/app/write/history/page.tsx` | Lịch sử bài viết; mở rewrite |
| `/write/rewrite/[id]` | `src/app/write/rewrite/[id]/page.tsx` | Viết lại đoạn sai; chấm qua `/api/exam/grade-open`; lỗi → `unifiedMistakes` |

**Navigation** (`AppNavigation.tsx`, mounted in `layout.tsx`): desktop (`lg+`) = sticky left sidebar grouped Hôm nay/Ôn tập · Học · Luyện · Tiến độ, with Cài đặt, `HeaderTimer` and `ProviderBadge` at the bottom; phones = top bar (brand + timer) and a fixed bottom tab bar (Hôm nay, Từ mới, Ôn tập, Luyện thi, Thêm). "Thêm" is a `<details>` sheet with every other link (≥44px targets, backdrop closes it, closes on route change). Active link uses `usePathname` + `aria-current`. `.app-content` reserves the tab bar height below `lg`. No footer.

---

## API Routes (POST, trừ `/api/providers` và `/api/admin/metrics` là GET)

| Route | Body | Response |
|---|---|---|
| `/api/generate-words` | `{ topic, exclude?: string[], count?: 1–30, knownCount?: number, provider?, disabledProviders? }` | `{ word, meaning }[]` |
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

Mọi route gọi AI đều đi qua `callTask` (task router, có metrics) — kể cả lần gọi sửa JSON (`repair`). Chúng set header `X-Provider-Used`. Lời gọi AI thật nằm ở `src/lib/providers/`.

`/api/generate-words` nhận `exclude` (từ đã có, tối đa 200, khử trùng), `count` (1–30, mặc định 5) và `knownCount` (số từ đã biết của chủ đề, thêm vào prompt). Prompt yêu cầu model tránh các từ đó; kết quả bị lọc lại và gọi bổ sung một lần nếu model vẫn trả từ trùng.

**Vercel `maxDuration`**: mọi route gọi AI export `maxDuration = 300` (mức tối đa của gói Hobby khi bật Fluid compute; chuỗi fallback có thể tốn nhiều lần 25 s); `/api/speech/transcribe` giữ `60`. Nếu project tắt Fluid compute, Hobby chỉ cho tối đa 60 s và cần giảm số này.

**Giới hạn request** (`src/middleware.ts` + `src/lib/api-limits.ts`, áp cho mọi `POST /api/*` trước khi route đọc body): body tối đa theo `content-length` — mặc định 16 KB; `/api/write/grade` và `/api/speak/roleplay` 64 KB, `/api/speech/grade` 32 KB, `/api/exam/generate-item` 8 KB; `/api/speech/transcribe` không giới hạn ở đây (route tự giới hạn 25 MiB) → 413; thiếu `Content-Length` (trừ transcribe) → 411. Mỗi IP (`x-vercel-forwarded-for` nếu có, nếu không thì phần tử **cuối** của `x-forwarded-for` do proxy thêm — phần tử đầu do client tự đặt nên không tin) tối đa `API_RATE_LIMIT` request/phút (mặc định 60; `0` = tắt) → 429 + `Retry-After`. Bộ đếm in-memory theo instance; khi quá 1000 IP chỉ xoá các IP không còn request trong cửa sổ.

**Security headers** (`next.config.mjs`, mọi đường dẫn): CSP (`default-src 'self'`; script thêm `'unsafe-inline'` cho theme script/Next bootstrap, `'unsafe-eval'` chỉ ở dev, googletagmanager; connect tới `*.googleapis.com`, `*.google-analytics.com`, `*.analytics.google.com` cho Firebase Analytics; `media-src blob:` cho ghi âm; `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` (chỉ `microphone=(self)`), HSTS. Thêm domain mới phía client thì phải thêm vào CSP.
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
  reviewInterval?: number;     // days until the next review
  mastery?: number;            // 0–5 stars (stabilityToMastery: <1, <3, <7, <21, <60 days, else 5)
  synonyms?: string[];
  antonyms?: string[];
  stability?: number;          // FSRS: days until recall drops to 90%
  difficulty?: number;         // FSRS: 1–10
  lastReviewedAt?: string;     // FSRS: ISO
  easiness?: number;           // legacy SM-2, read once to convert
  repetitions?: number;        // legacy SM-2
}
```
SRS uses **FSRS-4.5** (`src/lib/srs.ts`, default weights, target retention 90%, max interval 365 days). Use `reviewWord(word, quality: 0|3|4|5)` (Quên/Khó/Được/Dễ → Again/Hard/Good/Easy).

### Word bank & generation job (`src/lib/word-bank.ts`, `src/lib/word-job.ts`, `src/lib/word-job-runner.ts`)

```ts
interface BankWord {
  word: string;
  meaning: string;
  topic: string;
  createdAt: string;   // ISO
  seenAt?: string;     // ISO, set when displayed on a card
}

interface WordJob {
  id: string;
  topic: string;
  target: number;      // total words wanted for the topic in the bank
  status: "running" | "paused" | "done" | "error";
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  lock?: { tabId: string; heartbeatAt: string };
}
```

`word-bank.ts` chuẩn hoá `trim + gộp space + lowercase`; `addBankWords` lọc trùng với bank **và** `learnedWords`, trả `{ added, persisted }` (ghi lỗi → giữ batch trong overlay bộ nhớ, `persisted: false`). `getUnseen`/`countBank` bỏ từ đã học; `takeUnseen` lấy + đánh dấu `seenAt`; `pickExcludeSample` gửi tối đa 200 từ (120 mới nhất + ngẫu nhiên phần còn lại + learned).

`word-job-runner.ts`: một worker, lô 20, rate window 40 request/phút, backoff 2^n (≤30 s), 429 = cooldown (`Retry-After`, 5 lần liên tiếp → `error`), dừng khi đủ target / 3 lô rỗng / 3 lỗi / ghi bank lỗi. `WordJobContext` (mount trong `layout.tsx`) chạy job xuyên trang, giữ lock giữa các tab (heartbeat 5 s, cũ sau 30 s) và dừng khi đóng tab.

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
  shortcutsEnabled: boolean;        // default true; tắt phím tắt ExamRunner và flashcard
  reminderTime: string;             // "HH:MM", default "20:00"; giờ nhắc học (banner + .ics)
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
| `wordBank` | `BankWord[]` | Từ đã sinh, tối đa 5.000; nguồn chặn trùng (bank + `learnedWords`), có `seenAt` |
| `wordJob` | `WordJob \| null` | Job sinh trước đang chạy/dở; runtime, không vào backup, `clearAllData` xoá |
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
| `learningLanguages` | `LearnLang[]` | Languages being studied (default `["en"]`, never empty); `LanguagePicker` |
| `dailyPlan` | `{ date, blocks }` | Kế hoạch `/today` — regenerate mỗi ngày |
| `lastSpeakingAt` | ISO string | Để /today nhắc luyện nói sau 2 ngày |
| `lastWritingAt` | ISO string | Để /today nhắc luyện viết sau 5 ngày |
| `speakingSessions` | `SpeakingRecord[]` | IELTS speaking session history; newest-first, max 200 |
| `writingTaskDraft:<taskId>` | `{content: string, deadline: number}` | Local unfinished writing task; saved synchronously on edits/start, restored on mount (even past its deadline), cleared after successful grading and local result save or by "Làm lại từ đầu" |
| `lastBackupAt` | ISO string | Lần xuất file sao lưu gần nhất (nhắc sao lưu sau 7 ngày) |
| `studyReminderSnoozedOn` | `YYYY-MM-DD` | Ngày đã bấm "Để mai" ở banner nhắc học; không đưa vào file sao lưu |
| `retentionRanOn` | `YYYY-MM-DD` | Ngày local đã chạy dọn dữ liệu 90 ngày; không đưa vào file sao lưu |
| `backupReminderSnoozedUntil` | ISO string | Ẩn banner nhắc sao lưu tới mốc này; không đưa vào file sao lưu |
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

**Task router** (`src/lib/ai-tasks.ts`): `callTask({ task, prompt, provider?, disabledProviders?, temperature? })` → `{ text, providerId }`. Bọc `callWithFallback`, chọn provider theo `TASK_PROVIDER_MAP` (bảng tĩnh; chỉ `speaking-grade` và `writing-grade` ghim theo `GRADING_PROVIDER`) và ghi metric mỗi lần gọi. `AITaskName` → route: `word-generation` (generate-words), `vocab-batch` (generate-batch), `sentence-generation` (generate-sentence), `vocab-exercise` (generate-synonyms, generate-fillblank), `reading-generation` (generate-reading), `sentence-grade` (grade-sentence), `grammar-generation` (grammar-generate), `grammar-explanation` (grammar-examples), `grammar-exercise`, `exam-generation` (exam/generate-item), `exam-explanation` (exam/explain), `exam-grade` (exam/grade-open), `speaking-roleplay`, `speaking-grade`, `writing-grade`, `vocab-context`; `writing-feedback` chưa dùng.
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

On first flip: fetches sentence + synonyms in parallel. Saved state is lazy (only after flip). Pronunciation button (`PronunciationButton`) floats on front face. Both faces are `.postcard`s; the front has a `.stamp` with the word's `Plant` (stage = `growthStage(learned?.mastery)`). Save button: "Gieo vào vườn" / "Đã gieo".

In **review mode** (`isReviewMode=true`): shows 4 review grade buttons — Quên (0), Khó (3), Được (4), Dễ (5) — instead of save. Prop `shortcuts` (set on the first card of `/review`, outlined in blue): Space/Enter flips, 1–4 grade; ignored while typing or when a button/link has focus; off when `learningProfile.shortcutsEnabled` is false. Optional prop `learned` (the `LearnedWord`): each grade button previews the stage and interval it would give (`fsrs(fsrsStateOf(learned), q)`). Updates the schedule via `reviewWord` and passes the quality to `onReviewed` for session tracking. `/review` cancels unfinished sessions on exit; its summary reports counts, accuracy (Được + Dễ), duration, and remaining due words.

---

## Learning languages (`src/lib/languages.ts`)

`LearnLang` = `en | zh | ja | ko` (Chinese is simplified). `LANG_INFO` has the Vietnamese label, native name, short code (EN, 中, 日, 한), voice code (`en-US`, `zh-CN`, `ja-JP`, `ko-KR`), HTML `lang` and reading name (pinyin, kana, romanization). localStorage `learningLanguages` (array, default `["en"]`, never empty) is set by `LanguagePicker` (sidebar + phone top bar) and read with `useLearningLanguages()`; `setLearningLanguages` fires a `learning-languages` window event.

- Words: `LearnedWord` and `BankWord` have `lang?` (missing = English), `reading?`, `conceptId?` (same meaning in other languages, generated together). Identity is `wordKey(lang, word)` everywhere (saving, review, delete, bank dedupe, backup merge), so 学生 zh and 学生 ja are separate words. `deleteLearnedWord(word, lang="en")`, `reviewWord(word, q, now, lang="en")`, `getWordsForReview(langs?)`.
- Bank: `getUnseen/countBank/markBankWordsSeen/pickExcludeSample` take a language (default `"en"`). Concepts: `addConcepts`, `getUnseenConcepts(topic, langs, n)` (only concepts complete in every language), `countConcepts`, `markConceptsSeen`, `countAvailable(topic, langs)` (words for English only, concepts otherwise), `isEnglishOnly`.
- `/api/generate-words`: no `langs` or `["en"]` → the original word list; otherwise `{ concepts: [{ meaning, words: { en: {word}, zh: {word, reading} } }] }` with `exclude` per language. `/api/generate-sentence` with `lang` (not en) → `{ sentence, reading, translation }`; `/api/generate-synonyms` takes `lang`.
- Từ mới: English only keeps `FlashcardGrid`; several languages show `ConceptCard` (front: each language's word via `LangText` + 🔊; back: meaning + an example per language; "Gieo vào vườn" saves one word per language). Quiz and Đọc hiểu work per language (see Practice below). The word job (`WordJob.langs`) generates concepts through the same generic `runWordJob`.
- Review: `Flashcard` takes `lang`/`reading` ("Cũng là" shows sibling words; typing modes work in every language). `/review` shows toggle chips per language with due words, preselected to the learning languages.
- Vườn từ, Thống kê: a "Ngôn ngữ" filter when saved words span several languages; GardenBed labels get the short code.
- Practice (phase 2): `lib/answer-match.ts` (`normalizeAnswer`, `answersMatch`, `answerTokens`, `similarityPct`; zh/ja compare without spaces/punctuation, en/ko by words) and `lib/speech-voice.ts` (`voicesFor`, `pickVoice`, `speakText` with optional onstart/onend; saved voice if it speaks the language, else exact match, else browser default). Routes taking `lang` (English prompt unchanged when absent): `generate-fillblank` (non-en → `{sentence, reading, translation}`), `grade-sentence`, `generate-reading` (non-en adds `translation`), `vocab/context`, `speak/roleplay` (non-en adds `reading`; English prompt pinned by a Jest snapshot); `speech/transcribe` takes form field `language` and returns Whisper's `language`.
- Card modes (`WritingChallenge`, `FillBlank`, `DictationMode`) take `lang` for every language. `/vocab/quiz`, `/vocab/context`, `/speak/shadowing` and roleplay show a "Ngôn ngữ" `Segmented` when more than one language qualifies (quiz: ≥4 saved words, context: any saved word, shadowing/roleplay: learning languages); roleplay's language locks after the first message (later header-picker changes don't affect it); Shadowing hides its selector while recording or processing. `speech/transcribe` sends Whisper a simplified-Chinese prompt for `zh`. `parseWordInput` accepts any letters and CJK separators (，、；). `lib/vocab-quiz.ts`: `quizWords(words, lang)`, `quizLanguages`, `buildMCQ` (unique options). `lib/shadow-sentences.ts`: 8 sentences per language with reading and Vietnamese translation (English set unchanged). Từ mới with several languages: "Kiểm tra kiến thức" quizzes all shown words (distractors from the same language) and "Đọc hiểu" has one chip per language. `SpeakingRecord.lang`, `ConversationTurn.reading`.
- `PronunciationButton({ word, lang })` speaks with that language's voice; disabled with a hint when the device has none. `LangText` sets `lang` (correct Han glyphs) and the reading; CJK uses system fonts (Tailwind `sans`/`en` stacks).

## Topics (`src/lib/topics.ts`)

`RANDOM_TOPIC = "Random"` is the "Ngẫu nhiên" chip in `TopicSelector`: no theme, the AI picks useful words across many everyday areas (`generateWords` swaps the topic phrase for that instruction). It is stored in the word bank like any topic, and `pickExcludeSample("Random")` excludes words from every topic. `DEFAULT_TOPICS` and `topicLabel(topic)` (Vietnamese label) are used by `TopicSelector`, `Flashcard`, `/`, `/history`, `/stats`.

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
- `reviewWord(word, quality: 0|3|4|5, now?)` — FSRS trong `src/lib/srs.ts`: `fsrs(prevState | undefined, quality)` → `{ stability, difficulty, lastReviewedAt, intervalDays, nextReviewAt }`. Quên → ôn lại sau 1 ngày; còn lại interval = ngày tới khi khả năng nhớ còn 90% (= stability). Lưu `stability`, `difficulty`, `lastReviewedAt`, `reviewInterval`, `nextReviewAt`, `mastery`, `updatedAt`.
- Thẻ cũ lên lịch bằng SM-2 được chuyển khi ôn lần đầu (`fsrsStateOf`): stability = `reviewInterval`, difficulty = `10 − (easiness − 1.3) × 5` (EF 2.5 → 4), `lastReviewedAt` = `nextReviewAt − interval`. Thẻ chưa ôn lần nào được coi là mới.

---

## Data Transfer / Backup (`src/lib/data-transfer.ts`)

Không dùng Supabase hay backend nào. Toàn bộ dữ liệu nằm trong localStorage của trình duyệt.

- `exportData()` → JSON string `{ app: "english-study", version: 1, exportedAt, data: { key: value } }`, giữ nguyên raw string của từng key. Bỏ qua key runtime (`syncKey`, `syncFailedQueue`, `backupReminderSnoozedUntil`, `retentionRanOn`, `studyReminderSnoozedOn`, `wordJob`).
- `importData(json)` → validate `app`/`version`/`data`, ghi đè từng key có trong file; key không có trong file được giữ nguyên. Trả `{ imported, skipped }`.
- `clearAllData()` → xoá mọi key của app (trừ key runtime), trả số key đã xoá.
- `backupFileName(date?)` → `english-study-backup-YYYY-MM-DD.json`.
- `mergeData(json)` → **nhập gộp**: không ghi đè cả key. Danh sách bản ghi gộp theo từng mục (định danh: `id`; `learnedWords` theo `word`, `wordBank` theo `word` chuẩn hoá, `dailyChallenge` theo `date`, `reportedQuestions` theo `questionId`, `grammarBookmarks` theo `topicId:subRuleId`, `masteryTimeline` theo `date:skill`, `examTagAccuracies` theo `tag`), bản có mốc thời gian mới hơn (`updatedAt` → `finishedAt` → `createdAt` → `learnedAt` → `startedAt` → `reportedAt` → `at`) thắng, hoà thì giữ bản trên máy. `examTagAccuracies` lấy bản có `total` lớn hơn, `dailyChallenge` ưu tiên `completed`, `wordBank` giữ `seenAt` nếu một bên đã đánh dấu. Mảng chuỗi (`customTopics`) hợp nhất; `studyTime` lấy số giây lớn hơn mỗi ngày; `examBank` gộp theo từng bank key; `lastSpeakingAt`/`lastWritingAt`/`lastBackupAt` lấy mốc sau. `learningSessions`, `examAttempts`, `speakingSessions`, `writingSubmissions` sắp lại mới nhất trước. Cài đặt, hồ sơ, cache giữ giá trị trên máy, chỉ điền key còn thiếu. Giới hạn: không có tombstone nên từ đã xoá trên máy sẽ quay lại nếu file còn.
- `downloadBackup(json)` tải file và ghi `lastBackupAt`; `markBackedUp()`, `needsBackup()` (có dữ liệu học và chưa sao lưu trong `BACKUP_REMIND_DAYS` = 7 ngày). `storageUsage()` → byte ước tính của localStorage (2 byte/ký tự), key lớn nhất trước; `LOCAL_STORAGE_LIMIT` = 5 MB.
- UI: Settings → tab **Dữ liệu** (`src/app/settings/page.tsx`) — xuất file, nhập file chọn **Gộp từ file** (`mergeData`) hoặc **Thay thế bằng file** (`importData`, có confirm) rồi reload, **Dung lượng** (thanh % trên ~5 MB, cảnh báo ≥80%, 3 mục lớn nhất), xoá toàn bộ (confirm 2 bước). `clearAllData` xoá tường minh `wordJob` dù nó nằm trong danh sách runtime bị bỏ qua.
- `BackupReminder` (trong `layout.tsx`, đầu vùng nội dung): banner nhắc sao lưu khi `needsBackup()`; "Xuất file sao lưu" tải ngay, "Để mai" ghi `backupReminderSnoozedUntil` (+1 ngày).
- Không đồng bộ tự động giữa các thiết bị; chuyển máy bằng xuất/nhập file.
- `exam_items`: đề sinh ra chỉ lưu local trong `examBank`; không còn kho đề dùng chung trên server.

---

## Study reminders (`src/lib/reminders.ts`)

Không cần server. `studyNudge(reminderTime, now?)` trả `{ dueWords, streak }` khi: có từ đã lưu, chưa có phiên học **hoàn thành** hôm nay (theo `learningSessions`, không dùng `studyTime` vì timer chạy cả khi chỉ mở app), đã qua giờ `learningProfile.reminderTime` (mặc định `"20:00"`), và chưa bấm "Để mai" hôm nay (key `studyReminderSnoozedOn`). `StudyReminder` (trong `layout.tsx`, trên `BackupReminder`) hiện banner với nút "Ôn tập ngay" / "Xem kế hoạch hôm nay" và "Để mai". `buildReminderIcs(time, appUrl)` tạo sự kiện lịch lặp hằng ngày (giờ local, bắt đầu từ ngày mai, có `VALARM`), tải từ Cài đặt → Hồ sơ → "Tải file lịch nhắc học (.ics)".

## Data retention (`src/lib/retention.ts`)

`RETENTION_DAYS` = 90. `pruneOldData(now)` xoá: `learningSessions` có `startedAt` cũ hơn 90 ngày; item trong `examBank` có `createdAt` cũ hơn 90 ngày (trừ item gắn với lỗi exam chưa resolve, để "làm lại" vẫn chạy; bank key rỗng thì bỏ); và bản ghi âm của `speakingSessions` cũ hơn 90 ngày (bỏ `audioId` khỏi bản ghi, giữ điểm và transcript; blob xoá bằng `deleteAudio(ids)` trong `audio-store.ts`). Giữ nguyên: từ đã lưu, sổ lỗi, điểm, bài viết, `examAttempts`, `studyTime`. `runRetention()` chạy tối đa 1 lần/ngày (key `retentionRanOn`), gọi từ `DataRetention` trong `layout.tsx` sau 2 giây. Hệ quả: `/activity`, streak dài nhất và các thống kê đọc `learningSessions` chỉ còn 90 ngày gần nhất. `RetentionNotice` báo việc này ở `/review`, `/history`, `/activity`, `/speak/history`.

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
| `StageCensus` | Row of 6 plants with the number of saved words at each stage (`/history`, `/stats`) |
| `Plant` | SVG of a word's growth stage 0–5 (Hạt, Mầm, Lá, Bụi, Nụ, Hoa = mastery stars); exports `STAGE_NAMES`, `growthStage(mastery)` |
| `GardenBed` | `/today`: the 12 most recently saved words as plants on soil labels; due words are thirsty (yellow drop and rim); "Tưới N cây" links to `/review` |
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
| `StudyReminder` | Banner nhắc học khi đã qua giờ nhắc mà hôm nay chưa hoàn thành phiên học nào; "Để mai" ẩn tới mai |
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
| `ExamRunner` | Items are passed through `withJudgementOptions` (`lib/exam/scoring.ts`) on load, so True/False/Not Given and Yes/No/Not Given questions get three choice buttons with a canonical answer. Stateful exam engine — phases: `loading → ready → running → reviewing → done` (+ `error`); falls back to the local bank when offline/API fails (without a topic filter), or displays an error rather than leaving a loading spinner; accepts `forceComplete` prop to transition directly to reviewing on timer expiry (mock mode); dispatches `LOADING_ERROR` when all API fetches fail |
| `DueBadge` | Client component — live SRS-due word count badge next to "Ôn tập" nav link, updates every 60 s |
| `DiaryCalendar` | Interactive 26-week heatmap calendar for /diary; purple color levels 0–3; click cell opens DayDrawer |
| `DayDrawer` | Slide-in right drawer for /diary; shows daily word list (expandable) + study minutes + prev/next nav |
| `AppNavigation` | Desktop grouped sidebar; phone top bar + bottom tab bar with "Thêm" sheet; timer, provider badge, due badge (marker yellow) |
| `ServiceWorkerRegistration` | Production worker registration; installs through `beforeinstallprompt` when available, native installation instructions otherwise (dismissible with ✕, remembered in `pwaInstallDismissed`); standalone detection and optional persistent storage request; offline notice; waiting-worker update button posts `SKIP_WAITING`, reloads only after user action |
| `ExamTimer` (prop `enabled`; mock timer starts via `ExamRunner.onRunning`, not while items load) · `ListeningPlayer` · `PassageReader` · `QuestionCard` | Thành phần của exam engine. Trang động (`[id]`/`[part]`) là client component đọc tham số bằng `useParams()` (countdown, phát TTS, đoạn đọc, thẻ câu hỏi) |
| `exam/ReportQuestionModal` | Báo câu hỏi lỗi (lý do + ghi chú) → lưu `reportedQuestions` (max 200) và `removeItemFromBank(itemId)` để câu đó không ra lại khi luyện |
| `MistakeWords` | Nút "+ từ" thêm vào ôn tập trên `/mistakes` và `/exam/mistakes` (`lib/mistake-words.ts`: từ khoá của câu exam trong `examBank`, nếu không thì đáp án đúng khi là từ/cụm ≤3 từ; bỏ từ đã học; nghĩa = phần giải thích) |
| `BackupReminder` | Banner nhắc xuất file sao lưu (≥7 ngày, có dữ liệu học); "Để mai" ẩn 1 ngày |
| `DataRetention` · `RetentionNotice` | Chạy `runRetention()` mỗi ngày (không render gì) · dòng thông báo xoá dữ liệu sau 90 ngày |
| `LinkList` | Titled list of destinations in one bordered card (rows divided by rules, chevron); used by `/exam`, `/speak`, `/write` |
| `Segmented` | Single-choice segmented control (`role=radiogroup`); used by `/exam` (kỳ thi, trình độ), `/stats` tabs, `/today` minutes, `/settings` tabs, `/mistakes` + `/exam/mistakes` + `/history` filters |
| `ImportWords` · `QuizCard` | Bulk import từ; thẻ quiz dùng chung |
| `WordBankPanel` | Trang chủ: số từ chưa học, chọn mốc 100/300/1.000 và bắt đầu job; khoá khi job khác đang chạy |
| `WordJobStrip` | Dải tiến trình job trên mọi trang (`Dừng`/`Chạy tiếp`/`Huỷ`); `WordJobStripConnected` mount trong `layout.tsx` |

---

## Context Providers

### `ProviderContext` (`src/contexts/ProviderContext.tsx`)

`ProviderContextProvider` wraps the app. Exposes:
- `currentProvider` — active provider id
- `availableProviders` — fetched from `/api/providers` on mount
- `setProvider(id)` — sets preferred provider (persisted to localStorage)
- `disabledProviders` — list of opted-out provider ids
- `toggleProvider(id)` — enable/disable; auto-switches away if current is disabled

### `WordJobContext` (`src/contexts/WordJobContext.tsx`)

Mount trong `ProviderContextProvider` (cần `useApiFetch`) và ngoài `TimerContextProvider`. `useWordJob()` trả `{ job, count, wordsPerMinute, isOwner, startJob, pauseJob, resumeJob, cancelJob }`. Vòng lặp chạy qua `runWordJob`; `fetchBatch` gọi `/api/generate-words` với `exclude`/`count`/`knownCount` và `AbortController`. Job dở của lần mở trước trở về `paused` (khoá cũ, hoặc khoá của chính tab sau reload — `tabId` giữ trong `sessionStorage`) để người dùng bấm "Chạy tiếp"; tab khác thấy heartbeat mới thì chỉ hiển thị tiến trình.

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

- **Design tokens** ("Vườn bưu thiếp": each word is a postcard, the garden shows progress): RGB triplets in `globals.css` per `data-theme` — `paper` (mint page), `card`, `ink`, `muted`, `rule`, `primary` (leaf green, +`strong`, `soft`, `text` = readable green on paper/card), `marker` (sun yellow — only for what needs the learner now: due counts, thirsty plants), `margin` (coral; errors), `soil` (plant labels, grove ground). Tailwind: `bg-paper`, `text-primary-text`, `bg-soil`… plus fixed `deep` (#17332a, ink on yellow pills). Old `blue/purple/violet/indigo` classes map to Tailwind green, `gray` to neutral. Use tokens for new UI; never hardcode hex.
- Status tokens: `ok`, `warn`, `margin` each with `-soft` (`bg-ok-soft`, `text-margin`). styled-jsx and inline styles use `rgb(var(--token))` — no hex, and no `:root[data-theme="dark"]` overrides (tokens already switch).
- Shared classes (globals.css `@layer components`):
  `page` (max-w-3xl column) / `page-wide` (max-w-6xl), `page-title` (h1, Baloo 2 extrabold), `page-lead`, `section-title`, `panel` (rounded-3xl card), `btn` (pill) + `btn-primary` / `btn-secondary`, `field` (input/textarea).
- **Type** (`layout.tsx`, next/font with the vietnamese subset): `font-sans` = Lexend (UI), `font-display` = Baloo 2 (headings, brand), `font-en` = Fraunces — set English study content (words, example sentences, formulas, passages) in `font-en`.
- `.postcard`: airmail-striped border around an always-light card (light tokens forced inside, also in dark mode). `.stamp`: perforated stamp box for a `Plant`. `.marker-stroke`: highlighter behind a short number. Also used for exam question prompts and reading passages (`QuestionCard`, `PassageReader`), the IELTS speaking cue card and upgraded answer, the roleplay intro, the writing prompt and the band-8 model answer. styled-jsx pages use pill buttons (999px, min 44px) and 1rem/1.5rem card radii like the Tailwind classes.
- Phone chrome: floating rounded tab bar (`bottom-3`, sprout/watering-can icons), `.app-content` bottom padding 6.5rem, `.pwa-status` above it. Theme colours #eef6f0 / #0e1f19 (`lib/theme.ts`, `manifest.ts`).
- **Brand**: app name "ThankZ English" (manifest short name "ThankZ"). Nav shows `public/brand/mark.png` (TZ mark cropped from the logo kit, transparent) plus the name as HTML text (Z in `text-warn`/`dark:text-marker`). Icons/favicon come from `docs/design/logo/ThankZ_English_Logo_Kit/public`. Internal ids keep the old name on purpose: `BACKUP_APP = "english-study"` (old backups still import), SW `CACHE_PREFIX`, reminder ICS `UID`.
- `data-theme` is the resolved theme; `dark:` follows it. The old class re-map blocks were removed: use tokens only (no `bg-white`, `text-gray-*`, `text-white` on transparent backgrounds). `.chip`/`.chip-on` = pill toggles, `.choice` + `-right`/`-wrong`/`-dim` = quiz answers. `/history` is "Vườn từ" (plants per word, stage census, "Cần tưới"); `/path` is a stepping-stone path.
- `dark-surface` keeps light text on deliberately dark elements in light theme; `keep-light` keeps a light button in dark theme.
- Rule when adding UI: text/background must read in **both** themes (contrast ≥3; `e2e/contrast.e2e.js`).
- Limits: `apple-mobile-web-app-status-bar-style` and manifest `theme_color` are static (#0e182b).

## Storage resilience

- Anything that runs during render or in an effect (providers, `DueBadge`, timer, session tracking, mastery cache, mistake migration) must never throw when `localStorage` is blocked (`SecurityError`), full (`QuotaExceededError`) or holds a value of the wrong top-level type. Use `lib/safe-json.ts` (`readStored`, `readString`, `asArray`, `asObject`) for reads and wrap writes in `try/catch`.
- Writes triggered by a user action may surface an error to the user (e.g. the writing draft warning); they must not be silently swallowed unless the data is a cache.
- `app/error.tsx` and `app/global-error.tsx` are the last-resort boundaries (a retry button instead of a blank page or a React update loop).

## E2E tests

`e2e/` holds a browser suite (Node test runner + puppeteer-core, `npm run e2e`, needs `npm run dev` and Chrome). Run it after UI, theming, storage or AI-error-handling changes; see `e2e/README.md`. Jest ignores it (files are named `*.e2e.js`). `pwa.e2e.js` needs a production server (see README); `npm run e2e` skips it; run `npm run build && npx next start -p 3100`, then `npm run e2e:pwa`.
