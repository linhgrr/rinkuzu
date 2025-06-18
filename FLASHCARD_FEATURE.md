# Flashcard Feature Documentation

## Tổng quan

Tính năng Flashcard được thêm vào ứng dụng RinKuzu để giúp người dùng học tập hiệu quả hơn thông qua phương pháp học bằng thẻ ghi nhớ (flashcards). Tính năng này mô phỏng trải nghiệm học tập tương tự như Quizlet.

## Tính năng chính

### 🗂️ Flashcard Learning
- **Học bằng thẻ ghi nhớ**: Chuyển đổi các câu hỏi quiz thành flashcards
- **Swipe gestures**: Quẹt sang trái (chưa biết) hoặc sang phải (đã biết)
- **Flip animation**: Lật thẻ để xem câu hỏi và đáp án
- **Progress tracking**: Theo dõi tiến độ học tập

### 📊 Progress Tracking
- **Đếm số câu đã thuộc**: Hiển thị số câu hỏi đã biết
- **Đếm số câu chưa thuộc**: Hiển thị số câu hỏi cần ôn lại
- **Phần trăm hoàn thành**: Hiển thị mức độ thành thạo
- **Kết quả cuối cùng**: Tổng kết sau khi hoàn thành

### 🎯 Interactive Features
- **Touch/Mouse support**: Hỗ trợ cả touch và mouse
- **Visual feedback**: Hiệu ứng animation khi swipe
- **Manual buttons**: Nút "Don't Know" và "Know It" cho desktop
- **Responsive design**: Tương thích với mọi thiết bị

## Cách sử dụng

### 1. Truy cập Flashcard
- Từ trang danh sách quiz: Nhấn nút "🗂️ Flashcards" bên cạnh "Take Quiz"
- Từ trang quiz: Nhấn nút "🗂️ Learn with Flashcards" trước khi bắt đầu quiz

### 2. Học với Flashcard
- **Mặt trước**: Hiển thị câu hỏi và các đáp án
- **Mặt sau**: Hiển thị đáp án đúng và giải thích
- **Swipe trái**: Đánh dấu câu hỏi chưa biết (sẽ xuất hiện lại để ôn)
- **Swipe phải**: Đánh dấu câu hỏi đã biết (sẽ không xuất hiện lại)

### 3. Theo dõi tiến độ
- **Progress bar**: Hiển thị phần trăm hoàn thành
- **Stats cards**: 
  - 🟢 Known: Số câu đã biết
  - 🔴 Unknown: Số câu chưa biết  
  - 🔵 Remaining: Số câu còn lại

### 4. Kết quả cuối cùng
- **Mastery level**: Phần trăm thành thạo tổng thể
- **Review list**: Danh sách câu hỏi cần ôn lại
- **Practice again**: Luyện tập lại từ đầu

## Technical Implementation

### Components
- `Flashcard.tsx`: Component chính cho flashcard với swipe gestures
- `page.tsx`: Trang flashcard với progress tracking

### API Routes
- `GET /api/quiz/[slug]/flashcards`: Lấy dữ liệu quiz với đáp án đúng

### CSS Animations
- `perspective-1000`: Hiệu ứng 3D cho flip animation
- `backface-hidden`: Ẩn mặt sau khi lật thẻ
- `rotate-y-180`: Xoay thẻ 180 độ

### State Management
- `FlashcardProgress`: Theo dõi tiến độ học tập
- `known[]`: Mảng chứa index của câu hỏi đã biết
- `unknown[]`: Mảng chứa index của câu hỏi chưa biết
- `currentIndex`: Vị trí câu hỏi hiện tại

## User Experience

### Mobile Experience
- **Touch gestures**: Swipe trái/phải bằng ngón tay
- **Responsive design**: Tối ưu cho màn hình nhỏ
- **Visual cues**: Hướng dẫn swipe rõ ràng

### Desktop Experience  
- **Mouse drag**: Kéo thả bằng chuột
- **Keyboard shortcuts**: Có thể thêm trong tương lai
- **Manual buttons**: Nút bấm thay thế cho swipe

### Accessibility
- **Screen reader support**: Mô tả rõ ràng cho người khiếm thị
- **Keyboard navigation**: Điều hướng bằng phím
- **High contrast**: Tương phản cao cho dễ đọc

## Future Enhancements

### Tính năng có thể thêm
- **Spaced repetition**: Lặp lại câu hỏi theo thuật toán
- **Study sessions**: Phiên học tập có thời gian
- **Export progress**: Xuất kết quả học tập
- **Social features**: Chia sẻ tiến độ với bạn bè
- **Custom decks**: Tạo bộ thẻ tùy chỉnh

### Performance Optimizations
- **Lazy loading**: Tải flashcards theo nhu cầu
- **Caching**: Cache dữ liệu quiz
- **Offline support**: Học offline
- **Progressive Web App**: Cài đặt như app

## Troubleshooting

### Lỗi thường gặp
1. **Flashcard không lật**: Kiểm tra CSS 3D transforms
2. **Swipe không hoạt động**: Kiểm tra touch events
3. **Progress không cập nhật**: Kiểm tra state management

### Debug Tips
- Mở DevTools để xem console logs
- Kiểm tra network requests
- Test trên nhiều thiết bị khác nhau

## Conclusion

Tính năng Flashcard mang lại trải nghiệm học tập tương tác và hiệu quả cho người dùng. Với giao diện thân thiện và tính năng theo dõi tiến độ chi tiết, người dùng có thể học tập một cách có hệ thống và đạt được kết quả tốt hơn. 