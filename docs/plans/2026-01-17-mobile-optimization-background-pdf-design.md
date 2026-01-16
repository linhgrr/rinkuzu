# Mobile Optimization & Background PDF Processing - Design Document

> **Date:** 2026-01-17
> **Status:** Approved
> **Author:** AI Assistant + User

---

## Executive Summary

Thiết kế tối ưu hóa giao diện mobile và xử lý PDF background cho RinKuzu - nền tảng học tập PDF-to-Quiz.

### Mục tiêu chính
1. **Mobile UI**: Simplified Create page + Swipe Quiz Player
2. **Background PDF Processing**: User có thể browse app trong khi PDF được xử lý

---

## Quyết định thiết kế

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Mobile Create** | Simplified - chỉ upload + tên | Tập trung core action, edit chi tiết trên desktop |
| **Quiz Player** | Swipe navigation | Mobile-native experience |
| **Background UX** | Upload & Browse + Floating Progress | User tiếp tục dùng app, có indicator theo dõi |
| **Notification** | In-app only | Đơn giản, đủ dùng |
| **Processing** | Client-side orchestration + Service Worker | Free, không giới hạn, works với Vercel Hobby |
| **Storage** | MongoDB DraftQuiz collection | Clean separation, auto-cleanup 48h |
| **Resume** | Chunk-level progress | Resume từ chunk cuối nếu interrupt |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Create Page │───▶│ PDF Manager  │───▶│  Service Worker   │  │
│  │ (Upload UI) │    │   (Zustand)  │    │ (Background Sync) │  │
│  └─────────────┘    └──────────────┘    └───────────────────┘  │
│         │                  │                      │             │
│         │                  ▼                      │             │
│         │         ┌──────────────┐                │             │
│         │         │   Floating   │                │             │
│         │         │  Progress UI │                │             │
│         │         └──────────────┘                │             │
└─────────┼──────────────────────────────────────────┼─────────────┘
          │                                          │
          ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (Vercel)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ POST /api/draft │  │ POST /api/draft │  │ GET /api/draft  │ │
│  │     /create     │  │ /[id]/chunk     │  │    /[id]        │ │
│  │                 │  │                 │  │                 │ │
│  │ • Tạo DraftQuiz │  │ • Xử lý 1 chunk │  │ • Lấy progress  │ │
│  │ • Upload PDF    │  │ • <10s timeout  │  │ • Lấy kết quả   │ │
│  │ • Split chunks  │  │ • Lưu questions │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                         │
│                    │    MongoDB      │                         │
│                    │   DraftQuiz     │                         │
│                    │   Collection    │                         │
│                    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model: DraftQuiz

```typescript
interface DraftQuiz {
  _id: ObjectId;

  // Owner
  userId: ObjectId;

  // Basic info
  title: string;
  categoryId?: ObjectId;

  // PDF Storage
  pdfData: {
    fileName: string;
    fileSize: number;
    totalPages: number;
    base64?: string;          // Xóa sau khi xử lý xong
  };

  // Chunking info
  chunks: {
    total: number;
    processed: number;
    current: number;
    chunkDetails: [{
      index: number;
      startPage: number;
      endPage: number;
      status: 'pending' | 'processing' | 'done' | 'error';
      error?: string;
    }];
  };

  // Extracted questions
  questions: Question[];

  // Status
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'expired';

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;            // Auto-delete sau 48h
}
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/draft/create` | POST | Tạo draft, upload PDF, split chunks |
| `/api/draft/[id]/process-chunk` | POST | Xử lý 1 chunk (<10s) |
| `/api/draft/[id]` | GET | Lấy draft info + progress |
| `/api/draft/list` | GET | Danh sách drafts của user |
| `/api/draft/[id]/submit` | POST | Convert draft → Quiz |
| `/api/draft/[id]` | DELETE | Xóa draft thủ công |

---

## Mobile UI Specifications

### Create Page (Mobile)
- Upload zone với drag & drop
- Title input
- Submit button
- Desktop hint: "Mở trên máy tính để edit chi tiết"
- Navigate away sau upload, processing tiếp tục background

### Quiz Player (Mobile)
- Swipe left/right để chuyển câu
- Tap để chọn đáp án
- Progress dots header
- Full-screen focus mode
- Framer Motion animations

### Floating Progress Indicator
- Fixed bottom-right (above BottomNav on mobile)
- Collapsed: Icon + count
- Expanded: List of drafts với progress bars
- Click completed draft → navigate to edit

---

## Constraints & Trade-offs

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Vercel Hobby 10s timeout | Không thể xử lý full PDF trong 1 request | Chunk-based processing |
| Free tier only | Không dùng paid services | Client-side orchestration |
| Service Worker limitations | Không chạy khi browser đóng | Resume from chunk cuối |
| MongoDB Atlas free | 512MB storage | TTL index auto-cleanup 48h |

---

## Success Metrics

1. Mobile Create flow < 30s từ mở app đến upload xong
2. Quiz Player swipe latency < 100ms
3. PDF processing không block UI
4. Resume success rate > 95%
5. Draft auto-cleanup hoạt động đúng sau 48h
