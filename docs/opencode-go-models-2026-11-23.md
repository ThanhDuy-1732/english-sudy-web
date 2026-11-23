# OpenCode Go: tốc độ dịch và sinh từ của 30 model (23/11/2026)

## Cách đo

- **Route thật của app:** `/api/translate` (6 câu du lịch: vi→ja, vi→ko, vi→zh, ko→vi, ja→vi, en→vi, mỗi câu 3 sắc thái) và `/api/generate-words` (`topic: travel`, 5 từ).
- **Số lần:** 2 lượt mỗi ca, tức 12 lần dịch và 2 lần sinh từ cho mỗi model. Chạy 4 model song song.
- **Không fallback:** mỗi model chạy trong một tiến trình chỉ có `OPENCODE_API_KEY`, nên lỗi không bị provider khác che đi. Không có `DATABASE_URL`, nên không ghi gì vào Neon.
- **Giới hạn thời gian:** dùng giới hạn đang chạy trên production. Dịch 15 s, sinh từ 25 s. App không gửi `reasoning_effort` cho opencode.
- **Cách tính "Đạt":** dịch đạt khi trả 200, tức là đúng chữ viết của ngôn ngữ đích và đúng JSON. Sinh từ đạt khi trả đủ 5 từ, mỗi từ có nghĩa.
- **Giới hạn gói:** lấy từ <https://opencode.ai/console/go>, tab Limits. *Monthly limit* là hạn mức tính bằng USD mỗi tháng. *Req/5h* là số request ước tính trong 5 giờ (Go / Go Plus).
- **Thời gian:** "Dịch p50" là trung vị, "Dịch max" là lần chậm nhất. Hai cột này chỉ tính các lần đạt.
- Script: [`scripts/perf/models-bench.mjs`](../scripts/perf/models-bench.mjs). Dữ liệu thô: `scripts/perf/models-results-tr-words.json`. Bảng giới hạn: `scripts/perf/go-limits.json`.

```bash
PERF_RUNS=2 PERF_CONCURRENCY=4 PERF_CASES=tr,words PERF_OUT=scripts/perf/models-results-tr-words.json node scripts/perf/models-bench.mjs
```

## Kết quả, sắp theo Monthly limit giảm dần

Hai model cùng Monthly limit được xếp theo Req/5h giảm dần. ✅ là model đạt 12/12 lần dịch.

| # | Model | Monthly limit (Go / Plus) | Req/5h (Go / Plus) | Dịch đạt | Dịch p50 | Dịch max | Sinh từ đạt | Sinh từ p50 | Lỗi |
|---|---|---|---|---|---|---|---|---|---|
| 1 | beam-free | ∞ (miễn phí, có thời hạn) | ∞ | 11/12 | 7,3 s | 9,2 s | 2/2 | 4,9 s | 1 timeout |
| 2 | hy4-flash-free | ∞ (miễn phí, có thời hạn) | ∞ | 3/12 | 10,9 s | 12,5 s | 2/2 | 4,1 s | 9 timeout |
| 3 | iceman-contributor-free | ∞ (miễn phí, có thời hạn) | ∞ | 0/12 | — | — | 0/2 | — | bị chặn (model train trên dữ liệu) |
| 4 | glm-5.3 | $200 / $400 | 2.640 / 5.280 | 11/12 | 10,6 s | 14,6 s | 2/2 | 7,6 s | 1 timeout |
| 5 | deepseek-v4.1-flash | $100 / $200 | 43.300 / 86.700 | 9/12 | 10,6 s | 14,4 s | 2/2 | 2,9 s | 3 timeout |
| 6 | muse-spark-1.2-contributor | $60 / $120 | 45.300 / 90.600 | 0/12 | — | — | 0/2 | — | bị chặn (model train trên dữ liệu) |
| 7 | muse-spark-1.3-contributor | $60 / $120 | 45.300 / 90.600 | 0/12 | — | — | 0/2 | — | bị chặn (model train trên dữ liệu) |
| 8 | mimo-v2.6-flash | $60 / $120 | 30.100 / 60.200 | 10/12 | 10,7 s | 14,0 s | 2/2 | 4,3 s | 2 timeout |
| 9 | longcat-2.5 | $60 / $240 | 11.400 / 45.700 | 0/12 | — | — | 2/2 | 7,6 s | 12 timeout |
| 10 | **glm-5.3-flash** ✅ (đang dùng) | $60 / $180 | 6.320 / 18.900 | **12/12** | 5,0 s | 9,4 s | 2/2 | 2,2 s | — |
| 11 | qwen3.7-plus | $60 / $180 | 4.310 / 12.900 | 0/12 | — | — | 2/2 | 17,6 s | 12 timeout |
| 12 | hy3 | $60 / $240 | 4.300 / 17.200 | 0/12 | — | — | 2/2 | 14,7 s | 12 timeout |
| 13 | minimax-m3 | $60 / $180 | 3.210 / 9.620 | 4/12 | 5,9 s | 7,5 s | 0/2 | — | 8 timeout, 2 JSON lẫn `<think>` |
| 14 | hy4 | $60 / $240 | 2.710 / 10.800 | 0/12 | — | — | 2/2 | 7,5 s | 12 timeout |
| 15 | kimi-k2.7-code | $60 / $180 | 994 / 2.980 | 0/12 | — | — | 2/2 | 6,6 s | 12 timeout |
| 16 | qwen3.8-flash | $30 / $90 | 5.400 / 16.200 | 3/12 | 13,6 s | 14,8 s | 2/2 | 4,5 s | 9 timeout |
| 17 | hy4-preview | $30 / $120 | 1.350 / 5.410 | 0/12 | — | — | 1/2 | 20,8 s | 13 timeout |
| 18 | gemini-4-argon | $30 / $120 | 566 / 2.260 | 11/12 | 7,9 s | 12,8 s | 2/2 | 11,7 s | 1 timeout |
| 19 | minimax-m3.1-flash | $20 / $80 | 3.880 / 15.500 | 7/12 | 5,7 s | 10,5 s | 2/2 | 3,7 s | 5 timeout |
| 20 | **gpt-6-luna** ✅ | $15 / $60 | 4.230 / 16.900 | **12/12** | 3,8 s | 7,2 s | 2/2 | 3,0 s | — |
| 21 | **claude-haiku-5-5** ✅ | $15 / $60 | 3.850 / 15.400 | **12/12** | 3,8 s | 5,7 s | 2/2 | 1,3 s | — |
| 22 | mimo-v2.6-pro | $15 / $60 | 3.260 / 13.000 | 2/12 | 12,2 s | 12,2 s | 2/2 | 6,6 s | 10 timeout |
| 23 | **gpt-5.6-luna** ✅ | $15 / $60 | 2.050 / 8.200 | **12/12** | 3,9 s | 5,4 s | 2/2 | 2,0 s | — |
| 24 | deepseek-v4-pro | $15 / $60 | 1.040 / 4.180 | 2/12 | 13,4 s | 13,4 s | 2/2 | 4,7 s | 10 timeout |
| 25 | **qwen4-max** ✅ | $15 / $60 | 463 / 1.850 | **12/12** | 8,7 s | 12,4 s | 2/2 | 3,6 s | — |
| 26 | step-5-preview | $15 / $60 | 426 / 1.700 | 1/12 | 14,3 s | 14,3 s | 2/2 | 12,5 s | 11 timeout |
| 27 | grok-4.7 | $15 / $60 | 169 / 676 | 4/12 | 12,9 s | 14,7 s | 2/2 | 3,6 s | 8 timeout |
| 28 | qwen3.8-max | $15 / $60 | 162 / 647 | 2/12 | 14,8 s | 14,8 s | 2/2 | 6,0 s | 10 timeout |
| 29 | kimi-k3.1-pro | $15 / $60 | 147 / 588 | 7/12 | 9,7 s | 14,4 s | 2/2 | 3,4 s | 5 timeout |
| 30 | kimi-k3 | $15 / $60 | 98 / 392 | 4/12 | 13,2 s | 13,2 s | 2/2 | 8,9 s | 8 timeout |

## Nhận xét

- **Chỉ 5 model dịch đạt 12/12:** glm-5.3-flash, gpt-6-luna, claude-haiku-5-5, gpt-5.6-luna và qwen4-max. Trong số này, chỉ **glm-5.3-flash** vừa nhanh (p50 5,0 s, sinh từ 2,2 s) vừa có hạn mức cao ($60/tháng, khoảng 6.300 request mỗi 5 giờ). Vì vậy model đang dùng vẫn là lựa chọn hợp lý nhất.
- **Nhanh nhất là claude-haiku-5-5:** dịch tối đa 5,7 s, sinh từ 1,3 s. Đổi lại, hạn mức chỉ $15/tháng, bằng một phần tư glm-5.3-flash. Model này hợp làm dự phòng hơn là model chính.
- **Hạn mức lớn nhưng dịch chưa ổn định:**
  - **deepseek-v4.1-flash:** $100/tháng, 43.300 request mỗi 5 giờ, đạt 9/12.
  - **mimo-v2.6-flash:** $60/tháng, 30.100 request mỗi 5 giờ, đạt 10/12.
  - **glm-5.3:** $200/tháng, đạt 11/12.

  Cả ba chỉ trượt vì timeout (p50 khoảng 10,6 s, sát ngưỡng 15 s). Nếu bật `reasoning_effort: "low"` hoặc nới timeout thì có thể dùng được, nhưng cần đo lại.
- **Gần như mọi lỗi đều là timeout:** app không hạ mức suy luận cho opencode. Một lần đo nhanh với `reasoning_effort: "low"` cho thấy kimi-k3.1-pro giảm từ 26 s xuống 5 s, minimax-m3.1-flash từ hơn 60 s xuống 5,6 s. qwen4-max và deepseek-v4.1-flash gần như không đổi.
- **Sinh từ ít khắt khe hơn:** 25/30 model đạt 2/2. Chỉ có ba ngoại lệ:
  - **minimax-m3:** trả `<think>…</think>` lẫn trong nội dung nên JSON hỏng.
  - **hy4-preview:** 1 lần timeout 25 s.
  - **Các model contributor:** bị chặn.
- **Không dùng được:** muse-spark-1.2 và 1.3, iceman-contributor-free. Gateway trả 400 vì các model này train trên dữ liệu request, trong khi Settings › Privacy đang chặn loại này.
- **Model miễn phí:** beam-free đạt 11/12, p50 7,3 s. Tuy vậy nó chỉ có trong thời gian giới hạn và ở một số khu vực, nên không nên dựa vào lâu dài.

## Giới hạn của lần đo

- **Ít mẫu:** chỉ 2 lượt mỗi ca. Thời gian dao động nhiều giữa các lần, cùng một model có thể lệch vài giây.
- **Chạy song song:** 4 model chạy cùng lúc nên độ trễ có thể cao hơn khi gọi lẻ.
- **Chưa chấm chất lượng:** chưa có người đọc kiểm tra bản dịch. "Đạt" chỉ có nghĩa là đúng chữ viết và đúng JSON.
- **Ý nghĩa của Monthly limit:** đây là hạn mức tính bằng USD theo giá token của từng model, không phải số request. Số request thực tế phụ thuộc vào độ dài prompt và câu trả lời.
- **Lỗi ghi nhãn trong log (có sẵn từ trước):** khi JSON hỏng, log ghi "Gemini returned invalid JSON" dù model không phải Gemini.
