# Subscription Admin TODO

## 1. Trang quản trị Subscription cho Admin
- [x] Tạo API route `/api/admin/subscriptions` để lấy danh sách subscription, hỗ trợ tìm kiếm, lọc, phân trang
- [x] Tạo API route `/api/admin/subscriptions/[id]` để cập nhật trạng thái subscription (kích hoạt, hủy, ...)
- [x] Xây dựng UI trang `/admin/subscriptions`:
  - [x] Hiển thị danh sách subscription, tìm kiếm, lọc trạng thái, phân trang
  - [x] Xem chi tiết subscription (modal)
  - [x] Kích hoạt/thay đổi trạng thái subscription

## 2. Trang quản trị Pricing Plan cho Admin
- [x] Tạo API route `/api/admin/plans` để lấy và cập nhật thông tin các gói subscription
- [x] Xây dựng UI trang `/admin/plans`:
  - [x] Hiển thị danh sách gói, chỉnh sửa giá, tên, mô tả
  - [x] Lưu thay đổi gói

## 3. Navigation & UI
- [x] Thêm Navigation vào trang `/subscription` giống trang home
- [x] Thêm đường dẫn đến trang `/subscription` trong Navigation cho user
- [x] Thêm đường dẫn đến `/admin/subscriptions` và `/admin/plans` trong Navigation cho admin

## 4. Sửa lỗi & hoàn thiện
- [x] Sửa lỗi duplicate schema index trên payosOrderId (model Subscription)
- [x] Sửa lỗi tạo payment request thất bại (SubscriptionService)
- [ ] Sửa cảnh báo metadata viewport/themeColor ở trang `/subscription` và API

## 5. Kiểm thử & hoàn thiện
- [x] Kiểm thử toàn bộ flow mua, duyệt, quản lý subscription
- [ ] Viết hướng dẫn sử dụng cho admin

## 6. Cập nhật UI theo chuẩn admin
- [x] Thêm Sidebar navigation cho admin pages
- [x] Cập nhật UI admin subscription management theo English
- [x] Cập nhật UI admin plans management theo English  
- [x] Đồng bộ design với các trang admin khác (users, categories, ...)

## 7. Sửa lỗi Admin Plans Page
- [x] Sửa lỗi HTTP method mismatch (PUT → PATCH)
- [x] Cập nhật Plan model để có `isActive` field
- [x] Sửa API route để hỗ trợ `isActive` field
- [x] Cập nhật frontend interface để khớp với model
- [x] Cập nhật seed script với `isActive` field

## 8. Hoàn thành
✅ **Tích hợp PayOS payment system hoàn tất**
✅ **Admin panel cho subscription & plans hoàn tất**
✅ **UI đồng bộ với các trang admin khác**
✅ **Sidebar navigation cho admin pages**
✅ **Sử dụng tiếng Anh cho admin interface**
✅ **Loại bỏ hardcode plans - sử dụng database**
✅ **Sửa lỗi admin plans page** 