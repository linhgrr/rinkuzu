import {
  Session,
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
} from '@/features/adaptive-learning/types';

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

export async function createSession(maxSteps: number = 9999): Promise<Session> {
  return apiFetch<Session>('/api/adaptive-learning/session/start', {
    method: 'POST',
    body: JSON.stringify({ max_steps: maxSteps, use_default_data: true }),
  });
}

export async function getNextConcept(sessionId: string): Promise<NextConcept> {
  return apiFetch<NextConcept>(`/api/adaptive-learning/session/${sessionId}/next-concept`, {
    method: 'POST',
  });
}

export async function getTheory(sessionId: string): Promise<TheoryData> {
  return apiFetch<TheoryData>(`/api/adaptive-learning/session/${sessionId}/theory`, {
    method: 'GET',
  });
}

export async function getExercise(sessionId: string): Promise<Exercise> {
  return apiFetch<Exercise>(`/api/adaptive-learning/session/${sessionId}/exercise`, {
    method: 'POST',
  });
}

export async function submitAnswer(
  sessionId: string,
  answer: SubmitAnswerPayload,
): Promise<SubmitResult> {
  return apiFetch<SubmitResult>(`/api/adaptive-learning/session/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  return apiFetch<SessionStatus>(`/api/adaptive-learning/session/${sessionId}/status`, {
    cacheTtlMs: 10_000,
  });
}

export async function getKnowledgeGraph(sessionId: string): Promise<KnowledgeGraphData> {
  return apiFetch<KnowledgeGraphData>(`/api/adaptive-learning/session/${sessionId}/graph`, {
    cacheTtlMs: 10_000,
  });
}

export async function getMasteryMatrix(sessionId: string): Promise<MasteryMatrixData> {
  return apiFetch<MasteryMatrixData>(`/api/adaptive-learning/session/${sessionId}/mastery-matrix`, {
    cacheTtlMs: 10_000,
  });
}

export async function getConceptDetail(
  sessionId: string,
  conceptId: string,
): Promise<ConceptDetail> {
  return apiFetch<ConceptDetail>(
    `/api/adaptive-learning/session/${sessionId}/concept/${conceptId}`,
    {
      cacheTtlMs: 10_000,
    },
  );
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/adaptive-learning/health', { cache: 'no-store' });
    return res.ok;
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
  const presignedRes = await timedFetch('/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      fileSize: file.size,
      purpose: 'quiz',
    }),
    timeoutMs: PRESIGNED_URL_TIMEOUT_MS,
  });

  if (!presignedRes.ok) {
    throw new AdaptiveApiError({
      message: 'Failed to get upload URL',
      code: 'presigned_url_failed',
      status: presignedRes.status,
    });
  }

  const data = await presignedRes.json();
  const { uploadUrl, s3Key } = data.data || {};

  if (!uploadUrl || !s3Key) {
    throw new AdaptiveApiError({
      message: 'Invalid presigned url response',
      code: 'presigned_url_invalid',
      status: presignedRes.status,
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
      code: 's3_upload_failed',
      status: uploadRes.status,
      retryable: uploadRes.status >= 500,
    });
  }

  // 3. Process the file
  return executeRequest<PipelineUploadResponse>('/api/adaptive-learning/pipeline/process', 'POST', {
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
  return apiFetch<PipelineJobStatus>(`/api/adaptive-learning/pipeline/jobs/${jobId}`, {
    timeoutMs: PIPELINE_STATUS_TIMEOUT_MS,
  });
}

export async function createSessionFromPipeline(
  jobId: string,
  maxSteps: number = 9999,
): Promise<PipelineSessionResponse> {
  return apiFetch<PipelineSessionResponse>(
    `/api/adaptive-learning/pipeline/jobs/${jobId}/create-session?max_steps=${maxSteps}`,
    { method: 'POST', timeoutMs: PIPELINE_CREATE_SESSION_TIMEOUT_MS },
  );
}

export async function checkPipelineAvailable(): Promise<boolean> {
  try {
    const res = await apiFetch<{ available: boolean }>('/api/adaptive-learning/pipeline/status');
    return res.available;
  } catch {
    return false;
  }
}

// --- MongoDB History API ---

export async function getSubjectProgressHistory(limit = 50): Promise<SubjectProgressItem[]> {
  const res = await apiFetch<{ subjects: SubjectProgressItem[]; count: number }>(
    `/api/adaptive-learning/history/subjects/progress?limit=${limit}`,
    { cacheTtlMs: 15_000 },
  );
  return res.subjects;
}

export async function getSubjectHistoryDetail(jobId: string): Promise<SubjectHistoryDetail> {
  return apiFetch<SubjectHistoryDetail>(`/api/adaptive-learning/history/subjects/${jobId}`, {
    cacheTtlMs: 30_000,
  });
}

export async function getSubjectHistoryDetailFresh(jobId: string): Promise<SubjectHistoryDetail> {
  return executeRequest<SubjectHistoryDetail>(
    `/api/adaptive-learning/history/subjects/${jobId}`,
    'GET',
    { cache: 'no-store' },
  );
}

export async function prefetchStartLearningData(sessionId: string): Promise<void> {
  await Promise.allSettled([getSessionStatus(sessionId)]);
}

export async function getPipelineJobHistory(limit = 20): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<{ jobs: PipelineJobHistoryItem[]; count: number }>(
    `/api/adaptive-learning/history/pipeline-jobs?limit=${limit}`,
    { cacheTtlMs: 10_000 },
  );
  return res.jobs;
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<
    { subjects: PipelineJobHistoryItem[]; count: number } | PipelineJobHistoryItem[]
  >('/api/adaptive-learning/subjects', { cacheTtlMs: 10_000 });
  return Array.isArray(res) ? res : res.subjects;
}

export async function deleteSubject(
  jobId: string,
  deleteSessions: boolean = true,
): Promise<DeleteSubjectResponse> {
  return apiFetch<DeleteSubjectResponse>(
    `/api/adaptive-learning/history/subjects/${jobId}?delete_sessions=${deleteSessions ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}
