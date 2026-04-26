# Architecture — DÂU CINEMA 🍓

## Tech Stack
- **Frontend**: HTML5, CSS3, Javascript (Vanilla).
- **Video Library**: [HLS.js](https://github.com/video-dev/hls.js).
- **Infrastructure**: Sẵn sàng để deploy lên Vercel, Netlify hoặc GitHub Pages.

## Project Structure
```
/clone-web/
├── index.html      ← Trang chủ liệt kê danh sách phim
├── watch.html      ← Trang xem phim chi tiết
├── styles.css      ← Toàn bộ giao diện Dark Mode
├── app.js          ← Logic điều khiển trình phát và dữ liệu
├── data.js         ← "Cơ sở dữ liệu" chứa thông tin phim và tập phim
└── docs/           ← Tài liệu dự án
```

## Data Flow
1. Người dùng truy cập `index.html`.
2. Javascript trong `index.html` đọc dữ liệu từ `data.js` để hiển thị danh sách phim.
3. Khi click vào phim, người dùng được dẫn đến `watch.html?id=[movieId]&tap=[episodeSlug]`.
4. `app.js` trong trang `watch.html` lấy ID phim và tập từ URL.
5. `app.js` truy xuất link `.m3u8` tương ứng từ `data.js`.
6. `Hls.js` khởi tạo và nạp luồng video vào thẻ `<video>`.

## Key Patterns
- **URL Search Params**: Sử dụng Query Strings để truyền trạng thái (phim nào, tập nào) giữa các trang mà không cần server.
- **Mock Database Pattern**: Sử dụng một đối tượng Javascript (`movies`) để quản lý dữ liệu tập trung.

## Deployment
Dự án được thiết kế để triển khai như một trang web tĩnh. Chỉ cần đẩy toàn bộ thư mục lên các nền tảng hosting tĩnh (Vercel/Netlify) là có thể hoạt động ngay.