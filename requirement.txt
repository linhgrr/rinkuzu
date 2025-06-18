You are a senior full-stack engineer.

────────────────────────────────────────────────
🌟  Goal
────────────────────────────────────────────────
Build a web app that lets teachers create interactive quizzes from PDF files, with an admin approval flow.

────────────────────────────────────────────────
🛠  Tech stack (hard constraints)
────────────────────────────────────────────────
Framework: **Next.js 14** (App Router, server actions) – runs perfectly on Vercel  
Language: TypeScript (ES2022)  
Database: MongoDB Atlas (env var MONGO_URL) via **Mongoose**  
Auth: **next-auth** (Credentials provider) + JWT; roles: "admin" | "user"  
State (client): Zustand  
Styling: TailwindCSS  
AI:**gemini-2.0-flash** via `@google/genai` SDK  
PDF ⇆ Gemini: inline base64 ≤ 20 MB or URL (auto-detect)  
Key rotation: array of API keys, round-robin + automatic retry ≤ 3  

────────────────────────────────────────────────
🔑  Environment variables (.env.local)
────────────────────────────────────────────────
```

MONGO\_URL=mongodb+srv://nhatquangpx:[8sotamnhe@gymmanagement.8jghrjf.mongodb.net](mailto:8sotamnhe@gymmanagement.8jghrjf.mongodb.net)/?retryWrites=true\&w=majority\&appName=GymManagement
NEXTAUTH\_SECRET=supersecret
GEMINI\_KEYS=key1,key2,key3
JWT\_EXPIRES\_IN=30m

````

────────────────────────────────────────────────
📄  Data models (Mongoose)
────────────────────────────────────────────────
```ts
// models/User.ts
export interface IUser extends Document {
  email: string;
  password: string;        // hashed (argon2)
  role: 'admin' | 'user';
}

export interface IQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface IQuiz extends Document {
  title: string;
  description?: string;
  status: 'pending' | 'published' | 'rejected';
  author: Types.ObjectId;
  slug: string;
  questions: IQuestion[];
  createdAt: Date;
}

export interface IAttempt extends Document {
  user: Types.ObjectId;
  quiz: Types.ObjectId;
  score: number;
  answers: number[];
  takenAt: Date;
}
````

────────────────────────────────────────────────
📂  API routes (App Router)
────────────────────────────────────────────────

```
POST   /api/auth/register             # next-auth custom action
POST   /api/auth/login                # returns JWT
GET    /api/quizzes?status=           # list (RBAC)
POST   /api/quizzes                   # upload PDF(s) -> Gemini extract
PUT    /api/quizzes/[id]              # edit
POST   /api/quizzes/[id]/publish      # admin publish
POST   /api/quizzes/[id]/approve      # admin approve
POST   /api/quizzes/[id]/reject       # admin reject
GET    /api/quizzes/[slug]/play       # fetch for student mode
POST   /api/quizzes/[slug]/attempt    # record Attempt
GET    /api/user/attempts             # self history
GET    /api/admin/users/[id]/attempts # admin view user history
```

*All handlers are server actions located in `src/app/api/.../route.ts`.*

────────────────────────────────────────────────
🏗  Gemini helper (key rotation + PDF logic)
────────────────────────────────────────────────

```ts
// lib/gemini.ts
import { GoogleGenAI } from '@google/genai';
const keys = process.env.GEMINI_KEYS!.split(',');
let idx = 0;

function nextKey() {
  idx = (idx + 1) % keys.length;
  return keys[idx];
}

export async function extractQuestionsFromPdf(buffer: Buffer | string) {
  for (let attempt = 0; attempt < keys.length; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: nextKey() });

      const contents = [
        { text: 'Extract multiple-choice questions (JSON as [{"question":"...","options":["A","B","C","D"],"correctIndex":2}, …])' },
        typeof buffer === 'string'
          ? { text: buffer } // treat as URL
          : {
              inlineData: {
                mimeType: 'application/pdf',
                data: buffer.toString('base64'),
              },
            },
      ];

      const res = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
      });
      return JSON.parse(res.text());
    } catch (err: any) {
      if (attempt === keys.length - 1) throw err;
    }
  }
}
```

────────────────────────────────────────────────
🎨  Frontend routes & pages
────────────────────────────────────────────────

```
/login                    -> LoginPage
/register                 -> RegisterPage
/                         -> Landing (“Create new quiz”)
/create                   -> QuizForm (PDF upload)
/edit/[id]                -> QuizEditor
/pending                  -> PendingList (user)
/admin/queue              -> AdminQueue
/quiz/[slug]              -> QuizPlayer
/quiz/[slug]/result       -> QuizResult
/history                  -> MyHistory
```

*Use `react-dropzone` for PDF uploads; call `/api/quizzes` via server action.*

────────────────────────────────────────────────
💾  Deployment on Vercel
────────────────────────────────────────────────

1. Push repo to GitHub.
2. In Vercel dashboard → “Import Project” → set **Environment Variables** (`MONGO_URL`, `GEMINI_KEYS`, etc.).
3. Vercel auto-build: `pnpm install` → `pnpm build` (Next.js).
4. Done; API routes become serverless functions.

────────────────────────────────────────────────
📦  Deliverables
────────────────────────────────────────────────

1. Full Next.js project structure (`src/` with pages, components, lib, models).
2. `vercel.json` (only if you want to force regions).
3. `README.md` with local dev (`pnpm dev`) & Vercel deploy guide.
4. `.env.example`.

────────────────────────────────────────────────
🔄  Generation instructions
────────────────────────────────────────────────

1. First output the file-tree.
2. Then print every file’s content sequentially until the project is complete.
   (No high-level summaries instead of code.)

────────────────────────────────────────────────

````
