# Mobile Optimization & Background PDF Processing - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement simplified mobile UI and background PDF processing with client-side orchestration.

**Architecture:** Client-side Service Worker orchestrates chunk-by-chunk PDF processing via API calls (<10s each). DraftQuiz MongoDB collection stores progress and extracted questions. Zustand manages UI state with floating progress indicator.

**Tech Stack:** Next.js 14, MongoDB/Mongoose, Zustand, Framer Motion, Service Worker, existing pdf-lib/LangChain infrastructure.

---

## Phase 1: Backend Foundation

### Task 1: Create DraftQuiz Model

**Files:**
- Create: `/src/models/DraftQuiz.ts`

**Step 1: Create the DraftQuiz model file**

```typescript
// /src/models/DraftQuiz.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IChunkDetail {
  index: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export interface IDraftQuestion {
  question: string;
  options: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  type: 'single' | 'multiple';
  explanation?: string;
}

export interface IDraftQuiz extends Document {
  userId: Types.ObjectId;
  title: string;
  categoryId?: Types.ObjectId;
  pdfData: {
    fileName: string;
    fileSize: number;
    totalPages: number;
    base64?: string;
  };
  chunks: {
    total: number;
    processed: number;
    current: number;
    chunkDetails: IChunkDetail[];
  };
  questions: IDraftQuestion[];
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const ChunkDetailSchema = new Schema<IChunkDetail>({
  index: { type: Number, required: true },
  startPage: { type: Number, required: true },
  endPage: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'error'],
    default: 'pending'
  },
  error: { type: String },
}, { _id: false });

const DraftQuestionSchema = new Schema<IDraftQuestion>({
  question: { type: String, required: true, trim: true },
  options: { type: [String], required: true },
  correctIndex: { type: Number },
  correctIndexes: { type: [Number] },
  type: { type: String, enum: ['single', 'multiple'], required: true },
  explanation: { type: String },
}, { _id: false });

const DraftQuizSchema = new Schema<IDraftQuiz>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  pdfData: {
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    base64: { type: String },
  },
  chunks: {
    total: { type: Number, required: true },
    processed: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    chunkDetails: { type: [ChunkDetailSchema], required: true },
  },
  questions: { type: [DraftQuestionSchema], default: [] },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'error', 'expired'],
    default: 'uploading',
  },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// TTL index for auto-cleanup after 48 hours
DraftQuizSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user queries
DraftQuizSchema.index({ userId: 1, status: 1, createdAt: -1 });

const DraftQuiz = mongoose.models.DraftQuiz || mongoose.model<IDraftQuiz>('DraftQuiz', DraftQuizSchema);

export default DraftQuiz;
```

**Step 2: Verify model compiles**

Run: `cd /home/linh/Downloads/rinkuzu && npx tsc --noEmit src/models/DraftQuiz.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/models/DraftQuiz.ts
git commit -m "feat: add DraftQuiz model for background PDF processing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create Draft Create API

**Files:**
- Create: `/src/app/api/draft/create/route.ts`

**Step 1: Create the API route**

```typescript
// /src/app/api/draft/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import DraftQuiz from '@/models/DraftQuiz';
import { PDFDocument } from 'pdf-lib';

const CHUNK_SIZE = 5; // pages per chunk
const OVERLAP_PAGES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const EXPIRY_HOURS = 48;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, categoryId, pdfBase64, fileName } = body;

    if (!title?.trim() || !pdfBase64 || !fileName) {
      return NextResponse.json(
        { error: 'Title, PDF data, and filename are required' },
        { status: 400 }
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = pdfBase64.includes(',')
      ? pdfBase64.split(',')[1]
      : pdfBase64;

    // Validate file size
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    // Parse PDF to get page count
    let totalPages: number;
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      totalPages = pdfDoc.getPageCount();
    } catch {
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Calculate chunks
    const chunkDetails: Array<{
      index: number;
      startPage: number;
      endPage: number;
      status: 'pending';
    }> = [];

    if (totalPages <= CHUNK_SIZE) {
      // Small PDF - single chunk
      chunkDetails.push({
        index: 0,
        startPage: 1,
        endPage: totalPages,
        status: 'pending',
      });
    } else {
      // Large PDF - multiple chunks with overlap
      let chunkIndex = 0;
      for (let start = 1; start <= totalPages; start += CHUNK_SIZE - OVERLAP_PAGES) {
        const end = Math.min(start + CHUNK_SIZE - 1, totalPages);
        chunkDetails.push({
          index: chunkIndex++,
          startPage: start,
          endPage: end,
          status: 'pending',
        });
        if (end >= totalPages) break;
      }
    }

    await connectDB();

    // Create draft
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

    const draft = await DraftQuiz.create({
      userId: session.user.id,
      title: title.trim(),
      categoryId: categoryId || undefined,
      pdfData: {
        fileName,
        fileSize: buffer.length,
        totalPages,
        base64: base64Data, // Store for chunk processing
      },
      chunks: {
        total: chunkDetails.length,
        processed: 0,
        current: 0,
        chunkDetails,
      },
      questions: [],
      status: 'processing',
      expiresAt,
    });

    return NextResponse.json({
      draftId: draft._id.toString(),
      title: draft.title,
      chunks: {
        total: chunkDetails.length,
        chunkDetails: chunkDetails.map(c => ({
          index: c.index,
          startPage: c.startPage,
          endPage: c.endPage,
          status: c.status,
        })),
      },
      totalPages,
      expiresAt: draft.expiresAt,
    });

  } catch (error) {
    console.error('Draft create error:', error);
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the endpoint manually**

Run: `curl -X POST http://localhost:3000/api/draft/create -H "Content-Type: application/json" -d '{"title":"test"}' -v`
Expected: 401 Unauthorized (since not logged in)

**Step 3: Commit**

```bash
git add src/app/api/draft/create/route.ts
git commit -m "feat: add POST /api/draft/create endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create Process Chunk API

**Files:**
- Create: `/src/app/api/draft/[id]/process-chunk/route.ts`

**Step 1: Create the API route**

```typescript
// /src/app/api/draft/[id]/process-chunk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import DraftQuiz from '@/models/DraftQuiz';
import { PDFDocument } from 'pdf-lib';
import { extractQuestionsFromPdf } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chunkIndex } = await request.json();

    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      return NextResponse.json(
        { error: 'Valid chunkIndex is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (!draft.pdfData.base64) {
      return NextResponse.json(
        { error: 'PDF data not available' },
        { status: 400 }
      );
    }

    const chunkDetail = draft.chunks.chunkDetails.find(
      (c: any) => c.index === chunkIndex
    );

    if (!chunkDetail) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    if (chunkDetail.status === 'done') {
      return NextResponse.json({
        success: true,
        message: 'Chunk already processed',
        questions: [],
        progress: {
          processed: draft.chunks.processed,
          total: draft.chunks.total,
          isComplete: draft.chunks.processed >= draft.chunks.total,
        },
      });
    }

    // Update chunk status to processing
    await DraftQuiz.updateOne(
      { _id: params.id, 'chunks.chunkDetails.index': chunkIndex },
      {
        $set: {
          'chunks.chunkDetails.$.status': 'processing',
          'chunks.current': chunkIndex,
        }
      }
    );

    try {
      // Extract pages for this chunk
      const fullPdfBuffer = Buffer.from(draft.pdfData.base64, 'base64');
      const fullPdfDoc = await PDFDocument.load(fullPdfBuffer);

      const chunkPdfDoc = await PDFDocument.create();
      for (let i = chunkDetail.startPage - 1; i < chunkDetail.endPage; i++) {
        if (i < fullPdfDoc.getPageCount()) {
          const [copiedPage] = await chunkPdfDoc.copyPages(fullPdfDoc, [i]);
          chunkPdfDoc.addPage(copiedPage);
        }
      }

      const chunkBuffer = Buffer.from(await chunkPdfDoc.save());

      // Extract questions using AI
      const extractedQuestions = await extractQuestionsFromPdf(chunkBuffer, 2);

      // Remove duplicates with existing questions
      const existingHashes = new Set(
        draft.questions.map((q: any) => hashQuestion(q))
      );

      const newQuestions = extractedQuestions.filter(
        (q: any) => !existingHashes.has(hashQuestion(q))
      );

      // Update draft with new questions
      const updateResult = await DraftQuiz.findOneAndUpdate(
        { _id: params.id, 'chunks.chunkDetails.index': chunkIndex },
        {
          $push: { questions: { $each: newQuestions } },
          $set: { 'chunks.chunkDetails.$.status': 'done' },
          $inc: { 'chunks.processed': 1 },
        },
        { new: true }
      );

      const isComplete = updateResult!.chunks.processed >= updateResult!.chunks.total;

      // If complete, clean up base64 data and update status
      if (isComplete) {
        await DraftQuiz.updateOne(
          { _id: params.id },
          {
            $set: { status: 'completed' },
            $unset: { 'pdfData.base64': 1 },
          }
        );
      }

      return NextResponse.json({
        success: true,
        questions: newQuestions,
        progress: {
          processed: updateResult!.chunks.processed,
          total: updateResult!.chunks.total,
          isComplete,
          totalQuestions: updateResult!.questions.length,
        },
      });

    } catch (extractError: any) {
      // Mark chunk as error
      await DraftQuiz.updateOne(
        { _id: params.id, 'chunks.chunkDetails.index': chunkIndex },
        {
          $set: {
            'chunks.chunkDetails.$.status': 'error',
            'chunks.chunkDetails.$.error': extractError.message,
          },
        }
      );

      return NextResponse.json({
        success: false,
        error: extractError.message,
        progress: {
          processed: draft.chunks.processed,
          total: draft.chunks.total,
          isComplete: false,
        },
      });
    }

  } catch (error) {
    console.error('Process chunk error:', error);
    return NextResponse.json(
      { error: 'Failed to process chunk' },
      { status: 500 }
    );
  }
}

function hashQuestion(q: any): string {
  const normalizedQuestion = q.question?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
  const normalizedOptions = q.options?.map((opt: string) =>
    opt.toLowerCase().trim().replace(/\s+/g, ' ')
  ).join('|') || '';
  return `${normalizedQuestion}:::${normalizedOptions}`;
}
```

**Step 2: Commit**

```bash
git add src/app/api/draft/[id]/process-chunk/route.ts
git commit -m "feat: add POST /api/draft/[id]/process-chunk endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Create Draft Get/List/Delete APIs

**Files:**
- Create: `/src/app/api/draft/[id]/route.ts`
- Create: `/src/app/api/draft/list/route.ts`

**Step 1: Create GET/DELETE for single draft**

```typescript
// /src/app/api/draft/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import DraftQuiz from '@/models/DraftQuiz';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: session.user.id,
    }).select('-pdfData.base64'); // Exclude large base64 data

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft });

  } catch (error) {
    console.error('Get draft error:', error);
    return NextResponse.json(
      { error: 'Failed to get draft' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const result = await DraftQuiz.deleteOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create list endpoint**

```typescript
// /src/app/api/draft/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import DraftQuiz from '@/models/DraftQuiz';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const drafts = await DraftQuiz.find({
      userId: session.user.id,
      status: { $ne: 'expired' },
    })
      .select('title status chunks.total chunks.processed questions createdAt expiresAt')
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json({
      drafts: drafts.map(d => ({
        _id: d._id.toString(),
        title: d.title,
        status: d.status,
        progress: {
          processed: d.chunks.processed,
          total: d.chunks.total,
        },
        questionsCount: d.questions.length,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
      })),
    });

  } catch (error) {
    console.error('List drafts error:', error);
    return NextResponse.json(
      { error: 'Failed to list drafts' },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/draft/[id]/route.ts src/app/api/draft/list/route.ts
git commit -m "feat: add GET/DELETE /api/draft/[id] and GET /api/draft/list

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Create Draft Submit API

**Files:**
- Create: `/src/app/api/draft/[id]/submit/route.ts`

**Step 1: Create the submit endpoint**

```typescript
// /src/app/api/draft/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import DraftQuiz from '@/models/DraftQuiz';
import Quiz from '@/models/Quiz';
import { generateSlug } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, categoryId, description, questions: editedQuestions } = body;

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status !== 'completed') {
      return NextResponse.json(
        { error: 'Draft is not ready for submission' },
        { status: 400 }
      );
    }

    // Use edited questions if provided, otherwise use draft questions
    const questionsToUse = editedQuestions || draft.questions;

    if (!questionsToUse || questionsToUse.length === 0) {
      return NextResponse.json(
        { error: 'No questions to submit' },
        { status: 400 }
      );
    }

    // Generate unique slug
    const baseSlug = generateSlug(title || draft.title);
    let slug = baseSlug;
    let counter = 1;
    while (await Quiz.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // Create quiz
    const quiz = await Quiz.create({
      title: title || draft.title,
      description: description || '',
      category: categoryId,
      status: 'pending', // Requires admin approval
      author: session.user.id,
      slug,
      questions: questionsToUse.map((q: any) => ({
        question: q.question,
        options: q.options,
        type: q.type,
        correctIndex: q.correctIndex,
        correctIndexes: q.correctIndexes,
      })),
      isPrivate: false,
    });

    // Delete the draft
    await DraftQuiz.deleteOne({ _id: params.id });

    return NextResponse.json({
      success: true,
      quizId: quiz._id.toString(),
      slug: quiz.slug,
    });

  } catch (error) {
    console.error('Submit draft error:', error);
    return NextResponse.json(
      { error: 'Failed to submit draft' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/draft/[id]/submit/route.ts
git commit -m "feat: add POST /api/draft/[id]/submit endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: Client Infrastructure

### Task 6: Create Draft Store (Zustand)

**Files:**
- Create: `/src/store/useDraftStore.ts`

**Step 1: Create the store**

```typescript
// /src/store/useDraftStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DraftProgress {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  chunksTotal: number;
  chunksProcessed: number;
  questionsCount: number;
  error?: string;
  createdAt: string;
}

interface DraftStore {
  activeDrafts: Record<string, DraftProgress>;

  // Actions
  addDraft: (draft: DraftProgress) => void;
  updateDraftProgress: (id: string, updates: Partial<DraftProgress>) => void;
  completeDraft: (id: string, questionsCount: number) => void;
  setDraftError: (id: string, error: string) => void;
  removeDraft: (id: string) => void;
  clearCompletedDrafts: () => void;

  // Computed helpers
  getActiveDrafts: () => DraftProgress[];
  getProcessingCount: () => number;
  getCompletedCount: () => number;
  hasActiveDrafts: () => boolean;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      activeDrafts: {},

      addDraft: (draft) =>
        set((state) => ({
          activeDrafts: { ...state.activeDrafts, [draft.id]: draft },
        })),

      updateDraftProgress: (id, updates) =>
        set((state) => {
          if (!state.activeDrafts[id]) return state;
          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: { ...state.activeDrafts[id], ...updates },
            },
          };
        }),

      completeDraft: (id, questionsCount) =>
        set((state) => {
          if (!state.activeDrafts[id]) return state;
          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: {
                ...state.activeDrafts[id],
                status: 'completed',
                questionsCount,
              },
            },
          };
        }),

      setDraftError: (id, error) =>
        set((state) => {
          if (!state.activeDrafts[id]) return state;
          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: {
                ...state.activeDrafts[id],
                status: 'error',
                error,
              },
            },
          };
        }),

      removeDraft: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.activeDrafts;
          return { activeDrafts: rest };
        }),

      clearCompletedDrafts: () =>
        set((state) => {
          const activeDrafts = Object.fromEntries(
            Object.entries(state.activeDrafts).filter(
              ([_, d]) => d.status !== 'completed'
            )
          );
          return { activeDrafts };
        }),

      getActiveDrafts: () => Object.values(get().activeDrafts),

      getProcessingCount: () =>
        Object.values(get().activeDrafts).filter(
          (d) => d.status === 'processing' || d.status === 'uploading'
        ).length,

      getCompletedCount: () =>
        Object.values(get().activeDrafts).filter(
          (d) => d.status === 'completed'
        ).length,

      hasActiveDrafts: () => Object.keys(get().activeDrafts).length > 0,
    }),
    {
      name: 'draft-storage',
      version: 1,
    }
  )
);
```

**Step 2: Commit**

```bash
git add src/store/useDraftStore.ts
git commit -m "feat: add useDraftStore for background processing state

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Create PDF Processor Hook

**Files:**
- Create: `/src/hooks/usePdfProcessor.ts`

**Step 1: Create the hook**

```typescript
// /src/hooks/usePdfProcessor.ts
import { useCallback, useRef, useEffect } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import { toast } from 'sonner';

interface ChunkInfo {
  index: number;
  startPage: number;
  endPage: number;
  status: string;
}

interface ProcessingState {
  isProcessing: boolean;
  currentDraftId: string | null;
}

export function usePdfProcessor() {
  const { updateDraftProgress, completeDraft, setDraftError } = useDraftStore();
  const processingRef = useRef<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        controller.abort();
      });
    };
  }, []);

  const processChunk = useCallback(async (
    draftId: string,
    chunkIndex: number,
    signal?: AbortSignal
  ): Promise<{ success: boolean; questions: any[]; isComplete: boolean; totalQuestions: number }> => {
    const response = await fetch(`/api/draft/${draftId}/process-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkIndex }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process chunk');
    }

    const result = await response.json();
    return {
      success: result.success,
      questions: result.questions || [],
      isComplete: result.progress?.isComplete || false,
      totalQuestions: result.progress?.totalQuestions || 0,
    };
  }, []);

  const startProcessing = useCallback(async (
    draftId: string,
    chunks: ChunkInfo[],
    title: string
  ) => {
    if (processingRef.current[draftId]) {
      console.log(`Draft ${draftId} is already being processed`);
      return;
    }

    processingRef.current[draftId] = true;
    const abortController = new AbortController();
    abortControllersRef.current[draftId] = abortController;

    const pendingChunks = chunks
      .filter(c => c.status === 'pending' || c.status === 'error')
      .sort((a, b) => a.index - b.index);

    let processedCount = chunks.filter(c => c.status === 'done').length;
    let totalQuestions = 0;

    try {
      for (const chunk of pendingChunks) {
        if (abortController.signal.aborted) {
          break;
        }

        try {
          const result = await processChunk(
            draftId,
            chunk.index,
            abortController.signal
          );

          processedCount++;
          totalQuestions = result.totalQuestions;

          updateDraftProgress(draftId, {
            chunksProcessed: processedCount,
            questionsCount: totalQuestions,
            status: 'processing',
          });

          if (result.isComplete) {
            completeDraft(draftId, totalQuestions);
            toast.success(`"${title}" đã sẵn sàng!`, {
              description: `${totalQuestions} câu hỏi được trích xuất`,
              action: {
                label: 'Xem',
                onClick: () => window.location.href = `/draft/${draftId}/edit`,
              },
            });
            break;
          }

          // Small delay between chunks
          await new Promise(r => setTimeout(r, 300));

        } catch (chunkError: any) {
          if (chunkError.name === 'AbortError') {
            break;
          }
          console.error(`Chunk ${chunk.index} failed:`, chunkError);
          // Continue with next chunk on error
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setDraftError(draftId, error.message);
        toast.error(`Lỗi xử lý "${title}"`, {
          description: error.message,
        });
      }
    } finally {
      delete processingRef.current[draftId];
      delete abortControllersRef.current[draftId];
    }
  }, [processChunk, updateDraftProgress, completeDraft, setDraftError]);

  const stopProcessing = useCallback((draftId: string) => {
    const controller = abortControllersRef.current[draftId];
    if (controller) {
      controller.abort();
    }
  }, []);

  const resumeProcessing = useCallback(async (draftId: string) => {
    try {
      const response = await fetch(`/api/draft/${draftId}`);
      if (!response.ok) throw new Error('Failed to fetch draft');

      const { draft } = await response.json();

      if (draft.status === 'completed') {
        return; // Already done
      }

      await startProcessing(
        draftId,
        draft.chunks.chunkDetails,
        draft.title
      );
    } catch (error) {
      console.error('Resume processing error:', error);
    }
  }, [startProcessing]);

  return {
    startProcessing,
    stopProcessing,
    resumeProcessing,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/usePdfProcessor.ts
git commit -m "feat: add usePdfProcessor hook for client-side orchestration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Create Floating Progress Component

**Files:**
- Create: `/src/components/FloatingDraftProgress.tsx`

**Step 1: Create the component**

```typescript
// /src/components/FloatingDraftProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { useDraftStore, DraftProgress } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineX,
  HiOutlineChevronUp,
  HiOutlineRefresh,
} from 'react-icons/hi';

export function FloatingDraftProgress() {
  const { getActiveDrafts, getProcessingCount, getCompletedCount, removeDraft, hasActiveDrafts } = useDraftStore();
  const { resumeProcessing } = usePdfProcessor();
  const [isExpanded, setIsExpanded] = useState(false);

  const drafts = getActiveDrafts();
  const processingCount = getProcessingCount();
  const completedCount = getCompletedCount();

  // Resume any interrupted processing on mount
  useEffect(() => {
    drafts
      .filter(d => d.status === 'processing')
      .forEach(d => resumeProcessing(d.id));
  }, []); // Only on mount

  if (!hasActiveDrafts()) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-3 w-80 rounded-2xl bg-white/95 backdrop-blur-xl
                       shadow-xl border border-gray-200/60 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Đang xử lý PDF</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {drafts.map((draft) => (
                <DraftItem
                  key={draft.id}
                  draft={draft}
                  onRemove={() => removeDraft(draft.id)}
                  onRetry={() => resumeProcessing(draft.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full
                   bg-white/95 backdrop-blur-xl shadow-lg border border-gray-200/60
                   hover:shadow-xl transition-all duration-200"
        whileTap={{ scale: 0.97 }}
      >
        {processingCount > 0 ? (
          <div className="relative">
            <HiOutlineDocumentText className="w-5 h-5 text-blue-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>
        ) : (
          <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
        )}

        <span className="text-sm font-medium text-gray-700">
          {processingCount > 0
            ? `Đang xử lý ${processingCount} file`
            : `${completedCount} quiz sẵn sàng`}
        </span>

        <HiOutlineChevronUp
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? '' : 'rotate-180'
          }`}
        />
      </motion.button>
    </div>
  );
}

function DraftItem({
  draft,
  onRemove,
  onRetry,
}: {
  draft: DraftProgress;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const progress = draft.chunksTotal > 0
    ? (draft.chunksProcessed / draft.chunksTotal) * 100
    : 0;

  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">
            {draft.title}
          </p>

          {draft.status === 'processing' || draft.status === 'uploading' ? (
            <>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                {draft.chunksProcessed}/{draft.chunksTotal} phần •{' '}
                {draft.questionsCount} câu hỏi
              </p>
            </>
          ) : draft.status === 'completed' ? (
            <Link
              href={`/draft/${draft.id}/edit`}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs
                         text-blue-600 hover:text-blue-700 font-medium"
            >
              <HiOutlineCheckCircle className="w-3.5 h-3.5" />
              {draft.questionsCount} câu hỏi – Bấm để chỉnh sửa
            </Link>
          ) : draft.status === 'error' ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-red-500 flex items-center gap-1">
                <HiOutlineExclamationCircle className="w-3.5 h-3.5" />
                {draft.error || 'Lỗi xử lý'}
              </span>
              <button
                onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <HiOutlineRefresh className="w-3 h-3" />
                Thử lại
              </button>
            </div>
          ) : null}
        </div>

        {draft.status === 'completed' && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <HiOutlineX className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/FloatingDraftProgress.tsx
git commit -m "feat: add FloatingDraftProgress component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Add FloatingDraftProgress to Layout

**Files:**
- Modify: `/src/app/layout.tsx`

**Step 1: Add the component to root layout**

Find the client wrapper or providers component and add FloatingDraftProgress. If there's a separate client layout, add it there.

```typescript
// Add import at top
import { FloatingDraftProgress } from '@/components/FloatingDraftProgress';

// Add component inside the body, after main content but before closing tags
<FloatingDraftProgress />
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add FloatingDraftProgress to root layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: Mobile Create Page

### Task 10: Create Mobile Create Page

**Files:**
- Create: `/src/app/create/mobile/page.tsx`
- Modify: `/src/app/create/page.tsx` (add mobile detection)

**Step 1: Create simplified mobile create page**

```typescript
// /src/app/create/mobile/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineUpload,
  HiOutlineDocumentText,
  HiOutlineArrowRight,
  HiOutlineDesktopComputer,
  HiOutlineX,
} from 'react-icons/hi';
import { toast } from 'sonner';

export default function MobileCreatePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { addDraft } = useDraftStore();
  const { startProcessing } = usePdfProcessor();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      const f = acceptedFiles[0];
      setFile(f);
      setTitle(f.name.replace(/\.pdf$/i, ''));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: isUploading,
  });

  const handleSubmit = async () => {
    if (!file || !title.trim() || !session?.user) return;

    setIsUploading(true);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Create draft via API
      const response = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          pdfBase64: base64,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create draft');
      }

      const { draftId, chunks, totalPages } = await response.json();

      // Add to store
      addDraft({
        id: draftId,
        title: title.trim(),
        status: 'processing',
        chunksTotal: chunks.total,
        chunksProcessed: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
      });

      // Start background processing
      startProcessing(draftId, chunks.chunkDetails, title.trim());

      toast.success('Đang xử lý PDF', {
        description: `${totalPages} trang, ${chunks.total} phần`,
      });

      // Navigate away
      router.push('/');

    } catch (error: any) {
      toast.error('Lỗi', { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tạo Quiz mới</h1>
        <p className="text-gray-500 mt-1">Upload PDF và để AI tạo câu hỏi</p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          relative rounded-2xl border-2 border-dashed p-8
          flex flex-col items-center justify-center
          min-h-[200px] transition-all duration-200 cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
          ${file ? 'border-green-500 bg-green-50' : ''}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <HiOutlineDocumentText className="w-14 h-14 text-green-500 mx-auto" />
              <p className="mt-3 font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setTitle('');
                }}
                className="mt-3 inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
              >
                <HiOutlineX className="w-4 h-4" />
                Chọn file khác
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <HiOutlineUpload className="w-14 h-14 text-gray-400 mx-auto" />
              <p className="mt-3 font-medium text-gray-700">
                {isDragActive ? 'Thả file vào đây' : 'Chọn hoặc kéo thả PDF'}
              </p>
              <p className="text-sm text-gray-500">Tối đa 50MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Title Input */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-5"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên Quiz
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên quiz..."
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200
                         bg-white text-gray-900 placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200"
              disabled={isUploading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <AnimatePresence>
        {file && title.trim() && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleSubmit}
            disabled={isUploading}
            className="w-full mt-6 py-4 rounded-full bg-blue-500 text-white
                       font-semibold flex items-center justify-center gap-2
                       hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50
                       transition-all duration-200"
          >
            {isUploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang tải lên...
              </>
            ) : (
              <>
                Tạo Quiz
                <HiOutlineArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Desktop Hint */}
      <div className="mt-8 p-4 rounded-xl bg-gray-100 flex items-start gap-3">
        <HiOutlineDesktopComputer className="w-6 h-6 text-gray-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">Cần chỉnh sửa chi tiết?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Mở trên máy tính để edit câu hỏi, thêm hình ảnh, và nhiều tùy chọn khác.
          </p>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

**Step 2: Add mobile detection to main create page**

Add at the top of `/src/app/create/page.tsx`:

```typescript
// Add this hook to detect mobile and redirect
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Inside the component, add:
const router = useRouter();

useEffect(() => {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    router.replace('/create/mobile');
  }
}, [router]);
```

**Step 3: Commit**

```bash
git add src/app/create/mobile/page.tsx src/app/create/page.tsx
git commit -m "feat: add simplified mobile create page with auto-redirect

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Mobile Quiz Player

### Task 11: Create Mobile Quiz Player Component

**Files:**
- Create: `/src/components/quiz/MobileQuizPlayer.tsx`

**Step 1: Create the swipe-based quiz player**

```typescript
// /src/components/quiz/MobileQuizPlayer.tsx
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheck,
} from 'react-icons/hi';

interface Question {
  _id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
}

interface MobileQuizPlayerProps {
  questions: Question[];
  onComplete: (answers: Record<string, number | number[]>) => void;
  onExit?: () => void;
}

export function MobileQuizPlayer({
  questions,
  onComplete,
  onExit,
}: MobileQuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [direction, setDirection] = useState(0);

  const currentQuestion = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  const goNext = useCallback(() => {
    if (!isLast) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [isLast]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [isFirst]);

  const handleDragEnd = useCallback(
    (event: any, info: PanInfo) => {
      const threshold = 50;
      const velocity = 500;

      if (info.offset.x > threshold || info.velocity.x > velocity) {
        if (!isFirst) goPrev();
      } else if (info.offset.x < -threshold || info.velocity.x < -velocity) {
        if (!isLast) goNext();
      }
    },
    [isFirst, isLast, goNext, goPrev]
  );

  const handleOptionSelect = useCallback(
    (optionIndex: number) => {
      const qId = currentQuestion._id;

      if (currentQuestion.type === 'single') {
        setAnswers((prev) => ({ ...prev, [qId]: optionIndex }));
      } else {
        setAnswers((prev) => {
          const current = (prev[qId] as number[]) || [];
          const newAnswers = current.includes(optionIndex)
            ? current.filter((i) => i !== optionIndex)
            : [...current, optionIndex];
          return { ...prev, [qId]: newAnswers };
        });
      }
    },
    [currentQuestion]
  );

  const isOptionSelected = useCallback(
    (optionIndex: number) => {
      const answer = answers[currentQuestion._id];
      if (Array.isArray(answer)) {
        return answer.includes(optionIndex);
      }
      return answer === optionIndex;
    },
    [answers, currentQuestion._id]
  );

  const answeredCount = Object.keys(answers).length;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col z-50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-100 safe-area-top">
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="p-2 -ml-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <HiOutlineChevronLeft
              className={`w-6 h-6 ${isFirst ? 'text-gray-300' : 'text-gray-600'}`}
            />
          </button>

          <div className="text-center">
            <span className="text-sm font-semibold text-gray-900">
              Câu {currentIndex + 1} / {questions.length}
            </span>
            {/* Progress dots */}
            <div className="flex gap-1 justify-center mt-2 max-w-[200px] mx-auto flex-wrap">
              {questions.map((q, i) => (
                <div
                  key={q._id}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex
                      ? 'bg-blue-500'
                      : answers[q._id] !== undefined
                      ? 'bg-green-400'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={isLast}
            className="p-2 -mr-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <HiOutlineChevronRight
              className={`w-6 h-6 ${isLast ? 'text-gray-300' : 'text-gray-600'}`}
            />
          </button>
        </div>
      </div>

      {/* Question Card - Swipeable */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="h-full touch-pan-y"
          >
            <div className="h-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col overflow-hidden">
              {/* Question Image */}
              {currentQuestion.questionImage && (
                <div className="mb-4 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={currentQuestion.questionImage}
                    alt="Question"
                    className="w-full h-auto max-h-36 object-contain"
                  />
                </div>
              )}

              {/* Question Text */}
              <div className="mb-4 flex-shrink-0">
                <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 mb-2">
                  {currentQuestion.type === 'single' ? 'Chọn một' : 'Chọn nhiều'}
                </span>
                <p className="text-base font-medium text-gray-900 leading-relaxed">
                  {currentQuestion.question}
                </p>
              </div>

              {/* Options */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pb-2">
                {currentQuestion.options.map((option, optIdx) => (
                  <motion.button
                    key={optIdx}
                    onClick={() => handleOptionSelect(optIdx)}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all duration-150
                      ${
                        isOptionSelected(optIdx)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 bg-gray-50 active:border-gray-200 active:bg-gray-100'
                      }
                    `}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center
                          flex-shrink-0 transition-all duration-150
                          ${
                            isOptionSelected(optIdx)
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300 bg-white'
                          }
                        `}
                      >
                        {isOptionSelected(optIdx) && (
                          <HiOutlineCheck className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="flex-1 text-sm text-gray-800">{option}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-4 bg-white border-t border-gray-100 safe-area-bottom">
        {/* Swipe hint */}
        <p className="text-center text-xs text-gray-400 mb-3">
          ← Vuốt để chuyển câu →
        </p>

        {/* Complete button */}
        <motion.button
          onClick={() => onComplete(answers)}
          className={`
            w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2
            transition-all duration-200
            ${
              answeredCount === questions.length
                ? 'bg-green-500 text-white active:bg-green-600'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }
          `}
          whileTap={{ scale: 0.98 }}
        >
          Hoàn thành ({answeredCount}/{questions.length} câu đã trả lời)
        </motion.button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/quiz/MobileQuizPlayer.tsx
git commit -m "feat: add MobileQuizPlayer with swipe navigation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Integrate MobileQuizPlayer

**Files:**
- Modify: `/src/app/quiz/[slug]/page.tsx`

**Step 1: Add mobile detection and conditional rendering**

Find the quiz player component/page and add:

```typescript
// Add import
import { MobileQuizPlayer } from '@/components/quiz/MobileQuizPlayer';

// Add state for mobile detection
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

// In the render, conditionally show mobile player
{isMobile && isPlaying ? (
  <MobileQuizPlayer
    questions={quiz.questions}
    onComplete={handleQuizComplete}
    onExit={() => setIsPlaying(false)}
  />
) : (
  // existing desktop player
)}
```

**Step 2: Commit**

```bash
git add src/app/quiz/[slug]/page.tsx
git commit -m "feat: integrate MobileQuizPlayer in quiz page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: Draft Edit Page

### Task 13: Create Draft Edit Page

**Files:**
- Create: `/src/app/draft/[id]/edit/page.tsx`

**Step 1: Create the edit page (desktop-focused)**

```typescript
// /src/app/draft/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDraftStore } from '@/store/useDraftStore';
import { CategorySelector } from '@/components/ui/CategorySelector';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { toast } from 'sonner';
import {
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineDesktopComputer,
  HiOutlineArrowLeft,
} from 'react-icons/hi';
import Link from 'next/link';

interface DraftQuestion {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
}

interface Draft {
  _id: string;
  title: string;
  categoryId?: string;
  questions: DraftQuestion[];
  status: string;
  createdAt: string;
  expiresAt: string;
}

export default function DraftEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { removeDraft } = useDraftStore();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch draft
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchDraft();
  }, [id, session, authStatus]);

  const fetchDraft = async () => {
    try {
      const response = await fetch(`/api/draft/${id}`);
      if (!response.ok) throw new Error('Draft not found');

      const { draft: fetchedDraft } = await response.json();
      setDraft(fetchedDraft);
      setQuestions(fetchedDraft.questions);
      setTitle(fetchedDraft.title);
      setCategoryId(fetchedDraft.categoryId || '');
    } catch (error) {
      toast.error('Không tìm thấy draft');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionEdit = (index: number, updates: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!categoryId) {
      toast.error('Vui lòng chọn danh mục');
      return;
    }

    if (questions.length === 0) {
      toast.error('Cần ít nhất 1 câu hỏi');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/draft/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          categoryId,
          description,
          questions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit');
      }

      const { slug } = await response.json();

      // Remove from store
      removeDraft(id as string);

      toast.success('Quiz đã được gửi để duyệt!');
      router.push(`/quiz/${slug}`);
    } catch (error: any) {
      toast.error('Lỗi', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mobile redirect message
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
          <HiOutlineDesktopComputer className="w-10 h-10 text-blue-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Mở trên máy tính</h1>
        <p className="text-gray-500 mb-6 max-w-xs">
          Để chỉnh sửa chi tiết câu hỏi, vui lòng sử dụng máy tính.
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-blue-500 text-white font-medium
                     hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
          Về trang chủ
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <HiOutlineArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Chỉnh sửa Quiz</h1>
          <p className="text-gray-500 mt-1">
            {questions.length} câu hỏi được trích xuất
          </p>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Thông tin cơ bản</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tên Quiz *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên quiz..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mô tả
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về quiz..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Danh mục *
              </label>
              <CategorySelector
                value={categoryId}
                onChange={setCategoryId}
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Câu hỏi ({questions.length})
          </h2>

          <div className="space-y-4">
            {questions.map((q, index) => (
              <QuestionEditor
                key={index}
                index={index}
                question={q}
                onEdit={(updates) => handleQuestionEdit(index, updates)}
                onDelete={() => handleDeleteQuestion(index)}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/')}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !categoryId || questions.length === 0}
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi để duyệt'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Question Editor Component
function QuestionEditor({
  index,
  question,
  onEdit,
  onDelete,
}: {
  index: number;
  question: DraftQuestion;
  onEdit: (updates: Partial<DraftQuestion>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(question.question);

  const handleSave = () => {
    onEdit({ question: editedQuestion });
    setIsEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-500 uppercase">
            Câu {index + 1} • {question.type === 'single' ? 'Một đáp án' : 'Nhiều đáp án'}
          </span>

          {isEditing ? (
            <div className="mt-2 flex items-start gap-2">
              <Textarea
                value={editedQuestion}
                onChange={(e) => setEditedQuestion(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <button
                onClick={handleSave}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
              >
                <HiOutlineCheck className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <p className="mt-1 text-gray-900">{question.question}</p>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <HiOutlinePencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Options preview */}
      <div className="space-y-1.5">
        {question.options.map((opt, optIdx) => {
          const isCorrect = question.type === 'single'
            ? question.correctIndex === optIdx
            : question.correctIndexes?.includes(optIdx);

          return (
            <div
              key={optIdx}
              className={`px-3 py-2 rounded-lg text-sm ${
                isCorrect
                  ? 'bg-green-100 text-green-800'
                  : 'bg-white text-gray-600'
              }`}
            >
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/draft/[id]/edit/page.tsx
git commit -m "feat: add draft edit page with question editing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 6: Final Integration & Testing

### Task 14: Add generateSlug utility

**Files:**
- Modify: `/src/lib/utils.ts`

**Step 1: Add or verify generateSlug function exists**

```typescript
// Add to /src/lib/utils.ts if not exists

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}
```

**Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add generateSlug utility function

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: Test End-to-End Flow

**Step 1: Start development server**

Run: `cd /home/linh/Downloads/rinkuzu && npm run dev`

**Step 2: Test the flow manually**

1. Open mobile viewport (Chrome DevTools)
2. Go to /create - should redirect to /create/mobile
3. Upload a PDF, enter title
4. Submit - should navigate home with processing indicator
5. Watch floating progress
6. When complete, click to edit
7. On desktop, edit questions
8. Submit to create quiz

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete mobile optimization and background PDF processing

- Add DraftQuiz model with TTL auto-cleanup
- Add draft CRUD APIs (/api/draft/*)
- Add useDraftStore for client state management
- Add usePdfProcessor hook for client-side orchestration
- Add FloatingDraftProgress component
- Add simplified mobile create page
- Add MobileQuizPlayer with swipe navigation
- Add draft edit page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

| Phase | Tasks | Files Created/Modified |
|-------|-------|----------------------|
| **1. Backend** | 5 tasks | DraftQuiz model, 5 API routes |
| **2. Client Infra** | 4 tasks | Zustand store, processor hook, floating UI |
| **3. Mobile Create** | 1 task | Mobile create page |
| **4. Quiz Player** | 2 tasks | MobileQuizPlayer component |
| **5. Draft Edit** | 1 task | Draft edit page |
| **6. Integration** | 2 tasks | Utils, testing |

**Total: 15 tasks, ~25-30 small commits**

**Estimated time: 10-14 hours of focused development**
