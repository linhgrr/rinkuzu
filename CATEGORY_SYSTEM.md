# Hệ thống Category (Môn học) - RinKuzu

## 🎯 Tổng quan

Hệ thống Category cho phép tổ chức quizzes theo môn học, giúp người dùng dễ dàng tìm kiếm và phân loại nội dung học tập.

## ✨ Tính năng chính

### 1. **Hot Categories Section** (Trang chủ)
- Hiển thị 3 môn học phổ biến nhất (có nhiều quiz nhất)
- Thiết kế card đẹp mắt với màu sắc đặc trưng
- Hiệu ứng hover và animation mượt mà

### 2. **Category Filter** (Trang chủ)  
- Bộ lọc theo môn học dạng button pills
- Hiển thị số lượng quiz cho mỗi môn
- Kết hợp với search để tìm kiếm chính xác

### 3. **Category Pages** (`/category/[slug]`)
- Trang riêng cho từng môn học
- Breadcrumb navigation rõ ràng
- Search trong phạm vi môn học
- Pagination và UI/UX chuẩn

### 4. **Sidebar Navigation**
- Section "Browse by Subject" với top 6 categories
- Màu sắc đặc trưng cho mỗi môn
- Responsive design (collapsed/expanded)

### 5. **Admin Management** (`/admin/categories`)
- CRUD hoàn chỉnh cho categories
- Color picker để chọn màu đặc trưng
- Validation và bảo vệ dữ liệu

## 🛠️ Cấu trúc kỹ thuật

### API Endpoints

```
GET /api/categories/stats           # Lấy thống kê categories
GET /api/categories/search          # Search categories (debounced)
GET /api/admin/categories           # Admin: List categories
POST /api/admin/categories          # Admin: Create category
GET /api/admin/categories/[id]      # Admin: Get category
PUT /api/admin/categories/[id]      # Admin: Update category  
DELETE /api/admin/categories/[id]   # Admin: Delete category
```

### Database Models

#### Category Model
```typescript
{
  name: string;           // Tên môn học (required, unique)
  description: string;    // Mô tả chi tiết  
  color: string;         // Màu sắc HEX (default: #3B82F6)
  isActive: boolean;     // Trạng thái hoạt động
  createdBy: ObjectId;   // Người tạo (ref User)
  createdAt: Date;       // Thời gian tạo
  updatedAt: Date;       // Thời gian cập nhật
}
```

#### Quiz Model (Updated)
```typescript
{
  // ... existing fields ...
  category: ObjectId;    // Reference tới Category (required)
}
```

## 🎨 UI/UX Design

### Color System
- Mỗi category có màu sắc riêng biệt
- Sử dụng opacity 20% cho background
- Full color cho selected state

### Navigation
- URL slug: category name lowercase + replace spaces with `-`
- Example: "Toán học" → `/category/toan-hoc`

### Responsive Design
- Mobile: Categories hiển thị dạng vertical stack
- Tablet: 2 columns layout  
- Desktop: 3 columns layout

## 📱 Demo Screenshots

### Home Page - Hot Categories
```
🔥 Hot Subjects
┌─────────────┬─────────────┬─────────────┐
│ 📊 Toán học │ 🧪 Vật lý   │ 🇬🇧 Tiếng Anh │
│ 25 quizzes  │ 18 quizzes  │ 12 quizzes  │
└─────────────┴─────────────┴─────────────┘
```

### Category Filter  
```
Filter by Subject:
[All Subjects] [Toán học (25)] [Vật lý (18)] [Tiếng Anh (12)] ...
```

### Sidebar Navigation
```
📚 Browse by Subject
├── 📊 Toán học (25)
├── 🧪 Vật lý (18)  
├── 🇬🇧 Tiếng Anh (12)
├── 📜 Lịch sử (8)
├── 🎨 Mỹ thuật (5)
└── 💻 Công nghệ (3)
   📋 View All Subjects
```

## 🚀 Cách sử dụng

### Cho User thông thường:

1. **Duyệt theo môn học:**
   - Trang chủ: Click vào Hot Categories hoặc Category Filter
   - Sidebar: Click vào môn học trong "Browse by Subject"

2. **Tìm kiếm theo môn:**
   - Chọn category filter trước khi search
   - Hoặc vào trang category riêng để search

3. **Navigation:**
   - Breadcrumb để biết vị trí hiện tại
   - "Back to All Subjects" để quay về

### Cho Admin:

1. **Quản lý Categories:**
   - Truy cập `/admin/categories`
   - Tạo/sửa/xóa categories
   - Đặt màu sắc đặc trưng

2. **Gán Category cho Quiz:**
   - Category là required khi tạo quiz
   - Dropdown với search debounced
   - Validation đảm bảo category active

## 🔧 Setup và Installation

### 1. Seed Sample Data
```bash
# Chạy script tạo sample categories
node src/scripts/seedCategories.js
```

### 2. Update existing quizzes
```javascript
// Cần gán category cho các quiz hiện có
// Admin có thể edit từng quiz để chọn category
```

### 3. Environment Variables
```env
# Không cần config thêm - sử dụng MongoDB connection hiện có
```

## 📊 Statistics & Analytics

### Hot Categories Logic:
- Sắp xếp theo số lượng quiz (published)
- Cập nhật real-time khi có quiz mới
- Hiển thị top 3 trên home page

### Performance:
- MongoDB aggregation pipeline tối ưu
- Index trên category field trong Quiz model
- Caching categories trong client state

## 🛡️ Security & Validation

### Category Management:
- Chỉ admin mới được tạo/sửa/xóa categories
- Validation không được xóa category đang có quiz
- Sanitize input để tránh XSS

### Quiz Category Assignment:
- Required field khi tạo quiz
- Validate category phải active
- Reference integrity đảm bảo

## 🎯 Future Enhancements

1. **Category Hierarchy** - Support subcategories
2. **Category Statistics** - Chi tiết analytics cho admin  
3. **User Preferences** - Lưu categories yêu thích
4. **Smart Recommendations** - Gợi ý quiz theo category đã học
5. **Category Tags** - Multi-tagging system

## 🐛 Troubleshooting

### Common Issues:

1. **Categories không hiển thị:**
   - Kiểm tra MongoDB connection
   - Chạy seed script
   - Verify isActive = true

2. **Category filter không hoạt động:**
   - Clear browser cache
   - Check console errors
   - Verify API responses

3. **Slug navigation lỗi:**
   - Category names có ký tự đặc biệt
   - Update getCategorySlug function
   - Test với nhiều loại tên

---

## 📞 Support

Nếu gặp vấn đề hoặc cần hỗ trợ, vui lòng:
1. Check console logs
2. Verify database connection  
3. Test API endpoints manually
4. Create issue with detailed steps to reproduce

**Happy Learning! 🎓** 