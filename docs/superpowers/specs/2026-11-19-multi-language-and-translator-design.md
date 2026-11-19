# Học nhiều ngôn ngữ và trình dịch theo ngữ cảnh

Ngày: 2026-11-19 · Trạng thái: chờ duyệt

## Mục đích

Người dùng (chính chủ ứng dụng, người Việt) muốn học nhiều ngôn ngữ trong cùng một ứng dụng: tiếng Anh như hiện nay, thêm tiếng Trung, Nhật, Hàn. Các ngôn ngữ dùng chung một khu vườn, một hàng ôn tập, một chuỗi ngày học, không tách thành bốn ứng dụng con.

Ngoài việc học, người dùng cần một trình dịch dùng hằng ngày: viết tin nhắn cho người nước ngoài và giao tiếp khi đi du lịch. Với tin nhắn, sắc thái quyết định câu nào gửi được (thân mật hay trang trọng). Khi du lịch, cần nói thay vì gõ, đọc được biển hiệu và thực đơn, phát câu dịch cho người đối diện nghe và nghe lại câu trả lời của họ.

## Mục tiêu

1. Chọn một hoặc nhiều ngôn ngữ học (mặc định tiếng Anh). Lựa chọn được nhớ và áp dụng cho toàn ứng dụng.
2. Từ mới, ngân hàng từ, ôn tập, Vườn từ, khu vườn và Thống kê hoạt động với mọi ngôn ngữ đã chọn.
3. Luyện tập nhẹ theo từng ngôn ngữ: quiz từ vựng, Từ trong ngữ cảnh, Shadowing, hội thoại tình huống (roleplay), và các chế độ trên thẻ (viết câu, điền từ, nghe chép).
4. Trình dịch: Việt, Anh, Trung, Nhật, Hàn theo mọi chiều; mỗi lần dịch trả về 3 sắc thái; có cách đọc, phát âm, sao chép.
5. Dịch từ giọng nói và từ ảnh; chế độ hội thoại hai chiều cho du lịch.

## Không làm

- Ngữ pháp, TOEIC/IELTS, IELTS Speaking/Writing vẫn chỉ tiếng Anh. HSK, JLPT, TOPIK là các dự án riêng sau này.
- Không dịch ngoại tuyến. Trình dịch cần mạng.
- Không đổi ngôn ngữ giải nghĩa: nghĩa và giải thích luôn bằng tiếng Việt.
- Không thêm dịch vụ trả phí mới (giọng đọc đám mây, OCR trả phí).

## Điều không được xảy ra

- Mất hoặc làm sai lịch ôn của từ tiếng Anh đã lưu khi nâng cấp dữ liệu.
- Tiến độ của hai từ khác ngôn ngữ nhưng cùng chữ viết (学生 trong tiếng Trung và tiếng Nhật) ghi đè lên nhau.
- Người chỉ học tiếng Anh thấy ứng dụng chậm hơn hoặc rối hơn hiện nay.
- Trình dịch chậm đến mức không dùng được khi đang đứng trước người khác.
- File sao lưu cũ không nhập lại được.

## Ràng buộc (từ dự án hiện tại)

- Dữ liệu nằm trong localStorage, không có backend dữ liệu. Sao lưu/nhập (`lib/data-transfer.ts`, `mergeData`) phải mang theo các trường mới.
- API key chỉ ở server; client chỉ gọi `src/app/api/*`. Lớp AI (`lib/providers`) chỉ nhận văn bản, thử lần lượt các nhà cung cấp.
- Vercel: hàm tối đa 300 s; thân request tối đa khoảng 4,5 MB (ảnh và audio phải nhỏ hơn mức này; route transcribe hiện cho 25 MB nhưng Vercel sẽ chặn trước).
- Phiên âm hiện dùng Groq Whisper (`/api/speech/transcribe`, đang khoá `language: "en"`). Phát âm dùng `speechSynthesis` của trình duyệt (`PronunciationButton`, khoá `en-US`).
- Từ được nhận diện bằng chuỗi `word` ở khắp nơi (`reviewWord(word)`, `deleteLearnedWord(word)`, `normalizeWord` trong ngân hàng từ).
- Thiết kế "Vườn bưu thiếp": postcard cho nội dung học, token màu, `font-en` (Fraunces) không có chữ Hán/Kana/Hangul.

## Cách tiếp cận (đã chọn)

| Vấn đề | Đã chọn | Phương án khác và lý do không chọn |
|---|---|---|
| Cách đọc (pinyin, kana, romanization) | AI trả về cùng lúc khi sinh từ hoặc dịch | Thư viện: pinyin nhỏ và chính xác, nhưng tiếng Nhật cần từ điển ~20 MB, quá nặng cho web app trên điện thoại. Chấp nhận AI thỉnh thoảng đọc sai. |
| Đọc chữ trong ảnh | Gửi ảnh thẳng cho Gemini (đã có key), thêm khả năng gửi ảnh vào lớp AI, chỉ Gemini | OCR trên máy: yếu với chữ Trung/Nhật/Hàn và chậm trên điện thoại. |
| Nghe (micro, hội thoại) | Groq Whisper, tự nhận ngôn ngữ, bấm để nói | Nhận dạng giọng nói của trình duyệt: không ổn định trên iPhone và Firefox, phải chọn ngôn ngữ trước (hội thoại hai chiều cần tự nhận). |
| Đọc to | Giọng có sẵn của trình duyệt | Dịch vụ giọng đọc đám mây: tự nhiên hơn nhưng tốn phí và thêm key. |
| Lưu từ | Thêm trường ngôn ngữ vào từ đã lưu, cùng kho hiện tại | Kho riêng cho mỗi ngôn ngữ: phải làm lại sao lưu, ôn tập, khu vườn cho từng kho. |

## Thiết kế

### Ngôn ngữ (dùng chung)

- `lib/languages.ts`: danh sách `en`, `zh`, `ja`, `ko` (và `vi` cho trình dịch) với tên tiếng Việt, tên bản ngữ (English, 中文, 日本語, 한국어), mã giọng đọc (`en-US`, `zh-CN`, `ja-JP`, `ko-KR`, `vi-VN`), mã Whisper, tên cách đọc (pinyin, kana, romanization). Tiếng Trung là giản thể.
- Lựa chọn ngôn ngữ học: key localStorage `learningLanguages` (mảng, mặc định `["en"]`, luôn ít nhất một). Một hook/context dùng chung để mọi trang đọc.
- Bộ chọn: combobox nhiều lựa chọn có ô tích, đặt trên thanh trên cùng ở điện thoại và trong thanh bên ở máy tính, hiện cờ chữ ngắn (EN, 中, 日, 한) của các ngôn ngữ đang chọn.
- Chữ Trung/Nhật/Hàn: phần tử chứa từ đó có thuộc tính `lang` đúng (`zh-CN`, `ja`, `ko`) để trình duyệt chọn đúng dạng chữ Hán; chồng font hệ thống sau Fraunces/Lexend (PingFang SC, Hiragino Sans, Apple SD Gothic Neo, Noto Sans CJK, Malgun Gothic, Microsoft YaHei). Không tải thêm font CJK.

### Dữ liệu

- `LearnedWord` và mục ngân hàng từ thêm: `lang` (thiếu = `"en"`), `reading?` (cách đọc), `conceptId?` (nối các từ cùng nghĩa ở ngôn ngữ khác, sinh cùng một lượt).
- Khoá nhận diện của một từ là cặp (`lang`, từ đã chuẩn hoá). Mọi hàm đang nhận `word` (ôn, xoá, đánh dấu đã thấy, chặn trùng) nhận thêm `lang`, mặc định `"en"` để mã cũ vẫn chạy.
- Từ đã lưu hiện có được coi là tiếng Anh, không cần chạy chuyển đổi: thiếu `lang` nghĩa là `"en"`.
- Sao lưu/nhập: `mergeData` gộp theo (`lang`, từ). File cũ không có `lang` vẫn nhập được (thành tiếng Anh).
- Mỗi từ có lịch ôn FSRS và cây riêng, kể cả khi cùng nghĩa với từ ở ngôn ngữ khác.

### Giai đoạn 1: Từ mới, ôn tập, khu vườn

- `/api/generate-words` nhận `langs` (mảng). Mỗi mục trả về là một nghĩa: nghĩa tiếng Việt và với mỗi ngôn ngữ một từ kèm cách đọc (tiếng Anh không cần cách đọc). Chủ đề và "Ngẫu nhiên" giữ nguyên ý nghĩa; danh sách tránh lặp gửi theo từng ngôn ngữ.
- Ngân hàng từ lưu từng từ theo ngôn ngữ, cùng `conceptId`. "Gieo 5 từ mới" lấy 5 nghĩa chưa thấy có đủ các ngôn ngữ đang chọn; thiếu thì sinh thêm. Đếm "N từ chưa học" theo số nghĩa.
- Thẻ ở Từ mới: một postcard cho mỗi nghĩa. Mặt trước: các từ theo ngôn ngữ, mỗi từ có cách đọc nhỏ phía dưới và nút phát âm đọc bằng đúng giọng. Mặt sau: nghĩa, câu ví dụ cho từng ngôn ngữ, đồng nghĩa/trái nghĩa (giữ cho tiếng Anh; các ngôn ngữ khác nếu AI trả được). "Gieo vào vườn" lưu tất cả từ của nghĩa đó, mỗi từ một mục riêng.
- Chỉ chọn tiếng Anh: thẻ, luồng và tốc độ như hiện nay.
- Ôn tập: mỗi thẻ là một từ của một ngôn ngữ. Mặt trước: từ và cách đọc. Mặt sau: nghĩa, ví dụ, và các từ anh em ở ngôn ngữ khác (nhỏ, làm gợi ý). Lọc theo ngôn ngữ bằng chip ở đầu trang (mặc định: các ngôn ngữ đang chọn).
- Vườn từ, Thống kê, Vườn hôm nay: bộ lọc ngôn ngữ; nhãn đất của cây hiện từ kèm chữ ngắn của ngôn ngữ (中, 日, 한) khi đang học hơn một ngôn ngữ.
- `PronunciationButton` nhận `lang`. Nếu thiết bị không có giọng cho ngôn ngữ đó, nút bị vô hiệu kèm lời nhắc cài giọng đọc.

### Giai đoạn 2: Luyện tập theo ngôn ngữ

- Các route sinh nội dung (`generate-sentence`, `generate-synonyms`, `generate-fillblank`, `grade-sentence`, `generate-reading`, `vocab/*`, `speak/roleplay`) nhận `lang`; lời nhắc yêu cầu đúng ngôn ngữ, giải thích và nhận xét bằng tiếng Việt.
- Quiz từ vựng và quiz trên trang Từ mới: chọn ngôn ngữ trước khi bắt đầu (mặc định các ngôn ngữ đang chọn); câu hỏi trộn nhiều ngôn ngữ được.
- Chế độ trên thẻ: viết câu, điền từ, nghe chép chấm theo ngôn ngữ của từ. Gõ chữ Trung/Nhật/Hàn bằng bộ gõ của thiết bị; khi chấm, so khớp sau khi bỏ khoảng trắng và dấu câu (tiếng Trung/Nhật không có khoảng trắng giữa từ).
- Từ trong ngữ cảnh: chọn từ trong một ngôn ngữ, nội dung sinh ra bằng ngôn ngữ đó.
- Shadowing: danh sách câu mẫu cố định cho mỗi ngôn ngữ (8 câu như hiện nay), có cách đọc; phiên âm Whisper với mã ngôn ngữ tương ứng.
- Roleplay: chọn ngôn ngữ hội thoại; AI đóng vai bằng ngôn ngữ đó; phần "Xem sửa lỗi" giải thích bằng tiếng Việt.

### Giai đoạn 3: Trình dịch văn bản

- Trang `/translate` ("Dịch"). Hai combobox: ngôn ngữ nguồn (có "Tự nhận") và ngôn ngữ đích, nút đảo chiều. Ô nhập. Nhớ cặp ngôn ngữ dùng lần cuối (mặc định Việt → Anh).
- `/api/translate`: `{ text, from, to }` → `{ detected, results: [{ tone: "casual" | "polite" | "formal", text, reading?, note }] }`. Một lời gọi AI trả cả 3 sắc thái dưới dạng JSON. Giới hạn độ dài đầu vào (đề xuất 1.000 ký tự).
- Mỗi kết quả là một postcard: tên sắc thái (Thân mật, Lịch sự, Trang trọng), câu dịch, cách đọc, ghi chú khi nào dùng, nút 🔊 phát âm, ⧉ sao chép, "Gieo vào vườn" (lưu câu đó vào vườn của ngôn ngữ đích nếu ngôn ngữ đó là ngôn ngữ học).
- Lịch sử dịch gần đây trên máy (20 mục) để mở lại nhanh khi đang ở ngoài.

### Giai đoạn 4: Giọng nói, ảnh, hội thoại hai chiều

- Micro trong trình dịch: bấm để nói, bấm để dừng (giới hạn 60 s); `/api/speech/transcribe` nhận `language` (hoặc để Whisper tự nhận) và trả về ngôn ngữ đã nhận; văn bản điền vào ô nhập rồi dịch.
- Ảnh: chụp hoặc chọn ảnh (`accept="image/*"`, `capture="environment"`), thu nhỏ trên máy (cạnh dài ≤ 1.600 px, JPEG) để dưới giới hạn thân request; `/api/translate/image` gửi cho Gemini; trả về các dòng chữ đọc được và bản dịch (một sắc thái tự nhiên, kèm cách đọc). Không có key Gemini: nút ảnh bị ẩn kèm ghi chú trong Cài đặt.
- Lớp AI: thêm một hàm riêng cho yêu cầu có ảnh, chỉ Gemini triển khai; không đổi `generateContent` hiện có.
- Hội thoại hai chiều (`/translate/conversation`): hai nút lớn, mỗi bên một ngôn ngữ (ví dụ "Tôi nói · Tiếng Việt" và "Họ nói · 中文"). Mỗi lượt: ghi âm → phiên âm (gợi ý ngôn ngữ của bên đó) → dịch một sắc thái lịch sự → hiện cả hai câu trong dòng hội thoại và tự đọc to bản dịch. Có nút xoay nửa màn hình của người đối diện 180° khi đặt điện thoại giữa hai người.
- Ảnh và audio của trình dịch không lưu lại; chỉ lưu văn bản trong lịch sử dịch.

### Điều hướng

- Thêm "Dịch" vào thanh bên, cạnh "Hôm nay".
- Thanh tab điện thoại (người dùng chọn): "Dịch" thay chỗ "Luyện thi"; thanh tab thành Hôm nay, Từ mới, Ôn tập, Dịch, Thêm. "Luyện thi" chuyển vào bảng "Thêm" (nhóm Luyện), vẫn ở thanh bên máy tính như cũ. Các bài e2e nhấn tab "Luyện thi" phải cập nhật.
- Bộ chọn ngôn ngữ học như mô tả ở phần Ngôn ngữ.

## Kiểm thử

- Jest: `languages`, khoá (`lang`, từ) trong lưu trữ và ngân hàng từ, nhập file sao lưu cũ không có `lang`, lời nhắc sinh từ nhiều ngôn ngữ, phân tích JSON của `/api/translate`, so khớp khi chấm chữ Trung/Nhật/Hàn.
- E2E (puppeteer, AI giả lập như hiện nay): sinh từ Anh + Trung, lưu và ôn một từ tiếng Trung, dịch 3 sắc thái, độ tương phản và tràn chữ với chữ CJK ở cả hai giao diện sáng và tối.
- Kiểm tra thủ công trên iPhone: giọng đọc Trung/Nhật/Hàn, micro, chụp ảnh.

## Để người xây quyết định

- Cấu trúc JSON chính xác của các route và tên trường trong mã.
- Hook hay context cho `learningLanguages`.
- Nội dung 8 câu Shadowing cho mỗi ngôn ngữ.
- Biểu tượng và nhãn cụ thể của bộ chọn ngôn ngữ, miễn theo thiết kế hiện có.
- Cách chia nhỏ mỗi giai đoạn thành các commit.

## Các quyết định do Claude đề xuất (người dùng kiểm tra khi đọc)

- Tiếng Trung giản thể.
- "Gieo vào vườn" trên thẻ nhiều ngôn ngữ lưu tất cả ngôn ngữ của nghĩa đó; xoá riêng từng từ ở Vườn từ nếu không muốn.
- "Gieo 5 từ mới" với hai ngôn ngữ cho 5 nghĩa, tức 10 từ phải ôn.
- Trình dịch mặc định Việt → Anh, nhớ cặp ngôn ngữ dùng lần cuối; lịch sử 20 mục.
- Hội thoại hai chiều dịch một sắc thái (lịch sự) để nhanh.
- Giới hạn 1.000 ký tự cho một lần dịch, 60 s cho một lần nói.
