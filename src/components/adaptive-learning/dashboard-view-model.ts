import type { PipelineJobHistoryItem } from './types'

type TranslateFn = (key: string, values?: Record<string, any>) => string

export type DashboardSubjectMetrics = {
  masteredConcepts: number
  allConcepts: number
  progressPercent: number
  remainingConcepts: number
}

export type DashboardSubject = PipelineJobHistoryItem & {
  displayTitle: string
  lastOpenedLabel: string
  progressLabel: string
  ctaLabel: string
  metrics: DashboardSubjectMetrics
}

const toTimestampMs = (value?: number | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    return null

  return value < 1_000_000_000_000 ? value * 1000 : value
}

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value))
    return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

export const getSubjectMetrics = (job: PipelineJobHistoryItem): DashboardSubjectMetrics => {
  const masteredConcepts = Math.max(0, job.mastered_concept ?? 0)
  const allConcepts = Math.max(0, job.all_concept ?? job.concepts_after_merge ?? 0)

  if (allConcepts > 0) {
    const boundedMastered = Math.min(masteredConcepts, allConcepts)
    return {
      masteredConcepts: boundedMastered,
      allConcepts,
      progressPercent: clampPercent((boundedMastered / allConcepts) * 100),
      remainingConcepts: Math.max(allConcepts - boundedMastered, 0),
    }
  }

  const fallbackProgress = Math.max(0, job.progress_percent ?? 0)

  return {
    masteredConcepts: 0,
    allConcepts: 0,
    progressPercent: clampPercent(fallbackProgress),
    remainingConcepts: 0,
  }
}

const getDisplayTitle = (job: PipelineJobHistoryItem): string => {
  const filenameTitle = job.filename?.replace(/\.[^.]+$/, '')
  return job.subject_id || filenameTitle || job.job_id
}

const formatLastOpenedLabel = (completedAt: number | undefined, locale: string, t: TranslateFn): string => {
  const timestamp = toTimestampMs(completedAt)
  if (!timestamp)
    return t('lastOpenedUnknown')

  const diffMs = Date.now() - timestamp
  if (diffMs < 0)
    return new Date(timestamp).toLocaleDateString(locale)

  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  if (hours < 1)
    return t('openedJustNow')
  if (hours < 24)
    return t('openedHoursAgo', { count: hours })
  if (hours < 48)
    return t('openedYesterday')

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days <= 7)
    return t('openedDaysAgo', { count: days })

  return new Date(timestamp).toLocaleDateString(locale)
}

export const toDashboardSubject = (
  job: PipelineJobHistoryItem,
  locale: string,
  t: TranslateFn,
): DashboardSubject => {
  const metrics = getSubjectMetrics(job)

  return {
    ...job,
    displayTitle: getDisplayTitle(job),
    lastOpenedLabel: formatLastOpenedLabel(job.completed_at, locale, t),
    progressLabel: t('progressLabel'),
    ctaLabel: metrics.progressPercent > 0 ? t('continueLearning') : t('startLearning'),
    metrics,
  }
}
