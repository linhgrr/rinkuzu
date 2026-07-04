import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listPipelineJobs,
  retryPipelineJob,
  cancelPipelineJob,
  getSubjects,
  getSubjectsFresh,
  getSubjectProgressHistory,
  getSubjectHistoryDetail,
  getExercise,
  getNextConcept,
  getKnowledgeGraph,
  getConceptDetail,
  submitAnswer,
  uploadPdf,
} from '@/features/adaptive/lib/adaptive-api-methods';

function okJson(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('pipeline lifecycle methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listPipelineJobs unwraps {jobs}', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okJson({ jobs: [{ job_id: 'a' }], count: 1 })),
    );

    expect(await listPipelineJobs()).toEqual([{ job_id: 'a' }]);
  });

  it('retryPipelineJob POSTs the retry path', async () => {
    const spy = vi.fn().mockResolvedValue(
      okJson({
        job_id: 'a',
        status: 'queued',
        status_url: '/api/adaptive/pipeline/jobs/a',
        retry_count: 1,
      }),
    );
    vi.stubGlobal('fetch', spy);

    await retryPipelineJob('a');
    expect(spy).toHaveBeenCalledWith(
      '/api/adaptive/pipeline/jobs/a/retry',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('cancelPipelineJob POSTs the cancel path', async () => {
    const spy = vi.fn().mockResolvedValue(okJson({ job_id: 'a', status: 'cancelling' }));
    vi.stubGlobal('fetch', spy);

    await cancelPipelineJob('a');
    expect(spy).toHaveBeenCalledWith(
      '/api/adaptive/pipeline/jobs/a/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uploadPdf requests adaptive storage prefix before processing', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(okJson({ uploadUrl: 'https://storage.test/upload', s3Key: 'k1' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        okJson({
          job_id: 'job-1',
          status: 'queued',
          status_url: '/api/adaptive/pipeline/jobs/job-1',
          message: 'queued',
        }),
      );
    vi.stubGlobal('fetch', spy);

    await uploadPdf(new File(['%PDF-1.7'], 'subject.pdf', { type: 'application/pdf' }), 'Math');

    const presignedRequest = JSON.parse(String(spy.mock.calls[0]?.[1]?.body));
    expect(spy.mock.calls[0]?.[0]).toBe('/api/storage/presigned-url');
    expect(presignedRequest.purpose).toBe('adaptive');
  });

  it('getSubjects normalizes raw subject status to the pipeline status contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          subjects: [
            {
              job_id: 'job-1',
              filename: 'subject.pdf',
              subject_id: 'subject-1',
              status: 'completed',
              concepts_extracted: 3,
              concepts_after_merge: 2,
              relations_verified: 1,
              completed_at: 1_783_000_000,
              mastered_concept: 1,
              all_concept: 2,
              unlocked_concept: 2,
              locked_concept: 0,
              progress_percent: 50,
            },
          ],
          count: 1,
        }),
      ),
    );

    await expect(getSubjects()).resolves.toEqual([
      expect.objectContaining({ job_id: 'job-1', status: 'completed' }),
    ]);
  });

  it('getSubjectsFresh bypasses the cached subject list', async () => {
    const spy = vi.fn().mockResolvedValue(okJson({ subjects: [], count: 0 }));
    vi.stubGlobal('fetch', spy);

    await expect(getSubjectsFresh()).resolves.toEqual([]);

    expect(spy.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('getSubjectProgressHistory accepts active subject progress', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          subjects: [
            {
              job_id: 'job-1',
              filename: 'subject.pdf',
              subject_id: 'subject-1',
              status: 'active',
              total_correct: 0,
              total_answered: 0,
              accuracy: 0,
              avg_mastery: 0,
              unlocked_concepts: 1,
              locked_concepts: 0,
              mastered_concepts: 0,
              progress_percent: 0,
              step: 0,
              max_steps: 50,
              created_at: 1_783_000_000,
              updated_at: 1_783_000_000,
              last_session_id: 'session-1',
            },
          ],
          count: 1,
        }),
      ),
    );

    await expect(getSubjectProgressHistory()).resolves.toEqual([
      expect.objectContaining({ job_id: 'job-1', status: 'active' }),
    ]);
  });

  it('getSubjectProgressHistory rejects unknown progress statuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          subjects: [
            {
              job_id: 'job-1',
              filename: 'subject.pdf',
              subject_id: 'subject-1',
              status: 'surprise',
              total_correct: 0,
              total_answered: 0,
              accuracy: 0,
              avg_mastery: 0,
              unlocked_concepts: 1,
              locked_concepts: 0,
              mastered_concepts: 0,
              progress_percent: 0,
              updated_at: 1_783_000_000,
            },
          ],
          count: 1,
        }),
      ),
    );

    await expect(getSubjectProgressHistory(49)).rejects.toThrow(
      'Unsupported adaptive subject progress status: surprise',
    );
  });

  it('getSubjectHistoryDetail parses exercise history records at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          job_id: 'job-1',
          filename: 'subject.pdf',
          subject_id: 'subject-1',
          status: 'completed',
          total_correct: 1,
          total_answered: 1,
          accuracy: 100,
          step: 1,
          max_steps: 5,
          avg_mastery: 0.5,
          unlocked_concepts: 1,
          locked_concepts: 0,
          mastered_concepts: 0,
          progress_percent: 0,
          concept_names: { c1: 'Concept 1' },
          concept_mastery: [0.5],
          bloom_mastery: [[0.5]],
          exercise_history: [
            {
              exercise_id: 'ex-1',
              concept_idx: 0,
              concept_name: 'Concept 1',
              bloom_level: 1,
              question: 'Question?',
              explanation: 'Because',
              explanation_correct: 'Correct',
              explanation_incorrect: 'Incorrect',
              payload: {
                exercise_type: 'mcq',
                options: { A: 'A1' },
                correct_option: 'A',
              },
              theory: null,
              user_answer: 'A',
              is_correct: true,
              timestamp: 1_783_000_000,
            },
          ],
          created_at: 1_783_000_000,
          updated_at: 1_783_000_001,
          last_session_id: 'session-1',
        }),
      ),
    );

    await expect(getSubjectHistoryDetail('job-1')).resolves.toEqual(
      expect.objectContaining({
        status: 'completed',
        exercise_history: [
          expect.objectContaining({
            exercise_id: 'ex-1',
            question: 'Question?',
            is_correct: true,
          }),
        ],
      }),
    );
  });

  it('getExercise normalizes optional fields only when they are not required by the exercise type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          exercise_id: 'ex-1',
          concept_name: 'Concept 1',
          concept_idx: 0,
          bloom_level: 1,
          bloom_label: 'Remember',
          exercise_type: 'mcq',
          question: 'Question?',
          options: { A: 'Answer A' },
          step: 0,
          max_steps: 5,
        }),
      ),
    );

    await expect(getExercise('session-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'ex-1',
        exercise_type: 'mcq',
        options: { A: 'Answer A' },
        items: [],
        pairs: [],
        right_items: [],
      }),
    );
  });

  it('getExercise rejects an option-based exercise without options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          exercise_id: 'ex-1',
          concept_name: 'Concept 1',
          concept_idx: 0,
          bloom_level: 1,
          bloom_label: 'Remember',
          exercise_type: 'mcq',
          question: 'Question?',
          step: 0,
          max_steps: 5,
        }),
      ),
    );

    await expect(getExercise('session-1')).rejects.toThrow('Missing options for mcq exercise');
  });

  it('getExercise rejects an ordering exercise without items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          exercise_id: 'ex-1',
          concept_name: 'Concept 1',
          concept_idx: 0,
          bloom_level: 3,
          bloom_label: 'Apply',
          exercise_type: 'ordering',
          question: 'Order these',
          step: 0,
          max_steps: 5,
        }),
      ),
    );

    await expect(getExercise('session-1')).rejects.toThrow('Missing items for ordering exercise');
  });

  it('getNextConcept rejects unsupported Bloom metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          concept_name: 'Concept 1',
          concept_idx: 0,
          bloom_level: 7,
          bloom_label: 'Unknown',
          step: 0,
          max_steps: 5,
        }),
      ),
    );

    await expect(getNextConcept('session-1')).rejects.toThrow('Unsupported Bloom level: 7');
  });

  it('getKnowledgeGraph maps generated DTOs to strict concept statuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          nodes: [
            {
              id: 'concept-1',
              index: 0,
              name: 'Concept 1',
              mastery: 0.5,
              status: 'available',
              visited: true,
            },
          ],
          edges: [],
        }),
      ),
    );

    await expect(getKnowledgeGraph('session-1')).resolves.toEqual({
      nodes: [expect.objectContaining({ id: 'concept-1', status: 'available' })],
      edges: [],
    });
  });

  it('getConceptDetail rejects statuses outside the UI domain contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          id: 'concept-1',
          name: 'Concept 1',
          definition: 'Definition',
          mastery: 0.5,
          status: 'unknown',
          bloom_mastery: [],
          prerequisites: [],
          dependents: [],
          visited: true,
          visit_count: 1,
        }),
      ),
    );

    await expect(getConceptDetail('session-1', 'concept-1')).rejects.toThrow(
      'Unsupported adaptive concept status: unknown',
    );
  });

  it('submitAnswer rejects incomplete stats instead of inventing result values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          is_correct: true,
          correct_option: 'A',
          explanation: 'Because',
          concept_name: 'Concept 1',
          bloom_level: 1,
          mastery_after: 0.6,
          avg_mastery: 0.5,
          step: 1,
          session_completed: false,
          stats: {
            total_correct: 1,
            total_answered: 1,
          },
        }),
      ),
    );

    await expect(submitAnswer('session-1', { choice: 'A' })).rejects.toThrow(
      'Invalid adaptive response field: accuracy',
    );
  });

  it('listPipelineJobs rejects a contradictory optional jobs envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ count: 1 })));

    await expect(listPipelineJobs()).rejects.toThrow(
      'Pipeline job list omitted jobs despite a non-zero count',
    );
  });
});
