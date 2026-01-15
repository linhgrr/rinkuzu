# RinKuzu Study UX Redesign

**Date:** 2026-01-15
**Goal:** Transform RinKuzu from a "quiz platform" into a "smart study companion" optimized for student review habits.

---

## Problem Statement

RinKuzu has strong features (AI quiz creation, flashcards, bookmarks, history) but lacks:

1. **No Spaced Repetition System** - Flashcards exist but lack SRS scheduling
2. **No Daily Goals/Streaks** - Missing habit-building mechanics
3. **Fragmented Study Flow** - User must navigate between bookmarks, history, flashcards manually
4. **No Progress Dashboard** - Users can't see "what should I study today?"
5. **Missing Quick Review Mode** - No unified "weak areas" review

**Key principle:** Reduce decision fatigue. When a student opens the app, they should immediately know: "Here's what you should study right now."

---

## Research Findings

Based on analysis of Quizlet, Anki, and Kahoot:

- **Spaced Repetition** improves retention by 40-50%
- **Streak counters** increase daily active users by 40%+
- **5-10 minute micro-sessions** show better completion rates
- **70%+ of study app usage** happens on mobile
- **Bottom-aligned primary actions** essential for one-handed use

---

## Solution Overview

### 1. Study Dashboard (New Homepage for Logged-in Users)

```
┌─────────────────────────────────────────────────────────────┐
│  [Nav Bar]                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Chào buổi sáng, [Tên]! 🔥 5 ngày streak                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  📚 HÔM NAY CẦN ÔN                                   │    │
│  │  12 câu hỏi đến hạn • ~5 phút                        │    │
│  │                        [Bắt đầu ôn tập →]            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Đã học       │ │ Cần ôn lại   │ │ Độ thành thạo│         │
│  │ 156 câu      │ │ 23 câu yếu   │ │ 78%          │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                              │
│  TIẾP TỤC HỌC                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Quiz Card] Lịch sử VN      │ 75% • Còn 10 câu chưa │    │
│  │ [Quiz Card] Toán 12         │ 60% • Đến hạn ôn      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  KHÁM PHÁ QUIZ MỚI                                          │
│  [Grid of quiz cards...]                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **Daily Review Card** - Big, prominent CTA showing due reviews (SRS-based)
- **Quick Stats** - 3 metrics: total learned, weak items, mastery %
- **Continue Learning** - Quizzes in progress or needing review
- **Discover** - New quizzes (current homepage content moves here)

---

### 2. Spaced Repetition System (SRS)

Each question has a level (0-5) determining review intervals:

| Level | Review Interval | Condition |
|-------|-----------------|-----------|
| 0 | Immediately | New or answered wrong |
| 1 | 1 day | First correct answer |
| 2 | 3 days | 2 correct in a row |
| 3 | 7 days | 3 correct in a row |
| 4 | 14 days | 4 correct in a row |
| 5 | 30 days | Mastered |

**User Flow - Daily Review:**

1. User opens app → Dashboard shows "12 câu đến hạn"
2. Click "Bắt đầu ôn tập" → Enter Review Mode
3. Each question displays as flashcard (question → flip → answer)
4. User rates: **Sai** / **Khó** / **Đúng** / **Dễ**
   - Sai → Level reset to 0
   - Khó → Level stays same
   - Đúng → Level +1
   - Dễ → Level +2
5. Complete → Show summary + streak update

---

### 3. Streak & Gamification System

**Daily Streak:**
- Complete at least 1 review session/day → maintain streak
- Streak displayed in header: 🔥 5 ngày
- Lose streak if miss 1 day (can use "Streak Freeze" - premium feature)

**XP System:**

| Action | XP |
|--------|-----|
| Correct answer | +10 |
| Correct (rated "Easy") | +15 |
| Complete quiz first time | +50 |
| Complete daily review | +30 |
| 7-day streak | +100 bonus |

**Weekly Progress Visualization:**

```
┌─────────────────────────────────────┐
│  T2   T3   T4   T5   T6   T7   CN  │
│  ●    ●    ●    ○    ○    ○    ○   │
│  12   8    15   -    -    -    -   │
│  câu  câu  câu                      │
└─────────────────────────────────────┘
```

---

### 4. Smart Review Mode UI

**Minimalist, focused review interface:**

```
┌─────────────────────────────────────────┐
│  ← Thoát          3/12         ⏱ 2:34   │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│     Thủ đô của Việt Nam là gì?         │
│                                         │
│                                         │
│         [Tap để xem đáp án]             │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ████████████░░░░░░░░  25%              │
└─────────────────────────────────────────┘
```

**After flip:**

```
┌─────────────────────────────────────────┐
│  ← Thoát          3/12         ⏱ 2:34   │
├─────────────────────────────────────────┤
│                                         │
│     Thủ đô của Việt Nam là gì?         │
│     ─────────────────────               │
│     ✓ Hà Nội                            │
│                                         │
│     Hà Nội là thủ đô từ năm 1010...    │
│                                         │
├─────────────────────────────────────────┤
│  [Sai]   [Khó]   [Đúng]   [Dễ]         │
│   🔴      🟡       🟢       ⚡           │
└─────────────────────────────────────────┘
```

**Mobile Gestures:**
- Swipe up → Flip card
- Swipe left → Wrong (reset level)
- Swipe right → Correct (+1 level)
- Tap buttons → Alternative for gestures

---

### 5. Navigation Redesign

**Bottom Navigation (Mobile):**

```
┌─────────────────────────────────────────┐
│  🏠        📚        ➕        👤       │
│  Home    Ôn tập    Tạo     Profile     │
└─────────────────────────────────────────┘
```

**Simplified User Journeys:**

| Journey | Steps | Path |
|---------|-------|------|
| Daily Review | 2 taps | App → Dashboard → "Bắt đầu ôn tập" |
| Quick Study | 3 taps | App → Select quiz → Flashcard/Quiz Mode |
| Create Quiz | 2 taps | App → Bottom nav "Tạo" → Upload PDF |

**Page Consolidation:**

| Current | Proposed |
|---------|----------|
| `/bookmarks` | Merge into Dashboard "Câu hỏi đã lưu" |
| `/history` | Merge into Profile tab |
| `/pending` | Merge into Profile tab "Quiz của tôi" |

---

### 6. New Page Structure

```
/ (Dashboard - logged in)
├── Daily Review section
├── Continue Learning section
├── Discover Quizzes section
└── Quick Stats

/review (Smart Review Mode)
├── SRS-based question queue
├── Flip card interface
└── Rating buttons

/quiz/[slug] (Quiz Mode - unchanged)
├── Standard quiz taking
└── AI help & discussion

/quiz/[slug]/flashcards (Flashcard Mode - enhanced)
├── Add SRS rating
└── Sync with review progress

/profile (New unified profile)
├── Stats & Achievements
├── My Quizzes (from /pending)
├── Quiz History (from /history)
├── Bookmarks (from /bookmarks)
└── Settings

/explore (Browse quizzes - for guests)
├── Categories
├── Search
└── Popular quizzes
```

---

## Data Model Changes

### New Collections

```typescript
// UserProgress - User's overall progress
interface UserProgress {
  _id: ObjectId;
  userId: ObjectId;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;

  // XP & Level
  totalXp: number;
  level: number;

  // Stats
  totalQuestionsLearned: number;
  totalQuizzesTaken: number;
  totalReviewSessions: number;
  averageAccuracy: number;

  // Weekly activity
  weeklyActivity: {
    [dateString: string]: {
      questionsReviewed: number;
      xpEarned: number;
      accuracy: number;
    };
  };
}

// QuestionProgress - Per-question progress (SRS)
interface QuestionProgress {
  _id: ObjectId;
  userId: ObjectId;
  lessonId: ObjectId;
  questionId: ObjectId;

  srsLevel: number;          // 0-5
  nextReviewDate: Date;
  lastReviewDate: Date;
  correctStreak: number;
  totalReviews: number;
  totalCorrect: number;

  isBookmarked: boolean;     // Replaces Bookmark collection
  notes: string;             // Personal notes
}
```

### New API Endpoints

```
GET  /api/review/due          → Get questions due for review
POST /api/review/submit       → Submit review result
GET  /api/progress/stats      → Get overall stats
GET  /api/progress/weekly     → Get weekly activity
POST /api/progress/streak     → Update streak
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Create UserProgress and QuestionProgress models
- [ ] Implement SRS algorithm service
- [ ] Create /api/review/* endpoints
- [ ] Create /api/progress/* endpoints

### Phase 2: Review Mode
- [ ] Build /review page with flip card UI
- [ ] Implement swipe gestures
- [ ] Add rating buttons
- [ ] Connect to SRS backend

### Phase 3: Dashboard
- [ ] Redesign homepage for logged-in users
- [ ] Add Daily Review card
- [ ] Add Quick Stats section
- [ ] Add Continue Learning section

### Phase 4: Gamification
- [ ] Implement streak tracking
- [ ] Add XP system
- [ ] Create weekly activity visualization
- [ ] Add streak animations

### Phase 5: Navigation
- [ ] Add bottom navigation for mobile
- [ ] Consolidate pages into Profile
- [ ] Update navigation component
- [ ] Add /explore page for guests

### Phase 6: Enhancement
- [ ] Enhance flashcard mode with SRS
- [ ] Add keyboard shortcuts for desktop
- [ ] Implement Streak Freeze (premium)
- [ ] Add progress sharing

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Daily Active Users | - | +50% |
| Session Duration | - | 8-12 min avg |
| 7-day Retention | - | 40%+ |
| Daily Review Completion | N/A | 60%+ |
| Average Streak Length | N/A | 5+ days |

---

## Technical Considerations

- **Offline Support**: Queue review submissions when offline, sync when online
- **Performance**: Lazy load question content, prefetch next 3 questions
- **Mobile**: Touch-optimized, gesture-based navigation
- **Accessibility**: Keyboard navigation, screen reader support, reduced motion option
