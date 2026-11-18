# ThankZ English

ThankZ English là website tự học tiếng Anh cá nhân, tập trung vào việc học từ vựng theo chủ đề bằng flashcard. Người học có thể chọn chủ đề, sinh bộ từ mới bằng AI, lật thẻ để xem nghĩa tiếng Việt và câu ví dụ, sau đó lưu lại những từ đã học để ôn tập sau.

## Tính năng chính

- Chọn chủ đề học từ vựng: `Daily Communication` hoặc `TOEIC`.
- Sinh 5 từ tiếng Anh theo chủ đề bằng Gemini AI.
- Hiển thị từ vựng dưới dạng flashcard có hiệu ứng lật thẻ.
- Tạo câu ví dụ tự nhiên cho từng từ khi người dùng lật thẻ.
- Lưu từ đã học vào trình duyệt bằng `localStorage`.
- Xem lịch sử từ đã học tại trang `/history`.
- Lọc lịch sử theo chủ đề và xóa những từ không còn cần luyện.

## Công nghệ sử dụng

- Next.js 15 với App Router
- React 19
- TypeScript
- Tailwind CSS
- Google Generative AI SDK
- Jest và Testing Library

## Cấu trúc chính

```text
src/app/page.tsx                     Trang học từ mới
src/app/history/page.tsx             Trang lịch sử từ đã học
src/app/api/generate-words/route.ts  API sinh danh sách từ vựng
src/app/api/generate-sentence/route.ts API sinh câu ví dụ
src/components/Flashcard.tsx         Thẻ học từ vựng
src/components/FlashcardGrid.tsx     Lưới flashcard
src/components/TopicSelector.tsx     Bộ chọn chủ đề
src/lib/gemini.ts                    Kết nối Gemini AI
src/lib/storage.ts                   Lưu và đọc lịch sử học từ
```

## Cài đặt và chạy dự án

1. Cài dependencies:

```bash
npm install
```

2. Tạo file `.env.local` ở thư mục gốc và thêm Gemini API key:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

3. Chạy môi trường development:

```bash
npm run dev
```

4. Mở website tại:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev        # Chạy development server
npm run build      # Build production
npm run start      # Chạy bản production sau khi build
npm run lint       # Kiểm tra lint
npm test           # Chạy test
npm run test:watch # Chạy test ở chế độ watch
```

## Luồng sử dụng

1. Vào trang chủ và chọn chủ đề muốn học.
2. Bấm `Sinh từ mới` để AI tạo danh sách từ vựng.
3. Bấm vào từng flashcard để xem nghĩa và câu ví dụ.
4. Bấm `Đã học` để lưu từ vào lịch sử.
5. Mở trang `Lịch sử` để xem lại, lọc theo chủ đề hoặc xóa từ đã lưu.

## Ghi chú

Dữ liệu lịch sử học được lưu trong `localStorage` của trình duyệt, nên mỗi trình duyệt hoặc thiết bị sẽ có một danh sách riêng. Các chức năng sinh từ và sinh câu ví dụ cần `GEMINI_API_KEY` hợp lệ để hoạt động.
