import {
    Session, Exercise, SubmitResult, SessionStatus,
    KnowledgeGraphData, MasteryMatrixData, ConceptDetail,
    PipelineUploadResponse, PipelineJobStatus, PipelineSessionResponse,
    SessionHistoryItem, SessionHistoryDetail, PipelineJobHistoryItem, DeleteSubjectResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
    });
    if (!res.ok) {
        const error = await res.text().catch(() => res.statusText);
        throw new Error(`API Error ${res.status}: ${error}`);
    }
    return res.json();
}

export async function createSession(maxSteps: number = 50): Promise<Session> {
    return apiFetch<Session>('/api/session/start', {
        method: 'POST',
        body: JSON.stringify({ max_steps: maxSteps, use_default_data: true }),
    });
}

export async function getNextExercise(sessionId: string): Promise<Exercise> {
    return apiFetch<Exercise>(`/api/session/${sessionId}/next`, {
        method: 'POST',
    });
}

export async function submitAnswer(sessionId: string, answer: string): Promise<SubmitResult> {
    return apiFetch<SubmitResult>(`/api/session/${sessionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
    });
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
    return apiFetch<SessionStatus>(`/api/session/${sessionId}/status`);
}

export async function getKnowledgeGraph(sessionId: string): Promise<KnowledgeGraphData> {
    return apiFetch<KnowledgeGraphData>(`/api/session/${sessionId}/graph`);
}

export async function getMasteryMatrix(sessionId: string): Promise<MasteryMatrixData> {
    return apiFetch<MasteryMatrixData>(`/api/session/${sessionId}/mastery-matrix`);
}

export async function getConceptDetail(sessionId: string, conceptId: string): Promise<ConceptDetail> {
    return apiFetch<ConceptDetail>(`/api/session/${sessionId}/concept/${conceptId}`);
}

export async function checkApiHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/api/health`);
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

    const res = await fetch(`${API_BASE}/api/pipeline/process`, {
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
    return apiFetch<PipelineJobStatus>(`/api/pipeline/jobs/${jobId}`);
}

export async function createSessionFromPipeline(
    jobId: string,
    maxSteps: number = 50,
): Promise<PipelineSessionResponse> {
    return apiFetch<PipelineSessionResponse>(
        `/api/pipeline/jobs/${jobId}/create-session?max_steps=${maxSteps}`,
        { method: 'POST' },
    );
}

export async function checkPipelineAvailable(): Promise<boolean> {
    try {
        const res = await apiFetch<{ available: boolean }>('/api/pipeline/status');
        return res.available;
    } catch {
        return false;
    }
}

// --- MongoDB History API ---

export async function getSessionHistory(limit = 50): Promise<SessionHistoryItem[]> {
    const res = await apiFetch<{ sessions: SessionHistoryItem[]; count: number }>(
        `/api/history/sessions?limit=${limit}`
    );
    return res.sessions;
}

export async function getSessionHistoryDetail(sessionId: string): Promise<SessionHistoryDetail> {
    return apiFetch<SessionHistoryDetail>(`/api/history/sessions/${sessionId}`);
}

export async function getPipelineJobHistory(limit = 20): Promise<PipelineJobHistoryItem[]> {
    const res = await apiFetch<{ jobs: PipelineJobHistoryItem[]; count: number }>(
        `/api/history/pipeline-jobs?limit=${limit}`
    );
    return res.jobs;
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
    const res = await apiFetch<{ subjects: PipelineJobHistoryItem[]; count: number }>(
        '/api/history/subjects'
    );
    return res.subjects;
}

export async function deleteSubject(
    jobId: string,
    deleteSessions: boolean = true,
): Promise<DeleteSubjectResponse> {
    return apiFetch<DeleteSubjectResponse>(
        `/api/history/subjects/${jobId}?delete_sessions=${deleteSessions ? 'true' : 'false'}`,
        { method: 'DELETE' },
    );
}
