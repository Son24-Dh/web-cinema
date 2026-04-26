# Setup — DÂU CINEMA 🍓

## Prerequisites
- Trình duyệt web hiện đại (Chrome, Firefox, Safari, Edge).
- Không cần cài đặt môi trường server (Node.js, PHP...).

## Clone & Install
1. Tải toàn bộ thư mục `clone-web` về máy.
2. Không cần chạy lệnh cài đặt (npm install...).

## Run Locally
1. Mở thư mục dự án.
2. Click đúp vào file `index.html` để mở bằng trình duyệt.
3. Hoặc kéo thả file `index.html` vào tab trình duyệt đang mở.

## Cách thêm phim mới
1. Mở file `data.js`.
2. Sao chép cấu trúc của một bộ phim có sẵn.
3. Thay đổi ID, tên, poster và danh sách tập phim (link `.m3u8`).
4. Lưu file và tải lại trang web.

## Common Issues
- **Lỗi video không chạy**: Kiểm tra lại link `.m3u8` trong `data.js` xem còn hoạt động không. Link m3u8 thường có thời hạn hoặc bị chặn bởi CORS của máy chủ gốc.
- **Ảnh không hiển thị**: Đảm bảo link ảnh là trực tiếp và cho phép hiển thị từ bên ngoài.