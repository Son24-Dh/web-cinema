# Business Overview — DÂU CINEMA 🍓

## What it does
DÂU CINEMA là một trang web xem phim tĩnh (Static Site) được thiết kế lãng mạn dành riêng cho việc chia sẻ các bộ phim yêu thích với người thân. Trang web cho phép xem các bộ phim truyền hình và điện ảnh thông qua các link stream trực tiếp (.m3u8) với giao diện hiện đại và tối giản.

## Terminology
| Term | Meaning |
|------|---------|
| HLS | HTTP Live Streaming - Giao thức truyền tải video qua HTTP. |
| m3u8 | Định dạng file playlist chứa các phân đoạn video của luồng HLS. |
| Player | Trình phát video trên trình duyệt. |
| Mock Backend | Sử dụng file Javascript (`data.js`) để lưu trữ dữ liệu thay vì dùng Server thực tế. |

## External Systems
- **HLS.js Library**: Thư viện Javascript dùng để hỗ trợ trình phát video HLS trên các trình duyệt không hỗ trợ mặc định.
- **Image CDNs**: Sử dụng link ảnh từ các nguồn bên ngoài (Saostar, OPhim, TMDB).
- **Video Stream Servers**: Các máy chủ chứa luồng video (Opstream, KKPhim).