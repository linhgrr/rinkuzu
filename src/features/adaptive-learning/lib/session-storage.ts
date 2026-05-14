import type { Exercise, SubmitResult } from '@/features/adaptive-learning/types';

const RESULT_KEY_PREFIX = 'al_session_result';
const EXERCISE_KEY_PREFIX = 'al_session_exercise';
const SESSION_JOB_MAP_KEY = 'al_session_job_map';

function getResultKey(sessionId: string): string {
  return `${RESULT_KEY_PREFIX}:${sessionId}`;
}

function getExerciseKey(sessionId: string): string {
  return `${EXERCISE_KEY_PREFIX}:${sessionId}`;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type SessionJobMap = Record<string, { jobId: string; updatedAt: number }>;

function readSessionJobMap(): SessionJobMap {
  return parseJson<SessionJobMap>(localStorage.getItem(SESSION_JOB_MAP_KEY)) || {};
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

  // Keep storage bounded to most recent 30 sessions.
  const entries = Object.entries(map)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, 30);

  writeSessionJobMap(Object.fromEntries(entries));
}

export function getJobIdForSession(sessionId: string): string | null {
  const map = readSessionJobMap();
  return map[sessionId]?.jobId || null;
}

export function saveSessionExerciseOutcome(
  sessionId: string,
  payload: { result: SubmitResult; exercise: Exercise },
): void {
  localStorage.setItem(getResultKey(sessionId), JSON.stringify(payload.result));
  localStorage.setItem(getExerciseKey(sessionId), JSON.stringify(payload.exercise));
}

export function getSessionExerciseOutcome(
  sessionId: string,
): { result: SubmitResult; exercise: Exercise } | null {
  const result = parseJson<SubmitResult>(localStorage.getItem(getResultKey(sessionId)));
  const exercise = parseJson<Exercise>(localStorage.getItem(getExerciseKey(sessionId)));

  if (!result || !exercise) {
    return null;
  }

  return { result, exercise };
}
