# Fix Background PDF Processing - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 15 issues identified in the background PDF processing flow to improve reliability, performance, and user experience.

**Architecture:** Client-side orchestration with improved state sync, server-side chunk locking, proper error handling with retry logic, and S3-only storage (remove base64 from MongoDB).

**Tech Stack:** Next.js 14, MongoDB/Mongoose, Zustand, S3 (ClawCloud), pdf-lib

---

## Phase 1: Storage Optimization (Issues #1, #2)

### Task 1.1: Remove base64 storage, use S3 only

**Files:**
- Modify: `src/app/api/draft/create/route.ts`
- Modify: `src/models/DraftQuiz.ts`

**Step 1: Update DraftQuiz model - remove base64, add pdfKey**

```typescript
// src/models/DraftQuiz.ts - Update pdfData interface
pdfData: {
  fileName: string;
  fileSize: number;
  totalPages: number;
  pdfKey: string;      // S3 key for fetching
  pdfUrl?: string;     // Signed URL (refreshed on access)
};
```

**Step 2: Update create API - upload to S3 only, store key**

In `src/app/api/draft/create/route.ts`, replace base64 storage:

```typescript
// Upload PDF to S3 (required, not optional)
const userId = (session!.user as any).id;
const pdfKey = generatePDFKey(userId, fileName);

try {
  await uploadPDF(buffer, pdfKey);
} catch (s3Error) {
  console.error('S3 upload error:', s3Error);
  return NextResponse.json(
    { error: 'Failed to upload PDF. Please try again.' },
    { status: 500 }
  );
}

// Create draft without base64
const draft = await DraftQuiz.create({
  userId,
  title: title.trim(),
  categoryId: categoryId || undefined,
  pdfData: {
    fileName,
    fileSize: buffer.length,
    totalPages,
    pdfKey, // Store S3 key only
  },
  // ... rest
});
```

**Step 3: Run TypeScript check**

Run: `cd /home/linh/Downloads/rinkuzu && npx tsc --noEmit`
Expected: May have errors in process-chunk (will fix in next task)

**Step 4: Commit**

```bash
git add src/models/DraftQuiz.ts src/app/api/draft/create/route.ts
git commit -m "refactor: remove base64 storage, use S3 pdfKey only

- Remove pdfData.base64 from DraftQuiz model
- Add pdfData.pdfKey for S3 reference
- Make S3 upload required (fail if S3 fails)
- Reduces MongoDB storage significantly

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: Update process-chunk to fetch from S3

**Files:**
- Modify: `src/app/api/draft/[id]/process-chunk/route.ts`
- Modify: `src/lib/s3.ts`

**Step 1: Add getPDFBuffer function to s3.ts**

```typescript
// src/lib/s3.ts - Add new function
/**
 * Get PDF buffer from S3
 * @param key - The S3 object key
 * @returns PDF as Buffer
 */
export async function getPDFBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('Empty response from S3');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

**Step 2: Update process-chunk to use S3**

```typescript
// src/app/api/draft/[id]/process-chunk/route.ts
import { getPDFBuffer } from '@/lib/s3';

// Replace base64 loading with S3 fetch:
// OLD:
// const fullPdfBuffer = Buffer.from(draft.pdfData.base64, 'base64');

// NEW:
if (!draft.pdfData.pdfKey) {
  return NextResponse.json(
    { error: 'PDF not available' },
    { status: 400 }
  );
}

let fullPdfBuffer: Buffer;
try {
  fullPdfBuffer = await getPDFBuffer(draft.pdfData.pdfKey);
} catch (s3Error) {
  console.error('Failed to fetch PDF from S3:', s3Error);
  return NextResponse.json(
    { error: 'Failed to fetch PDF' },
    { status: 500 }
  );
}
```

**Step 3: Remove base64 cleanup logic**

Delete this code block from process-chunk (no longer needed):
```typescript
// DELETE THIS:
if (isComplete) {
  await DraftQuiz.updateOne(
    { _id: params.id },
    {
      $set: { status: 'completed' },
      $unset: { 'pdfData.base64': 1 },  // No longer exists
    }
  );
}

// REPLACE WITH:
if (isComplete) {
  await DraftQuiz.updateOne(
    { _id: params.id },
    { $set: { status: 'completed' } }
  );
}
```

**Step 4: Run TypeScript check**

Run: `cd /home/linh/Downloads/rinkuzu && npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/s3.ts src/app/api/draft/[id]/process-chunk/route.ts
git commit -m "refactor: fetch PDF from S3 instead of base64

- Add getPDFBuffer() to s3.ts
- Update process-chunk to fetch from S3 using pdfKey
- Remove base64 cleanup logic (no longer needed)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: Chunk Processing Reliability (Issues #4, #5, #9)

### Task 2.1: Add chunk locking to prevent duplicate processing

**Files:**
- Modify: `src/models/DraftQuiz.ts`
- Modify: `src/app/api/draft/[id]/process-chunk/route.ts`

**Step 1: Add lockedAt and lockedBy to chunk schema**

```typescript
// src/models/DraftQuiz.ts - Update IChunkDetail
export interface IChunkDetail {
  index: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  lockedAt?: Date;      // When processing started
  lockedBy?: string;    // Unique request ID
}

// Update ChunkDetailSchema
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
  lockedAt: { type: Date },
  lockedBy: { type: String },
}, { _id: false });
```

**Step 2: Implement atomic lock acquisition in process-chunk**

```typescript
// src/app/api/draft/[id]/process-chunk/route.ts

import { randomUUID } from 'crypto';

const LOCK_TIMEOUT_MS = 60000; // 60 seconds - if locked longer, consider stale

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // ... auth check ...

  const requestId = randomUUID();
  const now = new Date();
  const lockExpiry = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  await connectDB();

  // Atomic lock acquisition - only lock if:
  // 1. status is 'pending' or 'error', OR
  // 2. status is 'processing' but lock is stale (older than LOCK_TIMEOUT_MS)
  const lockResult = await DraftQuiz.findOneAndUpdate(
    {
      _id: params.id,
      userId: (session!.user as any).id,
      'chunks.chunkDetails': {
        $elemMatch: {
          index: chunkIndex,
          $or: [
            { status: { $in: ['pending', 'error'] } },
            { status: 'processing', lockedAt: { $lt: lockExpiry } }
          ]
        }
      }
    },
    {
      $set: {
        'chunks.chunkDetails.$.status': 'processing',
        'chunks.chunkDetails.$.lockedAt': now,
        'chunks.chunkDetails.$.lockedBy': requestId,
        'chunks.current': chunkIndex,
      }
    },
    { new: true }
  );

  if (!lockResult) {
    // Could not acquire lock - either chunk done, or another request has it
    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: (session!.user as any).id,
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const chunk = draft.chunks.chunkDetails.find((c: any) => c.index === chunkIndex);

    if (chunk?.status === 'done') {
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

    // Another request is processing it
    return NextResponse.json({
      success: false,
      error: 'Chunk is being processed by another request',
      retryAfter: 5000,
    }, { status: 409 });
  }

  // We have the lock, proceed with processing...
  const draft = lockResult;

  // ... rest of processing logic ...
}
```

**Step 3: Commit**

```bash
git add src/models/DraftQuiz.ts src/app/api/draft/[id]/process-chunk/route.ts
git commit -m "feat: add atomic chunk locking to prevent duplicates

- Add lockedAt, lockedBy fields to chunk schema
- Implement atomic lock acquisition with findOneAndUpdate
- Handle stale locks (older than 60s)
- Return 409 Conflict if chunk is already being processed

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.2: Add retry logic with exponential backoff

**Files:**
- Modify: `src/hooks/usePdfProcessor.ts`

**Step 1: Add retry helper function**

```typescript
// src/hooks/usePdfProcessor.ts

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If conflict (another request processing), wait and retry
      if (response.status === 409) {
        const data = await response.json();
        const retryAfter = data.retryAfter || INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, retryAfter));
        continue;
      }

      return response;
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort
      if (error.name === 'AbortError') {
        throw error;
      }

      // Exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('All retries failed');
}
```

**Step 2: Update processChunk to use retry**

```typescript
const processChunk = useCallback(async (
  draftId: string,
  chunkIndex: number,
  signal?: AbortSignal
): Promise<{ success: boolean; questions: any[]; isComplete: boolean; totalQuestions: number }> => {
  const response = await fetchWithRetry(
    `/api/draft/${draftId}/process-chunk`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkIndex }),
      signal,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process chunk');
  }

  const result = await response.json();
  return {
    success: result.success !== false,
    questions: result.questions || [],
    isComplete: result.progress?.isComplete || false,
    totalQuestions: result.progress?.totalQuestions || 0,
  };
}, []);
```

**Step 3: Update startProcessing to handle chunk errors better**

```typescript
const startProcessing = useCallback(async (
  draftId: string,
  chunks: ChunkInfo[],
  title: string
) => {
  // ... existing lock check ...

  const pendingChunks = chunks
    .filter(c => c.status === 'pending' || c.status === 'error' || c.status === 'processing')
    .sort((a, b) => a.index - b.index);

  // Also retry 'processing' chunks (might be stale locks)

  let processedCount = chunks.filter(c => c.status === 'done').length;
  let totalQuestions = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  try {
    for (const chunk of pendingChunks) {
      if (abortController.signal.aborted) break;

      try {
        const result = await processChunk(
          draftId,
          chunk.index,
          abortController.signal
        );

        if (result.success) {
          consecutiveErrors = 0; // Reset on success
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
        }

        await new Promise(r => setTimeout(r, 300));

      } catch (chunkError: any) {
        if (chunkError.name === 'AbortError') break;

        consecutiveErrors++;
        console.error(`Chunk ${chunk.index} failed:`, chunkError);

        // Stop if too many consecutive errors
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setDraftError(draftId, `Quá nhiều lỗi liên tiếp: ${chunkError.message}`);
          toast.error(`Lỗi xử lý "${title}"`, {
            description: 'Vui lòng thử lại sau',
          });
          break;
        }
      }
    }
  } finally {
    delete processingRef.current[draftId];
    delete abortControllersRef.current[draftId];
  }
}, [processChunk, updateDraftProgress, completeDraft, setDraftError]);
```

**Step 4: Commit**

```bash
git add src/hooks/usePdfProcessor.ts
git commit -m "feat: add retry logic with exponential backoff

- Add fetchWithRetry helper with exponential backoff
- Handle 409 Conflict responses (chunk locked by another request)
- Track consecutive errors, stop after 3 in a row
- Retry 'processing' chunks (might be stale locks)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.3: Fix isComplete logic to handle errors

**Files:**
- Modify: `src/app/api/draft/[id]/process-chunk/route.ts`

**Step 1: Update completion check to account for errors**

```typescript
// In process-chunk/route.ts, after updating chunk status

// Count done + error as "attempted"
const doneCount = updateResult!.chunks.chunkDetails.filter(
  (c: any) => c.status === 'done'
).length;

const errorCount = updateResult!.chunks.chunkDetails.filter(
  (c: any) => c.status === 'error'
).length;

const allAttempted = (doneCount + errorCount) >= updateResult!.chunks.total;
const hasQuestions = updateResult!.questions.length > 0;

// Complete if all chunks attempted AND we have at least some questions
const isComplete = allAttempted && hasQuestions;

if (isComplete) {
  await DraftQuiz.updateOne(
    { _id: params.id },
    {
      $set: {
        status: errorCount > 0 ? 'completed' : 'completed',  // Could add 'partial' status
        'chunks.processed': doneCount,
      }
    }
  );
}

return NextResponse.json({
  success: true,
  questions: newQuestions,
  progress: {
    processed: doneCount,
    total: updateResult!.chunks.total,
    errors: errorCount,
    isComplete,
    totalQuestions: updateResult!.questions.length,
  },
});
```

**Step 2: Commit**

```bash
git add src/app/api/draft/[id]/process-chunk/route.ts
git commit -m "fix: update isComplete logic to handle chunk errors

- Count done + error as 'attempted'
- Complete when all attempted AND has questions
- Return error count in progress response

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: State Synchronization (Issues #3, #8, #13)

### Task 3.1: Add expiresAt to client store and sync logic

**Files:**
- Modify: `src/store/useDraftStore.ts`

**Step 1: Update DraftProgress interface**

```typescript
// src/store/useDraftStore.ts

export interface DraftProgress {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  chunksTotal: number;
  chunksProcessed: number;
  questionsCount: number;
  error?: string;
  createdAt: string;
  expiresAt: string;  // ADD THIS
}
```

**Step 2: Add cleanup expired drafts action**

```typescript
// Add to DraftStore interface
cleanupExpiredDrafts: () => void;
syncWithServer: (serverDrafts: Array<{ _id: string; status: string; expiresAt: string }>) => void;

// Add implementations
cleanupExpiredDrafts: () =>
  set((state) => {
    const now = new Date();
    const activeDrafts = Object.fromEntries(
      Object.entries(state.activeDrafts).filter(([_, d]) => {
        if (!d.expiresAt) return true; // Keep if no expiry
        return new Date(d.expiresAt) > now;
      })
    );
    return { activeDrafts };
  }),

syncWithServer: (serverDrafts) =>
  set((state) => {
    const serverIds = new Set(serverDrafts.map(d => d._id));

    // Remove drafts that no longer exist on server
    const activeDrafts = Object.fromEntries(
      Object.entries(state.activeDrafts).filter(([id, _]) => {
        return serverIds.has(id);
      })
    );

    // Update status from server for existing drafts
    serverDrafts.forEach(sd => {
      if (activeDrafts[sd._id]) {
        activeDrafts[sd._id] = {
          ...activeDrafts[sd._id],
          status: sd.status as any,
          expiresAt: sd.expiresAt,
        };
      }
    });

    return { activeDrafts };
  }),
```

**Step 3: Commit**

```bash
git add src/store/useDraftStore.ts
git commit -m "feat: add expiresAt tracking and server sync to draft store

- Add expiresAt to DraftProgress interface
- Add cleanupExpiredDrafts action
- Add syncWithServer action to reconcile with server state

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.2: Create DraftSyncProvider component

**Files:**
- Create: `src/components/providers/DraftSyncProvider.tsx`
- Modify: `src/app/layout.tsx` or appropriate provider file

**Step 1: Create DraftSyncProvider**

```typescript
// src/components/providers/DraftSyncProvider.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useDraftStore } from '@/store/useDraftStore';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';

const SYNC_INTERVAL = 30000; // 30 seconds

export function DraftSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { getActiveDrafts, cleanupExpiredDrafts, syncWithServer } = useDraftStore();
  const { resumeProcessing } = usePdfProcessor();
  const hasInitialized = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Initial sync and resume on mount
  useEffect(() => {
    if (!session?.user || hasInitialized.current) return;
    hasInitialized.current = true;

    const initSync = async () => {
      // Cleanup expired first
      cleanupExpiredDrafts();

      // Fetch server state
      try {
        const response = await fetch('/api/draft/list');
        if (response.ok) {
          const { drafts } = await response.json();
          syncWithServer(drafts);

          // Resume processing drafts
          const localDrafts = getActiveDrafts();
          localDrafts
            .filter(d => d.status === 'processing')
            .forEach(d => {
              // Check if server says it's still processing
              const serverDraft = drafts.find((sd: any) => sd._id === d.id);
              if (serverDraft && serverDraft.status === 'processing') {
                resumeProcessing(d.id);
              }
            });
        }
      } catch (error) {
        console.error('Failed to sync drafts:', error);
      }
    };

    initSync();

    // Periodic sync
    syncIntervalRef.current = setInterval(() => {
      cleanupExpiredDrafts();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [session]);

  return <>{children}</>;
}
```

**Step 2: Add to providers/layout**

Find the appropriate provider file and add:

```typescript
import { DraftSyncProvider } from '@/components/providers/DraftSyncProvider';

// Wrap children with DraftSyncProvider
<DraftSyncProvider>
  {children}
</DraftSyncProvider>
```

**Step 3: Commit**

```bash
git add src/components/providers/DraftSyncProvider.tsx
git commit -m "feat: add DraftSyncProvider for state synchronization

- Initial sync with server on mount
- Cleanup expired drafts periodically
- Resume processing only if server confirms status
- Prevents stale localStorage state issues

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.3: Fix useEffect dependencies in FloatingDraftProgress

**Files:**
- Modify: `src/components/FloatingDraftProgress.tsx`

**Step 1: Remove resume logic from FloatingDraftProgress**

```typescript
// src/components/FloatingDraftProgress.tsx

// REMOVE this useEffect entirely (now handled by DraftSyncProvider):
// useEffect(() => {
//   if (mounted) {
//     drafts
//       .filter(d => d.status === 'processing')
//       .forEach(d => resumeProcessing(d.id));
//   }
// }, [mounted]);

// Keep only the mounted state effect:
useEffect(() => {
  setMounted(true);
}, []);
```

**Step 2: Remove resumeProcessing from imports and hook usage**

```typescript
// Update the hook destructuring:
const { stopProcessing } = usePdfProcessor();
// Remove: resumeProcessing (now handled by DraftSyncProvider)
```

**Step 3: Commit**

```bash
git add src/components/FloatingDraftProgress.tsx
git commit -m "refactor: move resume logic to DraftSyncProvider

- Remove resume useEffect from FloatingDraftProgress
- FloatingDraftProgress now only handles UI display
- Fixes React Strict Mode double-mount issue
- Fixes missing dependency warnings

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Cleanup and Cancel Handling (Issues #6, #11, #12)

### Task 4.1: Add S3 cleanup on draft delete

**Files:**
- Modify: `src/app/api/draft/[id]/route.ts`

**Step 1: Update DELETE handler to cleanup S3**

```typescript
// src/app/api/draft/[id]/route.ts
import { deletePDF } from '@/lib/s3';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Find draft first to get pdfKey
    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: (session!.user as any).id,
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Delete from MongoDB
    await DraftQuiz.deleteOne({ _id: params.id });

    // Cleanup S3 (best effort, don't fail if this fails)
    if (draft.pdfData?.pdfKey) {
      try {
        await deletePDF(draft.pdfData.pdfKey);
        console.log('Deleted PDF from S3:', draft.pdfData.pdfKey);
      } catch (s3Error) {
        console.error('Failed to delete PDF from S3:', s3Error);
        // Don't fail the request, S3 cleanup is best-effort
      }
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

**Step 2: Commit**

```bash
git add src/app/api/draft/[id]/route.ts
git commit -m "feat: add S3 cleanup when deleting draft

- Fetch draft first to get pdfKey
- Delete from S3 after MongoDB delete
- Best-effort S3 cleanup (don't fail if S3 fails)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.2: Fix memory cleanup in usePdfProcessor

**Files:**
- Modify: `src/hooks/usePdfProcessor.ts`

**Step 1: Update cleanup effect to clear refs completely**

```typescript
// src/hooks/usePdfProcessor.ts

// Cleanup on unmount
useEffect(() => {
  return () => {
    // Abort all controllers
    Object.values(abortControllersRef.current).forEach(controller => {
      controller.abort();
    });
    // Clear refs completely
    processingRef.current = {};
    abortControllersRef.current = {};
  };
}, []);
```

**Step 2: Add cleanup in stopProcessing**

```typescript
const stopProcessing = useCallback((draftId: string) => {
  const controller = abortControllersRef.current[draftId];
  if (controller) {
    controller.abort();
    delete abortControllersRef.current[draftId];
  }
  delete processingRef.current[draftId];
}, []);
```

**Step 3: Commit**

```bash
git add src/hooks/usePdfProcessor.ts
git commit -m "fix: properly cleanup refs in usePdfProcessor

- Clear refs completely on unmount
- Delete entries in stopProcessing
- Prevents memory leaks

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.3: Add rollback on create API failure

**Files:**
- Modify: `src/app/api/draft/create/route.ts`

**Step 1: Wrap creation in try-catch with S3 rollback**

```typescript
// src/app/api/draft/create/route.ts

// After S3 upload succeeds, wrap draft creation:
let draft;
try {
  draft = await DraftQuiz.create({
    userId,
    title: title.trim(),
    categoryId: categoryId || undefined,
    pdfData: {
      fileName,
      fileSize: buffer.length,
      totalPages,
      pdfKey,
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
} catch (dbError) {
  // Rollback S3 upload
  console.error('Draft creation failed, rolling back S3:', dbError);
  try {
    await deletePDF(pdfKey);
  } catch (s3Error) {
    console.error('S3 rollback failed:', s3Error);
  }
  throw dbError;
}
```

**Step 2: Add import for deletePDF**

```typescript
import { uploadPDF, generatePDFKey, deletePDF } from '@/lib/s3';
```

**Step 3: Commit**

```bash
git add src/app/api/draft/create/route.ts
git commit -m "fix: add S3 rollback on draft creation failure

- If MongoDB create fails, delete uploaded PDF from S3
- Prevents orphaned S3 files

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: Duplicate Questions Prevention (Issue #10)

### Task 5.1: Improve question hash function

**Files:**
- Modify: `src/app/api/draft/[id]/process-chunk/route.ts`

**Step 1: Create more robust hash function**

```typescript
// src/app/api/draft/[id]/process-chunk/route.ts

/**
 * Create a robust hash of question content to detect duplicates
 * Handles minor variations in formatting, punctuation, whitespace
 */
function hashQuestion(q: any): string {
  // Normalize question text
  const normalizedQuestion = normalizeText(q.question || '');

  // Normalize and sort options (order shouldn't matter for duplicate detection)
  const normalizedOptions = (q.options || [])
    .map((opt: string) => normalizeText(opt))
    .sort()
    .join('|||');

  return `${normalizedQuestion}:::${normalizedOptions}`;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove common punctuation variations
    .replace(/[.,;:!?'"()[\]{}]/g, '')
    // Remove leading/trailing option markers (a., A), 1., etc.)
    .replace(/^[a-zA-Z0-9][.)]\s*/, '')
    // Normalize unicode
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if two questions are similar (fuzzy match)
 */
function areSimilarQuestions(q1: any, q2: any): boolean {
  const text1 = normalizeText(q1.question || '');
  const text2 = normalizeText(q2.question || '');

  // If normalized texts are identical, they're duplicates
  if (text1 === text2) return true;

  // Check if one contains the other (for partial matches)
  if (text1.length > 20 && text2.length > 20) {
    if (text1.includes(text2) || text2.includes(text1)) {
      return true;
    }
  }

  return false;
}
```

**Step 2: Use improved deduplication in process-chunk**

```typescript
// Replace existing duplicate check with:

// Build hash set from existing questions
const existingHashes = new Set(
  draft.questions.map((q: any) => hashQuestion(q))
);

// Filter new questions
const newQuestions = extractedQuestions.filter((newQ: any) => {
  const hash = hashQuestion(newQ);

  // Check exact hash match
  if (existingHashes.has(hash)) {
    console.log('Duplicate (exact hash):', newQ.question?.substring(0, 50));
    return false;
  }

  // Check fuzzy similarity with existing questions
  for (const existingQ of draft.questions) {
    if (areSimilarQuestions(newQ, existingQ)) {
      console.log('Duplicate (similar):', newQ.question?.substring(0, 50));
      return false;
    }
  }

  return true;
});
```

**Step 3: Commit**

```bash
git add src/app/api/draft/[id]/process-chunk/route.ts
git commit -m "feat: improve question deduplication algorithm

- Add normalizeText() for robust text normalization
- Sort options before hashing (order-independent)
- Add fuzzy similarity check for near-duplicates
- Better handles overlap page duplicates

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 6: Submit Validation (Issue #14)

### Task 6.1: Add comprehensive submit validation

**Files:**
- Modify: `src/app/api/draft/[id]/submit/route.ts`

**Step 1: Add validation functions**

```typescript
// src/app/api/draft/[id]/submit/route.ts

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateQuestions(questions: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!questions || questions.length === 0) {
    errors.push('Cần ít nhất 1 câu hỏi');
    return { isValid: false, errors, warnings };
  }

  questions.forEach((q, index) => {
    const prefix = `Câu ${index + 1}`;

    // Required fields
    if (!q.question?.trim()) {
      errors.push(`${prefix}: Thiếu nội dung câu hỏi`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`${prefix}: Cần ít nhất 2 đáp án`);
    }

    // Check for empty options
    const emptyOptions = q.options?.filter((opt: string) => !opt?.trim());
    if (emptyOptions?.length > 0) {
      errors.push(`${prefix}: Có đáp án trống`);
    }

    // Validate correct answer
    if (q.type === 'single') {
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options?.length) {
        errors.push(`${prefix}: Đáp án đúng không hợp lệ`);
      }
    } else if (q.type === 'multiple') {
      if (!Array.isArray(q.correctIndexes) || q.correctIndexes.length === 0) {
        errors.push(`${prefix}: Cần chọn ít nhất 1 đáp án đúng`);
      } else {
        const invalidIndexes = q.correctIndexes.filter(
          (idx: number) => idx < 0 || idx >= q.options?.length
        );
        if (invalidIndexes.length > 0) {
          errors.push(`${prefix}: Có đáp án đúng không hợp lệ`);
        }
      }
    } else {
      errors.push(`${prefix}: Loại câu hỏi không hợp lệ`);
    }
  });

  // Warnings (non-blocking)
  if (questions.length < 5) {
    warnings.push('Quiz nên có ít nhất 5 câu hỏi');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
```

**Step 2: Update submit handler to use validation**

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ... auth check ...

  const body = await request.json();
  const { title, categoryId, description, questions: editedQuestions } = body;

  if (!categoryId) {
    return NextResponse.json(
      { error: 'Vui lòng chọn danh mục' },
      { status: 400 }
    );
  }

  await connectDB();

  const draft = await DraftQuiz.findOne({
    _id: params.id,
    userId: (session!.user as any).id,
  });

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  // Allow submit if completed OR if has questions (partial completion)
  const questionsToUse = editedQuestions || draft.questions;

  // Validate questions
  const validation = validateQuestions(questionsToUse);

  if (!validation.isValid) {
    return NextResponse.json({
      error: 'Validation failed',
      details: validation.errors,
    }, { status: 400 });
  }

  // ... rest of quiz creation ...

  // Return warnings if any
  return NextResponse.json({
    success: true,
    quizId: quiz._id.toString(),
    slug: quiz.slug,
    warnings: validation.warnings,
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/draft/[id]/submit/route.ts
git commit -m "feat: add comprehensive question validation on submit

- Validate required fields (question, options, correctIndex)
- Check for empty options
- Validate answer indexes are within bounds
- Return detailed error messages
- Allow partial completion submit (if has questions)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 7: UI/UX Improvements (Issues #7, #15)

### Task 7.1: Add expiry indicator to draft items

**Files:**
- Modify: `src/components/FloatingDraftProgress.tsx`

**Step 1: Add time remaining helper**

```typescript
// src/components/FloatingDraftProgress.tsx

function getTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Hết hạn';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} ngày`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} phút`;
}
```

**Step 2: Update DraftItem to show expiry**

```typescript
function DraftItem({ draft, onRemove, onRetry, onCancel }: {...}) {
  // ... existing code ...

  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-gray-900 truncate">
              {draft.title}
            </p>
            {draft.expiresAt && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                ⏱ {getTimeRemaining(draft.expiresAt)}
              </span>
            )}
          </div>
          {/* ... rest of status display ... */}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/FloatingDraftProgress.tsx
git commit -m "feat: add expiry time indicator to draft items

- Show remaining time before draft expires
- Display in human-readable format (days, hours, minutes)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7.2: Fix progress display to show errors

**Files:**
- Modify: `src/components/FloatingDraftProgress.tsx`
- Modify: `src/store/useDraftStore.ts`

**Step 1: Add chunksError to DraftProgress**

```typescript
// src/store/useDraftStore.ts

export interface DraftProgress {
  id: string;
  title: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  chunksTotal: number;
  chunksProcessed: number;
  chunksError: number;  // ADD THIS
  questionsCount: number;
  error?: string;
  createdAt: string;
  expiresAt: string;
}
```

**Step 2: Update progress display**

```typescript
// src/components/FloatingDraftProgress.tsx

function DraftItem({ draft, ... }) {
  const successProgress = draft.chunksTotal > 0
    ? (draft.chunksProcessed / draft.chunksTotal) * 100
    : 0;

  const errorProgress = draft.chunksTotal > 0
    ? ((draft.chunksError || 0) / draft.chunksTotal) * 100
    : 0;

  return (
    // ... in the processing status section:
    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
      <motion.div
        className="h-full bg-blue-500"
        initial={{ width: 0 }}
        animate={{ width: `${successProgress}%` }}
        transition={{ duration: 0.3 }}
      />
      {errorProgress > 0 && (
        <motion.div
          className="h-full bg-red-400"
          initial={{ width: 0 }}
          animate={{ width: `${errorProgress}%` }}
          transition={{ duration: 0.3 }}
        />
      )}
    </div>
    <p className="mt-1.5 text-xs text-gray-500">
      {draft.chunksProcessed}/{draft.chunksTotal} hoàn thành
      {(draft.chunksError || 0) > 0 && (
        <span className="text-red-500"> • {draft.chunksError} lỗi</span>
      )}
      {' • '}{draft.questionsCount} câu hỏi
    </p>
  );
}
```

**Step 3: Commit**

```bash
git add src/store/useDraftStore.ts src/components/FloatingDraftProgress.tsx
git commit -m "feat: show chunk errors in progress indicator

- Add chunksError field to DraftProgress
- Display error count in progress bar (red segment)
- Show error count in text

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7.3: Update usePdfProcessor to track errors

**Files:**
- Modify: `src/hooks/usePdfProcessor.ts`

**Step 1: Track and report chunk errors**

```typescript
// In startProcessing function, add error tracking:

let errorCount = chunks.filter(c => c.status === 'error').length;

// In the chunk processing loop, after catch block:
} catch (chunkError: any) {
  if (chunkError.name === 'AbortError') break;

  errorCount++;
  consecutiveErrors++;
  console.error(`Chunk ${chunk.index} failed:`, chunkError);

  // Update store with error count
  updateDraftProgress(draftId, {
    chunksError: errorCount,
  });

  // ... rest of error handling
}
```

**Step 2: Commit**

```bash
git add src/hooks/usePdfProcessor.ts
git commit -m "feat: track and report chunk errors to store

- Count errors during processing
- Update store with error count for UI display

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 8: Mobile Create Page Fix

### Task 8.1: Update mobile create to include expiresAt

**Files:**
- Modify: `src/app/create/mobile/page.tsx`

**Step 1: Update addDraft call to include expiresAt**

```typescript
// src/app/create/mobile/page.tsx

// In handleSubmit, after getting response:
const { draftId, chunks, totalPages, expiresAt } = await response.json();

// Add to store with expiresAt
addDraft({
  id: draftId,
  title: title.trim(),
  status: 'processing',
  chunksTotal: chunks.total,
  chunksProcessed: 0,
  chunksError: 0,
  questionsCount: 0,
  createdAt: new Date().toISOString(),
  expiresAt: expiresAt,  // ADD THIS
});
```

**Step 2: Commit**

```bash
git add src/app/create/mobile/page.tsx
git commit -m "fix: include expiresAt when adding draft to store

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Final: Testing and Verification

### Task 9.1: Manual testing checklist

**Step 1: Test create flow**

1. Go to `/create/mobile`
2. Upload a PDF (10+ pages)
3. Verify S3 upload (check S3 bucket or logs)
4. Verify draft created without base64 in MongoDB
5. Navigate away, verify FloatingProgress shows

**Step 2: Test processing**

1. Watch progress indicator update
2. Open Network tab - verify no duplicate chunk requests
3. Open another tab - verify no duplicate processing
4. Wait for completion

**Step 3: Test error handling**

1. Simulate network error (offline mode)
2. Verify retry happens
3. Verify error count shows in UI

**Step 4: Test cleanup**

1. Cancel a processing draft
2. Verify S3 file deleted
3. Verify removed from localStorage

**Step 5: Test submit**

1. Go to draft edit page
2. Try submit with empty questions - verify error
3. Submit valid quiz - verify success

---

## Summary

| Phase | Tasks | Issues Fixed |
|-------|-------|--------------|
| 1. Storage | 2 tasks | #1, #2 |
| 2. Chunk Reliability | 3 tasks | #4, #5, #9 |
| 3. State Sync | 3 tasks | #3, #8, #13 |
| 4. Cleanup | 3 tasks | #6, #11, #12 |
| 5. Duplicates | 1 task | #10 |
| 6. Submit Validation | 1 task | #14 |
| 7. UI/UX | 3 tasks | #7, #15 |
| 8. Mobile Fix | 1 task | - |
| 9. Testing | 1 task | - |

**Total: 18 tasks**

**Estimated time: 6-8 hours**
