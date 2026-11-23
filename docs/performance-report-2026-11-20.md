# Báo cáo tốc độ phản hồi — English Study App

- **URL:** https://english-sudy-web-taupe.vercel.app
- **Thời điểm đo:** 20/11/2026, ~14:10–14:30 (giờ Việt Nam)
- **Phạm vi:** 25 trang + 21 API (toàn bộ tính năng đang dùng)
- **Kết quả:** 100% request trả `HTTP 200`, không gặp lỗi 4xx/5xx hay rate limit

> **Re-test 21/11/2026:** đã kiểm tra các fix prefetch/cache + observability + provider timeout. Xem `docs/performance-retest-2026-11-21.md`.

---

## 1. Tóm tắt

| Lớp | Trung vị | Nhanh nhất | Chậm nhất | Kết luận |
|---|---:|---:|---:|---|
| Tải trang (TTFB, 5 mẫu/trang) | **140 ms** | 118 ms (`/speak`) | 481 ms (`/speak/history`) | Tốt, 20/25 trang dưới 200 ms |
| API cấu hình (`GET /api/providers`) | **414 ms** | 414 ms | 813 ms | Ổn |
| API gọi AI (20 endpoint) | **2,54 s** | 1,55 s (`generate-synonyms`) | **13,9 s** (`write/grade`) | **Nút thắt chính** |

**Điểm chính**

- Phần giao diện và server của app rất nhanh: HTML 33–52 KB, TTFB trung vị **140 ms**, FCP/LCP khi đã cache **0,16–0,74 s**.
- Toàn bộ độ trễ lớn nằm ở lời gọi AI (OpenCode Go / `glm-5.3-flash`): 4 tính năng nặng nhất mất **8–14 giây**.
- 6/21 API dưới 2 s; 11/21 API từ 2–5 s; 4 API từ 8–14 s.
- Request đầu tiên sau khi app "nguội" mất **4,9 s** TTFB; các request sau đó 0,1–0,5 s.

---

## 2. Tốc độ tải trang

Đo 5 mẫu mỗi trang, xen kẽ thứ tự, lấy trung vị. Tất cả là `x-vercel-cache: HIT` (bản prerender tại edge).

| Trang | TTFB trung vị | Khoảng (min–max) | Kích thước HTML | HTTP |
|---|---:|---:|---:|---:|
| `/speak` | 118 ms | 108–435 ms | 52 KB | 200 |
| `/diary` | 119 ms | 107–148 ms | 35 KB | 200 |
| `/today` | 125 ms | 107–471 ms | 34 KB | 200 |
| `/exam/mistakes` | 126 ms | 105–216 ms | 34 KB | 200 |
| `/grammar` | 127 ms | 107–403 ms | 45 KB | 200 |
| `/grammar/quiz` | 127 ms | 96–418 ms | 34 KB | 200 |
| `/activity` | 129 ms | 106–410 ms | 33 KB | 200 |
| `/translate` | 129 ms | 92–893 ms | 33 KB | 200 |
| `/library` | 133 ms | 101–458 ms | 33 KB | 200 |
| `/vocab/context` | 133 ms | 108–193 ms | 34 KB | 200 |
| `/mistakes` | 135 ms | 91–1460 ms | 35 KB | 200 |
| `/import` | 137 ms | 91–200 ms | 33 KB | 200 |
| `/write/history` | 140 ms | 93–510 ms | 33 KB | 200 |
| `/settings` | 142 ms | 100–250 ms | 39 KB | 200 |
| `/stats` | 143 ms | 110–894 ms | 43 KB | 200 |
| `/vocab/quiz` | 151 ms | 97–940 ms | 33 KB | 200 |
| `/` | 166 ms | 103–474 ms | 37 KB | 200 |
| `/exam` | 168 ms | 108–873 ms | 43 KB | 200 |
| `/review` | 169 ms | 90–459 ms | 33 KB | 200 |
| `/path` | 172 ms | 108–442 ms | 33 KB | 200 |
| `/write` | 355 ms | 122–463 ms | 46 KB | 200 |
| `/history` | 404 ms | 106–867 ms | 38 KB | 200 |
| `/exam/mock` | 414 ms | 130–488 ms | 33 KB | 200 |
| `/speak/shadowing` | 422 ms | 92–627 ms | 33 KB | 200 |
| `/speak/history` | 481 ms | 98–868 ms | 33 KB | 200 |

> Đây là TTFB của HTML. Các trang đọc dữ liệu từ `localStorage` (history, stats, review…) còn cần hydrate xong mới hiện dữ liệu; số đo trong trình duyệt bên dưới phản ánh đầy đủ hơn trải nghiệm thực.

### Trải nghiệm trong trình duyệt (lần tải lại, đã có service worker)

| Trang | FCP | LCP | Load | Ghi chú |
|---|---:|---:|---:|---|
| `/` | 740 ms | 740 ms | 648 ms | SW vừa đăng ký, asset lấy từ HTTP cache |
| `/today` | 184 ms | 184 ms | 475 ms | SW cache |
| `/exam` | 200 ms | 200 ms | 285 ms | SW cache |
| `/translate` | 204 ms | 204 ms | 281 ms | SW cache |
| `/write` | 180 ms | 180 ms | 457 ms | SW cache |
| `/settings` | 164 ms | 164 ms | 219 ms | SW cache |

LCP trùng FCP vì giao diện chủ yếu là chữ; không có ảnh lớn chặn render.

### Trọng lượng tải lần đầu

| Trang | JS/CSS tham chiếu | Tổng JS/CSS | Thời gian tải hết asset |
|---|---:|---:|---:|
| `/` | 15 file | ~683 KB | 1,54 s |
| `/today` | 15 file | ~667 KB | 0,47 s |
| `/exam` | 14 file | ~647 KB | 0,53 s |
| `/translate` | 14 file | ~648 KB | 0,60 s |
| `/write` | 14 file | ~633 KB | 1,12 s |

Tổng dữ liệu giải nén khi mở `/` trong trình duyệt: **~1,64 MB** (65 resource, gồm font và các chunk tải muộn). Chunk lớn nhất ~397 KB.

---

## 3. Tốc độ API theo tính năng

Thời gian là **tổng thời gian phản hồi** (client → Vercel → AI → trả JSON), trung vị 2–3 mẫu. Với các route AI, `TTFB ≈ tổng thời gian` vì server chỉ gửi header sau khi AI trả xong.

| # | Tính năng | Endpoint | Trung vị | Khoảng | HTTP | Provider |
|---:|---|---|---:|---:|---:|---|
| 1 | Cấu hình – danh sách provider | `GET /api/providers` | 414 ms | 406–813 ms | 200 | — |
| 2 | Flashcard – từ đồng/trái nghĩa | `/api/generate-synonyms` | 1,55 s | 1,44–1,80 s | 200 | opencode |
| 3 | Exam – chấm câu trả lời mở | `/api/exam/grade-open` | 1,66 s | 1,10–2,35 s | 200 | — |
| 4 | Flashcard – câu ví dụ | `/api/generate-sentence` | 1,75 s | 1,53–2,19 s | 200 | opencode |
| 5 | Flashcard – điền từ | `/api/generate-fillblank` | 1,83 s | 1,76–1,85 s | 200 | opencode |
| 6 | Ngữ pháp – bài tập | `/api/grammar-exercise` | 1,96 s | 1,82–2,26 s | 200 | opencode |
| 7 | Flashcard – chấm câu viết | `/api/grade-sentence` | 2,22 s | 2,14–3,30 s | 200 | opencode |
| 8 | Ngữ pháp – ví dụ | `/api/grammar-examples` | 2,36 s | 1,42–3,20 s | 200 | opencode |
| 9 | Flashcard – sinh hàng loạt | `/api/generate-batch` | 2,40 s | 2,18–3,08 s | 200 | opencode |
| 10 | Speaking – Whisper transcribe | `/api/speech/transcribe` | 2,54 s | 2,54–2,59 s | 200 | — |
| 11 | Speaking – roleplay | `/api/speak/roleplay` | 2,54 s | 2,30–2,61 s | 200 | — |
| 12 | Exam – giải thích đáp án | `/api/exam/explain` | 2,58 s | 2,37–3,66 s | 200 | — |
| 13 | Từ trong ngữ cảnh | `/api/vocab/context` | 2,72 s | 2,58–3,55 s | 200 | — |
| 14 | Từ mới – sinh từ vựng | `/api/generate-words` | 3,06 s | 1,94–4,36 s | 200 | opencode |
| 15 | Cấu hình – test provider | `/api/providers/test` | 3,68 s | 1,03–5,49 s | 200 | — |
| 16 | Đọc hiểu – sinh đoạn đọc | `/api/generate-reading` | 4,11 s | 3,51–4,70 s | 200 | opencode |
| 17 | Dịch – 3 sắc thái | `/api/translate` | 4,26 s | 3,48–4,82 s | 200 | opencode |
| 18 | Exam – sinh câu hỏi | `/api/exam/generate-item` | **8,06 s** | 7,88–9,11 s | 200 | opencode |
| 19 | Speaking – chấm IELTS | `/api/speech/grade` | **9,41 s** | 8,14–9,87 s | 200 | — |
| 20 | Ngữ pháp – tạo chủ đề | `/api/grammar-generate` | **10,76 s** | 10,12–13,02 s | 200 | opencode |
| 21 | Writing – chấm bài IELTS | `/api/write/grade` | **13,87 s** | 11,16–14,34 s | 200 | — |

**Nhóm theo trải nghiệm người dùng**

- 🟢 **Tức thì (< 0,5 s):** mở trang, xem lịch sử/thống kê, đọc dữ liệu local, danh sách provider.
- 🟡 **Chờ ngắn (1,5–3 s):** flashcard sinh câu/từ đồng nghĩa/điền từ, chấm câu, bài tập & ví dụ ngữ pháp, roleplay, dịch ngắn, Whisper.
- 🟠 **Chờ rõ (3–5 s):** sinh bộ từ mới, đọc hiểu, dịch 3 sắc thái, test provider.
- 🔴 **Chờ lâu (8–14 s):** sinh đề exam, chấm speaking, tạo chủ đề ngữ pháp, chấm writing.

---

## 4. Phân tích nguyên nhân

1. **App không phải nút thắt.** Với các route AI, TTFB gần bằng tổng thời gian → toàn bộ thời gian nằm ở provider AI. Phần Vercel + xử lý nội bộ chỉ ~0,1–0,4 s.
2. **Một provider duy nhất được dùng.** Mọi response có header đều là `opencode` (OpenCode Go, `glm-5.3-flash`). Các provider còn lại (Gemini, Groq, OpenRouter, Mistral, Cohere) chỉ là fallback khi lỗi/timeout, nên độ trễ phản ánh tốc độ của OpenCode Go.
3. **Tác vụ sinh JSON dài tốn thời gian.** Writing (4 band + annotation + model answer) và Speaking (4 band + nhận xét + từ vựng) là hai prompt dài nhất → 9–14 s. Grammar topic và exam item cũng sinh JSON lớn → 8–11 s.
4. **Cold start.** Request đầu tiên trong phiên đo mất 4,9 s TTFB; sau đó edge cache phục vụ 0,1–0,5 s. Trang ít được truy cập có thể gặp cold start tương tự.
5. **Biến động mạng/edge.** Cùng một trang có mẫu 0,09 s và mẫu 1,46 s. P95 cao hơn trung vị đáng kể, nên cần theo dõi bằng real-user monitoring thay vì chỉ nhìn trung vị.
6. **Tải lần đầu khá nặng.** ~650–680 KB JS/CSS tham chiếu + font, tổng ~1,6 MB dữ liệu giải nén. Trên 4G yếu, FCP/LCP lần đầu sẽ cao hơn nhiều so với 0,2–0,7 s đo được khi đã cache.

---

## 5. Khuyến nghị ưu tiên

| Ưu tiên | Việc nên làm | Tác động |
|---|---|---|
| **P0** | Chấm writing/speaking: hiển thị tiến trình theo bước (đang chấm band → nhận xét → bài mẫu), hoặc tách 2 request (band trước, chi tiết sau) | Giảm cảm giác chờ 9–14 s |
| **P0** | Sinh đề exam & chủ đề ngữ pháp: prefetch/background job + cache; exam đã có `examBank` local, hãy sinh trước câu kế tiếp khi người dùng đang làm câu hiện tại | 8–11 s → gần như tức thì khi đã cache |
| **P1** | `GET /api/providers`: đánh dấu static/cache (`s-maxage`) vì danh sách chỉ đổi khi deploy | 414 ms → ~0 ms |
| **P1** | Giảm JS lần đầu: `next/dynamic` cho chart (recharts), Firebase/GA và các trang nặng; chạy `@next/bundle-analyzer` | Cải thiện FCP/LCP trên mạng chậm |
| **P2** | Thêm `X-Provider-Used` cho 6 route AI đang thiếu (`exam/grade-open`, `exam/explain`, `vocab/context`, `speak/roleplay`, `speech/grade`, `write/grade`) | Quan sát/đo lường nhất quán, đúng như mô tả trong `CONTEXT.md` |
| **P2** | Theo dõi RUM (Vercel Speed Insights) cho TTFB/LCP p75–p95 theo từng trang | Phát hiện cold start và spike thực tế |
| **P3** | Cân nhắc model nhanh hơn cho grading hoặc ghim `GRADING_PROVIDER` đang có latency thấp | Có thể giảm 30–50% thời gian chấm |

---

## 6. Cách tái lập

Script đo nằm tại `scripts/perf/bench.mjs`, kết quả thô ở `scripts/perf/results.json`.

```bash
# Tải trang: 5 mẫu/trang, xen kẽ thứ tự
PERF_PAGE_RUNS=5 node scripts/perf/bench.mjs pages

# API: 2 mẫu/endpoint (riêng GET providers 3 mẫu)
PERF_API_RUNS=2 node scripts/perf/bench.mjs api

# Trọng lượng JS/CSS của các trang chính
node scripts/perf/bench.mjs assets
```

**Giới hạn của phép đo**

- Đo tuần tự từ một máy, không mô phỏng tải đồng thời → đây là **latency**, không phải **khả năng chịu tải**.
- Kết nối tới edge Vercel `hkg1` (Hồng Kông); RTT mạng ~90–150 ms đã nằm trong mọi con số.
- API AI là lời gọi thật, có tính phí và phụ thuộc chất lượng mạng/provider tại thời điểm đo.
- Trang `/exam/drill/[part]`, `/speak/ielts/[part]`, `/write/task/[id]`, `/write/rewrite/[id]`, `/write/result/[id]`, `/speak/roleplay/[id]` cần dữ liệu/ID cụ thể nên không đo TTFB; phần logic AI của chúng đã được phủ qua các API tương ứng.

**Phân tích nguyên nhân các tính năng trên 4 giây:** `docs/performance-rca-slow-features.md`.
