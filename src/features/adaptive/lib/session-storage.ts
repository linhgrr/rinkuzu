import { z } from 'zod';
import type { Exercise, SubmitResult } from '@/features/adaptive/types/learning';

const OUTCOME_KEY_PREFIX = 'al_session_outcome:v1';
const SESSION_JOB_MAP_KEY = 'al_session_job_map:v1';
const ACTIVE_SESSION_ID_KEY = 'al_session_id';
const PIPELINE_JOB_ID_KEY = 'al_pipeline_job_id';
const PIPELINE_FILENAME_KEY = 'al_pipeline_filename';
const PIPELINE_SUBJECT_NAME_KEY = 'al_pipeline_subject_name';

const bloomLabelSchema = z.enum([
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
]);

const exerciseTypeSchema = z.enum([
  'mcq',
  'true_false',
  'fill_blank',
  'multi_correct',
  'ordering',
  'matching',
  'short_answer',
]);

const correctAnswerSchema = z
  .union([z.string(), z.array(z.string()), z.boolean(), z.record(z.string(), z.string()), z.null()])
  .optional();

const exerciseSchema = z
  .object({
    id: z.string().min(1),
    exercise_id: z.string().min(1),
    concept_name: z.string(),
    concept_idx: z.number().int().min(0),
    bloom_level: z.number().int().min(1).max(6),
    bloom_label: bloomLabelSchema,
    exercise_type: exerciseTypeSchema,
    question: z.string(),
    sentence: z.string().nullable().optional(),
    options: z.record(z.string(), z.string()),
    statement: z.string().nullable().optional(),
    hint: z.string().nullable().optional(),
    items: z.array(z.string()),
    pairs: z.array(z.object({ left: z.string(), right: z.string() }).strict()),
    right_items: z.array(z.string()),
    rubric: z.array(z.string()).optional(),
    correct_answer: correctAnswerSchema,
    step: z.number().int().min(0),
    max_steps: z.number().int().min(1),
    theory: z
      .object({
        content: z.string(),
        examples: z.array(z.string()),
      })
      .strict()
      .nullable()
      .optional(),
    recommendation_reason: z
      .object({
        concept_name: z.string(),
        bloom_level: z.number().int().min(1).max(6),
        bloom_label: bloomLabelSchema,
        satisfied_prereqs: z.array(z.object({ name: z.string(), mastery: z.number() }).strict()),
        current_mastery: z.number(),
        next_milestone: z.number(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

const submitResultSchema = z
  .object({
    is_correct: z.boolean(),
    correct_option: z.string(),
    explanation: z.string(),
    concept_name: z.string(),
    bloom_level: z.number().int().min(1).max(6),
    mastery_after: z.number(),
    avg_mastery: z.number(),
    step: z.number().int().min(0),
    session_completed: z.boolean(),
    stats: z
      .object({
        total_correct: z.number().int().min(0),
        total_answered: z.number().int().min(0),
        accuracy: z.number(),
      })
      .strict(),
  })
  .strict();

const sessionOutcomeSchema = z
  .object({
    version: z.literal(1),
    result: submitResultSchema,
    exercise: exerciseSchema,
  })
  .strict();

const sessionJobMapSchema = z.record(
  z.string().min(1),
  z
    .object({
      jobId: z.string().min(1),
      updatedAt: z.number().int().nonnegative(),
    })
    .strict(),
);

type SessionJobMap = z.infer<typeof sessionJobMapSchema>;

export type SelectedPipelineJob = {
  jobId: string;
  filename: string;
  subjectName: string;
};

function getOutcomeKey(sessionId: string): string {
  return `${OUTCOME_KEY_PREFIX}:${sessionId}`;
}

function readSessionJobMap(): SessionJobMap {
  const value = localStorage.getItem(SESSION_JOB_MAP_KEY);
  if (value === null) return {};

  try {
    const parsed = sessionJobMapSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid JSON is handled by removing the corrupt cache below.
  }

  localStorage.removeItem(SESSION_JOB_MAP_KEY);
  return {};
}

function writeSessionJobMap(map: SessionJobMap): void {
  localStorage.setItem(SESSION_JOB_MAP_KEY, JSON.stringify(map));
}

export function saveSessionJobMapping(sessionId: string, jobId: string): void {
  const map = readSessionJobMap();
  map[sessionId] = {
    jobId,
    updatedAt: Date.now(),
  };

  const entries = Object.entries(map)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, 30);

  writeSessionJobMap(Object.fromEntries(entries));
}

export function getJobIdForSession(sessionId: string): string | null {
  const entry = readSessionJobMap()[sessionId];
  return entry ? entry.jobId : null;
}

export function saveActiveSessionId(sessionId: string): void {
  localStorage.setItem(ACTIVE_SESSION_ID_KEY, sessionId);
}

export function saveSelectedPipelineJob(selection: SelectedPipelineJob): void {
  localStorage.setItem(PIPELINE_JOB_ID_KEY, selection.jobId);
  localStorage.setItem(PIPELINE_FILENAME_KEY, selection.filename);
  localStorage.setItem(PIPELINE_SUBJECT_NAME_KEY, selection.subjectName);
}

export function getSelectedPipelineJobId(): string | null {
  return localStorage.getItem(PIPELINE_JOB_ID_KEY);
}

export function getSelectedPipelineFilename(defaultFilename: string): string {
  return localStorage.getItem(PIPELINE_FILENAME_KEY) || defaultFilename;
}

export function getSelectedPipelineTitle(defaultTitle: string): string {
  return (
    localStorage.getItem(PIPELINE_SUBJECT_NAME_KEY) ||
    localStorage.getItem(PIPELINE_FILENAME_KEY) ||
    defaultTitle
  );
}

export function clearSelectedPipelineJob(expectedJobId?: string): void {
  if (expectedJobId && localStorage.getItem(PIPELINE_JOB_ID_KEY) !== expectedJobId) return;

  localStorage.removeItem(PIPELINE_JOB_ID_KEY);
  localStorage.removeItem(PIPELINE_FILENAME_KEY);
  localStorage.removeItem(PIPELINE_SUBJECT_NAME_KEY);
}

export function saveSessionExerciseOutcome(
  sessionId: string,
  payload: { result: SubmitResult; exercise: Exercise },
): void {
  localStorage.setItem(getOutcomeKey(sessionId), JSON.stringify({ version: 1, ...payload }));
}

export function getSessionExerciseOutcome(
  sessionId: string,
): { result: SubmitResult; exercise: Exercise } | null {
  const key = getOutcomeKey(sessionId);
  const value = localStorage.getItem(key);
  if (value === null) return null;

  try {
    const parsed = sessionOutcomeSchema.safeParse(JSON.parse(value));
    if (parsed.success) {
      return {
        result: parsed.data.result,
        exercise: parsed.data.exercise,
      };
    }
  } catch {
    // Invalid JSON is handled by removing the corrupt cache below.
  }

  localStorage.removeItem(key);
  return null;
}
