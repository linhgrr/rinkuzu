# Thiết kế: Thay Category bằng Folder cá nhân

Ngày: 2026-06-26
Repo: `rinkuzu` (Next.js frontend, Mongoose trong app)

## Mục tiêu

Xóa **hoàn toàn** hệ thống category công khai (do admin tạo) và thay bằng
hệ thống **folder cá nhân** (mỗi user tự tổ chức quiz của mình).

- Quiz builder: chọn folder qua dropdown; không chọn → "My folder" mặc định.
- Dropdown có option "+ Add folder" → popup đặt tên.
- My Quizzes: 2 tab (Quizzes | Folders) kiểu Quizlet; click folder → trang detail.
- Explore: liệt kê toàn bộ quiz công khai, dùng chung component/design với My Quizzes.

## Quyết định đã chốt

| #                 | Quyết định                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Phạm vi           | **Xóa toàn bộ** category: model, service, repo, routes, pages admin/explore-category, stats theo category.                          |
| Explore           | Giữ trang, đổi thành liệt kê tất cả quiz công khai (bỏ phân loại). Dùng chung `QuizCard` + design của My Quizzes.                   |
| My folder         | **Ảo**: `quiz.folder = null` nghĩa là "My folder". Không record DB, không cho xóa/đổi tên.                                          |
| My Quizzes UI     | 2 tab trên đầu (Quizzes \| Folders). Tab Folders hiện "My folder" + folder user tạo + nút New folder. Click folder → folder detail. |
| Folder CRUD       | Cơ bản: tạo + đổi tên + xóa (xóa folder → quiz về My folder, không mất). Đổi folder của quiz qua trang sửa quiz.                    |
| Lưu trữ           | Trong app Next.js (Mongoose `Folder` model + `/api/folders`). Không đụng repo Python.                                               |
| Folder detail URL | Route riêng `/my-quizzes/folder/[id]`, dùng `default` cho My folder.                                                                |

## Phần 1 — Data model & Backend

### Folder model mới (`src/models/Folder.ts`)

```
Folder {
  _id, name: string (trim, maxlen ~100),
  owner: ObjectId(User) required,
  createdAt, updatedAt
}
index { owner: 1, name: 1 } unique   // 1 user không trùng tên folder
```

### Quiz model (`src/models/Quiz.ts`)

- Xóa field `category` (đang `required`) + 2 index chứa `category`.
- Thêm `folder: ObjectId(Folder) | null` (không required; default `null`).
- Thêm index `{ author: 1, folder: 1, createdAt: -1 }`.
- Cập nhật `IQuiz` interface trong `src/types/index.ts` (bỏ `category`, thêm `folder`).

### API folder mới (`/api/folders`)

- `GET /api/folders` → list folder của user + count quiz mỗi folder.
  "My folder" KHÔNG ở DB; frontend tự prepend (count = số quiz `folder: null`).
- `POST /api/folders` `{ name }` → tạo. Validate: tên không rỗng, không trùng (unique index).
- `PATCH /api/folders/[id]` `{ name }` → đổi tên. Chỉ owner.
- `DELETE /api/folders/[id]` → xóa folder + set `folder: null` cho mọi quiz trong đó. Chỉ owner.

### `/api/quizzes`

- Thêm param `folder` (lọc theo folder của chính user; `folder=null` → quiz chưa gán).
- Bỏ param `category`.

### Xóa toàn bộ category

- **Models/services/repos**: `Category` model, `CategoryService` (+ test), `ICategoryService`,
  `ICategoryRepository`, references trong `IQuizService`/`IQuizRepository`/`IAdminService`.
- **Routes**: `/api/categories/*`, `/api/admin/categories/*`, `/api/admin/stats/categories`,
  gỡ `category` khỏi `/api/quizzes` + `/api/quizes`, gỡ `categoryId` khỏi
  `/api/quiz-drafts/[id]/submit`.
- **Pages**: `/categories`, `/category/[slug]` (+ layout), `/admin/categories`.
  Gỡ link/section category trong `/admin/stats` nếu có.
- **Components**: `CategorySelector`, `CategorySearch`, `CategoryOptionItem`,
  `useCategorySearch`, toàn bộ `features/categories`.
- **i18n**: gỡ key category không còn dùng (hoặc để lại nếu rủi ro — ưu tiên gỡ key rõ ràng).

### Migration

`category` đang `required` → cần script chạy 1 lần:
`db.quizzes.updateMany({}, { $unset: { category: "" }, $set: { folder: null } })`.
Viết script Node trong repo, chạy thủ công 1 lần.

## Phần 2 — Quiz Builder (chọn folder)

Thay `CategorySelector` → **`FolderSelector`** trong `QuizMetaForm` (dùng chung
create page, draft edit, edit quiz).

### FolderSelector (dropdown click-chọn, không search-as-you-type)

- Mở → list: **"My folder"** (đầu) + folder user đã tạo.
- Không chọn → `folderId = null` (My folder).
- Cuối list: **"+ Add folder"** (có gạch phân cách) → mở popup nhập tên →
  `POST /api/folders` → chọn folder mới luôn + thêm vào list.
- Dùng hook `useFolders()` (gọi `GET /api/folders`) dùng chung với My Quizzes.

### Luồng dữ liệu

- `QuizMetaForm` props: `selectedCategory/onCategoryChange` → `selectedFolderId/onFolderChange`
  (`string | null`). Bỏ `requiredCategory`, `categoryDisabled`.
- `create/page.tsx`: state `selectedCategory` → `selectedFolderId: string | null` (default `null`).
  Bỏ validation "category required". Submit gửi `folderId`.
- `DraftEditClient.tsx`: tương tự, submit gửi `folderId`.
- `quizdraftApi.ts`: `category_id`/`categoryId` → `folder_id`/`folderId` (optional/nullable).
- Edit quiz cũ: preload `selectedFolderId` từ `quiz.folder`.

### Popup "Add folder"

Modal đơn giản: input tên + nút Create/Cancel. Validate rỗng/trùng (hiện lỗi từ API).
Dùng chung cho cả quiz builder và tab Folders.

## Phần 3 — My Quizzes (2 tab) + Explore dùng chung

### Component dùng chung (`src/features/quiz/components/QuizCard.tsx`)

- Tách `QuizCard` + `QuizCardSkeleton` (card xanh `surface-blue`) từ `ProfileQuizzes.tsx`.
- `onDelete` optional: không truyền → ẩn menu edit/delete (dùng cho Explore xem quiz người khác).

### My Quizzes — 2 tab (`?tab=folders` giữ state back/forward)

- **Tab "Quizzes"** (mặc định): giữ nguyên — filter all/public/private, group theo tháng,
  sidebar Quiz Builder.
- **Tab "Folders"**: grid folder card.
  - "My folder" đầu list (count = quiz folder=null), không menu.
  - Folder user tạo: tên + count + menu ⋮ (Rename / Delete).
  - Nút "+ New folder" → popup đặt tên (dùng chung Phần 2).
  - Empty state khi chưa tạo folder nào (vẫn luôn thấy My folder).

### Folder detail (`/my-quizzes/folder/[id]`, `default` cho My folder)

- Header: tên folder + back về tab Folders + (folder thật) menu Rename/Delete.
- Grid `QuizCard` chung (có edit/delete).
- Fetch `GET /api/quizzes?mine=true&folder=<id|null>`.

### Explore (`explore/page.tsx`)

- Bỏ `CategorySearch`, badge category, filter category, param `category`.
- `QuizCard` nội bộ → dùng `QuizCard` chung (card xanh, không menu).
- Giữ search + pagination. Layout grid giống My Quizzes.

## Testing

- Folder API: tạo/đổi tên/xóa, xóa folder → quiz về null, unique name per owner.
- FolderSelector: chọn folder, add folder qua popup, default null.
- My Quizzes: 2 tab, folder detail, My folder ảo.
- Explore: list quiz công khai, search, pagination, không còn category.
- Migration script: quiz cũ mất `category`, có `folder: null`.

## Files chính bị ảnh hưởng

- Thêm: `src/models/Folder.ts`, `src/app/api/folders/**`, `src/features/folders/**`
  (FolderSelector, useFolders, AddFolderModal, FolderCard), `QuizCard.tsx` chung,
  `src/app/[locale]/(app)/my-quizzes/folder/[id]/`, migration script.
- Sửa: `Quiz.ts`, `types/index.ts`, `QuizMetaForm.tsx`, `create/page.tsx`,
  `DraftEditClient.tsx`, `quizdraftApi.ts`, `ProfileQuizzes.tsx`, `explore/page.tsx`,
  `/api/quizzes/route.ts`, `/api/quiz-drafts/[id]/submit/route.ts`.
- Xóa: toàn bộ `features/categories`, `Category` model/service/repo/interfaces,
  `/api/categories/**`, `/api/admin/categories/**`, `/api/admin/stats/categories`,
  pages `/categories`, `/category/[slug]`, `/admin/categories`.
