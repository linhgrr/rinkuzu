import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPipelineJob,
  checkApiHealth,
  createSessionFromPipeline,
  deleteSubject,
  getConceptDetail,
  getKnowledgeGraph,
  getLearningStep,
  getMasteryMatrix,
  getPipelineJobStatus,
  getSessionStatus,
  getSubjectHistoryDetail,
  getSubjectHistoryDetailFresh,
  getSubjectProgressHistory,
  getSubjects,
  getSubjectsFresh,
  listPipelineJobs,
  prefetchStartLearningData,
  retryPipelineJob,
  submitAnswer,
  uploadPdf,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import {
  PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  PIPELINE_PROCESS_TIMEOUT_MS,
  PIPELINE_STATUS_TIMEOUT_MS,
  PRESIGNED_URL_TIMEOUT_MS,
  OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
} from '@/features/adaptive/lib/adaptive-api-fetch';
import type {
  Exercise,
  SubmitAnswerPayload,
  SubmitAnswerRequest,
} from '@/features/adaptive/types/learning';

function okJson(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseConcept = {
  concept_name: 'Concept 1',
  concept_idx: 0,
  bloom_level: 1,
  bloom_label: 'Remember' as const,
  step: 0,
  max_steps: 5,
};

function baseExercise(overrides: Record<string, unknown>) {
  return {
    exercise_id: 'ex-1',
    concept_name: 'Concept 1',
    concept_idx: 0,
    bloom_level: 1,
    bloom_label: 'Remember',
    question: 'Question?',
    step: 0,
    max_steps: 5,
    ...overrides,
  };
}

function learningStepPayload(exercise: Record<string, unknown>, theory: unknown = null) {
  return {
    concept: baseConcept,
    theory,
    exercise,
    cache_status: 'hit' as const,
  };
}

describe('adaptive-api-methods mutation coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('learning step exercise normalization', () => {
    it.each([
      {
        name: 'true_false',
        exercise: baseExercise({
          exercise_type: 'true_false',
          statement: 'Sky is blue',
        }),
        assert: (exercise: Exercise) => {
          expect(exercise).toMatchObject({
            exercise_type: 'true_false',
            statement: 'Sky is blue',
            id: 'ex-1',
            options: {},
          });
        },
      },
      {
        name: 'fill_blank',
        exercise: baseExercise({
          exercise_type: 'fill_blank',
          sentence: 'Hello ___',
          hint: 'world',
        }),
        assert: (exercise: Exercise) => {
          expect(exercise).toMatchObject({
            exercise_type: 'fill_blank',
            sentence: 'Hello ___',
            hint: 'world',
          });
        },
      },
      {
        name: 'multi_correct',
        exercise: baseExercise({
          exercise_type: 'multi_correct',
          options: { A: 'One', B: 'Two' },
        }),
        assert: (exercise: Exercise) => {
          expect(exercise).toMatchObject({
            exercise_type: 'multi_correct',
            options: { A: 'One', B: 'Two' },
          });
        },
      },
      {
        name: 'matching',
        exercise: baseExercise({
          exercise_type: 'matching',
          pairs: [
            { left: 'A', right: '1' },
            { left: 'B', right: '2' },
          ],
          right_items: ['1', '2'],
        }),
        assert: (exercise: Exercise) => {
          expect(exercise).toMatchObject({
            exercise_type: 'matching',
            pairs: [
              { left: 'A', right: '1' },
              { left: 'B', right: '2' },
            ],
            right_items: ['1', '2'],
          });
        },
      },
      {
        name: 'short_answer',
        exercise: baseExercise({
          exercise_type: 'short_answer',
          rubric: ['mentions X', 'mentions Y'],
        }),
        assert: (exercise: Exercise) => {
          expect(exercise).toMatchObject({
            exercise_type: 'short_answer',
            rubric: ['mentions X', 'mentions Y'],
          });
        },
      },
      {
        name: 'ordering',
        exercise: baseExercise({
          exercise_type: 'ordering',
          items: ['first', 'second'],
        }),
        assert: (exercise: Exercise) => {
          expect(exercise).toMatchObject({
            exercise_type: 'ordering',
            items: ['first', 'second'],
          });
        },
      },
    ])('normalizes $name exercises from getLearningStep', async ({ exercise, assert }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(learningStepPayload(exercise))));
      const step = await getLearningStep('session-types');
      assert(step.exercise);
      expect(step.theory).toBeNull();
      expect(step.cache_status).toBe('hit');
      expect(step.concept.bloom_level).toBe(1);
      expect(step.concept.bloom_label).toBe('Remember');
    });

    it('preserves theory and recommendation_reason when present', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson(
            learningStepPayload(
              baseExercise({
                exercise_type: 'mcq',
                options: { A: 'Yes' },
                recommendation_reason: {
                  bloom_label: 'Apply',
                  reason: 'practice',
                },
              }),
              { title: 'Theory', content: 'Body' },
            ),
          ),
        ),
      );

      const step = await getLearningStep('session-theory');
      expect(step.theory).toEqual({ title: 'Theory', content: 'Body' });
      expect(step.exercise.recommendation_reason).toMatchObject({
        bloom_label: 'Apply',
        reason: 'practice',
        satisfied_prereqs: [],
      });
    });

    it('rejects unsupported exercise type, bloom label, and concept status', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            okJson(
              learningStepPayload(
                baseExercise({ exercise_type: 'unknown_type', options: { A: 'x' } }),
              ),
            ),
          )
          .mockResolvedValueOnce(
            okJson(
              learningStepPayload(
                baseExercise({
                  exercise_type: 'mcq',
                  options: { A: 'x' },
                  bloom_label: 'NotALabel',
                }),
              ),
            ),
          )
          .mockResolvedValueOnce(
            okJson({
              nodes: [
                {
                  id: 'c1',
                  index: 0,
                  name: 'C',
                  mastery: 0,
                  status: 'ghost',
                  visited: false,
                },
              ],
              edges: [],
            }),
          ),
      );

      await expect(getLearningStep('s1')).rejects.toMatchObject({
        code: 'upstream_invalid_envelope',
        message: 'Unsupported adaptive exercise type: unknown_type',
        retryable: true,
      });
      await expect(getLearningStep('s2')).rejects.toMatchObject({
        message: 'Unsupported Bloom label: NotALabel',
        code: 'upstream_invalid_envelope',
      });
      await expect(getKnowledgeGraph('s3')).rejects.toMatchObject({
        message: 'Unsupported adaptive concept status: ghost',
        code: 'upstream_invalid_envelope',
      });
    });

    it('rejects invalid bloom levels outside 1..6', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson(
            learningStepPayload(
              baseExercise({
                exercise_type: 'mcq',
                options: { A: 'x' },
                bloom_level: 0,
              }),
            ),
          ),
        ),
      );

      await expect(getLearningStep('s-bloom')).rejects.toThrow('Unsupported Bloom level: 0');
    });

    it('requires type-specific fields and rejects non-string options/items/pairs', async () => {
      const cases = [
        {
          exercise: baseExercise({ exercise_type: 'true_false' }),
          message: 'Missing statement for true_false exercise',
        },
        {
          exercise: baseExercise({ exercise_type: 'fill_blank', sentence: 'x' }),
          message: 'Missing hint for fill_blank exercise',
        },
        {
          exercise: baseExercise({
            exercise_type: 'mcq',
            options: { A: 1 },
          }),
          message: 'Missing options for mcq exercise',
        },
        {
          exercise: baseExercise({
            exercise_type: 'matching',
            pairs: [{ left: 'A', right: 2 }],
            right_items: ['2'],
          }),
          message: 'Missing pairs for matching exercise',
        },
        {
          exercise: baseExercise({
            exercise_type: 'short_answer',
            rubric: [1, 2],
          }),
          message: 'Missing rubric for short_answer exercise',
        },
      ];

      const spy = vi.fn();
      for (const c of cases) {
        spy.mockResolvedValueOnce(
          okJson(learningStepPayload(c.exercise as Record<string, unknown>)),
        );
      }
      vi.stubGlobal('fetch', spy);

      for (const c of cases) {
        await expect(getLearningStep('validate')).rejects.toThrow(c.message);
      }
    });
  });

  describe('submit, session, graph, mastery, concept, health', () => {
    it('submitAnswer wraps bare payload and normalizes stats numbers', async () => {
      const spy = vi.fn().mockResolvedValue(
        okJson({
          concept_name: 'C',
          is_correct: true,
          feedback: 'good',
          stats: { total_correct: 2, total_answered: 4, accuracy: 0.5 },
        }),
      );
      vi.stubGlobal('fetch', spy);

      const barePayload: SubmitAnswerPayload = { choice: 'A' };
      const bare = await submitAnswer('sess-1', barePayload);
      expect(bare.stats).toEqual({ total_correct: 2, total_answered: 4, accuracy: 0.5 });
      expect(JSON.parse(String(spy.mock.calls[0]?.[1]?.body))).toEqual({
        answer: { choice: 'A' },
      });
      expect(spy.mock.calls[0]?.[0]).toBe('/api/adaptive/session/sess-1/submit');
      expect(spy.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });

      spy.mockResolvedValueOnce(
        okJson({
          concept_name: 'C',
          is_correct: false,
          feedback: 'no',
          stats: { total_correct: 1, total_answered: 2, accuracy: 0.5 },
        }),
      );
      const wrappedRequest: SubmitAnswerRequest = {
        exercise_id: 'ex-1',
        idempotency_key: 'idem-1',
        answer: { choice: 'B' },
      };
      const wrapped = await submitAnswer('sess-1', wrappedRequest);
      expect(JSON.parse(String(spy.mock.calls[1]?.[1]?.body))).toEqual(wrappedRequest);
      expect(wrapped.is_correct).toBe(false);
    });

    it('rejects submit results with non-finite stats', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson({
            concept_name: 'C',
            is_correct: true,
            feedback: 'x',
            stats: { total_correct: 'x', total_answered: 1, accuracy: 1 },
          }),
        ),
      );

      const invalidStatsRequest: SubmitAnswerRequest = {
        exercise_id: 'ex-1',
        idempotency_key: 'idem-2',
        answer: { choice: 'A' },
      };
      await expect(submitAnswer('s', invalidStatsRequest)).rejects.toMatchObject({
        message: 'Invalid adaptive response field: total_correct',
        code: 'upstream_invalid_envelope',
        retryable: true,
      });
    });

    it('reads session status, mastery matrix, and concept detail with cache TTL options', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(okJson({ session_id: 's1', status: 'active' }))
        .mockResolvedValueOnce(okJson({ rows: [], columns: [] }))
        .mockResolvedValueOnce(
          okJson({
            id: 'c1',
            index: 0,
            name: 'Concept',
            mastery: 0.2,
            status: 'in_progress',
            visited: true,
          }),
        );
      vi.stubGlobal('fetch', spy);

      await expect(getSessionStatus('s1')).resolves.toEqual({ session_id: 's1', status: 'active' });
      await expect(getMasteryMatrix('s1')).resolves.toEqual({ rows: [], columns: [] });
      await expect(getConceptDetail('s1', 'c1')).resolves.toMatchObject({
        id: 'c1',
        status: 'in_progress',
      });

      expect(spy.mock.calls[0]?.[0]).toBe('/api/adaptive/session/s1/status');
      expect(spy.mock.calls[1]?.[0]).toBe('/api/adaptive/session/s1/mastery-matrix');
      expect(spy.mock.calls[2]?.[0]).toBe('/api/adaptive/session/s1/concept/c1');
    });

    it('checkApiHealth returns ready flag and false on failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(okJson({ ready: true }))
          .mockResolvedValueOnce(okJson({ ready: false }))
          .mockRejectedValueOnce(new Error('down')),
      );

      await expect(checkApiHealth()).resolves.toBe(true);
      await expect(checkApiHealth()).resolves.toBe(false);
      await expect(checkApiHealth()).resolves.toBe(false);
    });
  });

  describe('pipeline upload and job lifecycle', () => {
    it('uploadPdf uses default batch size, adaptive purpose, and timeouts', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(okJson({ uploadUrl: 'https://storage.test/u', s3Key: 'key-1' }))
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

      const file = new File(['%PDF'], 'notes.pdf', { type: '' });
      const result = await uploadPdf(file);
      expect(result.job_id).toBe('job-1');

      expect(spy.mock.calls[0]?.[0]).toBe('/api/storage/presigned-url');
      expect(JSON.parse(String(spy.mock.calls[0]?.[1]?.body))).toEqual({
        fileName: 'notes.pdf',
        contentType: 'application/pdf',
        fileSize: file.size,
        purpose: 'adaptive',
      });

      expect(spy.mock.calls[1]?.[0]).toBe('https://storage.test/u');
      expect(spy.mock.calls[1]?.[1]).toMatchObject({
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
      });

      expect(spy.mock.calls[2]?.[0]).toBe('/api/adaptive/pipeline/process');
      expect(JSON.parse(String(spy.mock.calls[2]?.[1]?.body))).toEqual({
        s3Key: 'key-1',
        filename: 'notes.pdf',
        subject_id: undefined,
        page_batch_size: DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
      });
      expect(PRESIGNED_URL_TIMEOUT_MS).toBe(30_000);
      expect(OBJECT_STORAGE_UPLOAD_TIMEOUT_MS).toBe(180_000);
      expect(PIPELINE_PROCESS_TIMEOUT_MS).toBe(180_000);
    });

    it('uploadPdf rejects incomplete presigned responses and failed S3 uploads', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(okJson({ uploadUrl: '', s3Key: 'k' }))
          .mockResolvedValueOnce(okJson({ uploadUrl: 'https://storage.test/u', s3Key: 'k2' }))
          .mockResolvedValueOnce(new Response(null, { status: 503 })),
      );

      await expect(
        uploadPdf(new File(['x'], 'a.pdf', { type: 'application/pdf' })),
      ).rejects.toMatchObject({
        code: 'upstream_invalid_envelope',
        message: 'Invalid presigned URL response',
      });

      await expect(
        uploadPdf(new File(['x'], 'b.pdf', { type: 'application/pdf' }), 'subj', 5),
      ).rejects.toMatchObject({
        code: 'upstream_error',
        message: 'Failed to upload file to S3',
        status: 503,
        retryable: true,
      });
    });

    it('marks non-5xx S3 failures as non-retryable', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(okJson({ uploadUrl: 'https://storage.test/u', s3Key: 'k' }))
          .mockResolvedValueOnce(new Response(null, { status: 403 })),
      );

      await expect(
        uploadPdf(new File(['x'], 'c.pdf', { type: 'application/pdf' })),
      ).rejects.toMatchObject({
        status: 403,
        retryable: false,
      });
    });

    it('getPipelineJobStatus and createSessionFromPipeline use exact URLs and timeouts', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(okJson({ job_id: 'j1', status: 'running' }))
        .mockResolvedValueOnce(okJson({ job_id: 'j1', status: 'running', debug: {} }))
        .mockResolvedValueOnce(okJson({ session_id: 's1' }))
        .mockResolvedValueOnce(okJson({ session_id: 's2' }));
      vi.stubGlobal('fetch', spy);

      await getPipelineJobStatus('j1');
      await getPipelineJobStatus('j1', { includeDebug: true });
      await createSessionFromPipeline('j1');
      await createSessionFromPipeline('j1', 12);

      expect(spy.mock.calls[0]?.[0]).toBe('/api/adaptive/pipeline/jobs/j1');
      expect(spy.mock.calls[1]?.[0]).toBe('/api/adaptive/pipeline/jobs/j1?include_debug=true');
      expect(spy.mock.calls[2]?.[0]).toBe(
        '/api/adaptive/pipeline/jobs/j1/create-session?max_steps=9999',
      );
      expect(spy.mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
      expect(spy.mock.calls[3]?.[0]).toBe(
        '/api/adaptive/pipeline/jobs/j1/create-session?max_steps=12',
      );
      expect(PIPELINE_STATUS_TIMEOUT_MS).toBe(25_000);
      expect(PIPELINE_CREATE_SESSION_TIMEOUT_MS).toBe(30_000);
    });

    it('listPipelineJobs returns jobs, empty list on zero count, and rejects missing jobs', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(okJson({ jobs: [{ job_id: 'a' }], count: 1 }))
          .mockResolvedValueOnce(okJson({ count: 0 }))
          .mockResolvedValueOnce(okJson({ count: 2 })),
      );

      await expect(listPipelineJobs(10)).resolves.toEqual([{ job_id: 'a' }]);
      await expect(listPipelineJobs()).resolves.toEqual([]);
      await expect(listPipelineJobs()).rejects.toMatchObject({
        message: 'Pipeline job list omitted jobs despite a non-zero count',
        code: 'upstream_invalid_envelope',
      });
    });

    it('retry and cancel pipeline jobs POST to lifecycle endpoints', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(okJson({ job_id: 'j', status: 'queued', retry_count: 1 }))
        .mockResolvedValueOnce(okJson({ job_id: 'j', status: 'cancelling' }));
      vi.stubGlobal('fetch', spy);

      await retryPipelineJob('j');
      await cancelPipelineJob('j');
      expect(spy.mock.calls[0]?.[0]).toBe('/api/adaptive/pipeline/jobs/j/retry');
      expect(spy.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
      expect(spy.mock.calls[1]?.[0]).toBe('/api/adaptive/pipeline/jobs/j/cancel');
      expect(spy.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    });
  });

  describe('history, subjects, delete, prefetch', () => {
    it('maps subject progress history and defaults limit to 50', async () => {
      const spy = vi.fn().mockResolvedValue(
        okJson({
          subjects: [
            {
              job_id: 'job-1',
              subject_id: 'sub-1',
              filename: 'a.pdf',
              status: 'active',
              progress_percent: 40,
              mastered_concept: 1,
              all_concept: 4,
              unlocked_concept: 2,
              locked_concept: 2,
            },
          ],
        }),
      );
      vi.stubGlobal('fetch', spy);

      await expect(getSubjectProgressHistory()).resolves.toEqual([
        expect.objectContaining({ job_id: 'job-1', status: 'active' }),
      ]);
      expect(spy.mock.calls[0]?.[0]).toBe('/api/adaptive/history/subjects/progress?limit=50');
    });

    it('normalizes subject history exercise payloads for every exercise type', async () => {
      const historyBase = {
        exercise_id: 'e1',
        concept_name: 'C',
        concept_idx: 0,
        bloom_level: 2,
        bloom_label: 'Understand',
        question: 'Q?',
        step: 1,
        max_steps: 3,
        is_correct: true,
        timestamp: 100,
        user_answer: 'x',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson({
            job_id: 'job-hist',
            filename: 'f.pdf',
            subject_id: 's',
            status: 'completed',
            concepts_extracted: 1,
            concepts_after_merge: 1,
            relations_accepted: 0,
            relations_llm_verified: 0,
            relations_deterministic_unverified: 0,
            completed_at: 1,
            mastered_concept: 1,
            all_concept: 1,
            unlocked_concept: 1,
            locked_concept: 0,
            progress_percent: 100,
            exercise_history: [
              {
                ...historyBase,
                exercise_id: ' mcq-1 ',
                payload: {
                  exercise_type: 'mcq',
                  options: { A: 'a' },
                  correct_option: 'A',
                },
              },
              {
                ...historyBase,
                exercise_id: 'tf-1',
                payload: {
                  exercise_type: 'true_false',
                  statement: 'S',
                  correct_answer: true,
                },
              },
              {
                ...historyBase,
                exercise_id: 'fb-1',
                payload: {
                  exercise_type: 'fill_blank',
                  sentence: 'Hi ___',
                  hint: 'h',
                  blank_answers: ['world'],
                },
              },
              {
                ...historyBase,
                exercise_id: 'mc-1',
                payload: {
                  exercise_type: 'multi_correct',
                  options: { A: 'a', B: 'b' },
                  correct_options: ['A', 'B'],
                },
              },
              {
                ...historyBase,
                exercise_id: 'ord-1',
                payload: {
                  exercise_type: 'ordering',
                  correct_order: ['1', '2'],
                },
              },
              {
                ...historyBase,
                exercise_id: 'mat-1',
                payload: {
                  exercise_type: 'matching',
                  pairs: [{ left: 'L', right: 'R' }],
                },
              },
              {
                ...historyBase,
                exercise_id: 'sa-1',
                payload: {
                  exercise_type: 'short_answer',
                  rubric: ['r1'],
                  sample_answer: 'sample',
                },
              },
            ],
            created_at: 1,
            updated_at: 2,
            last_session_id: 'sess',
          }),
        ),
      );

      const detail = await getSubjectHistoryDetail('job-hist');
      expect(detail.exercise_history).toHaveLength(7);
      expect(detail.exercise_history[0]).toMatchObject({
        exercise_id: 'mcq-1',
        exercise_type: 'mcq',
        correct_option: 'A',
        options: { A: 'a' },
      });
      expect(detail.exercise_history[1]).toMatchObject({
        exercise_type: 'true_false',
        statement: 'S',
        correct_answer: true,
        correct_option: 'true',
      });
      expect(detail.exercise_history[2]).toMatchObject({
        exercise_type: 'fill_blank',
        sentence: 'Hi ___',
        hint: 'h',
        correct_answer: ['world'],
        correct_option: 'world',
      });
      expect(detail.exercise_history[3]).toMatchObject({
        exercise_type: 'multi_correct',
        correct_answer: ['A', 'B'],
        correct_option: 'A, B',
      });
      expect(detail.exercise_history[4]).toMatchObject({
        exercise_type: 'ordering',
        items: ['1', '2'],
        correct_option: '1\n2',
      });
      expect(detail.exercise_history[5]).toMatchObject({
        exercise_type: 'matching',
        pairs: [{ left: 'L', right: 'R' }],
        right_items: ['R'],
        correct_answer: { L: 'R' },
        correct_option: 'L → R',
      });
      expect(detail.exercise_history[6]).toMatchObject({
        exercise_type: 'short_answer',
        rubric: ['r1'],
        correct_answer: 'sample',
        correct_option: 'sample',
      });
    });

    it.each([
      {
        exerciseIds: ['', 'valid-id'],
        expectedMessage: 'Missing exercise_id',
        expectedDetail: 'subject exercise_history[0]',
      },
      {
        exerciseIds: ['duplicate-id', 'duplicate-id'],
        expectedMessage: 'Duplicate exercise_id',
        expectedDetail: 'subject exercise_history[1]',
      },
    ])(
      'rejects invalid history row identity: $expectedMessage',
      async ({ exerciseIds, expectedMessage, expectedDetail }) => {
        const exercise = (exerciseId: string) => ({
          exercise_id: exerciseId,
          concept_name: 'Concept',
          concept_idx: 0,
          bloom_level: 1,
          question: 'Question?',
          explanation: 'Explanation',
          payload: { exercise_type: 'mcq', options: { A: 'Answer' }, correct_option: 'A' },
          explanation_correct: 'Correct',
          explanation_incorrect: 'Incorrect',
          theory: null,
          is_correct: true,
          timestamp: 100,
          user_answer: 'A',
        });
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            okJson({
              job_id: 'job-invalid-history',
              filename: 'history.pdf',
              subject_id: 'subject-1',
              status: 'active',
              total_correct: 2,
              total_answered: 2,
              accuracy: 1,
              step: 2,
              max_steps: 10,
              avg_mastery: 0.5,
              unlocked_concepts: 1,
              locked_concepts: 0,
              mastered_concepts: 0,
              progress_percent: 20,
              concept_names: { '0': 'Concept' },
              concept_mastery: [0.5],
              bloom_mastery: [[0.5]],
              exercise_history: exerciseIds.map(exercise),
              created_at: 1,
              updated_at: 2,
              last_session_id: 'session-1',
            }),
          ),
        );

        await expect(getSubjectHistoryDetailFresh('job-invalid-history')).rejects.toMatchObject({
          code: 'upstream_invalid_envelope',
          message: expect.stringContaining(expectedMessage),
          detail: expectedDetail,
        });
      },
    );

    it('getSubjectHistoryDetailFresh and getSubjectsFresh bypass cache', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(
          okJson({
            job_id: 'j',
            filename: 'f.pdf',
            subject_id: 's',
            status: 'completed',
            concepts_extracted: 0,
            concepts_after_merge: 0,
            relations_accepted: 0,
            relations_llm_verified: 0,
            relations_deterministic_unverified: 0,
            completed_at: 1,
            mastered_concept: 0,
            all_concept: 0,
            unlocked_concept: 0,
            locked_concept: 0,
            progress_percent: 0,
            exercise_history: [],
            created_at: 1,
            updated_at: 1,
            last_session_id: 's',
          }),
        )
        .mockResolvedValueOnce(okJson({ subjects: [], count: 0 }));
      vi.stubGlobal('fetch', spy);

      await getSubjectHistoryDetailFresh('j');
      await getSubjectsFresh();
      expect(spy.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store', method: 'GET' });
      expect(spy.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-store', method: 'GET' });
    });

    it('deleteSubject encodes delete_sessions query for true and false defaults', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(okJson({ deleted: true }))
        .mockResolvedValueOnce(okJson({ deleted: true }));
      vi.stubGlobal('fetch', spy);

      await deleteSubject('job-1');
      await deleteSubject('job-2', false);

      expect(spy.mock.calls[0]?.[0]).toBe(
        '/api/adaptive/history/subjects/job-1?delete_sessions=true',
      );
      expect(spy.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
      expect(spy.mock.calls[1]?.[0]).toBe(
        '/api/adaptive/history/subjects/job-2?delete_sessions=false',
      );
    });

    it('getSubjects maps subject list through pipeline history mapper', async () => {
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
                relations_accepted: 1,
                relations_llm_verified: 1,
                relations_deterministic_unverified: 0,
                completed_at: 10,
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

    it('prefetchStartLearningData settles both status and step fetches', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(okJson({ session_id: 's', status: 'active' }))
        .mockResolvedValueOnce(
          okJson(learningStepPayload(baseExercise({ exercise_type: 'mcq', options: { A: 'a' } }))),
        );
      vi.stubGlobal('fetch', spy);

      await expect(prefetchStartLearningData('s-pre')).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalled();
      const urls = spy.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes('/status'))).toBe(true);
      expect(urls.some((url) => url.includes('/step'))).toBe(true);
    });

    it('surfaces AdaptiveApiError instances from failed method calls', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ success: false, error: { code: 'not_found', message: 'missing' } }),
            {
              status: 404,
            },
          ),
        ),
      );

      await expect(getSessionStatus('missing')).rejects.toBeInstanceOf(AdaptiveApiError);
    });
  });
});
