# ThankZ English — Logo kit

Bộ nhận diện Garden, hồng san hô – vàng mật ong, chữ Z vàng.

## File và cách dùng

| File | Dùng cho |
|---|---|
| public/brand/logo-light.png | Logo PNG nền trong suốt, chữ Thank xanh rừng, dùng trên nền sáng |
| public/brand/logo-dark.png | Logo chữ kem, Z vàng trên nền xanh rừng cố định |
| public/brand/logo-*-300/600/1200.png | Logo ngang ở kích thước tương ứng, tỉ lệ 3:1 |
| public/brand/app-icon-master.png | Icon nguồn độ phân giải cao, nền xanh rừng |
| public/icons/icon-16/32/48.png | Favicon PNG |
| public/favicon.ico | ICO nhiều kích thước 16, 32, 48 px |
| public/icons/apple-touch-icon.png | Biểu tượng iPhone/iPad, 180 × 180 px |
| public/icons/icon-192.png, icon-512.png | Icon PWA tiêu chuẩn |
| public/icons/icon-maskable-192.png, icon-maskable-512.png | Icon PWA có lề an toàn rộng hơn khi hệ điều hành cắt hình |
| public/icons/icon-64/128/256/1024.png | Kích thước bổ sung |
| reference/brand-colors.png | Bản tham chiếu thiết kế và bảng màu |

## Tích hợp vào dự án hiện tại

1. Chép nội dung thư mục `public/` vào `public/` của dự án. Sao lưu icon cũ nếu muốn giữ lại. Đây chỉ là bộ tài sản: chưa tự sửa ứng dụng hoặc triển khai.
2. Trong `src/app/manifest.ts`, đổi `name` thành `ThankZ English`, `short_name` thành `ThankZ`. Các đường dẫn icon 192/512/maskable-512 trùng cấu trúc đang có. Giữ `id`, `start_url`, `scope`, `shortcuts` và các cấu hình chức năng hiện tại. `manifest-branding.example.json` chỉ là phần cấu hình để ghép, không phải manifest đầy đủ.
3. Ghép cấu hình icon từ `nextjs-metadata.example.ts` vào metadata của `src/app/layout.tsx`. Đổi cả `appleWebApp.title` thành `ThankZ English`. Giữ `manifest: "/manifest.webmanifest"` và các cấu hình khác.
4. Đặt logo trong phần thương hiệu của thanh điều hướng. Ví dụ:

```tsx
<img src="/brand/logo-light-600.png" alt="ThankZ English" width={180} height={60} />
```

Trên nền tối dùng `logo-dark-600.png`. Ảnh này có nền xanh cố định, có thể thấy mép nếu màu nền ứng dụng khác; khi đó dùng icon vuông cùng tên ứng dụng hiển thị bằng chữ HTML để hòa màu giao diện.

5. Dùng `brand-colors.json` hoặc `brand.css` nếu cần tham chiếu bảng màu. Không cần đổi toàn bộ theme của ứng dụng. Vàng là màu nhấn; trên nền sáng dùng chữ xanh rừng cho văn bản nhỏ.
6. Kiểm tra trên desktop, điện thoại và màn hình thêm vào trang chủ. Favicon/PWA có thể bị cache: thử tab riêng tư, cập nhật service worker theo quy trình của dự án hoặc gỡ/thêm lại biểu tượng trang chủ khi cần. Không xóa dữ liệu học để đổi logo.

## Lưu ý định dạng

Tài sản logo là PNG raster, favicon là ICO chứa PNG. Không có file vector SVG/AI giả lập. Ảnh được tạo từ thiết kế tham chiếu nên có sai khác nhỏ về hình học giữa các biến thể; dùng nhất quán từng bộ file trong giao diện. Mã màu là màu nhận diện mục tiêu; ảnh có chuyển sắc nhẹ. Logo-dark có nền cố định; logo-light có kênh alpha.
