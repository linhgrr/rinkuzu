/**
 * Query parsing for the public, cacheable `/og` image route. Every value is
 * clamped or validated here, so a crafted URL can only change the card copy
 * within these bounds (RIN-1180).
 */

const MAX_TITLE = 110;
const MAX_EYEBROW = 40;
const DEFAULT_TITLE = 'AI Quiz Generator from PDF · Knowledge-Graph Personalized Learning';
const DEFAULT_EYEBROW = 'rinkuzu.app';
/** 1 to 999, digits only: "abc", "-1", "1.5" and "1000" are ignored. */
const COUNT_PATTERN = /^[1-9]\d{0,2}$/u;

const DETAIL_COPY = {
  vi: { questions: (count: number) => `${count} câu hỏi`, quick: '~3 phút' },
  en: { questions: (count: number) => `${count} questions`, quick: '~3 min' },
} as const;

type OgParams = {
  title: string;
  eyebrow: string;
  /** Line under the title, e.g. "42 câu hỏi · ~3 phút"; null keeps the title-only card. */
  detail: string | null;
};

function clamp(raw: string | null, max: number, fallback: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function parseDetail(searchParams: URLSearchParams): string | null {
  const rawCount = searchParams.get('count');
  if (rawCount === null || !COUNT_PATTERN.test(rawCount)) return null;
  const copy = searchParams.get('lang') === 'en' ? DETAIL_COPY.en : DETAIL_COPY.vi;
  const questions = copy.questions(Number(rawCount));
  return searchParams.get('quick') === '1' ? `${questions} · ${copy.quick}` : questions;
}

export function parseOgParams(searchParams: URLSearchParams): OgParams {
  return {
    title: clamp(searchParams.get('title'), MAX_TITLE, DEFAULT_TITLE),
    eyebrow: clamp(searchParams.get('eyebrow'), MAX_EYEBROW, DEFAULT_EYEBROW),
    detail: parseDetail(searchParams),
  };
}
