# Constants System

Hệ thống constants được tổ chức để dễ bảo trì và tái sử dụng trong toàn bộ ứng dụng.

## Cấu trúc

```
src/shared/constants/
├── index.ts          # Central export point
├── ui.ts             # UI constants (colors, animations, layout)
├── api.ts            # API endpoints and status codes
├── app.ts            # App configuration and validation rules
├── routes.ts         # Frontend navigation routes
└── README.md         # Documentation
```

## Import và sử dụng

### Import tất cả từ central point:
```typescript
import {
  COLORS,
  ANIMATIONS,
  API_ENDPOINTS,
  ROUTES,
  QUIZ_STATUS,
  type EmotionType
} from '@/shared/constants'
```

### Hoặc import specific modules:
```typescript
import { COLORS } from '@/shared/constants/ui'
import { API_ENDPOINTS } from '@/shared/constants/api'
```

## Ví dụ sử dụng

### 1. UI Constants

```typescript
// Colors
const categoryClass = COLORS.CATEGORY.blue
// → 'bg-blue-100 text-blue-700 border-blue-200'

// Animations
const interval = ANIMATIONS.EMOTION_CHANGE_INTERVAL // → 8000ms

// Layout
const defaultLimit = LAYOUT.PAGINATION.DEFAULT_LIMIT // → 12
```

### 2. API Constants

```typescript
// Endpoints
const url = API_ENDPOINTS.QUIZ.BASE // → '/api/quizzes'
const quizUrl = API_ENDPOINTS.QUIZ.BY_SLUG('my-quiz') // → '/api/quiz/my-quiz'

// Query params
const params = new URLSearchParams({
  [QUERY_PARAMS.STATUS]: QUIZ_STATUS.PUBLISHED,
  [QUERY_PARAMS.PAGE]: '1'
})
```

### 3. Routes Constants

```typescript
// Navigation
router.push(ROUTES.LOGIN) // → '/login'
router.push(ROUTES.QUIZ.VIEW('my-quiz')) // → '/quiz/my-quiz'
router.push(ROUTES.QUIZ.FLASHCARDS('my-quiz')) // → '/quiz/my-quiz/flashcards'
```

### 4. App Constants

```typescript
// Configuration
const appName = APP_CONFIG.NAME // → 'RinKuzu'

// External APIs
const emojiUrl = EXTERNAL_APIS.NEKOS_BEST.ENDPOINTS.EMOTION('happy')

// Validation
const minLength = VALIDATION.QUIZ.TITLE.MIN_LENGTH // → 3
```

## Utility Functions

Sử dụng utility functions trong `src/shared/utils/constants.ts`:

```typescript
import {
  getCategoryColorClass,
  getRandomEmotion,
  formatDisplayDate,
  createQuizSearchParams
} from '@/shared/utils/constants'

// Category colors
const colorClass = getCategoryColorClass('blue')

// Emotions
const randomEmotion = getRandomEmotion()
const nextEmotion = getNextEmotion(currentEmotion)

// Date formatting
const displayDate = formatDisplayDate(quiz.createdAt)

// Search params
const params = createQuizSearchParams(1, 12, 'published', 'search term')
```

## Best Practices

### ✅ DO:
- Sử dụng constants thay vì magic numbers/strings
- Import từ central point (`@/shared/constants`)
- Sử dụng TypeScript types được export
- Thêm utility functions cho logic phức tạp

### ❌ DON'T:
- Hardcode values trực tiếp trong components
- Duplicate constants ở nhiều files
- Ignore TypeScript types
- Tạo constants cho values chỉ dùng 1 lần

## Type Safety

Tất cả constants được define với `as const` để đảm bảo type safety:

```typescript
export const EMOTIONS = ['happy', 'wink', 'smile'] as const
export type EmotionType = typeof EMOTIONS[number] // 'happy' | 'wink' | 'smile'
```

## Extending Constants

Khi thêm constants mới:

1. Thêm vào file tương ứng (ui.ts, api.ts, etc.)
2. Export từ index.ts nếu cần
3. Tạo utility functions nếu cần logic phức tạp
4. Update documentation này

## Migration từ Magic Values

Khi refactor code cũ:

```typescript
// Before ❌
const interval = 8000
const url = '/api/quizzes'
router.push('/quiz/' + slug)

// After ✅  
const interval = ANIMATIONS.EMOTION_CHANGE_INTERVAL
const url = API_ENDPOINTS.QUIZ.BASE
router.push(ROUTES.QUIZ.VIEW(slug))
``` 