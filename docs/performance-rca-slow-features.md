# RCA — Vì sao một số tính năng xử lý trên 4 giây

- **Ngày phân tích:** 20/11/2026
- **Môi trường:** production `https://english-sudy-web-taupe.vercel.app`
- **Dữ liệu gốc:** `docs/performance-report-2026-11-20.md`, `scripts/perf/results.json`
- **Phương pháp:** 5-Whys + đo lại response size, đối chiếu code path

---

## 1. Phát biểu vấn đề

**Cái gì:** 6 tính năng có thời gian phản hồi trung vị trên 4 giây (cao nhất ~14–20 giây).

| Tính năng | Endpoint | Trung vị | Lần đo lại | Output |
|---|---|---:|---:|---:|
| Chấm Writing IELTS | `/api/write/grade` | 13,87 s | 19,7–20,2 s | ~4.000 ký tự (~1.000 token) |
| Tạo chủ đề ngữ pháp | `/api/grammar-generate` | 10,76 s | 10,1 s | ~2.700 ký tự (~680 token) |
| Chấm Speaking IELTS | `/api/speech/grade` | 9,41 s | 9,8–9,9 s | ~2.000 ký tự (~500 token) |
| Sinh câu hỏi Exam | `/api/exam/generate-item` | 8,06 s | 7,1 s | ~2.500 ký tự (~630 token) |
| Dịch 3 sắc thái | `/api/translate` | 4,26 s | 3,8 s | ~500 ký tự (~130 token) |
| Đọc hiểu | `/api/generate-reading` | 4,11 s | 4,0 s | ~1.070 ký tự (~270 token) |

**Khi nào:** mỗi lần người dùng bấm nút, không phải lúc cao điểm đặc biệt.
**Ở đâu:** lớp gọi AI trong API route (Vercel function → OpenCode Go).
**Tác động:** người dùng nhìn "Đang chấm…"/"Đang tạo…" 4–20 giây; các tính năng nhỏ (flashcard, quiz) vẫn ổn.

---

## 2. Bằng chứng

### 2.1. Thời gian gần như tỉ lệ với độ dài output

Đo 7 endpoint cùng lúc, ghi lại thời gian và kích thước JSON trả về:

| Endpoint | Thời gian | Ký tự | ~Token | Ghi chú |
|---|---:|---:|---:|---|
| `generate-synonyms` (đối chứng) | 6,72 s | 73 | 18 | Ngoại lệ — xem mục 2.3 |
| `generate-reading` | 4,02 s | 1.073 | 268 | |
| `translate` | 3,85 s | 508 | 127 | |
| `exam/generate-item` | 7,06 s | 2.529 | 632 | 6 câu hỏi/lần |
| `speech/grade` | 9,83 s | 2.313 | 578 | |
| `grammar-generate` | 10,08 s | 2.726 | 682 | 3–6 sub-rule |
| `write/grade` | 20,16 s | 4.175 | 1.044 | |

Hồi quy 6 điểm (bỏ ngoại lệ synonyms): **~17,3 ms/token (~58 token/giây), r = 0,93**. Nói cách khác, **độ dài output giải thích phần lớn thời gian chờ**.

### 2.2. Output dài vì gộp nhiều nội dung phụ vào cùng một response

Chấm writing (4.008 ký tự):

| Trường | Ký tự | Tỉ lệ |
|---|---:|---:|
| `annotations` (tối đa 6 lỗi) | 2.080 | 52% |
| `modelAnswer` (bài mẫu band 8) | 1.613 | 40% |
| `nextFocus` + `bands` + metadata | 315 | 8% |

Chấm speaking (2.019 ký tự):

| Trường | Ký tự | Tỉ lệ |
|---|---:|---:|
| `improvements` | 785 | 39% |
| `upgradedVersion` (viết lại cả câu trả lời) | 619 | 31% |
| `strengths` + `bands` + từ vựng + metadata | 615 | 30% |

→ Chỉ riêng phần **không cần thiết để biết điểm** (annotations + model answer / improvements + upgraded version) đã chiếm **70–92% output**, tức phần lớn thời gian chờ.

### 2.3. Provider có chi phí nền ~1,5–2 giây và dao động mạnh

Gọi `/api/providers/test` với prompt `"Reply with just: OK"` 5 lần:

| Lần | Server báo | Client thấy |
|---|---:|---:|
| 1 | 1.147 ms | 1.795 ms |
| 2 | 2.154 ms | 2.551 ms |
| 3 | 1.605 ms | 2.036 ms |
| 4 | 1.474 ms | 1.923 ms |
| 5 | 967 ms | 1.356 ms |

→ Mỗi request AI đã có **~1,5 s chi phí cố định** (Vercel → OpenCode Go → model + prefill), cộng ~0,4–0,6 s mạng client → Vercel. Đây là lý do các tính năng nhỏ vẫn mất 1,5–2,5 s.

Ngoại lệ `generate-synonyms` 6,72 s cho output 18 token cho thấy **jitter/queue** của provider có thể đẩy một request ngắn vượt 4 s dù không có output dài.

### 2.4. Code path xác nhận

| Bằng chứng trong code | Hệ quả |
|---|---|
| `openai-compat.ts`: `chat.completions.create({ model, messages })` — **không `stream`** | Client chỉ nhận dữ liệu sau khi model sinh xong toàn bộ JSON |
| Không đặt `max_tokens` | Model sinh đến khi tự dừng; output càng dài càng lâu |
| `providers/index.ts`: timeout 25 s/provider, fallback **tuần tự**, chỉ khi lỗi | Provider chậm nhưng dưới 25 s vẫn được dùng; không có routing theo latency |
| Registry đặt `opencode` đầu tiên; `GRADING_PROVIDER` ghim provider chấm | Hầu hết traffic đi một gateway; response chấm trả `gradedBy: "opencode"` |
| OpenAI SDK mặc định `maxRetries = 2` (không override) | Lỗi 429/5xx tạm thời có thể âm thầm cộng 2 lần retry + backoff → tăng jitter |
| `ai-json.ts`: lỗi schema → gọi **repair = một lần AI đầy đủ nữa** | Nếu model trả JSON sai, thời gian có thể gấp đôi |
| `gemini.ts generateWords`: có thể gọi bổ sung 1 lần nếu trùng từ | `generate-words` có lúc 4,36 s dù output nhỏ |
| `ai-metrics.ts`: chỉ lưu latency/success/fallback **trong bộ nhớ**, không có token count/attempt/repair | Không thể thấy p95 hay nguyên nhân tăng thời gian trên production |

### 2.5. Những thứ **không phải** nguyên nhân

| Nghi ngờ | Bằng chứng loại trừ |
|---|---|
| Vercel/Next.js chậm | `GET /api/providers` 414 ms; TTFB các trang 118–481 ms |
| Cold start | Request đầu 4,9 s, nhưng các request sau vẫn 4–20 s; latency server báo của "OK" chỉ 1–2 s |
| Rate limit | Không có 429 trong toàn bộ 40+ request |
| Database | App không dùng backend/DB, dữ liệu ở localStorage |
| Mạng client | Client ↔ Vercel chỉ ~0,4–0,6 s (so sánh server-reported vs client-observed) |
| Repair JSON | Không thấy pattern thời gian gấp đôi; thời gian tương quan với output length (r = 0,93) |

---

## 3. Chuỗi 5-Whys

### Nhánh A — Nguyên nhân chính (output dài, giao hàng một lần)

| Tầng | Câu hỏi | Trả lời | Bằng chứng |
|---|---|---|---|
| Why 1 | Vì sao tính năng mất >4 s? | Request phải chờ model sinh xong **toàn bộ** JSON mới trả về | Không có streaming; TTFB ≈ tổng thời gian ở mọi route AI |
| Why 2 | Vì sao phải sinh lâu? | Output 500–1.000 token; model ~58 token/giây | Đo output 2.000–4.200 ký tự; hồi quy 17,3 ms/token, r = 0,93 |
| Why 3 | Vì sao output dài? | Một response chứa nhiều artifact lớn: 6 câu exam, 3–6 rule ngữ pháp, 4 band + 6 annotation + bài mẫu, 4 band + improvements + bài nói viết lại | Đọc prompt và response thật; annotations + modelAnswer = 92% output writing |
| Why 4 | Vì sao gộp tất cả vào một response? | API contract trả **toàn bộ artifact**; nội dung phụ (bài mẫu, annotation, bài viết lại) nằm trên critical path | `write/grade`, `speech/grade`, `grammar-generate`, `exam/generate-item` |
| Why 5 | Vì sao thiết kế như vậy? | Chưa có **latency budget** cho tác vụ AI dài: không streaming, không tách request, không prefetch/cache, không route theo latency | Không có SSE/stream trong `providers/`; không có prefetch exam/grammar; cache chỉ sau lần đầu |

### Nhánh B — Chi phí nền của provider

| Tầng | Câu hỏi | Trả lời | Bằng chứng |
|---|---|---|---|
| Why 1 | Vì sao request nhỏ cũng 1,5–2,5 s? | Có chi phí cố định Vercel → gateway → model | "Reply with just: OK" mất 0,97–2,15 s server-side |
| Why 2 | Vì sao chi phí cố định cao? | Khoảng cách mạng + queue tại gateway + prefill prompt | Prompt chấm writing có thêm ~4.600 ký tự anchor (~1.150 token) |
| Why 3 | Vì sao vẫn dùng provider đó? | `opencode` đứng đầu registry và là provider chấm mặc định; fallback chỉ khi lỗi | `buildRegistry()`, `TASK_PROVIDER_MAP`, `gradedBy: "opencode"` |
| Why 4 | Vì sao không chọn provider nhanh hơn? | Không có đo p50/p95 theo task/provider, không có routing/hedging | Metrics in-memory, không có latency SLO |

### Nhánh C — Jitter và retry

| Tầng | Câu hỏi | Trả lời | Bằng chứng |
|---|---|---|---|
| Why 1 | Vì sao cùng một tính năng lúc 1,5 s lúc 6,7 s? | Provider/queue dao động; có thể có retry ẩn | Synonyms 18 token có lúc 6,72 s; "OK" dao động 0,97–2,15 s |
| Why 2 | Vì sao retry ẩn? | OpenAI SDK mặc định `maxRetries = 2` trên 429/5xx/network | `node_modules/openai` mặc định 2; code không override |
| Why 3 | Vì sao không thấy? | Metrics không ghi số attempt, retry, token | `ai-metrics.ts` chỉ có latency/success/fallback |
| Why 4 | Vì sao không xử lý? | Chưa có alert p95 và retry budget theo request | Metrics mất khi cold start, không đẩy ra ngoài |

---

## 4. Kết luận nguyên nhân

**Nguyên nhân gốc (High confidence):** thiết kế hiện tại thực hiện **một lời gọi AI đồng bộ, không streaming, trả về toàn bộ artifact lớn trong một response** — trong đó phần lớn output là nội dung phụ không cần để hiển thị kết quả chính. Với tốc độ ~58 token/giây, output 500–1.000 token đương nhiên mất 8–20 giây.

**Nguyên nhân cộng gộp (High/Medium):**

1. **Chi phí nền provider ~1,5–2 s** cho mọi request, cộng jitter mạnh; chỉ dùng một provider mặc định, không route theo latency.
2. **Không prefetch/cache** cho các artifact sinh chậm nhưng lặp lại (bộ đề exam, chủ đề ngữ pháp).
3. **Không có observability đủ** (token, attempt, retry, p95) để phát hiện và chặn regression.

**Không phải nguyên nhân:** Vercel, Next.js, cold start, rate limit, database, mạng client.

---

## 5. Kiểm chứng chuỗi

| Nếu sửa… | …thì… | Kỳ vọng |
|---|---|---|
| Tách response chấm điểm: trả `bands` + nhận xét ngắn trước (~100 token) | Writing không còn chờ 1.000 token | 20 s → **~4 s**; speaking 10 s → **~4 s** |
| Stream token (SSE) | Client thấy chữ đầu tiên sau ~2 s thay vì chờ hết | Cảm nhận chờ giảm mạnh; tổng thời gian không đổi |
| Sinh trước câu exam kế tiếp khi người dùng đang làm câu hiện tại | Không phải chờ 8 s khi bấm "tiếp" | Cảm nhận **~0 s** |
| Cache chủ đề ngữ pháp đã tạo | Lần xem lại không gọi AI | 10 s → **~0 s** |
| Chọn provider nhanh hơn / hedging | Giảm chi phí nền và p95 | Mọi tính năng giảm ~1–2 s; tính năng nhỏ xuống <4 s |
| Đặt `maxRetries: 1` cho route latency-sensitive | Giảm jitter do retry ẩn | p95 giảm, ít đỉnh 6–7 s bất thường |

---

## 6. Hành động đề xuất

| Loại | Hành động | Tác động | Công sức |
|---|---|---|---|
| **Ngay (P0)** | Chấm writing/speaking: trả điểm + nhận xét ngắn trước; annotations/bài mẫu/bài viết lại tải sau bằng request riêng | 20 s → ~4 s cho kết quả chính | Trung bình |
| **Ngay (P0)** | Exam: prefetch bộ câu kế tiếp khi người dùng đang làm câu hiện tại; grammar: cache topic đã tạo | 8–11 s → gần 0 khi đã có | Thấp |
| **Ngay (P1)** | Thêm SSE/streaming cho các tác vụ dài | Chữ đầu tiên sau ~2 s | Trung bình |
| **Phòng ngừa (P1)** | Đặt latency budget: mọi tính năng AI mới phải có p50 < 4 s hoặc có streaming/prefetch | Chặn tái diễn | Thấp |
| **Phòng ngừa (P1)** | Đo p50/p95 theo task + provider, thử Gemini/Groq cho grading; dùng `GRADING_PROVIDER` ghim provider nhanh nhất | Giảm 1–2 s nền, giảm p95 | Thấp–TB |
| **Phòng ngừa (P2)** | Giảm output: bỏ bài mẫu khỏi lần chấm đầu; giới hạn annotations; grammar trả 3 rule trước, ví dụ tải sau | Giảm 30–70% token | Trung bình |
| **Giám sát (P1)** | Ghi token count, số attempt/retry/repair, provider; đẩy metric ra ngoài (Vercel logs/APM); alert p95 > 5 s | Phát hiện sớm | Thấp |
| **Giám sát (P2)** | RUM đo thời gian từ click → có kết quả cho 6 tính năng này | Biết trải nghiệm thật | Thấp |

---

## 7. Ghi chú về giới hạn phân tích

- Số token là **ước tính** từ ký tự (`chars / 4`); JSON tiếng Anh có thể lệch 10–20%.
- Không có quyền truy cập `ADMIN_SECRET` / log production, nên **không xác nhận được** tần suất repair, retry và fallback thực tế; các kết luận này dựa trên code + phân bố thời gian đo được.
- Chưa đo trực tiếp vị trí/region của OpenCode Go; chỉ đo được chi phí nền qua `/api/providers/test`.
- Các phép đo là latency tuần tự, không phải load test.

---

## 8. Cập nhật re-test 21/11/2026

Đã kiểm tra 2 commit đang chạy: `da99aeb` (prefetch/cache + observability) và `4c69af2` (provider speed, no hidden retries, per-task timeouts).

| Nội dung | Kết quả |
|---|---|
| Exam drill mở lại | 0,40 s (lần đầu 6,77 s) → prefetch hiệu quả |
| Exam mock 6 parts | 9,28 s (song song), bank đủ 12 item sau ~10 s |
| Grammar request lặp | 0 lời gọi AI, không tạo topic trùng |
| `GET /api/providers` | CDN `HIT`, cache miss 1,37 s |
| `GET /api/admin/metrics` | **503** — `ADMIN_SECRET` chưa set; p50/p95 chưa đọc được |
| `X-Provider-Used` | Đã có trên các route trước đây thiếu |
| Writing | 13,87 s → **10,81 s** (vẫn >4 s) |
| Grammar generate | 10,76 s → **8,27 s** (vẫn >4 s) |
| Speech grade | 9,41 s → **5,78 s** (vẫn >4 s) |
| Exam generate | 8,06 s → **5,72 s** (vẫn >4 s) |
| Translate | 4,26 s → **2,18 s** (đã <4 s) |
| Reading | 4,11 s → **3,12 s** (đã <4 s) |

**Kết luận:** prefetch/cache và giảm jitter có tác dụng thật; 2 tính năng đã xuống dưới 4 s. Nhưng 4 tính năng nặng nhất vẫn >4 s vì nguyên nhân gốc — output dài, giao hàng một lần, không streaming — **chưa được xử lý**. Observability mới xong ở code, chưa bật trên production vì thiếu `ADMIN_SECRET`.

Chi tiết đầy đủ: `docs/performance-retest-2026-11-21.md`.
