import {
    Session, Exercise, SubmitResult, SessionStatus,
    KnowledgeGraphData, MasteryMatrixData, ConceptDetail,
    PipelineUploadResponse, PipelineJobStatus, PipelineSessionResponse,
    SessionHistoryItem, SessionHistoryDetail, PipelineJobHistoryItem, DeleteSubjectResponse,
    NextConcept, TheoryData,
} from './types';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 60_000;
const inFlightGetRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();

type ApiFetchOptions = RequestInit & {
    timeoutMs?: number;
    dedupeKey?: string;
    cacheTtlMs?: number;
};

function readCachedResponse<T>(key: string): T | null {
    const hit = responseCache.get(key);
    if (!hit) {
        return null;
    }

    if (Date.now() >= hit.expiresAt) {
        responseCache.delete(key);
        return null;
    }

    return hit.data as T;
}

function writeCachedResponse<T>(key: string, data: T, ttlMs?: number): void {
    if (!ttlMs || ttlMs <= 0) {
        return;
    }

    responseCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
    });
}

function invalidateCacheByPrefixes(prefixes: string[]): void {
    for (const key of responseCache.keys()) {
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
            responseCache.delete(key);
        }
    }
}

async function executeRequest<T>(
    path: string,
    method: string,
    options?: ApiFetchOptions,
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const headers = new Headers(options?.headers);
    const body = options?.body;
    const shouldAttachJsonContentType =
        body !== undefined
        && body !== null
        && !(body instanceof FormData)
        && !headers.has('Content-Type');

    if (shouldAttachJsonContentType) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        method,
        cache: options?.cache ?? 'no-store',
        headers,
        signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
        const error = await res.text().catch(() => res.statusText);
        throw new Error(`API Error ${res.status}: ${error}`);
    }

    if (res.status === 204) {
        return undefined as T;
    }

    return res.json();
}

async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
    const method = (options?.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const dedupeKey = options?.dedupeKey || path;

    if (!isGet) {
        // Writes can affect several derived reads in adaptive dashboards.
        if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
            invalidateCacheByPrefixes([
                '/api/adaptive-learning/session/',
                '/api/adaptive-learning/history/',
                '/api/adaptive-learning/subjects',
            ]);
        }
        return executeRequest<T>(path, method, options);
    }

    const cached = readCachedResponse<T>(dedupeKey);
    if (cached !== null) {
        return cached;
    }

    const inFlight = inFlightGetRequests.get(dedupeKey);
    if (inFlight) {
        return inFlight as Promise<T>;
    }

    const requestPromise = executeRequest<T>(path, method, options)
        .then((data) => {
            writeCachedResponse(dedupeKey, data, options?.cacheTtlMs);
            return data;
        })
        .finally(() => inFlightGetRequests.delete(dedupeKey));

    inFlightGetRequests.set(dedupeKey, requestPromise as Promise<unknown>);
    return requestPromise;
}

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

export async function submitAnswer(sessionId: string, answer: string): Promise<SubmitResult> {
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

export async function getConceptDetail(sessionId: string, conceptId: string): Promise<ConceptDetail> {
    return apiFetch<ConceptDetail>(`/api/adaptive-learning/session/${sessionId}/concept/${conceptId}`, {
        cacheTtlMs: 10_000,
    });
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
): Promise<PipelineUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (subjectId) formData.append('subject_id', subjectId);

    const res = await fetch('/api/adaptive-learning/pipeline/process', {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) {
        const error = await res.text().catch(() => res.statusText);
        throw new Error(`Upload failed: ${error}`);
    }
    return res.json();
}

export async function getPipelineJobStatus(jobId: string): Promise<PipelineJobStatus> {
    return apiFetch<PipelineJobStatus>(`/api/adaptive-learning/pipeline/jobs/${jobId}`);
}

export async function createSessionFromPipeline(
    jobId: string,
    maxSteps: number = 9999,
): Promise<PipelineSessionResponse> {
    return apiFetch<PipelineSessionResponse>(
        `/api/adaptive-learning/pipeline/jobs/${jobId}/create-session?max_steps=${maxSteps}`,
        { method: 'POST' },
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

export async function getSessionHistory(limit = 50): Promise<SessionHistoryItem[]> {
    const res = await apiFetch<{ sessions: SessionHistoryItem[]; count: number }>(
        `/api/adaptive-learning/history/sessions?limit=${limit}`,
        { cacheTtlMs: 15_000 }
    );
    return res.sessions;
}

export async function getSessionHistoryDetail(sessionId: string): Promise<SessionHistoryDetail> {
    return apiFetch<SessionHistoryDetail>(`/api/adaptive-learning/history/sessions/${sessionId}`, {
        cacheTtlMs: 30_000,
    });
}

export async function getSessionHistoryDetailFresh(sessionId: string): Promise<SessionHistoryDetail> {
    return executeRequest<SessionHistoryDetail>(
        `/api/adaptive-learning/history/sessions/${sessionId}`,
        'GET',
        { cache: 'no-store' },
    );
}

export async function prefetchStartLearningData(sessionId: string): Promise<void> {
    await Promise.allSettled([
        getSessionStatus(sessionId),
    ]);
}

export async function getPipelineJobHistory(limit = 20): Promise<PipelineJobHistoryItem[]> {
    const res = await apiFetch<{ jobs: PipelineJobHistoryItem[]; count: number }>(
        `/api/adaptive-learning/history/pipeline-jobs?limit=${limit}`,
        { cacheTtlMs: 10_000 }
    );
    return res.jobs;
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
    const res = await apiFetch<{ subjects: PipelineJobHistoryItem[]; count: number } | PipelineJobHistoryItem[]>(
        '/api/adaptive-learning/subjects',
        { cacheTtlMs: 10_000 }
    );
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

export function isSessionNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    return message.includes('session not found') || message.includes('session_not_found');
}
