# Rinkuzu marketing media

Đây là nơi lưu ảnh và video dùng cho lịch nội dung. Mỗi bài có một thư mục riêng:

```text
assets/marketing/media/YYYY/MM/<content_id>/
├── source/   # file gốc, không ghi đè
└── export/   # file cuối đã kiểm tra và sẵn sàng đăng
```

Tên file export:

```text
<media_id-ngắn>__<platform>__<width>x<height>__v01.<ext>
```

Ví dụ:

```text
gpa-proof__threads__1080x1350__v01.png
```

## Upload thủ công

1. Thả ảnh/video gốc vào `source/` của đúng `content_id`.
2. Mở sheet `Media Library` trong `docs/marketing/rinkuzu-content-calendar.xlsx`.
3. Điền hoặc cập nhật `source_path`.
4. Crop, che PII, thêm chú thích nếu cần rồi xuất file cuối vào `export/`.
5. Cập nhật `final_path`, kích thước, `pii_check`, `brand_check` và checksum.
6. Chỉ đặt `status=READY` khi file cuối đã được kiểm tra.
7. Sao chép `final_path` vào cột `media_path` của `Content Calendar`, sau đó mới chuyển bài sang `APPROVED`.

Với bài chỉ có chữ, để `media_path` trống. Với carousel, tạo một dòng Media Library cho mỗi frame và ghi các `final_path` trong `media_path`, ngăn cách bằng dấu chấm phẩy theo đúng thứ tự đăng.

## Quy trình tự động

Codex có thể nhận file trong `source/`, tạo/crop asset, lưu bản cuối vào `export/`, cập nhật Media Library và tính checksum. Automation đăng bài chỉ được dùng các file:

- khớp `content_id`;
- nằm trong `export/`;
- có `status=READY`;
- có `pii_check=PASS` hoặc `N/A`;
- có `brand_check=PASS` hoặc `N/A`;
- tồn tại đúng tại `final_path`.

Không dùng trực tiếp file trong `source/` để đăng. Không dùng AI vẽ lại logo hoặc UI sản phẩm; ảnh giao diện phải lấy từ sản phẩm thật.

## Kích thước khuyến nghị

- Ảnh Threads: `1080x1350` (`4:5`).
- Video dọc: `1080x1920` (`9:16`).

Không lưu token, mật khẩu, tài liệu thật hoặc thông tin người dùng trong thư mục này.
