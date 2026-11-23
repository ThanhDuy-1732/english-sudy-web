# Re-test sau fix — 21/11/2026

- **URL:** https://english-sudy-web-taupe.vercel.app
- **Commit đang chạy:** `4c69af2` (provider speed/timeouts) trên nền `da99aeb` (prefetch/cache + observability)
- **Xác nhận deploy:** `/api/providers` trả thứ tự mới `opencode → groq → cohere → openrouter → gemini → mistral`
- **Phương pháp:** đo API 3 mẫu/tính năng + test luồng UI thật trong trình duyệt + 46 Jest test
- **Kết quả:** tất cả request `200`, không lỗi, không rate limit

---

## 1. Tóm tắt

| Hạng mục | Kết quả | Đánh giá |
|---|---|---|
| Prefetch/cache exam | Mở lại 0,40 s thay vì 6,77 s | ✅ Đã fix |
| Prefetch/cache grammar | Request lặp lại **0 lời gọi AI** | ✅ Đã fix |
| Cache `GET /api/providers` | CDN `HIT`, có `age`; MISS 1,37 s | ✅ Có tác dụng |
| Observability | p50/p95/attempt/repair/outChars có trong code + test; **endpoint production trả 503** | ⚠️ Fix một nửa |
| Provider speed/no hidden retries | 2 tính năng xuống dưới 4 s; 4 tính năng vẫn trên 4 s | ⚠️ Cải thiện, chưa đủ |
| Cache/service worker sau deploy | Trang drill bị trắng runner do HTML cũ | ⚠️ Rủi ro mới phát hiện |

**Kết luận ngắn:** prefetch/cache đã hiệu quả rõ rệt; observability mới hoàn thiện ở code nhưng **chưa bật được trên production** vì thiếu `ADMIN_SECRET`; 4 tính năng nặng vẫn >4 s vì chưa cắt/stream output.

---

## 2. Trước và sau (API)

| Tính năng | Trước fix | Sau fix | Thay đổi | Còn >4 s? |
|---|---:|---:|---:|---|
| Writing – chấm bài | 13,87 s | **10,81 s** | −22% | 🔴 Có |
| Grammar – tạo chủ đề | 10,76 s | **8,27 s** | −23% | 🔴 Có |
| Speaking – chấm IELTS | 9,41 s | **5,78 s** | −39% | 🔴 Có |
| Exam – sinh câu hỏi | 8,06 s | **5,72 s** | −29% | 🔴 Có |
| Dịch – 3 sắc thái | 4,26 s | **2,18 s** | −49% | 🟢 Không |
| Đọc hiểu | 4,11 s | **3,12 s** | −24% | 🟢 Không |

Mẫu sau fix (3 lần):

| Endpoint | Các lần đo | Trung vị | Provider |
|---|---|---:|---|
| `write/grade` | 10.805 / 12.827 / 10.602 ms | 10.805 ms | opencode |
| `grammar-generate` | 8.274 / 7.658 / 10.519 ms | 8.274 ms | opencode |
| `speech/grade` | 6.759 / 5.784 / 5.092 ms | 5.784 ms | opencode |
| `exam/generate-item` | 5.722 / 7.105 / 5.342 ms | 5.722 ms | opencode |
| `translate` | 2.894 / 2.141 / 2.179 ms | 2.179 ms | opencode |
| `generate-reading` | 3.084 / 3.117 / 3.503 ms | 3.117 ms | opencode |

**Chi phí nền của provider không đổi:** gọi `"Reply with just: OK"` vẫn ~1,0–1,55 s server-side (client 1,57–2,06 s). Vì vậy phần giảm 20–40% đến từ việc bỏ retry ẩn/giảm jitter, không phải từ việc giảm output. 4 tính năng còn lại vẫn bị chặn bởi **độ dài output + không streaming**.

---

## 3. Prefetch/cache — đã hoạt động

### Exam drill

| Bước | Kết quả |
|---|---|
| Lần đầu (bank trống) | **6,77 s** đến màn hình "Sẵn sàng chưa?" |
| Ngay sau khi có câu hỏi | bank = 1 item |
| Background refill | thêm item thứ 2 sau **7,03 s** |
| Lần mở lại | **0,40 s** (nhanh hơn **94%**) |
| Bank sau lần mở lại | vẫn 2 item |

### Exam mock (TOEIC, 6 parts)

| Bước | Kết quả |
|---|---|
| Load 6 parts song song | **9,28 s** (nếu tuần tự như code cũ: ~6 × 6,8 ≈ 40 s) |
| Bank ngay sau load | 6 item (1/part) |
| Background refill | đủ 12 item (2/part) sau **10,04 s** |
| Lỗi/429 | không có |

### Grammar

| Bước | Kết quả |
|---|---|
| Request mới | **8,53 s**, 1 lời gọi AI, topic được lưu kèm `request` |
| Request y hệt lần 2 | **0 lời gọi AI** (resource `grammar-generate` vẫn = 1), không tạo topic trùng |

### `GET /api/providers`

- CDN trả `x-vercel-cache: HIT`, `age` tăng dần.
- Cache miss (query mới): **1,37 s**.
- Warm: 0,25–0,89 s (trung vị ~0,50 s). Cache có tác dụng nhưng TTFB từ mạng hiện tại vẫn bị chi phối bởi RTT edge.

### Hạn chế còn lại của prefetch

- Drill page truyền `preloadedItems` khi bank có item, và `ExamRunner` **return sớm** — nên không gọi `takeUnseenBankItem` và không refill. Bank đứng ở 2 item; các lần sau có thể lặp lại cùng 2 bộ câu.
- Mock không bị vì luôn đi qua `loadPart` → có `takeUnseenBankItem` + refill.
- Đề xuất: dùng `takeUnseenBankItem` ngay ở drill page (hoặc bỏ `preloadedItems` truyền random), và refill sau mỗi lần dùng bank.

---

## 4. Observability — code xong, production chưa bật

**Đã có trong code + test (46 test pass):**

- `MetricEntry` thêm `attempts`, `outChars`, `repair`.
- `getAggregatedMetrics()` trả `p50LatencyMs`, `p95LatencyMs`, `repairRate`, `avgOutChars`, `byProvider{ p50, p95 }`.
- Mỗi lời gọi ghi 1 dòng JSON `evt:"ai_call"` (task, provider, ms, ok, failed, outChars, promptChars, repair) ra Vercel logs.
- 6 route AI trước đây thiếu header đã có `X-Provider-Used` (kiểm tra thực tế: `opencode`).

**Chưa đạt trên production:**

| Vấn đề | Bằng chứng |
|---|---|
| `GET /api/admin/metrics` trả **503** | `ADMIN_SECRET` chưa được set trong Vercel |
| Metrics vẫn nằm trong RAM theo instance | `src/lib/ai-metrics.ts` không đổi cơ chế lưu; cold start reset |
| Không đọc được p50/p95 thật | Không có secret → không gọi được endpoint |

→ Cần set `ADMIN_SECRET` trong Vercel (Production) và redeploy. Nếu muốn p95 đáng tin, nên đẩy `ai_call` logs sang Vercel Log Drains/APM thay vì chỉ đọc RAM.

---

## 5. Sự cố service worker sau deploy (phát hiện khi re-test)

- Lần đầu mở `/exam/drill/RC5` sau deploy: trang chỉ hiện header, **runner không render**, `document.readyState = complete`, không có lỗi console.
- Nguyên nhân: service worker phục vụ HTML/JS cũ (cache theo pathname) lệch build mới → hydration không chạy.
- Clear service worker + Cache Storage rồi reload: trang chạy bình thường.
- Rủi ro thực tế: người dùng đã từng mở app trước deploy có thể gặp màn hình trắng cho đến khi SW tự cập nhật.
- Đề xuất: version cache theo build ID, `skipWaiting` + reload một lần khi có SW mới, hoặc trả HTML `no-store` cho navigation.

---

## 6. Việc còn lại

| Ưu tiên | Việc | Lý do |
|---|---|---|
| **P0** | Set `ADMIN_SECRET` trên Vercel + redeploy | Endpoint metrics đang 503 |
| **P0** | Tách/stream output writing & speaking | Vẫn 10,8 s và 5,8 s; đây là 2 tính năng chậm nhất |
| **P1** | Exam/grammar: đã nhanh khi có cache; giữ refill và xoay item | Tránh lặp câu ở drill |
| **P1** | Version cache service worker | Tránh trắng trang sau deploy |
| **P2** | Đẩy `ai_call` logs ra APM/Log Drain | p95 hiện chỉ trong RAM |
| **P2** | Đo lại p95 sau 1–2 ngày | 3 mẫu chưa đủ kết luận xu hướng |

---

## 7. Ghi chú

- So sánh trước/sau là **trung vị của 2–3 mẫu**, chịu ảnh hưởng của provider/network; các mức giảm 20–40% là tín hiệu, không phải cam kết.
- Các lời gọi API đo được trong re-test đều dùng `opencode`; chưa thấy fallback sang Groq/Cohere.
- Test UI chạy trên profile trình duyệt test (localStorage ban đầu trống); đã xoá các key test (`examBank`, `grammarTopics`, `learningSessions`, `examSettings`). Chỉ còn `studyTime`/`retentionRanOn` do app tự ghi.
