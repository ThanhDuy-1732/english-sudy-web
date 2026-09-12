# English Study App — Tài liệu kỹ thuật

> Tài liệu này mô tả kiến trúc, luồng dữ liệu, và kế hoạch phát triển của ứng dụng.
> Dùng làm context cho các phiên làm việc với AI.
>
> Cập nhật lần cuối: 2026-09-12

---

## 1. Mục đích ứng dụng

Ứng dụng học tiếng Anh cá nhân chạy trên web (PWA), hỗ trợ:

- **Học từ vựng** theo chủ đề với AI tạo câu ví dụ, bài tập, và kiểm tra
- **Ôn tập spaced-repetition (SRS)** — từ được lên lịch ôn theo khoảng tăng dần
- **Học ngữ pháp** với 8 chủ đề tĩnh + chủ đề do AI tạo theo yêu cầu
- **Theo dõi tiến trình** — thống kê số từ, thời gian học, mastery, streak
- **Nhật ký học tập** — xem lại từng ngày học gì, học bao lâu
- **Sync đa thiết bị** qua Supabase (không cần đăng nhập)

Không có backend riêng — mọi AI call đều qua Next.js API routes server-side để giữ API key an toàn.

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 14 App Router, TypeScript |
| Styling | Tailwind CSS |
| AI | Google Gemini, Groq, OpenRouter, Mistral, Cohere, HuggingFace (fallback chain) |
| Storage | `localStorage` (primary) + Supabase (sync) |
| Hosting | Firebase Hosting |
| Testing | Jest + @testing-library/react |
| PWA | Service Worker tại `public/sw.js` |

---

## 3. Kiến trúc tổng quan

```
Browser
├── Client Components (React)         ← UI, đọc localStorage
├── Context Providers
│   ├── ProviderContext                ← quản lý AI provider đang dùng
│   └── TimerContext                  ← đồng hồ học tập toàn app
└── API Routes (server-side only)
    └── src/app/api/*/route.ts        ← gọi AI, không bao giờ export sang client
```

**Nguyên tắc cứng:** `src/lib/providers/` chỉ được import trong API routes. Client không bao giờ chứa API key.

---

## 4. Các trang

### `/` — Flashcard (trang chính)

Luồng chính của app:
1. Người dùng chọn chủ đề (preset hoặc tự thêm)
2. Nhấn **Tạo từ** → POST `/api/generate-words` → trả `{ word, meaning }[]`
3. Hiển thị `FlashcardGrid` — mỗi card có mặt trước (từ) / mặt sau (nghĩa + bài tập)
4. Lật card lần đầu → fetch song song: `/api/generate-sentence` + `/api/generate-synonyms`
5. Nhấn **Lưu** → ghi vào `localStorage["learnedWords"]` + push Supabase

**4 chế độ học trên card (tabs):**
- `study` — nghĩa + ví dụ + đồng nghĩa/trái nghĩa
- `write` — người dùng tự viết câu, AI chấm điểm (`/api/grade-sentence`)
- `fill` — điền vào chỗ trống
- `dictation` — nghe và gõ lại

### `/review` — Ôn tập SRS

- Lấy từ `getWordsForReview()` — lọc `nextReviewAt <= now`
- Hiển thị flashcard ở `isReviewMode=true`
- Nhấn "Nhớ tốt ✓" / "Quên ✗" → `updateWordReview()` → cập nhật `mastery` và `reviewInterval`, push Supabase

**Thuật toán SRS đơn giản:**
- Nhớ: `interval = min(interval × 2, 30)`, `mastery++`
- Quên: `interval = 1`, `mastery--`
- `nextReviewAt = now + interval × 86400000`

### `/history` — Lịch sử từ

Browse toàn bộ `learnedWords`, lọc theo topic và mastery (0–5 sao). Có thể xóa từng từ.

### `/stats` — Thống kê

4 tile tóm tắt: tổng từ, ngày học trong 30 ngày, mastery trung bình, phút học hôm nay (live từ TimerContext).

Charts:
- `WordsPerDayChart` — số từ mỗi ngày (30 ngày)
- `StudyTimeChart` — phút học mỗi ngày (30 ngày, đọc từ `localStorage["studyTime"]`)
- `TopicDistributionChart` — phân bố theo chủ đề
- `StreakCalendar` — heatmap 26 tuần

### `/diary` — Nhật ký

Heatmap 26 tuần (DiaryCalendar). Click vào một ô → slide-in DayDrawer hiển thị:
- Danh sách từ học ngày đó (expandable)
- Tổng phút học ngày đó
- Điều hướng prev/next

Dữ liệu study minutes lấy từ `localStorage["studyTime"]`, words từ `getWordsForDate(date)` (filter theo `learnedAt`).

### `/grammar` — Ngữ pháp

Desktop: sidebar trái chọn topic + form thêm topic mới / Mobile: dropdown.

8 chủ đề tĩnh (`STATIC_GRAMMAR_TOPICS`): Tenses, Modal Verbs, Conditionals, Passive Voice, Relative Clauses, Reported Speech, Articles, Prepositions.

Người dùng có thể yêu cầu tạo chủ đề mới → POST `/api/grammar-generate` → trả `GrammarTopic` JSON → lưu `localStorage["grammarTopics"]` + push Supabase.

Trong mỗi sub-rule:
- Nút **Ví dụ AI** → POST `/api/grammar-examples`
- Nút **Bài tập** → POST `/api/grammar-exercise` → `GrammarExercise` inline (fill hoặc MCQ)

### `/settings` — Cài đặt

3 tab:
- **AI Providers** — xem danh sách provider, test latency, bật/tắt từng provider
- **Voice** — chọn giọng TTS, rate, pitch, volume
- **Sync** — nhập sync key để pull data từ thiết bị khác

---

## 5. Hệ thống AI Provider

**File:** `src/lib/providers/`

```
callWithFallback(prompt, preferredId?, disabledIds?)
  → thử preferred provider trước
  → nếu 429/503 → thử provider tiếp theo
  → trả chuỗi text hoặc throw
```

Provider được kích hoạt dựa vào env key có trong `.env.local`:

| Env key | Provider | Model mặc định |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini | `gemini-flash-latest` |
| `GROQ_API_KEY` | Groq | `llama-3.3-70b-versatile` |
| `OPENROUTER_API_KEY` | OpenRouter | `nvidia/nemotron-3-nano-30b-a3b:free` |
| `MISTRAL_API_KEY` | Mistral | `mistral-small-latest` |
| `COHERE_API_KEY` | Cohere | `command-r7b-12-2024` |
| `HUGGINGFACE_API_KEY` | HuggingFace | `meta-llama/Llama-3.2-1B-Instruct` |

Model có thể override qua `GEMINI_MODEL`, `GROQ_MODEL`, v.v.

**Luồng client:**
`useApiFetch` hook → đọc `ProviderContext` → POST với `{ provider, disabledProviders }` → API route set header `X-Provider-Used` → hook cập nhật context nếu provider thực tế dùng khác preferred.

---

## 6. Data Models

### LearnedWord (`src/lib/storage.ts`)

```ts
interface LearnedWord {
  word: string           // required
  meaning: string        // required
  example: string        // required
  topic: string          // required
  learnedAt: string      // ISO — thời điểm lưu
  nextReviewAt?: string  // ISO — lịch ôn tiếp theo (SRS)
  reviewInterval?: number // ngày, bắt đầu 1, tăng gấp đôi, max 30
  mastery?: number       // 0–5 sao
  synonyms?: string[]
  antonyms?: string[]
}
```

### GrammarTopic (`src/lib/grammar-data.ts`)

```ts
interface SubRule {
  id: string; name: string; formula: string
  explanation: string; examples: string[]
}
interface GrammarTopic {
  id: string; name: string; rules: SubRule[]
  isUserGenerated?: boolean; createdAt?: string
}
```

---

## 7. localStorage Keys

| Key | Type | Ghi chú |
|---|---|---|
| `learnedWords` | `LearnedWord[]` | Toàn bộ từ đã lưu |
| `studyTime` | `Record<YYYY-MM-DD, seconds>` | Thời gian học theo ngày |
| `grammarTopics` | `GrammarTopic[]` | Chủ đề ngữ pháp do người dùng tạo |
| `customTopics` | `string[]` | Chủ đề từ vựng tuỳ chỉnh |
| `syncKey` | UUID | Danh tính Supabase |
| `lastSyncedAt` | ISO string | Lần sync gần nhất |
| `preferredProvider` | string | Provider đang chọn |
| `disabledProviders` | `string[]` | Provider đã tắt |
| `voiceSettings` | `VoiceSettings` | TTS: voiceURI, rate, pitch, volume |
| `dailyChallenge` | `DailyChallenge[]` | Lịch sử daily challenge |

---

## 8. Sync Supabase

**Không có xác thực.** Danh tính = `syncKey` (UUID trong localStorage, tự sinh lần đầu).

| Bảng | Nội dung |
|---|---|
| `learned_words` | Mirror của `LearnedWord` |
| `daily_challenges` | Mirror của `DailyChallenge` |
| `custom_topics` | `{ sync_key, topic }` |
| `grammar_topics` | `{ sync_key, id, name, rules: jsonb, created_at }` |
| `user_settings` | `{ sync_key, voice_settings: jsonb }` |

**`initSync()`** chạy khi app mount (`SyncInitializer`):
1. Local → Remote: upsert toàn bộ words, topics, grammar topics, voice settings
2. Remote → Local: merge (từ mới hơn theo `learnedAt` thắng; `completed=true` thắng cho challenge)

**Fire-and-forget**: `pushWord`, `deleteWord`, `pushTopic`, `pushGrammarTopic`, `pushChallenge` — không await, không retry.

**Key alias**: `"thankz"` → UUID cứng (dùng để share nhanh).

---

## 9. TimerContext (`src/contexts/TimerContext.tsx`)

Đồng hồ học tập toàn app, chạy dưới dạng Context Provider trong `layout.tsx`.

```
isRunning = true  →  setInterval 1s  →  todaySeconds++
                                      →  schedulePersist (debounce 5s)
                                      →  countdownRemaining--
```

Khi đủ thời gian đếm ngược → `showTimeUp = true` → `HeaderTimer` hiển thị modal.

**Midnight reset** (đã fix): interval tự phát hiện khi `getTodayKey()` thay đổi → flush giá trị cũ vào ngày cũ → reset `todaySeconds = 0` cho ngày mới.

Persistence: `localStorage["studyTime"]["YYYY-MM-DD"]` = giây học trong ngày.

---

## 10. Các vấn đề đã biết

| Mức độ | Vấn đề | Trạng thái |
|---|---|---|
| ✅ Fixed | UTC/Local mismatch trong `getWordsForDate` | `3395af0` |
| ✅ Fixed | `expandedWords` rò rỉ khi navigate prev/next | `3395af0` |
| ✅ Fixed | TimerContext không reset khi qua nửa đêm | Unstaged |
| ⚠️ Edge case | Navigate > 182 ngày trong DayDrawer hiện 0 phút | Ít người bị |

---

## 11. Kế hoạch phát triển

Thứ tự ưu tiên dựa theo trạng thái code hiện tại và giá trị sử dụng hàng ngày.

### P0 — Hoàn thiện timer feature (đang dở)

File đang unstaged: `TimerContext.tsx`, `HeaderTimer.tsx`, `StudyTimeChart.tsx`, `FirebaseInitializer.tsx`.

Cần làm:
- [ ] Commit toàn bộ timer feature sau khi verify `HeaderTimer` hoạt động đúng
- [ ] `StudyTimeChart` sync live: chart bar "hôm nay" hiện đang lag 5s so với tile (minor, có thể bỏ qua)
- [ ] `FirebaseInitializer` — xác nhận analytics event đang bắn đúng

### P1 — Nâng cấp SRS

Thuật toán hiện tại rất thô (`interval × 2`, max 30). Cải tiến:
- [ ] Thêm **FSRS-4** hoặc **SM-2** thực sự — dựa vào `easiness factor` thay vì nhân đôi cứng
- [ ] Hiển thị **due count** trên navbar (badge số từ cần ôn hôm nay)
- [ ] **Session review**: kết thúc 1 phiên ôn → hiển thị summary (số từ đúng/sai, mastery thay đổi)

### P2 — Grammar page

Vừa ship, còn thiếu:
- [ ] **Progress tracking per topic** — lưu sub-rule nào đã xem, đã làm bài tập
- [ ] **Quiz mode** cho grammar — tạo 5–10 câu liên tiếp từ 1 topic
- [ ] **Bookmark sub-rule** để ôn lại sau

### P3 — Stats & Insights

- [ ] **Streak counting** thực sự (hiện `StreakCalendar` chỉ heatmap, không đếm streak liên tiếp)
- [ ] **Điểm mastery timeline** — chart mastery trung bình theo tuần
- [ ] **Nhắc nhở học** — notification (Web Push) khi streak sắp gãy

### P4 — Sync & offline

- [ ] **Conflict resolution rõ ràng hơn** — hiện "từ mới hơn thắng", đôi khi không đúng
- [ ] **Offline queue** — action thực hiện offline được queue và sync khi có mạng (hiện tại fire-and-forget không retry)
- [ ] **Import từ Anki** — hỗ trợ parse `.apkg` hoặc `.txt` format phổ biến

### P5 — UX nhỏ

- [ ] **Search trong History** — hiện chỉ lọc topic/mastery, chưa có full-text search
- [ ] **Dark mode** — app hiện chỉ có light theme
- [ ] **Keyboard shortcuts** — space để lật card, Enter để lưu

---

## 12. Cấu trúc file quan trọng

```
src/
├── app/
│   ├── page.tsx                    ← trang flashcard chính
│   ├── review/page.tsx
│   ├── history/page.tsx
│   ├── stats/page.tsx
│   ├── diary/page.tsx
│   ├── grammar/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── generate-words/route.ts
│       ├── generate-sentence/route.ts
│       ├── grammar-generate/route.ts
│       └── ...                     ← tất cả AI calls ở đây
├── components/
│   ├── Flashcard.tsx               ← card học chính, 4 mode
│   ├── HeaderTimer.tsx             ← timer trên navbar
│   ├── DiaryCalendar.tsx           ← heatmap 26 tuần
│   ├── DayDrawer.tsx               ← slide-in drawer ngày
│   ├── GrammarSidebar.tsx
│   ├── GrammarContent.tsx
│   └── charts/
│       ├── WordsPerDayChart.tsx
│       ├── StudyTimeChart.tsx
│       └── TopicDistributionChart.tsx
├── contexts/
│   ├── ProviderContext.tsx          ← AI provider state
│   └── TimerContext.tsx            ← đồng hồ học tập
└── lib/
    ├── storage.ts                  ← LearnedWord CRUD
    ├── stats.ts                    ← analytics functions
    ├── sync.ts                     ← Supabase operations
    ├── grammar-data.ts             ← static grammar topics
    ├── grammar-storage.ts          ← user grammar topics CRUD
    ├── custom-topics.ts            ← custom topic CRUD
    └── providers/
        ├── index.ts                ← callWithFallback, registry
        ├── gemini.ts
        └── openai-compat.ts        ← Groq, OpenRouter, Mistral, v.v.
```

---

## 13. Chạy & phát triển

```bash
npm run dev      # dev server tại http://localhost:3000
npm test         # chạy toàn bộ Jest tests (180 tests)
npm run build    # production build
npm run lint     # ESLint check
```

Firebase deploy (sau khi build):
```bash
npm run build
firebase deploy
```

API keys đặt trong `.env.local` (không commit). Chỉ cần set key của provider muốn dùng — provider nào thiếu key sẽ không được đăng ký.
