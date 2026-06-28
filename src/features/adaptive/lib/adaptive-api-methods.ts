import {
  Exercise,
  SubmitAnswerPayload,
  SubmitResult,
  SessionStatus,
  KnowledgeGraphData,
  MasteryMatrixData,
  ConceptDetail,
  PipelineUploadResponse,
  PipelineJobStatus,
  PipelineSessionResponse,
  SubjectProgressItem,
  SubjectHistoryDetail,
  PipelineJobHistoryItem,
  DeleteSubjectResponse,
  NextConcept,
  TheoryData,
  PipelineJobListItem,
} from '@/features/adaptive/types';
import { ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive/cache';

import {
  timedFetch,
  executeRequest,
  apiFetch,
  PRESIGNED_URL_TIMEOUT_MS,
  OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  PIPELINE_PROCESS_TIMEOUT_MS,
  PIPELINE_STATUS_TIMEOUT_MS,
  PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
} from './adaptive-api-fetch';
import { AdaptiveApiError } from './adaptive-api-error';

export async function getNextConcept(sessionId: string): Promise<NextConcept> {
  return apiFetch<NextConcept>(`/api/adaptive/session/${sessionId}/next-concept`, {
    method: 'POST',
  });
}

export async function getTheory(sessionId: string): Promise<TheoryData> {
  return apiFetch<TheoryData>(`/api/adaptive/session/${sessionId}/theory`, {
    method: 'GET',
  });
}

export async function getExercise(sessionId: string): Promise<Exercise> {
  return apiFetch<Exercise>(`/api/adaptive/session/${sessionId}/exercise`, {
    method: 'POST',
  });
}

export async function submitAnswer(
  sessionId: string,
  answer: SubmitAnswerPayload,
): Promise<SubmitResult> {
  return apiFetch<SubmitResult>(`/api/adaptive/session/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  return apiFetch<SessionStatus>(`/api/adaptive/session/${sessionId}/status`, {
    cacheTtlMs: 10_000,
  });
}

export async function getKnowledgeGraph(sessionId: string): Promise<KnowledgeGraphData> {
  return apiFetch<KnowledgeGraphData>(`/api/adaptive/session/${sessionId}/graph`, {
    cacheTtlMs: 10_000,
  });
}

export async function getMasteryMatrix(sessionId: string): Promise<MasteryMatrixData> {
  return apiFetch<MasteryMatrixData>(`/api/adaptive/session/${sessionId}/mastery-matrix`, {
    cacheTtlMs: 10_000,
  });
}

export async function getConceptDetail(
  sessionId: string,
  conceptId: string,
): Promise<ConceptDetail> {
  return apiFetch<ConceptDetail>(`/api/adaptive/session/${sessionId}/concept/${conceptId}`, {
    cacheTtlMs: 10_000,
  });
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiFetch('/api/adaptive/health', {
      cache: 'no-store',
      cacheTtlMs: ADAPTIVE_CACHE_TTL_SECONDS.health * 1000,
    });
    return true;
  } catch {
    return false;
  }
}

// --- Pipeline API ---

export async function uploadPdf(
  file: File,
  subjectId?: string,
  pageBatchSize: number = DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
): Promise<PipelineUploadResponse> {
  // 1. Get presigned URL
  const { uploadUrl, s3Key } = await executeRequest<{ uploadUrl?: string; s3Key?: string }>(
    '/api/storage/presigned-url',
    'POST',
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        fileSize: file.size,
        purpose: 'quiz',
      }),
      timeoutMs: PRESIGNED_URL_TIMEOUT_MS,
    },
  );

  if (!uploadUrl || !s3Key) {
    throw new AdaptiveApiError({
      message: 'Invalid presigned url response',
      code: 'upstream_invalid_envelope',
      retryable: true,
    });
  }

  // 2. Upload to S3
  const uploadRes = await timedFetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/pdf',
    },
    body: file,
    timeoutMs: OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  });

  if (!uploadRes.ok) {
    throw new AdaptiveApiError({
      message: 'Failed to upload file to S3',
      code: 'upstream_error',
      status: uploadRes.status,
      retryable: uploadRes.status >= 500,
    });
  }

  // 3. Process the file
  return executeRequest<PipelineUploadResponse>('/api/adaptive/pipeline/process', 'POST', {
    body: JSON.stringify({
      s3Key,
      filename: file.name,
      subject_id: subjectId,
      page_batch_size: pageBatchSize,
    }),
    timeoutMs: PIPELINE_PROCESS_TIMEOUT_MS,
  });
}

export async function getPipelineJobStatus(jobId: string): Promise<PipelineJobStatus> {
  return apiFetch<PipelineJobStatus>(`/api/adaptive/pipeline/jobs/${jobId}`, {
    timeoutMs: PIPELINE_STATUS_TIMEOUT_MS,
  });
}

export async function createSessionFromPipeline(
  jobId: string,
  maxSteps: number = 9999,
): Promise<PipelineSessionResponse> {
  return apiFetch<PipelineSessionResponse>(
    `/api/adaptive/pipeline/jobs/${jobId}/create-session?max_steps=${maxSteps}`,
    { method: 'POST', timeoutMs: PIPELINE_CREATE_SESSION_TIMEOUT_MS },
  );
}

// --- MongoDB History API ---

export async function getSubjectProgressHistory(limit = 50): Promise<SubjectProgressItem[]> {
  const res = await apiFetch<{ subjects: SubjectProgressItem[]; count: number }>(
    `/api/adaptive/history/subjects/progress?limit=${limit}`,
    { cacheTtlMs: 15_000 },
  );
  return res.subjects;
}

export async function getSubjectHistoryDetail(jobId: string): Promise<SubjectHistoryDetail> {
  return apiFetch<SubjectHistoryDetail>(`/api/adaptive/history/subjects/${jobId}`, {
    cacheTtlMs: 30_000,
  });
}

export async function getSubjectHistoryDetailFresh(jobId: string): Promise<SubjectHistoryDetail> {
  return executeRequest<SubjectHistoryDetail>(`/api/adaptive/history/subjects/${jobId}`, 'GET', {
    cache: 'no-store',
  });
}

export async function prefetchStartLearningData(sessionId: string): Promise<void> {
  await Promise.allSettled([getSessionStatus(sessionId)]);
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<PipelineJobHistoryItem[]>('/api/adaptive/subjects', {
    cacheTtlMs: 10_000,
  });
  return res;
}

export async function deleteSubject(
  jobId: string,
  deleteSessions: boolean = true,
): Promise<DeleteSubjectResponse> {
  return apiFetch<DeleteSubjectResponse>(
    `/api/adaptive/history/subjects/${jobId}?delete_sessions=${deleteSessions ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}

export async function listPipelineJobs(limit = 50): Promise<PipelineJobListItem[]> {
  const res = await apiFetch<{ jobs: PipelineJobListItem[]; count: number }>(
    `/api/adaptive/pipeline/jobs?limit=${limit}`,
    { timeoutMs: PIPELINE_STATUS_TIMEOUT_MS, cache: 'no-store' },
  );
  return res.jobs;
}

export async function retryPipelineJob(
  jobId: string,
): Promise<{ job_id: string; status: string; retry_count?: number }> {
  return apiFetch(`/api/adaptive/pipeline/jobs/${jobId}/retry`, {
    method: 'POST',
    timeoutMs: PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  });
}

export async function cancelPipelineJob(
  jobId: string,
): Promise<{ job_id: string; status: string }> {
  return apiFetch(`/api/adaptive/pipeline/jobs/${jobId}/cancel`, {
    method: 'POST',
    timeoutMs: PIPELINE_STATUS_TIMEOUT_MS,
  });
}
