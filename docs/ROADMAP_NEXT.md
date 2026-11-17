# Roadmap tiếp theo (lập 2026-11-16)

Trạng thái lúc lập: nhánh `phase-6-exam-engine` đi trước `main` 72 commit, `main` không có commit mới. 82 suite / 431 test pass, lint sạch, `tsc` sạch. Supabase đã bỏ (commit c3e2bb9); dữ liệu chỉ còn trong localStorage + file backup JSON.

Thứ tự ưu tiên: dọn nợ → an toàn dữ liệu → hạ tầng AI → vòng học thích ứng → tuỳ chọn.

---

## Phase 0 — Dọn nợ & bảo mật (1–2 ngày) 🔴

| # | Việc | Lý do |
|---|---|---|
| 0.1 | Merge `phase-6-exam-engine` → `main` | 72 commit chưa lên main; nhánh càng sống lâu càng khó merge |
| 0.2 | Nâng `next` (audit báo **critical**, dải 9.3.4 – 16.3.0-preview), `npm audit fix` cho `nanoid`, nâng `firebase` để có `@grpc/grpc-js` mới | Lỗ hổng trong dependency production |
| 0.3 | Xoá phần Supabase còn sót: thư mục `supabase/`, `e2e/sync.e2e.js`, các mục sync trong `docs/APP_OVERVIEW.md` (đoạn "Supabase multi-device sync", Batch 6) | Không còn backend, test sync sẽ fail/vô nghĩa |
| 0.4 | Thêm lại script `e2e:pwa` vào `package.json` (README có nhắc nhưng script không còn) | Bộ test PWA không chạy được bằng lệnh đã ghi trong tài liệu |
| 0.5 | Xoá code chết: `exam/AnswerSheet.tsx` (chỉ còn tự tham chiếu), `src/lib/gemini.ts` + test của nó, `updateWordReview` legacy nếu không còn ai gọi | Bớt code phải bảo trì |
| 0.6 | Cập nhật `APP_OVERVIEW.md` (số test, bỏ sync) | Tài liệu đang nói sai |

**Xong khi:** `main` có toàn bộ code, `npm audit --omit=dev` không còn high/critical, `npm test && npm run lint && npm run build && npm run e2e` đều pass.

---

## Phase 1 — An toàn dữ liệu (2–3 ngày) 🔴

Đã bỏ sync, nên rủi ro lớn nhất bây giờ là **mất dữ liệu** (xoá cache trình duyệt, iOS dọn storage, đổi máy).

| # | Việc |
|---|---|
| 1.1 | Lưu `lastBackupAt`; banner nhắc xuất backup khi > 7 ngày chưa backup và đã có dữ liệu học mới |
| 1.2 | Hiển thị dung lượng đang dùng / quota (`navigator.storage.estimate()`) trong Settings → Dữ liệu, cảnh báo khi > 80% (`examBank` phình nhanh nhất) |
| 1.3 | Chế độ nhập **gộp** (merge theo `updatedAt`, LWW) bên cạnh chế độ ghi đè. Các thực thể chính đã có `updatedAt` | 

1.3 quan trọng vì app dành cho 2 người dùng / nhiều thiết bị: hiện nhập file sẽ ghi đè cả key, làm mất dữ liệu học trên máy đích.

---

## Phase 2 — Hoàn thiện hạ tầng AI & API (2–3 ngày) 🟠

| # | Việc |
|---|---|
| 2.1 | Chuyển 15 route còn dùng `callWithFallback` trực tiếp sang `callTask` → có metrics + prompt registry cho mọi task |
| 2.2 | Giới hạn kích thước input cho các route AI (zod `.max()` trên chuỗi/mảng) — tránh đốt quota bằng payload lớn |
| 2.3 | Rate limit đơn giản theo IP (in-memory, chấp nhận mất khi cold start) cho route AI |
| 2.4 | Security headers trong `next.config.mjs` (CSP cơ bản, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` cho microphone) |

Bỏ qua: persist metrics (không có backend; `/api/admin/metrics` in-memory là đủ cho 2 người).

---

## Phase 3 — Vòng học thích ứng (1–2 tuần) 🟡

Đúng hướng `DEVELOPMENT_DIRECTION.md`: dùng dữ liệu sẵn có thay vì thêm module mới.

| # | Việc | Ghi chú |
|---|---|---|
| 3.1 | Gom navigation 17 link thành 3 nhóm: **Học** (từ, ôn tập, ngữ pháp) · **Luyện** (exam, speak, write) · **Theo dõi** (today, path, stats, diary, mistakes) | Nhiều trang (`/vocab/quiz`, `/speak/history`, `/write/history`, `/library`) khó tìm |
| 3.2 | "Báo câu hỏi lỗi" thực sự loại câu khỏi `examBank` local (không cho ra lại trong drill) | Hiện chỉ ghi `reportedQuestions` |
| 3.3 | Lỗi exam/grammar có `keyVocabulary` → nút "thêm vào SRS" ngay trên `/mistakes` | Kiểm tra trước xem S5.3 đã làm tới đâu |
| 3.4 | Phím tắt flashcard (Space lật, 1–4 chấm SM-2) tôn trọng `shortcutsEnabled` | Known issue trong APP_OVERVIEW |
| 3.5 | Bổ sung part còn thiếu trong drill: `LISTEN_S2–S4`, `READ_P1/P2` (type đã có trong `exam/types.ts`) | `LC1` để sau — cần ảnh |
| 3.6 | `/today` hiện tiến độ so với mục tiêu (`targetDate`, `targetToeicScore/IeltsScore`) dựa trên `scoring.ts` | Biến mục tiêu trong profile thành thứ có ý nghĩa |

---

## Phase 4 — Tuỳ chọn / khi có nhu cầu ⚪

- **FSRS thay SM-2**: chỉ làm khi đủ dữ liệu review để thấy SM-2 lên lịch sai.
- **Import Anki** (`.txt` trước, `.apkg` sau — `.apkg` là SQLite, cần thêm dependency).
- **Nhắc học**: Web Push thật cần server gửi (VAPID) → trái nguyên tắc "không backend". Bản rẻ: thông báo trong app + file `.ics` nhắc lịch.
- **Auth thật / sync lại**: chỉ khi số người dùng > 2.

---

## Ước lượng tổng

| Phase | Thời gian | Ưu tiên |
|---|---|---|
| 0 | 1–2 ngày | Làm ngay |
| 1 | 2–3 ngày | Làm ngay sau 0 |
| 2 | 2–3 ngày | Cao |
| 3 | 1–2 tuần | Trung bình, chia nhỏ từng mục |
| 4 | — | Khi có nhu cầu |
