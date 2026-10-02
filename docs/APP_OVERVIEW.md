# English Study App — Tổng quan sản phẩm & hiện trạng

> Tài liệu tường thuật: ứng dụng làm gì, hoạt động ra sao, đang ở đâu, thiếu gì.
> **Chi tiết kỹ thuật** (data model, localStorage key, bảng Supabase, route body/response, component map) nằm trong [`CONTEXT.md`](../CONTEXT.md) — không lặp lại ở đây để tránh lệch.
> Mục đích: dùng làm đầu vào cho phân tích định hướng phát triển.
>
> Cập nhật lần cuối: 2026-10-01 · Nhánh `phase-6-exam-engine` · Batch 1–8 đã code xong · 399 tests / 75 suites pass

---

## 1. Ứng dụng là gì

PWA học tiếng Anh cá nhân (1 người dùng, nhiều thiết bị), nhắm tới giao tiếp + TOEIC + IELTS. Không có tài khoản — danh tính là `syncKey` (UUID). Không có backend riêng: mọi lời gọi AI đi qua Next.js API routes server-side.

Năng lực hiện có:

| Mảng | Có gì |
|---|---|
| Từ vựng | Sinh từ theo chủ đề, flashcard 4 chế độ (study/write/fill/dictation), bulk import, quiz điền từ, luyện từ trong ngữ cảnh |
| SRS | SM-2 thật, 4 mức đánh giá, badge số từ đến hạn trên navbar, tóm tắt phiên ôn |
| Ngữ pháp | 8 chủ đề tĩnh + chủ đề AI sinh, ví dụ/bài tập AI, quiz, bookmark, theo dõi tiến độ từng sub-rule, link sang drill TOEIC Part 5 |
| Luyện thi | TOEIC/IELTS drill từng part + mock có timer, sổ lỗi, drill thích ứng theo tag yếu, nút báo câu hỏi lỗi (chỉ lưu local), phím tắt |
| Speaking | IELTS P1/P2/P3 (mic → Whisper → chấm band), roleplay đa lượt, shadowing, lịch sử + nghe lại audio |
| Writing | IELTS Task 1/2, TOEIC email, chấm 4 tiêu chí + model answer, lịch sử, viết lại (rewrite) |
| Thích ứng | Sổ lỗi hợp nhất, Skill Mastery Engine, kế hoạch hôm nay (`/today`), lộ trình (`/path`), learning profile |
| Thống kê | Streak, mastery timeline, báo cáo tuần, band timeline, radar kỹ năng, heatmap, accuracy theo question type |
| Hạ tầng | Sync LWW qua Supabase, hàng đợi offline có retry, task router + metrics + prompt registry cho AI, dark mode |

---

## 2. Tech stack

Next.js 14 App Router · TypeScript · Tailwind · Jest + Testing Library · `localStorage` (nguồn chính) + IndexedDB (audio) + Supabase (sync, không auth) · Firebase **chỉ hosting** · PWA (`public/sw.js`) · AI: Gemini, Groq (+ Whisper STT), OpenRouter, Mistral, Cohere, HuggingFace với fallback chain.

---

## 3. Kiến trúc

```
Browser
├── Client pages/components   ← đọc/ghi localStorage, IndexedDB
├── Context: ProviderContext (provider AI đang chọn), TimerContext (đồng hồ học toàn app)
├── SyncInit / SyncInitializer ← initSync() + drain hàng đợi offline khi online lại
└── fetch → API routes (server-side only)
              └── callTask(task, prompt) → callWithFallback → provider
                    ├── ai-prompts  (prompt registry theo task)
                    ├── ai-metrics  (ghi latency/lỗi, in-memory)
                    └── ai-json     (parse + Zod validate, 1 lần auto-repair)
```

Ràng buộc cứng: API key chỉ ở server; `src/lib/providers/` không bao giờ được import từ client component.

### Vòng lặp thích ứng (trục chính của sản phẩm)

```
Làm bài (vocab / grammar / exam / speaking / writing)
   → ghi LearningSession          (sessions)
   → ghi lỗi vào UnifiedMistake   (mistakes: dedupe, occurrenceCount, status new/reviewing/resolved)
   → recomputeMastery()           (mastery-all: 6 kỹ năng, decay-weighted accuracy, nửa đời 14 ngày)
   → generatePlan()               (plan: ưu tiên SRS → điểm yếu exam → lỗi chưa xử lý → grammar → speaking → writing → từ mới)
   → /today, /path hiển thị
```

Tính toán mastery/plan là **deterministic, không gọi AI**; AI chỉ dùng để sinh nội dung và chấm bài.

---

## 4. Các trang (30 trang)

### Học & ôn
| Route | Hành vi |
|---|---|
| `/` | Chọn chủ đề → sinh từ → flashcard (lật lần đầu fetch câu ví dụ + đồng/trái nghĩa song song) → Lưu |
| `/review` | SRS: từ `nextReviewAt <= now`, 4 nút Quên/Khó/Được/Dễ, tóm tắt phiên |
| `/history` | Duyệt từ đã lưu, lọc topic/mastery, xoá |
| `/import` | Nhập từ hàng loạt |
| `/vocab/quiz` | Quiz điền từ trên từ đã học (dùng `/api/generate-fillblank`), ghi session |
| `/vocab/context` | Luyện từ trong ngữ cảnh (`/api/vocab/context`) |
| `/grammar` | Sidebar topic, quy tắc, ví dụ AI, bài tập AI, bookmark, chỉ báo tiến độ sub-rule, link drill RC5 |
| `/grammar/quiz` | Quiz nhiều câu; ghi attempt, lỗi vào sổ lỗi, ưu tiên sub-rule yếu/bookmark |

### Luyện thi
| Route | Hành vi |
|---|---|
| `/exam` | Dashboard: TOEIC/IELTS, level, drill/mock |
| `/exam/drill/[part]` | RC5/RC6/RC7/LC2/LC3/LC4/READ_P3/LISTEN_S1; chọn đề thích ứng theo tag yếu; giải thích AI; phím 1–4 + Enter (tắt được trong profile); nút báo câu hỏi lỗi |
| `/exam/mock` | Mock rút gọn + countdown + AnswerSheet |
| `/exam/mistakes` | Sổ lỗi exam, là view lọc `source = exam:*` trên `unifiedMistakes` (dùng chung trạng thái resolve với `/mistakes`) |

### Speaking / Writing
| Route | Hành vi |
|---|---|
| `/speak` | Chọn roleplay / IELTS part / shadowing |
| `/speak/roleplay/[id]` | Hội thoại đa lượt, gợi ý trả lời, sửa lỗi |
| `/speak/ielts/[part]` | Ghi âm → IndexedDB (LRU 20) → Whisper → chấm band; hoặc nhập text |
| `/speak/shadowing` | Nghe–nhắc lại, ghi âm, STT, lưu `SpeakingRecord` |
| `/speak/history` | Lịch sử + nghe lại audio |
| `/write` · `/write/task/[id]` · `/write/result/[id]` | Chọn đề → editor + timer → kết quả chấm (annotation + model answer). Bản nháp quá giờ vẫn khôi phục và có nút "Làm lại từ đầu" |
| `/write/history` · `/write/rewrite/[id]` | Lịch sử bài viết; viết lại đoạn sai, chấm qua `/api/exam/grade-open`, lỗi vào sổ lỗi |

### Thích ứng & theo dõi
| Route | Hành vi |
|---|---|
| `/today` | Kế hoạch ngày từ `generatePlan` (SRS debt, điểm yếu exam 14 ngày ≥10 mẫu, ≥5 lỗi chưa xử lý, mastery grammar < 60, nhắc speaking >2 ngày / writing >5 ngày, từ mới theo ngân sách phút) |
| `/path` | Lộ trình: theo profile (goal, level, mục tiêu điểm), mastery từng kỹ năng, nhóm lỗi hàng đầu, link sang quiz/mistakes |
| `/mistakes` | Sổ lỗi **hợp nhất** 6 kỹ năng; lọc, đổi status, resolve |
| `/library` | Tìm kiếm xuyên từ vựng / lỗi / speaking / writing |
| `/stats` | Tile tổng quan, streak, mastery timeline, báo cáo tuần, words/day, study time, topic, exam accuracy, weakness radar, band timeline, skill radar, heatmap |
| `/diary` | Heatmap 26 tuần + drawer theo ngày |
| `/activity` | Các `LearningSession` theo ngày |
| `/settings` | Tab AI Providers (test latency, bật/tắt) · Voice (+ xoá audio) · Sync (nhập key, `SyncStatusBadge`) · theme sáng/tối |

### Khả năng khám phá (đã kiểm tra bằng grep `href`)
Navbar chỉ link tới: `/`, `/review`, `/diary`, `/activity`, `/grammar`, `/exam`, `/speak`, `/write`, `/today`, `/history`, `/settings`.
**Chưa có link nào trong UI** tới `/path`, `/library`, `/stats`, `/vocab/context`, `/import` — chỉ vào được bằng gõ URL. `/mistakes` chỉ được link từ `/path` và `/library` (nên cũng gián tiếp bị ẩn).

---

## 5. Hệ thống AI

- **Provider fallback**: `callWithFallback(prompt, preferred?, disabled?, opts?)` — thử provider ưu tiên, 429/503 thì chuyển tiếp. Provider nào có env key mới được đăng ký.
- **Task router** (`ai-tasks.ts`, `callTask`): mới 4 route dùng (`generate-words`, `speech/grade`, `write/grade`, `vocab/context`); các route khác còn gọi thẳng `callWithFallback`. 11 task (`word-generation`, `sentence-generation`, `grammar-generation`, `grammar-explanation`, `exam-generation`, `exam-explanation`, `speaking-roleplay`, `speaking-grade`, `writing-grade`, `writing-feedback`, `vocab-context`). Map task→provider hiện là bảng tĩnh; chỉ `speaking-grade` và `writing-grade` ghim theo `GRADING_PROVIDER` (kèm `temperature: 0.2` + few-shot anchors để band ổn định).
- **Prompt registry** (`ai-prompts.ts`): mới định nghĩa cho một phần task (`Partial<Record<…>>`).
- **Metrics** (`ai-metrics.ts`): lưu **trong bộ nhớ từng server instance**, mất khi cold start. Xem qua `GET /api/admin/metrics` (header `x-admin-secret` = `ADMIN_SECRET`; chưa set env → 503).
- **Client**: `useApiFetch` gửi `{provider, disabledProviders}`, đọc `X-Provider-Used` để đồng bộ context.

---

## 6. Dữ liệu & sync (tóm tắt — chi tiết ở CONTEXT.md)

- **Nguồn chính là localStorage**; mỗi thực thể có giới hạn kích thước (sessions 500, attempts 100, mistakes 1000, speaking 200, writing 100, bank 30/key).
- **Sync Supabase** theo `syncKey`, RLS bằng header `x-sync-key`. 11 bảng (words, challenges, topics, grammar topics, settings, exam_items dùng chung, exam_attempts, mistake_log, speaking, writing, unified_mistakes).
- **LWW** (`updatedAt` thắng, hòa → local, chỉ push phần khác) hiện áp cho: words, exam_attempts, unified_mistakes (`mistake_log` là legacy, chỉ pull một lần để migrate). `completed=true` thắng với challenges.
- **Offline queue**: push lỗi → `enqueue`; `drainQueue` khi online lại; `getSyncStatus()` ∈ synced/syncing/pending/offline/failed.
- **Migration**: 9+ file trong `supabase/migrations/` đã đổi sang timestamp `YYYYMMDDHHMMSS`; stack Supabase local đã chạy được (cổng tuỳ chỉnh 543xx do trùng dự án khác).

---

## 7. Hiện trạng & nợ kỹ thuật (trung thực)

**Trạng thái repo**: nhánh `phase-6-exam-engine` (~115 commit). Đã commit: migration đổi tên, `mastery-all.ts`, hợp nhất sổ lỗi vào `unifiedMistakes`, sync request hardening, docs/kế hoạch. Còn thay đổi chưa commit: PWA (`sw.js`, `AppNavigation`, `docs/pwa.md`), timer/`useCountdown`, recorder và các sửa speaking/writing. Chưa merge vào `main`.

| Mức | Vấn đề |
|---|---|
| ⚠️ | **Migrate route sang `callTask` mới được 4/21**: chỉ `generate-words`, `speech/grade`, `write/grade`, `vocab/context` đi qua task router (có metrics). Các route AI còn lại vẫn gọi `callWithFallback` trực tiếp nên không có metrics/task routing. |
| ⚠️ | **Trang mồ côi** (mục 4): `/path`, `/library`, `/stats`, `/vocab/context`, `/import` không có điểm vào UI. |
| ⚠️ | **"Báo câu hỏi lỗi" chưa có tác dụng ngược**: chỉ lưu `reportedQuestions` local; không đánh dấu `flagged` trên `exam_items` dùng chung nên đề xấu vẫn được pull về. |
| ⚠️ | LWW chưa áp cho speaking/writing/grammar topics/settings (các bảng này vẫn upsert kiểu cũ). |
| ⚠️ | Bảo mật sync: `syncKey` hoạt động như bearer secret; alias `"thankz"` → UUID cố định trong code. Không có đăng nhập. |
| ⚠️ | Metrics AI mất khi cold start; task→provider map tĩnh; prompt registry chưa phủ hết task. |
| ⚠️ | Phím tắt mới có ở `ExamRunner`; flashcard (space/Enter) chưa có. |
| ⚠️ | Điều hướng > 182 ngày trong DayDrawer hiện 0 phút (ít gặp). |
| ℹ️ | `src/lib/gemini.ts` là wrapper legacy chỉ còn test dùng; `updateWordReview` (kiểu cũ) còn giữ để tương thích. |

---

## 8. Lộ trình — đã làm / chưa làm

### Đã hoàn thành
- **Batch 1 — Adaptive core**: Learning Session, UnifiedMistake, Skill Mastery Engine, Today Planner v2, `/mistakes`
- **Batch 2 — Grammar**: progress, bookmark, quiz, chỉ báo tiến độ
- **Batch 3 — Exam intelligence**: drill thích ứng, tag accuracy, báo cáo câu hỏi, phân tích theo category
- **Batch 4 — Speaking/Writing loop**: history, rewrite, shadowing
- **Batch 5 — Vocabulary & insights**: streak, mastery timeline, quiz từ, luyện ngữ cảnh, báo cáo tuần
- **Batch 6 — Reliability**: hàng đợi offline, drain khi reconnect, `SyncStatusBadge`
- **Batch 7 — Personalization/UX**: learning profile, `/path`, tìm kiếm `/library`, phím tắt exam, dark mode
- **Batch 8 — AI infra** (một phần: 4/21 route đã migrate sang `callTask`): task router, metrics, prompt registry; gate `/api/admin/metrics` bằng `ADMIN_SECRET`
- Trước đó: SM-2, LWW (words/exam), Phase 6 exam engine, Phase 7 speaking/writing, audio replay, grading calibration.

### Chưa làm / ứng viên tiếp theo
- Nhắc học (Web Push) khi streak sắp gãy
- Import Anki (`.apkg` / `.txt`)
- Phím tắt cho flashcard
- LWW cho các thực thể còn lại
- Đưa các trang mồ côi vào navigation
- Persist metrics AI; map task→provider theo settings
- Mở rộng prompt registry cho mọi task
- Xác thực thật (thay `syncKey`) nếu có nhu cầu chia sẻ/đa người dùng
- Làm cho "báo câu hỏi lỗi" thực sự flag đề
- Dọn nợ: commit phần PWA/timer/speaking còn dang dở, merge nhánh

---

## 9. Chạy & phát triển

```bash
npm run dev      # http://localhost:3000
npm test         # 399 tests, 75 suites (đã chạy 2026-10-01: all pass)
npm run build
npm run lint
```

Env: ít nhất một `*_API_KEY` của provider; `GROQ_API_KEY` (+ `GROQ_WHISPER_MODEL`) cho STT; tuỳ chọn `GRADING_PROVIDER`, `ADMIN_SECRET`; `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` cho sync (có thể trỏ Supabase local). Deploy: `npm run build && firebase deploy`.
