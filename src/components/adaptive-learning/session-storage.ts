import type { Exercise, SubmitResult } from './types';

const RESULT_KEY_PREFIX = 'al_session_result';
const EXERCISE_KEY_PREFIX = 'al_session_exercise';

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

export function saveSessionExerciseOutcome(
    sessionId: string,
    payload: { result: SubmitResult; exercise: Exercise }
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
