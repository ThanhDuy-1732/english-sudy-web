# Ngân hàng từ + job sinh 1.000 từ không trùng

Ngày: 2026-11-18
Trạng thái: đã duyệt (2026-11-18)

## 1. Mục tiêu và lý do

Mỗi lần bấm "Sinh từ mới" hiện chỉ nhớ 40 từ gần nhất trong một lượt ghé trang. Tải lại là mất trí nhớ nên từ quay lại; không có cách tích luỹ 1.000 từ chắc chắn không trùng. Tốc độ cũng bị giới hạn vì mỗi lần chỉ sinh 5 từ (≈2,3 s), trong khi 20 từ chỉ ≈2,7 s.

Mục tiêu:

- **G1**: không bao giờ hiện lại một từ đã hiện, đã sinh hoặc đã lưu (`learnedWords`); đảm bảo bằng dữ liệu local, không phụ thuộc model.
- **G2**: sinh trước 1.000 từ cho một chủ đề; dừng giữa chừng, mở lại chạy tiếp.
- **G3**: bấm "Sinh từ mới" khi ngân hàng còn từ chưa học phải hiện tức thì (không gọi AI).
- **G4**: không thêm backend, cron, database hay service nào.

Non-goals: chạy khi app đã đóng; đồng bộ giữa thiết bị; thay bằng danh sách từ đóng gói sẵn; đổi flashcard/chấm/phát âm.

Anti-goals: job tiêu tốn AI mà không có UI nhìn thấy; mất quá 1 lô khi reload; vượt rate limit 60 request/phút/IP.

## 2. Ràng buộc hiện có

- `POST /api/*`: body ≤ 16 KB, 60 request/phút/IP (`src/middleware.ts`, `src/lib/api-limits.ts`), route AI `maxDuration = 300`.
- Không auth/DB; localStorage ~5 MB; phải chịu storage bị chặn/đầy (`safe-json.ts`).
- OpenCode Go ≈2,3 s/5 từ, ≈2,7 s/20 từ, ≈4,6 s/30 từ (đo 2026-11-18, `deepseek-v4.1-flash`).

## 3. Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **A. Job client có checkpoint + C. ngân hàng cuốn chiếu** | Resume; chặn trùng bằng local; bấm là có | Chỉ chạy khi app mở | **Chọn** |
| B. Một request streaming NDJSON | Ít điều phối | Đóng tab mất dữ liệu, không resume | Loại |
| C. Chỉ ngân hàng cuốn chiếu | Đơn giản nhất | Không sinh 1.000 từ ngay | Loại (dùng chung ngân hàng) |
| Danh sách từ đóng gói sẵn | 0 AI khi chọn từ | Cần dữ liệu chủ đề, khác sản phẩm | Loại |

## 4. Mô hình dữ liệu

### `wordBank` — localStorage, có trong backup

```ts
interface BankWord {
  word: string;
  meaning: string;
  topic: string;
  createdAt: string;   // ISO
  seenAt?: string;     // ISO, đặt khi từ được hiển thị
}
```

Khoá `wordBank`, tối đa **5.000** phần tử (bỏ cũ nhất; 5.000 từ ≈ 600 KB). So trùng: `trim → gộp khoảng trắng → lowercase`; không gộp số ít/số nhiều. Từ đã lưu nằm ở `learnedWords`, không chép sang bank.

### `wordJob` — localStorage, **runtime**, không vào backup

```ts
interface WordJob {
  id: string;
  topic: string;
  target: number;
  status: "running" | "paused" | "done" | "error";
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  lock?: { tabId: string; heartbeatAt: string };
}
```

Một job tại một thời điểm. Tiến trình = `countBank(job.topic) / target`. Target là **tổng số từ chưa học của chủ đề trong bank**, không phải "thêm 1.000 từ nữa".

## 5. Thiết kế

### 5.1 `src/lib/word-bank.ts` (mới)

- `normalizeWord(word)`.
- `getBank(): BankWord[]` — `readStored` + overlay bộ nhớ; lỗi trả `[]`.
- `addBankWords(entries): { added: number; persisted: boolean }` — lọc trùng trong batch, với bank, **và với `learnedWords`**; ghi đồng bộ. Ghi lỗi → giữ batch trong overlay bộ nhớ, trả `persisted: false`.
- `getKnownWordSet(): Set<string>` — bank ∪ `learnedWords` (đã chuẩn hoá).
- `getUnseen(topic, limit)` — `seenAt` trống, đúng `topic`, **và không có trong `learnedWords`** (phòng khi import backup thêm từ đã học mà bank chưa biết).
- `markBankWordsSeen(words)`.
- `countBank(topic?)` — chỉ đếm từ còn hiển thị được (chưa `seenAt`, chưa học).
- `pickExcludeSample(topic, max = 200)` — 120 từ mới nhất của chủ đề + 80 ngẫu nhiên còn lại.

**Lọc lúc ghi là chính, lọc lúc đọc là lưới an toàn**: target 1.000 phản ánh đúng số từ dùng được, không bị "đủ 1.000 mà chỉ hiện được 800".

### 5.2 Trang chủ — luồng C (bấm là có)

1. `unseen = getUnseen(topic, 5)`; đủ 5 → `markBankWordsSeen` → hiện ngay.
2. Thiếu → gọi `/api/generate-words` với `{ topic, exclude: pickExcludeSample(topic), count: 20, knownCount: countBank(topic) }`.
3. `addBankWords` toàn bộ kết quả, lấy 5 unseen (gồm từ mới), đánh dấu đã xem.
4. 0 từ mới → hiện "Chủ đề này đã cạn từ mới. Thử chủ đề khác."; không xoá thẻ đang xem.

Bỏ `seenWords` tạm trong `page.tsx`; ngân hàng thay thế.

### 5.3 Job (A) — `useWordJob` + `WordJobProvider`

**Một worker** (quyết định sau builder check): hai worker song song gửi gần như cùng prompt nên trùng lặp nhiều; lợi ích ròng ≈ 0 mà gấp đôi chi phí. Một worker 20 từ/2,7 s, hiệu suất thực ~70% → 1.000 từ trong **3–5 phút**.

- Vòng lặp: gọi lô `count: 20` → `addBankWords` → cập nhật `updatedAt`/heartbeat → dừng khi `countBank(topic) ≥ target`.
- **Giới hạn phía client**: cửa sổ trượt **40 request/phút** cho job (chừa 20 cho thao tác tay của người dùng), không dựa vào độ trễ provider.
- **429**: đọc `Retry-After`, đặt `cooldownUntil` **toàn job** (worker duy nhất chờ), **không** tính vào chuỗi lỗi.
- **5xx/network**: backoff 2^n giây (tối đa 30 s); tính vào chuỗi lỗi chung.
- **Dừng**: đủ target (`done`); người dùng bấm Dừng (`paused`); 3 lô liên tiếp 0 từ mới (`paused`, "chủ đề đã cạn"); 3 lỗi liên tiếp (`error`, giữ tiến trình); ghi bank thất bại (`error` riêng, xem 5.4).
- **Checkpoint**: mỗi lô ghi bank + `wordJob`; reload mất tối đa 1 lô và không gây trùng.
- **Resume**: mở app thấy job `running`/`paused` → "Đang có 420/1.000 từ — Chạy tiếp / Huỷ". Không tự chạy.
- **Đa tab**: lock heartbeat 5 s; heartbeat < 15 s → "Đang chạy ở tab khác"; > 30 s → được tiếp quản.
- **Rời trang**: hook nằm trong `WordJobProvider` (mount ở `layout.tsx`, trong `ProviderContextProvider`), nên **chạy tiếp khi điều hướng trong app**. Rời hẳn trang (đóng tab) → `AbortController` + `paused`.
- **Đổi chủ đề ở trang chủ**: không ảnh hưởng job; job luôn chạy cho `job.topic`. Bắt đầu job mới khi đang có job → phải Dừng/Huỷ trước (nút bị khoá kèm lý do).
- **Tab ẩn**: vẫn chạy.

### 5.4 Ghi bank thất bại

`addBankWords` trả `persisted: false` khi `setItem` lỗi (đầy/bị chặn). Job **dừng ngay** với `status: "error"`, thông báo "Không lưu được vào bộ nhớ trình duyệt. Job đã dừng; N từ vừa tạo vẫn dùng được trong phiên này." Batch được giữ trong overlay bộ nhớ để không mất từ đã trả tiền; không tự thử lại (tránh đốt AI vô hạn).

### 5.5 UI

- **Provider + dải tiến trình toàn cục** (mọi trang, dưới banner): "Đang tạo 420/1.000 từ · Dừng" (`aria-live="polite"`), bấm vào về `/`. Đây là cam kết chống job vô hình.
- **Trang chủ**, dưới nút Sinh từ mới:
  - "Ngân hàng: 214 từ chưa học cho chủ đề này."
  - Nút "Tạo trước" mở panel: mốc 100 / 300 / 1.000 (mặc định 1.000) → "Bắt đầu".
  - Đang chạy: progress + "420/1.000 · 38 từ/phút" + Dừng.
  - Xong: "Đã đủ 1.000 từ cho chủ đề này."
- Không thêm trang/mục điều hướng.

### 5.6 Backup / chuyển máy / xoá dữ liệu

- `wordBank` tự có trong `exportData`.
- `wordJob` vào `EXCLUDED_KEYS`.
- `mergeData`: `wordBank` vào `IDENTITY` theo `word`; `seenAt` **dính** (một bên đã xem thì bản gộp đã xem).
- `needsBackup`: thêm `wordBank` vào danh sách "có dữ liệu".
- `clearAllData`: **xoá tường minh `wordJob`** dù nó bị loại khỏi backup (hiện `clearAllData` bỏ qua mọi key trong `EXCLUDED_KEYS`). Settings đã reload sau khi xoá nên vòng lặp trong bộ nhớ cũng dừng.

### 5.7 API — chỉnh nhỏ, không thêm route

- `/api/generate-words` nhận `count` (1–30, mặc định 5), `knownCount` (số nguyên ≥0, kẹp 0–100.000); nâng `exclude` tối đa 60 → **200**.
- Prompt thêm khi `knownCount > 0`: "The learner already knows N words on this topic; avoid them and prefer less common words."

## 6. Kiểm thử

- `word-bank.test.ts`: chuẩn hoá; khử trùng batch/bank/`learnedWords`; `getUnseen` (topic, đã xem, đã học); `markBankWordsSeen`; cap 5.000; storage hỏng; overlay khi ghi lỗi; `pickExcludeSample` ≤ 200.
- `word-job.test.ts`: `shouldStop({ emptyStreak, failures, count, target })`, `nextBackoff`, `rateWindow` (40/phút), 429 không tăng chuỗi lỗi.
- `gemini.test.ts`: `count` 20 vào prompt; exclude dài bị cắt.
- `generate-words.test.ts`: `count` ngoài 1–30 bị kẹp; exclude 250 → 200; `knownCount` vào prompt.
- `data-transfer.test.ts`: merge `wordBank` theo `word`, `seenAt` dính; `wordJob` không có trong file; `clearAllData` xoá `wordJob`.
- E2E thủ công: job 100 từ, reload giữa chừng, resume; không trùng `learnedWords`; đo từ/phút.

## 7. Quyết định của người viết (bạn có thể bác)

- **Một worker** thay vì hai: cùng tốc độ thực, nửa chi phí.
- **Giới hạn 40 request/phút phía client** thay vì tin vào độ trễ.
- **20 từ/lô**, mốc 100/300/1.000.
- **Job chạy xuyên trang** + dải tiến trình toàn cục; không tự resume.
- **Bank tối đa 5.000**; target tính theo tổng bank của chủ đề.
- **Job không vào backup**; `clearAllData` xoá job.

## 8. Việc còn lại cho người triển khai

- Tên file provider/hook và vị trí dải tiến trình trong `layout.tsx`.
- Có hiển thị ngân hàng ở `/history` không (ngoài phạm vi, làm sau).
- Câu chữ UI cuối cùng theo quy ước copy trong `CONTEXT.md`.
