# Roadmap — Phase 6 & Phase 7

> Bổ sung cho `APP_OVERVIEW.md`. Mục tiêu mới: app phục vụ **tự học giao tiếp + luyện thi TOEIC/IELTS**, 2 người dùng.
> Hai phase này thay thế thứ tự ưu tiên P1–P5 cũ (P1 FSRS được gộp vào Phase 7, P3/P4/P5 lùi lại).
>
> Ngày lập: 2026-09-12

---

## 0. Bối cảnh & nguyên tắc thiết kế

App hiện tại mạnh về **input từ vựng + ngữ pháp tĩnh**, nhưng thiếu hoàn toàn 3 thứ mà TOEIC/IELTS và giao tiếp cần:

| Kỹ năng | Trạng thái hiện tại |
|---|---|
| Vocabulary | ✅ đầy đủ (flashcard, SRS, 4 mode) |
| Grammar | ✅ có (8 topic tĩnh + AI generate) |
| Listening | ❌ chỉ có `dictation` mode ở cấp độ 1 từ |
| Reading | ❌ không có passage, không có question type |
| Speaking | ❌ không có |
| Writing | ⚠️ có `write` mode chấm 1 câu, không có task-level |

Nguyên tắc giữ nguyên từ kiến trúc cũ:

1. **Không thêm backend riêng.** Mọi AI call qua Next.js API route. `src/lib/providers/` vẫn chỉ import server-side.
2. **localStorage là primary, Supabase là mirror.** Không đổi mô hình identity (`syncKey`, không auth).
3. **2 user → tối ưu cho chi phí 0đ, không tối ưu cho scale.** Dùng free tier: Gemini (generate), Groq Whisper (STT), Web Speech API (TTS). Không dựng queue, không dựng worker.
4. **AI output phải validate schema.** Phase 6 tăng số JSON contract từ ~6 lên ~15 → parse thủ công sẽ vỡ. Bắt buộc thêm `zod`.

### Prerequisite gate (làm trước khi bắt đầu Phase 6)

Không bắt đầu Phase 6 khi cây làm việc còn bẩn. Từ `APP_OVERVIEW.md` §11 P0:

```bash
npm test && npm run lint && npm run build
git add src/contexts/TimerContext.tsx src/components/HeaderTimer.tsx \
        src/components/charts/StudyTimeChart.tsx src/components/FirebaseInitializer.tsx
git commit -m "fix(timer): midnight reset + header modal + chart sync"
git checkout -b phase-6-exam-engine
```

---

# PHASE 6 — Exam Engine (Listening + Reading)

**Tại sao phase này trước:** Listening + Reading chiếm 100% điểm TOEIC (LC/RC) và 50% IELTS. Chúng chạy bằng **text + TTS**, không cần microphone, không cần STT → tái sử dụng gần như toàn bộ hạ tầng đang có (`callWithFallback`, `useApiFetch`, `speechSynthesis` từ dictation mode). Rủi ro kỹ thuật thấp nhất, giá trị/ngày cao nhất.

### 6.0 Definition of Done

- [ ] Làm được 1 bộ TOEIC LC full 4 part (rút gọn: 6/10/9/9 câu) và tự chấm ra điểm scaled ước lượng
- [ ] Làm được TOEIC RC Part 5/6/7 và IELTS Reading (3 question type)
- [ ] Mỗi câu sai được ghi vào **mistake log**, và từ vựng khó trong câu sai được đề xuất đẩy sang `learnedWords`
- [ ] Bank câu hỏi được cache — mở lại app không phải generate lại
- [ ] `/stats` có thêm tab Exam: accuracy theo từng question type
- [ ] Toàn bộ JSON từ AI đi qua zod validator, fail → retry 1 lần với prompt sửa lỗi

### 6.1 Data model

File mới: `src/lib/exam/types.ts`

```ts
export type ExamKind = 'TOEIC' | 'IELTS'

export type ToeicPart = 'LC1' | 'LC2' | 'LC3' | 'LC4' | 'RC5' | 'RC6' | 'RC7'
export type IeltsPart = 'LISTEN_S1' | 'LISTEN_S2' | 'LISTEN_S3' | 'LISTEN_S4'
                      | 'READ_P1' | 'READ_P2' | 'READ_P3'
export type ExamPart = ToeicPart | IeltsPart

/** Kiểu câu hỏi — đơn vị để thống kê điểm yếu */
export type QuestionType =
  | 'photo_description'      // TOEIC P1
  | 'question_response'      // TOEIC P2
  | 'conversation'           // TOEIC P3
  | 'short_talk'             // TOEIC P4
  | 'incomplete_sentence'    // TOEIC P5
  | 'text_completion'        // TOEIC P6
  | 'single_passage'         // TOEIC P7
  | 'multiple_passage'       // TOEIC P7
  | 'mcq'                    // IELTS
  | 'true_false_ng'          // IELTS Reading
  | 'yes_no_ng'              // IELTS Reading
  | 'matching_headings'
  | 'matching_information'
  | 'sentence_completion'
  | 'summary_completion'
  | 'form_completion'        // IELTS Listening S1
  | 'map_labelling'          // bỏ qua ở v1 (cần hình)

/** Một "khối" đề: 1 passage/audio script + n câu hỏi bám vào nó */
export interface ExamItem {
  id: string                    // uuid
  kind: ExamKind
  part: ExamPart
  level: 1 | 2 | 3 | 4 | 5      // 1=TOEIC 400 / IELTS 4.5 … 5=TOEIC 900+ / IELTS 8
  topic?: string                // business, environment, education…

  /** Nội dung nguồn */
  passage?: string              // Reading: đoạn văn
  script?: AudioLine[]          // Listening: transcript để TTS đọc
  imagePrompt?: string          // TOEIC P1: mô tả cảnh (v1 render bằng text, v2 dùng ảnh)

  questions: ExamQuestion[]
  createdAt: string             // ISO
  providerUsed?: string
}

export interface AudioLine {
  speaker: 'M1' | 'W1' | 'M2' | 'W2' | 'NARRATOR'
  text: string
}

export interface ExamQuestion {
  id: string
  type: QuestionType
  prompt: string                 // câu hỏi
  options?: string[]             // MCQ: 3 (TOEIC P2) hoặc 4 lựa chọn
  answer: string                 // với MCQ = option text; với completion = đáp án chuẩn
  acceptableAnswers?: string[]   // biến thể chấp nhận được (completion)
  explanation: string            // vì sao đúng — bắt buộc, đây là phần học chính
  keyVocabulary?: string[]       // từ khó trong câu → feed sang SRS
  timeLimitSec?: number
}

/** Một lần làm bài */
export interface ExamAttempt {
  id: string
  kind: ExamKind
  mode: 'drill' | 'mock'         // drill = luyện 1 part; mock = full test rút gọn
  parts: ExamPart[]
  startedAt: string
  finishedAt?: string
  answers: AnswerRecord[]
  score?: ScoreResult
}

export interface AnswerRecord {
  itemId: string
  questionId: string
  type: QuestionType
  part: ExamPart
  userAnswer: string
  correct: boolean
  timeSpentSec: number
  flagged?: boolean
}

export interface ScoreResult {
  raw: { correct: number; total: number }
  byPart: Record<string, { correct: number; total: number }>
  byType: Record<string, { correct: number; total: number }>
  toeic?: { listening: number; reading: number; total: number }  // scaled
  ielts?: { listening?: number; reading?: number }               // band
}

/** Sổ lỗi — nguồn dữ liệu cho Phase 7 adaptive */
export interface MistakeEntry {
  id: string
  questionId: string
  itemId: string
  type: QuestionType
  part: ExamPart
  prompt: string
  userAnswer: string
  correctAnswer: string
  explanation: string
  createdAt: string
  reviewedAt?: string
  resolved: boolean              // đã làm lại đúng
}
```

### 6.2 Storage

Thêm vào `localStorage`:

| Key | Type | Ghi chú |
|---|---|---|
| `examBank` | `Record<string, ExamItem[]>` | key = `${kind}:${part}:${level}`. Cache đề đã generate |
| `examAttempts` | `ExamAttempt[]` | giữ 100 attempt gần nhất, cắt bớt cũ hơn |
| `mistakeLog` | `MistakeEntry[]` | sổ lỗi, không giới hạn |
| `examSettings` | `ExamSettings` | target score, kind ưu tiên, level, listening speed |

```ts
// src/lib/exam/exam-storage.ts
export interface ExamSettings {
  primaryExam: ExamKind
  targetToeic?: number        // 600 / 750 / 900
  targetIelts?: number        // 6.0 / 6.5 / 7.0
  level: 1 | 2 | 3 | 4 | 5
  listeningRate: number       // 0.8 – 1.2, mặc định 1.0
  autoAdvance: boolean
}
```

⚠️ **Cảnh báo dung lượng:** `examBank` phình nhanh (1 TOEIC P7 double passage ≈ 4–6 KB). localStorage quota ~5 MB. Bắt buộc có hàm cắt:

```ts
const BANK_MAX_ITEMS_PER_KEY = 30
export function pruneBank(bank: Record<string, ExamItem[]>) {
  for (const key of Object.keys(bank)) {
    bank[key] = bank[key]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, BANK_MAX_ITEMS_PER_KEY)
  }
  return bank
}
```

Nếu đụng quota → fallback sang IndexedDB (`idb-keyval`, 1 dependency) chỉ cho riêng `examBank`, giữ mọi key khác ở localStorage.

### 6.3 Supabase DDL

```sql
-- exam items: bank dùng chung giữa 2 user (không gắn sync_key → tiết kiệm generate)
create table if not exists exam_items (
  id           uuid primary key,
  kind         text not null,
  part         text not null,
  level        int  not null,
  topic        text,
  passage      text,
  script       jsonb,
  image_prompt text,
  questions    jsonb not null,
  created_at   timestamptz default now()
);
create index if not exists exam_items_lookup on exam_items (kind, part, level);

-- attempts: riêng từng người
create table if not exists exam_attempts (
  id          uuid primary key,
  sync_key    text not null,
  kind        text not null,
  mode        text not null,
  parts       jsonb not null,
  started_at  timestamptz not null,
  finished_at timestamptz,
  answers     jsonb not null,
  score       jsonb
);
create index if not exists exam_attempts_user on exam_attempts (sync_key, started_at desc);

create table if not exists mistake_log (
  id              uuid primary key,
  sync_key        text not null,
  question_id     text not null,
  item_id         uuid,
  type            text not null,
  part            text not null,
  prompt          text,
  user_answer     text,
  correct_answer  text,
  explanation     text,
  created_at      timestamptz default now(),
  reviewed_at     timestamptz,
  resolved        boolean default false
);
create index if not exists mistake_log_user on mistake_log (sync_key, resolved, created_at desc);
```

**Điểm hay của bank dùng chung:** 2 user chia sẻ chung `exam_items` → người thứ hai mở app đã có sẵn đề, không tốn quota generate. Chỉ `attempts` và `mistake_log` mới gắn `sync_key`.

Thêm vào `src/lib/sync.ts`: `pushAttempt`, `pushMistake`, `pullExamBank(kind, part, level)`, giữ đúng phong cách fire-and-forget hiện tại.

### 6.4 API routes mới

```
src/app/api/exam/
├── generate-item/route.ts     POST { kind, part, level, topic? } → ExamItem
├── grade-open/route.ts        POST { question, userAnswer }      → { correct, feedback }
└── explain/route.ts           POST { question, userAnswer }      → { explanation }
```

`generate-item` là route nặng nhất. Contract bắt buộc:

```ts
// src/app/api/exam/generate-item/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callWithFallback } from '@/lib/providers'
import { ExamItemSchema } from '@/lib/exam/schemas'
import { buildItemPrompt } from '@/lib/exam/prompts'
import { parseAiJson } from '@/lib/ai-json'

export async function POST(req: NextRequest) {
  const { kind, part, level, topic, provider, disabledProviders } = await req.json()

  const prompt = buildItemPrompt({ kind, part, level, topic })
  const { text, providerUsed } = await callWithFallback(prompt, provider, disabledProviders)

  const parsed = await parseAiJson(text, ExamItemSchema, {
    // retry 1 lần: gửi lại lỗi zod cho model tự sửa
    repair: (err) => callWithFallback(
      `${prompt}\n\nOutput trước bị lỗi schema: ${err}\nTrả lại JSON hợp lệ, KHÔNG giải thích.`,
      providerUsed, disabledProviders
    ).then(r => r.text),
  })

  return NextResponse.json({ ...parsed, providerUsed },
    { headers: { 'X-Provider-Used': providerUsed } })
}
```

Helper dùng chung — đây là thứ nên viết đầu tiên trong phase:

```ts
// src/lib/ai-json.ts
import { z, ZodTypeAny } from 'zod'

export function stripFences(raw: string) {
  return raw.replace(/```(?:json)?/gi, '').trim()
    .replace(/^[^{[]*/, '')          // cắt preamble
    .replace(/[^}\]]*$/, '')         // cắt postamble
}

export async function parseAiJson<T extends ZodTypeAny>(
  raw: string, schema: T,
  opts?: { repair?: (err: string) => Promise<string> }
): Promise<z.infer<T>> {
  const attempt = (s: string) => schema.parse(JSON.parse(stripFences(s)))
  try { return attempt(raw) } catch (e) {
    if (!opts?.repair) throw e
    return attempt(await opts.repair(String(e)))
  }
}
```

### 6.5 Prompt contract (phần quyết định chất lượng)

`src/lib/exam/prompts.ts` — mỗi part một template riêng, **không dùng 1 prompt chung**. Ví dụ TOEIC Part 3:

```
You are an ETS-style TOEIC item writer.
Produce ONE Part 3 conversation set.

Constraints:
- 2 or 3 speakers, labelled M1/W1/M2. 12–16 turns total, 130–180 words.
- Register: workplace American English. Topic: {topic}.
- Difficulty target: TOEIC {levelToScore(level)} band — control by sentence length,
  idiom density and paraphrase distance, NOT by rare vocabulary.
- Exactly 3 questions. At least ONE must require paraphrase (the answer must NOT
  appear verbatim in the script).
- Each distractor must be plausible: use a real word from the script in a wrong relation.
- explanation: 1–2 sentences, name the exact line that proves the answer.
- keyVocabulary: 2–4 items, B2+ only, lemma form.

Return ONLY JSON matching:
{"kind":"TOEIC","part":"LC3","level":N,"topic":"...","script":[{"speaker":"M1","text":"..."}],
 "questions":[{"type":"conversation","prompt":"...","options":["A","B","C","D"],
 "answer":"<exact option text>","explanation":"...","keyVocabulary":["..."]}]}
```

Ba quy tắc prompt quan trọng cho toàn bộ phase:

1. **`answer` là text của option, không phải index.** Index làm model đếm sai; text đối chiếu được bằng string compare, và zod có thể `refine(q => q.options.includes(q.answer))`.
2. **Ép `explanation` bắt buộc.** Đây là giá trị học thật — 2 user tự học không có giáo viên.
3. **Điều khiển độ khó bằng cú pháp/paraphrase, không bằng từ hiếm.** Nếu không nói rõ, model sẽ nâng độ khó bằng cách nhét từ academic hiếm — sai hoàn toàn tinh thần TOEIC.

Zod refine tương ứng:

```ts
export const ExamQuestionSchema = z.object({
  type: z.string(),
  prompt: z.string().min(5),
  options: z.array(z.string()).min(3).max(4).optional(),
  answer: z.string().min(1),
  acceptableAnswers: z.array(z.string()).optional(),
  explanation: z.string().min(10),
  keyVocabulary: z.array(z.string()).max(6).optional(),
}).refine(q => !q.options || q.options.includes(q.answer),
  { message: 'answer phải trùng đúng một option' })
```

### 6.6 Listening: TTS pipeline

Tái sử dụng `speechSynthesis` (đã dùng ở dictation mode). Không cần dependency mới.

```ts
// src/lib/exam/tts-player.ts
const VOICE_ROLE: Record<AudioLine['speaker'], { gender: 'male'|'female' }> = {
  M1: { gender: 'male' },  M2: { gender: 'male' },
  W1: { gender: 'female' }, W2: { gender: 'female' },
  NARRATOR: { gender: 'female' },
}

export async function playScript(
  lines: AudioLine[], rate: number, onLine?: (i: number) => void
) {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))
  const pick = (g: 'male'|'female') =>
    voices.find(v => g === 'male' ? /male|david|alex|google uk english male/i.test(v.name)
                                  : /female|zira|samantha|google us english/i.test(v.name))
    ?? voices[0]

  for (let i = 0; i < lines.length; i++) {
    onLine?.(i)
    await new Promise<void>((res, rej) => {
      const u = new SpeechSynthesisUtterance(lines[i].text)
      u.voice = pick(VOICE_ROLE[lines[i].speaker].gender)
      u.rate = rate
      u.onend = () => res()
      u.onerror = (e) => rej(e)
      speechSynthesis.speak(u)
    })
    await new Promise(r => setTimeout(r, 250))  // khoảng nghỉ giữa lượt
  }
}
```

Hạn chế chấp nhận được ở v1 (ghi rõ để không phải debug lại sau):

- Không tua được, không có waveform. Chỉ Play / Replay-once / Stop.
- Giọng phụ thuộc OS. Máy Windows có Zira/David; Android/iOS khác hẳn.
- `speechSynthesis` bị Chrome cắt sau ~15s với chuỗi dài → **chia theo từng `AudioLine`, không đọc cả script bằng 1 utterance**. Code trên đã xử lý.
- Không được `await` trong `useEffect` cleanup → nhớ `speechSynthesis.cancel()` khi unmount.

Nâng cấp về sau (không làm ở Phase 6): Gemini TTS multi-speaker trả về audio thật, cache vào Supabase Storage.

### 6.7 UI — các trang mới

```
src/app/exam/
├── page.tsx                 ← dashboard: chọn TOEIC/IELTS, target, nút Drill / Mock / Sổ lỗi
├── drill/[part]/page.tsx    ← luyện 1 part
├── mock/page.tsx            ← full test rút gọn, có timer tổng
├── result/[attemptId]/page.tsx
└── mistakes/page.tsx        ← sổ lỗi, filter theo type, nút "Làm lại"

src/components/exam/
├── ExamRunner.tsx           ← state machine chạy 1 attempt (dùng chung drill + mock)
├── QuestionCard.tsx         ← render theo QuestionType (switch)
├── ListeningPlayer.tsx      ← nút play + highlight dòng đang đọc + reveal transcript
├── PassageReader.tsx        ← 2 cột: passage sticky trái, câu hỏi phải
├── AnswerSheet.tsx          ← lưới số câu, màu theo trạng thái, click nhảy câu
├── ExamTimer.tsx            ← countdown riêng, KHÔNG dùng TimerContext
└── ResultBreakdown.tsx      ← điểm + bảng accuracy theo type
```

**Quyết định kiến trúc quan trọng:** `ExamTimer` là countdown độc lập, còn `TimerContext` vẫn tiếp tục đếm thời gian học tổng. Đừng nhập hai thứ này — `TimerContext` đang persist theo ngày, còn timer đề thi phải reset theo attempt.

`ExamRunner` giữ state:

```ts
type RunnerState = {
  phase: 'loading' | 'ready' | 'running' | 'paused' | 'grading' | 'done'
  items: ExamItem[]
  flatQuestions: { item: ExamItem; q: ExamQuestion }[]
  cursor: number
  answers: Record<string, string>
  flags: Set<string>
  startedAt: number
  perQuestionStart: number
}
```

Reducer thay vì nhiều `useState` — có ~8 trường liên quan nhau, `useReducer` sẽ tránh bug race khi autoAdvance bật.

### 6.8 Scoring

```ts
// src/lib/exam/scoring.ts

/** Nội suy tuyến tính từ bảng anchor. KHÔNG phải bảng ETS chính thức —
 *  chỉ để theo dõi xu hướng tiến bộ. Ghi disclaimer này lên UI. */
const TOEIC_LC_ANCHORS: [number, number][] = [
  [0,5],[10,40],[20,85],[30,130],[40,185],[50,255],[60,315],[70,370],[80,415],[90,460],[96,495],[100,495],
]
const TOEIC_RC_ANCHORS: [number, number][] = [
  [0,5],[10,25],[20,65],[30,115],[40,170],[50,225],[60,280],[70,335],[80,390],[90,445],[96,490],[100,495],
]

function interpolate(anchors: [number, number][], x: number) {
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i]
    if (x <= x1) return Math.round((y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)) / 5) * 5
  }
  return anchors.at(-1)![1]
}

/** raw = số câu đúng, total = số câu đã làm (đề rút gọn → quy về thang 100) */
export function toeicScaled(raw: number, total: number, section: 'LC' | 'RC') {
  const per100 = (raw / total) * 100
  return interpolate(section === 'LC' ? TOEIC_LC_ANCHORS : TOEIC_RC_ANCHORS, per100)
}

const IELTS_READING_ACADEMIC: [number, number][] = [
  [39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],
]
const IELTS_LISTENING: [number, number][] = [
  [39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[6,3.5],[4,3],
]

export function ieltsBand(raw: number, total: number, skill: 'reading' | 'listening') {
  const scaled40 = Math.round((raw / total) * 40)
  const table = skill === 'reading' ? IELTS_READING_ACADEMIC : IELTS_LISTENING
  return table.find(([r]) => scaled40 >= r)?.[1] ?? 2.5
}
```

Chấm câu completion (IELTS) cần normalize, không so sánh thô:

```ts
export function isCompletionCorrect(user: string, q: ExamQuestion) {
  const norm = (s: string) => s.toLowerCase().trim()
    .replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
    .replace(/^(a|an|the)\s+/, '')
  const accepted = [q.answer, ...(q.acceptableAnswers ?? [])].map(norm)
  return accepted.includes(norm(user))
}
```

Nếu `false` nhưng độ dài gần nhau (Levenshtein ≤ 2) → gọi `/api/exam/grade-open` để AI quyết định, tránh đánh trượt vì lỗi chính tả nhỏ. Chỉ gọi khi cần, tiết kiệm quota.

### 6.9 Cầu nối sang hệ thống hiện có

Đây là phần khiến Phase 6 không phải một app rời rạc:

1. **Mistake → SRS.** Sau khi chấm, gom `keyVocabulary` của mọi câu sai → hiện modal "Thêm N từ này vào flashcard?" → tạo `LearnedWord` với `topic = \`exam:${part}\``, `example` = câu chứa từ trong passage, `mastery = 0`, `nextReviewAt = now + 1 day`. Tái dùng nguyên `addWord()` trong `storage.ts`.
2. **Grammar → Part 5.** Ở `/grammar`, mỗi sub-rule thêm nút **"Luyện TOEIC Part 5"** → mở drill với `topic = rule.name`.
3. **Study time.** `ExamRunner` mount → `timer.start()`; unmount → `timer.pause()`. Thời gian làm đề tính vào `studyTime` như mọi hoạt động khác.
4. **Stats.** Thêm `ExamAccuracyChart` (accuracy theo tuần) và `WeaknessRadar` (accuracy theo `QuestionType`) vào `/stats`.

### 6.10 Thứ tự commit đề xuất

| # | Commit | Nội dung |
|---|---|---|
| 1 | `chore: add zod + ai-json helper` | `src/lib/ai-json.ts` + test |
| 2 | `feat(exam): types, schemas, storage` | `types.ts`, `schemas.ts`, `exam-storage.ts`, `pruneBank` |
| 3 | `feat(exam): generate-item API + prompts` | 1 part trước (RC5 — đơn giản nhất, không TTS) |
| 4 | `feat(exam): ExamRunner + QuestionCard` | chạy được drill Part 5 end-to-end |
| 5 | `feat(exam): scoring + result page` | scoring.ts + `/exam/result/[id]` |
| 6 | `feat(exam): reading parts (P6, P7, IELTS)` | `PassageReader`, các question type Reading |
| 7 | `feat(exam): TTS listening player + LC parts` | `tts-player.ts`, `ListeningPlayer`, LC1–LC4 |
| 8 | `feat(exam): mistake log + SRS bridge` | `/exam/mistakes`, modal thêm từ |
| 9 | `feat(exam): mock mode + AnswerSheet` | timer tổng, điều hướng lưới |
| 10 | `feat(sync): exam tables` | DDL + push/pull functions |
| 11 | `feat(stats): exam accuracy charts` | 2 chart mới |

Làm **Part 5 xuyên suốt tất cả tầng trước** (commit 3→5), rồi mới nhân rộng sang part khác. Tránh viết 7 prompt rồi mới phát hiện contract sai.

### 6.11 Test

```bash
npm test -- exam
```

Ưu tiên test phần logic thuần, bỏ qua test UI nặng:

- `scoring.test.ts` — interpolate biên (raw=0, raw=total), bảng IELTS ở mọi ngưỡng
- `completion.test.ts` — normalize: `"The Manager"` vs `"manager"`, dấu câu, số nhiều
- `schemas.test.ts` — refine `answer ∈ options`, thiếu `explanation` phải fail
- `ai-json.test.ts` — output có ```json fence, có preamble "Here is the JSON:", JSON lồng trong text
- `exam-storage.test.ts` — `pruneBank` giữ đúng 30 mới nhất

Đặt mục tiêu: +40 test (180 → ~220).

### 6.12 Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Chất lượng đề AI thấp (distractor lộ liễu, answer sai) | **Cao** | Nút "Báo lỗi câu này" → set `flagged` trong bank, ẩn khỏi lần sau. Với 2 user, curation thủ công là chiến lược hợp lệ |
| localStorage quota | Trung bình | `pruneBank` + sẵn kế hoạch IndexedDB |
| `speechSynthesis` khác nhau giữa thiết bị | Trung bình | Cho chọn voice trong `/settings` > Voice (đã có tab sẵn) |
| Free tier rate limit khi generate mock 50 câu | Trung bình | Generate tuần tự có delay 1.5s + progress bar; pull từ `exam_items` trước khi gọi AI |
| Thời gian generate lâu → cảm giác app đơ | Trung bình | `warmBank()` chạy lúc idle: nền tảng generate trước 3 item cho part hay dùng |

---

# PHASE 7 — Speaking, Writing & Adaptive Engine

**Tiền đề:** Phase 6 đã sinh ra dữ liệu hành vi (`examAttempts`, `mistakeLog`) + dữ liệu từ vựng (`learnedWords`). Phase 7 làm 2 việc: (a) mở nốt 2 kỹ năng output, (b) dùng toàn bộ dữ liệu đã có để **tự quyết định hôm nay học gì**.

### 7.0 Definition of Done

- [ ] Nói vào mic → có transcript → có feedback chấm theo band descriptor
- [ ] IELTS Speaking Part 2 đầy đủ: cue card, 1 phút chuẩn bị, 2 phút nói, chấm 4 tiêu chí
- [ ] Roleplay giao tiếp đa lượt (đặt phòng, phỏng vấn, khiếu nại) — nói/gõ đều được
- [ ] IELTS Writing Task 1 + Task 2 chấm theo 4 band descriptor, có bản sửa inline
- [ ] SRS chuyển sang SM-2 thật, badge due count trên navbar
- [ ] `/today` — kế hoạch học sinh tự động từ điểm yếu

### 7.1 STT — quyết định kỹ thuật

Hai lựa chọn, **chọn B**:

| | A. Web Speech API | B. MediaRecorder → Groq Whisper |
|---|---|---|
| Chi phí | 0 | 0 (free tier) |
| Trình duyệt | Chrome/Edge only | mọi trình duyệt hiện đại |
| Độ chính xác giọng Việt nói tiếng Anh | kém | tốt hơn rõ rệt |
| Timestamps | không | có (`verbose_json`) |
| Cần API route | không | có |
| Giữ được audio để nghe lại | không | có |

Chọn B vì: nghe lại chính giọng mình là công cụ học phát âm quan trọng nhất, và Whisper xử lý accent tốt hơn hẳn. Dùng A làm fallback khi `/api/speech/transcribe` lỗi.

```ts
// src/app/api/speech/transcribe/route.ts
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const audio = form.get('audio') as File      // webm/opus từ MediaRecorder

  const upstream = new FormData()
  upstream.append('file', audio, 'speech.webm')
  upstream.append('model', 'whisper-large-v3-turbo')  // ⚠️ verify tên model hiện hành
  upstream.append('response_format', 'verbose_json')
  upstream.append('language', 'en')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: upstream,
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })

  const data = await res.json()
  return NextResponse.json({
    text: data.text,
    durationSec: data.duration,
    segments: (data.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: s.text })),
  })
}
```

> ⚠️ Kiểm tra lại tên model Whisper trên Groq tại thời điểm implement — model ID đổi khá thường xuyên. Đặt qua `GROQ_WHISPER_MODEL` trong `.env.local`, mặc định rơi về giá trị hard-code.

Client recorder:

```ts
// src/lib/speech/recorder.ts
export function createRecorder() {
  let chunks: Blob[] = [], rec: MediaRecorder | null = null
  return {
    async start() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      rec.ondataavailable = e => e.data.size && chunks.push(e.data)
      rec.start(1000)
    },
    stop(): Promise<Blob> {
      return new Promise(res => {
        rec!.onstop = () => {
          rec!.stream.getTracks().forEach(t => t.stop())
          res(new Blob(chunks, { type: 'audio/webm' }))
        }
        rec!.stop()
      })
    },
  }
}
```

Lưu audio: **không** đẩy lên Supabase ở v1 (2 user, không cần). Giữ Blob trong IndexedDB, tối đa 20 bản ghi gần nhất, có nút xoá toàn bộ trong Settings.

> `getUserMedia` yêu cầu HTTPS hoặc `localhost`. Firebase Hosting đã có HTTPS → không vấn đề. Nhớ thêm `microphone` vào permissions policy nếu app nhúng iframe.

### 7.2 Chấm Speaking

```ts
// src/lib/speech/types.ts
export interface SpeakingTask {
  id: string
  mode: 'ielts_p1' | 'ielts_p2' | 'ielts_p3' | 'toeic_speaking' | 'roleplay' | 'shadowing'
  prompt: string
  cueCard?: { topic: string; bullets: string[] }
  prepSec: number
  speakSec: number
  targetBand?: number
}

export interface SpeakingFeedback {
  transcript: string
  durationSec: number
  wordsPerMinute: number
  fillerCount: number          // um, uh, like, you know
  bands: {
    fluency: number            // 0–9, bước 0.5
    lexical: number
    grammar: number
    pronunciation: number | null   // null = không chấm từ transcript được
  }
  overall: number
  strengths: string[]
  improvements: { issue: string; example: string; better: string }[]
  upgradedVersion: string      // cùng ý, diễn đạt ở band cao hơn 1 bậc
  newVocabulary: string[]      // → đẩy sang SRS
}
```

**Nguyên tắc trung thực quan trọng:** không chấm `pronunciation` từ transcript — Whisper tự sửa lỗi phát âm khi decode, nên transcript sạch không chứng minh phát âm tốt. Trả `null` và ghi rõ trên UI, hoặc chấm gián tiếp bằng tín hiệu thô: số từ Whisper đánh dấu low-confidence, tỉ lệ segment bị ngắt. Đừng bịa điểm phát âm — với mục tiêu luyện thi, feedback sai còn hại hơn không có feedback.

Prompt chấm:

```
You are an IELTS Speaking examiner. Score this response using the public band descriptors.

Task: {task.prompt}
Response length: {durationSec}s, {wordCount} words ({wpm} wpm)
Transcript (auto-generated, may contain ASR errors — ignore capitalisation/punctuation):
"""{transcript}"""

Rules:
- Score fluency, lexical resource, grammatical range & accuracy on the 0–9 scale (0.5 steps).
- Do NOT score pronunciation; you only see text.
- "improvements": max 4, each must quote the learner's own words, then the fixed version.
- "upgradedVersion": rewrite THEIR answer at one band higher. Keep their ideas and their
  personal details. Do not invent new content.
- Be strict. A band 6 answer must not be called band 7.
Return ONLY JSON: { ... }
```

Dòng "Be strict" + "A band 6 answer must not be called band 7" là cần thiết — model mặc định chấm rộng tay và sẽ làm hỏng hoàn toàn giá trị theo dõi tiến bộ.

### 7.3 Roleplay giao tiếp (phần "giao tiếp" của mục tiêu)

Đây là tính năng dùng nhiều nhất hàng ngày, tách riêng khỏi luyện thi.

```
src/app/speak/
├── page.tsx                    ← chọn scenario
├── roleplay/[id]/page.tsx      ← hội thoại đa lượt
└── ielts/[part]/page.tsx       ← mô phỏng IELTS Speaking
```

```ts
export interface Scenario {
  id: string
  title: string                 // "Đặt phòng khách sạn", "Phỏng vấn xin việc"
  level: 1 | 2 | 3 | 4 | 5
  aiRole: string                // "hotel receptionist"
  userRole: string              // "guest checking in"
  goal: string                  // "check in early and request a late checkout"
  mustUse?: string[]            // cụm từ mục tiêu phải dùng được
  maxTurns: number              // 8–12
}

export interface ConversationTurn {
  role: 'user' | 'ai'
  text: string
  audioId?: string              // key trong IndexedDB
  correction?: { original: string; fixed: string; note: string } | null
}
```

Cơ chế "sửa mềm" — điểm khác biệt so với chatbot thường:

- AI **trả lời in-character trước** (giữ mạch hội thoại), sau đó hiện một chip nhỏ 🔧 dưới lượt của user nếu có lỗi. Click mới bung ra bản sửa.
- Không bao giờ dừng hội thoại để sửa ngữ pháp. Ngắt mạch làm người học ngại nói.
- Cuối phiên → `SessionReport`: goal đạt/không, `mustUse` đã dùng mấy cụm, tổng hợp mọi correction, 5 từ mới → SRS.

API: `POST /api/speak/roleplay` nhận `{ scenario, history, userText }` → trả `{ reply, correction, goalAchieved, suggestedReplies }`. `suggestedReplies` (2–3 gợi ý) rất quan trọng cho những lúc bí — không có nó phiên hội thoại sẽ chết.

Thêm **shadowing mode**: AI đọc 1 câu (TTS) → user nhại lại → so transcript với câu gốc, highlight từ lệch. Đơn giản về mặt code, hiệu quả cao cho phát âm.

### 7.4 Writing

```
src/app/write/
├── page.tsx                    ← chọn task type
├── task/[id]/page.tsx          ← editor + timer + word count
└── result/[id]/page.tsx
```

```ts
export interface WritingTask {
  id: string
  kind: 'ielts_task1' | 'ielts_task2' | 'toeic_email' | 'free'
  prompt: string
  chartData?: ChartSpec         // Task 1: mô tả biểu đồ bằng data, render bằng recharts
  minWords: number              // 150 / 250
  timeLimitMin: number          // 20 / 40
}

export interface WritingFeedback {
  bands: { task: number; coherence: number; lexical: number; grammar: number }
  overall: number
  wordCount: number
  annotations: {
    excerpt: string             // đoạn trích nguyên văn từ bài
    issue: string
    category: 'grammar'|'vocab'|'cohesion'|'task'|'style'
    suggestion: string
  }[]
  modelAnswer: string           // bài mẫu band 8 cùng đề
  nextFocus: string             // 1 việc cần cải thiện cho bài sau
}
```

**Mẹo triển khai Task 1:** đừng generate ảnh biểu đồ. Cho AI sinh `chartData` dạng JSON, render bằng `recharts` (đã có trong project cho các chart stats). Người học nhìn biểu đồ thật, còn AI vẫn "nhìn" được dữ liệu khi chấm vì nó có JSON gốc → chấm được tính chính xác của số liệu trong bài viết, điều mà chấm từ ảnh rất hay sai.

Render `annotations`: match `excerpt` vào text bài viết bằng `indexOf`, bọc `<mark>` với màu theo `category`. Nếu không match (AI paraphrase lại excerpt) → fallback hiện dạng danh sách bên dưới. Thêm vào prompt: `"excerpt must be copied verbatim from the learner's text, character for character"`.

### 7.5 SRS nâng cấp — SM-2

Thay thuật toán `interval × 2` trong `storage.ts`:

```ts
// src/lib/srs.ts
export interface SrsState {
  easiness: number      // EF, khởi tạo 2.5, sàn 1.3
  interval: number      // ngày
  repetitions: number
  nextReviewAt: string
}

/** quality: 0=quên hẳn, 3=đúng nhưng khó, 4=đúng, 5=dễ */
export function sm2(prev: SrsState, quality: 0|1|2|3|4|5): SrsState {
  let { easiness, interval, repetitions } = prev

  if (quality < 3) {
    repetitions = 0
    interval = 1
  } else {
    repetitions += 1
    interval = repetitions === 1 ? 1
             : repetitions === 2 ? 6
             : Math.round(interval * easiness)
  }

  easiness = Math.max(1.3,
    easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

  return {
    easiness, interval, repetitions,
    nextReviewAt: new Date(Date.now() + interval * 86400000).toISOString(),
  }
}
```

Migration cho dữ liệu cũ — chạy 1 lần khi app mount:

```ts
export function migrateToSm2(w: LearnedWord): LearnedWord {
  if (w.easiness !== undefined) return w
  return {
    ...w,
    easiness: 2.5,
    repetitions: Math.max(0, (w.mastery ?? 0) - 1),
    reviewInterval: w.reviewInterval ?? 1,
  }
}
```

UI đổi từ 2 nút (Nhớ/Quên) sang 4 nút chuẩn: **Quên (0) / Khó (3) / Được (4) / Dễ (5)**, mỗi nút hiện sẵn khoảng cách ôn tiếp theo. Giữ `mastery` 0–5 sao cho hiển thị, tính từ `repetitions`.

Kèm theo: badge due count trên navbar (`getWordsForReview().length`), cập nhật mỗi 60s và sau mỗi lần review.

### 7.6 Adaptive engine — `/today`

Thứ gắn kết toàn bộ app. Input: mọi dữ liệu đã có. Output: 4–6 việc cần làm hôm nay.

```ts
// src/lib/plan/generate-plan.ts
export interface PlanBlock {
  id: string
  kind: 'srs_review' | 'new_words' | 'exam_drill' | 'speaking' | 'writing' | 'grammar' | 'mistakes'
  title: string
  reason: string               // "Part 3 accuracy 52% — thấp nhất trong 2 tuần"
  estimatedMin: number
  href: string
  payload?: Record<string, unknown>
  done: boolean
}

export function generatePlan(ctx: {
  dueWords: number
  mistakes: MistakeEntry[]
  attempts: ExamAttempt[]
  lastSpeakingAt?: string
  lastWritingAt?: string
  settings: ExamSettings
  availableMin: number         // user tự chọn: 15 / 30 / 60
}): PlanBlock[] {
  const blocks: PlanBlock[] = []

  // 1. SRS luôn đứng đầu — nợ ôn tập là thứ đắt nhất nếu bỏ
  if (ctx.dueWords > 0) blocks.push({ /* … estimatedMin: ceil(dueWords * 0.25) */ } as PlanBlock)

  // 2. Điểm yếu nhất theo QuestionType trong 14 ngày gần nhất, tối thiểu 10 câu mẫu
  const weakest = weakestType(ctx.attempts, { days: 14, minSamples: 10 })
  if (weakest) blocks.push({ kind: 'exam_drill', /* … */ } as PlanBlock)

  // 3. Sổ lỗi chưa resolve > 10 → 1 block làm lại
  // 4. Speaking nếu > 2 ngày chưa nói (kỹ năng rơi nhanh nhất)
  // 5. Writing nếu > 5 ngày chưa viết
  // 6. Từ mới — luôn xếp CUỐI, và chỉ khi còn thời gian trong availableMin

  return fitToBudget(blocks, ctx.availableMin)
}
```

Ba quyết định về mặt sư phạm, cố ý:

- **Từ mới xếp cuối.** Học từ mới là việc "sướng" nhất và dễ trở thành né tránh ôn tập. Nợ SRS phải trả trước.
- **Speaking nhắc sau 2 ngày**, sớm hơn mọi kỹ năng khác — đây là kỹ năng rơi nhanh nhất khi bỏ.
- **`minSamples: 10`** trước khi gọi một type là "điểm yếu". 3 câu sai không phải bằng chứng.

`localStorage["dailyPlan"]` = `{ date, blocks }`, regenerate khi sang ngày mới (tái dùng `getTodayKey()` đã có trong TimerContext).

### 7.7 Storage & DDL bổ sung

| Key | Type |
|---|---|
| `speakingSessions` | `SpeakingSession[]` (transcript + feedback, không chứa audio) |
| `writingSubmissions` | `WritingSubmission[]` |
| `dailyPlan` | `{ date: string; blocks: PlanBlock[] }` |
| IndexedDB `audioBlobs` | `Record<audioId, Blob>` — tối đa 20 |

```sql
create table if not exists speaking_sessions (
  id uuid primary key, sync_key text not null, mode text not null,
  prompt text, transcript text, duration_sec int,
  feedback jsonb, created_at timestamptz default now()
);
create table if not exists writing_submissions (
  id uuid primary key, sync_key text not null, kind text not null,
  prompt text, chart_data jsonb, content text, word_count int,
  feedback jsonb, created_at timestamptz default now()
);
```

Bổ sung cột SM-2 vào `learned_words`:

```sql
alter table learned_words add column if not exists easiness numeric default 2.5;
alter table learned_words add column if not exists repetitions int default 0;
```

### 7.8 Thứ tự commit

| # | Commit |
|---|---|
| 1 | `feat(srs): SM-2 algorithm + migration + 4-button UI` |
| 2 | `feat(nav): due count badge` |
| 3 | `feat(speech): recorder + transcribe API + fallback` |
| 4 | `feat(speak): roleplay scenarios + soft correction` |
| 5 | `feat(speak): IELTS speaking P1/P2/P3 + band feedback` |
| 6 | `feat(speak): shadowing mode` |
| 7 | `feat(write): IELTS Task 2 + annotation renderer` |
| 8 | `feat(write): Task 1 with recharts chart spec` |
| 9 | `feat(plan): /today adaptive plan` |
| 10 | `feat(sync): speaking/writing tables + SM-2 columns` |
| 11 | `feat(stats): skill radar (L/R/S/W) + band timeline` |

Commit 1–2 độc lập hoàn toàn với phần còn lại — có thể ship ngay cả khi Phase 7 bị hoãn.

### 7.9 Test

- `srs.test.ts` — chuỗi SM-2: quality 5 năm lần liên tiếp phải ra interval tăng dần; quality 0 reset về 1; EF không xuống dưới 1.3
- `migrate.test.ts` — word cũ không có `easiness` → sau migrate không đổi `nextReviewAt`
- `plan.test.ts` — budget 15 phút không được trả về 6 block; SRS luôn ở vị trí 0 khi có due
- `weakest-type.test.ts` — dưới `minSamples` phải trả `null`
- `annotations.test.ts` — excerpt không match → fallback list, không crash

### 7.10 Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Chấm band không ổn định (cùng bài, 2 lần chấm lệch 1 band) | **Cao** | Pin 1 provider duy nhất cho grading (`GRADING_PROVIDER=gemini`), temperature thấp, kèm 2 few-shot anchor band 6 và band 8 trong prompt |
| Groq Whisper rate limit / đổi model | Trung bình | Env override + fallback Web Speech API |
| Quyền mic bị từ chối | Thấp | Mọi task speaking đều có chế độ gõ text, dùng chung pipeline chấm |
| IndexedDB audio phình | Thấp | Cap 20 bản ghi, nút xoá trong Settings |
| Scope phase quá lớn | **Cao** | Commit 1–6 là MVP có giá trị đứng một mình. Writing và `/today` có thể cắt sang phase sau mà không gãy gì |

---

## 8. Tổng kết & ước lượng

| | Phase 6 | Phase 7 |
|---|---|---|
| Trọng tâm | Listening + Reading, luyện thi | Speaking + Writing + adaptive |
| File mới (ước lượng) | ~25 | ~28 |
| API route mới | 3 | 5 |
| Bảng Supabase mới | 3 | 2 |
| Dependency mới | `zod` (+ `idb-keyval` nếu cần) | không (MediaRecorder/IndexedDB là native) |
| Test mới | ~40 | ~35 |
| Rủi ro lớn nhất | chất lượng đề AI | độ ổn định của band scoring |

### Setup nhanh

```bash
# Phase 6
npm i zod
mkdir -p src/lib/exam src/components/exam \
         src/app/exam/{drill/\[part\],mock,result/\[attemptId\],mistakes} \
         src/app/api/exam/{generate-item,grade-open,explain}

# Phase 7
mkdir -p src/lib/speech src/lib/plan src/components/speak src/components/write \
         src/app/speak/{roleplay/\[id\],ielts/\[part\]} \
         src/app/write/{task/\[id\],result/\[id\]} src/app/today \
         src/app/api/speech/{transcribe,grade} src/app/api/speak/roleplay \
         src/app/api/write/grade
```

`.env.local` bổ sung:

```bash
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
GRADING_PROVIDER=gemini          # pin provider cho chấm điểm, tránh lệch band
EXAM_BANK_WARM_COUNT=3
```

### Hai thứ nên bỏ qua, không làm

- **Đăng nhập / multi-user thật.** 2 user + `syncKey` là đủ. Thêm auth là chi phí thuần.
- **Dựng bank đề offline hoàn chỉnh.** Generate on-demand + cache dùng chung đã giải quyết vấn đề này với quy mô 2 người.
