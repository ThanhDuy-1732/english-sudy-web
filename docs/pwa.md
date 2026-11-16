# PWA: web và điện thoại

Ứng dụng dùng cùng một Next.js backend cho web và PWA. Production phải chạy qua HTTPS; chỉ localhost là ngoại lệ để thử service worker/microphone. `npm run dev` không đăng ký service worker. Không dùng static export vì các chức năng AI cần API routes.

## Có thể dùng khi mất mạng

Sau khi service worker cài xong và các trang được tải về:

- Xem lịch sử, thống kê và dữ liệu đã lưu trên thiết bị.
- Ôn flashcard đã lưu và cập nhật kết quả ôn tập.
- Đọc ngữ pháp có sẵn.
- Luyện đề có sẵn trong ngân hàng local, đúng loại/part/level. Không có đề phù hợp thì hiện lỗi để thử lại khi có mạng.
- Viết bài và lưu bản nháp theo task. Mở lại sẽ khôi phục nội dung và mốc hết giờ.

Sinh nội dung mới, bài tập AI, roleplay, nhận dạng giọng nói và chấm bài cần mạng. TTS offline phụ thuộc giọng đọc có sẵn trên thiết bị. Audio được lưu cục bộ, không đồng bộ giữa thiết bị.

Các trang bổ sung được precache theo best effort; mạng lỗi khi cài có thể khiến một số trang chưa sẵn sàng offline. Trang chưa cache sẽ hiện hướng dẫn ngoại tuyến. Điều hướng bằng Next Link lưu riêng HTML; không dùng chung cache giữa HTML và RSC/Flight.

## Cài đặt và cập nhật

- Android/Chrome: nút **Cài English Study** khi trình duyệt cho phép, hoặc menu trình duyệt → Cài ứng dụng. Khung hướng dẫn có nút ✕ để ẩn (nhớ trong `pwaInstallDismissed`).
- iPhone/iPad: Safari → Chia sẻ → Thêm vào Màn hình chính.
- Khi có worker mới: banner **Cập nhật và tải lại**. Không tự tải lại giữa bài học. Nút bị vô hiệu khi offline.
- Cache theo `NEXT_PUBLIC_PWA_VERSION` (mặc định tạo tại build); giữ thêm cache phiên bản trước để các tab cũ còn dùng asset.
- Worker cache offline không thay thế sao lưu dữ liệu. Dữ liệu local vẫn có thể bị xóa bởi người dùng/hệ điều hành. App yêu cầu persistent storage nếu API hỗ trợ trong chế độ standalone; trình duyệt quyết định chấp thuận.

## Sao lưu dữ liệu

Không còn backend đồng bộ. Dữ liệu nằm trong localStorage của từng trình duyệt; chuyển máy hoặc backup bằng **Cài đặt → Dữ liệu** (xuất file JSON, nhập lại trên thiết bị khác). PWA cache không thay thế backup: dữ liệu local vẫn có thể bị xoá bởi người dùng hoặc hệ điều hành.

## Kiểm tra trước phát hành

```sh
npm test -- --runInBand
npm run lint
npm run build
npm run start
```

Trên Android Chrome và iPhone Safari, kiểm tra cả tab web và app đã cài:

1. Manifest/icon tải được; worker kích hoạt trong DevTools; `/sw.js` có header `Cache-Control: no-cache, no-store, must-revalidate`.
2. Ở độ rộng 320/390/768px: Menu mở được, Cài đặt truy cập được, không tràn ngang; thử xoay ngang và mở bàn phím. Nội dung không bị tai thỏ/home indicator che.
3. Chờ cài worker hoàn tất, bật chế độ máy bay; mở Review, Grammar, Writing, lịch sử. Thử Next Link, mở lại app và route chưa từng mở.
4. Viết nháp, đóng app, mở lại đúng task: nội dung còn và countdown theo thời gian thực. API lỗi không xóa bản nháp hoặc lưu kết quả chấm lỗi.
5. Bắt đầu countdown/mock/prep speaking, chuyển app hoặc khóa màn hình 30s rồi trở lại: thời gian được cập nhật, callback hết giờ chỉ chạy một lần. Thời gian ẩn không tính vào thời gian học.
6. Ghi âm trên Safari/Chrome; từ chối quyền mic, rời trang khi đang ghi âm, nghe lại. Kiểm tra định dạng thực tế của file upload, đặc biệt iOS trước 18.4 (MP4 thay cho WebM).
7. Lưu dữ liệu lúc mất mạng, mở lại app rồi bật mạng: queue còn dữ liệu và xử lý thành công; giả lập server 503 để kiểm tra backoff/failed/retry.
8. Deploy build mới khi app cũ còn mở: hiện nút cập nhật, không tự mất bài đang làm; bấm cập nhật rồi mở lại offline.

`firebase.json` và `next.config.mjs` đều đặt header service worker. Triển khai theo `docs/firebase-deploy.md`; xác nhận domain thật trả 200 và API routes hoạt động. URL mặc định `study-project-f9e9d.web.app` trả 404 ở lần kiểm tra 2026-10-01; cấu hình PWA trong mã nguồn không xác nhận việc deploy đã hoàn tất.
