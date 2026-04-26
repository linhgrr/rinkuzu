import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  checkApiHealth,
  createSessionFromPipeline,
  deleteSubject,
  getSubjectProgressHistory,
  getSubjects,
} from '../api-client'
import { ADAPTIVE_ROUTES } from '../routes'
import { saveSessionJobMapping } from '../session-storage'
import { getSessionStartFeedback } from '../session-start-feedback'
import type { PipelineJobHistoryItem, SessionHistoryItem } from '../types'

const DAILY_GOAL_TARGET = 3
const ONE_DAY_MS = 24 * 60 * 60 * 1000

type TranslateFn = (key: string, values?: Record<string, any>) => string

type ToastPayload = { title: string; type: 'error' | 'success' } | null

const toTimestampMs = (value: number): number =>
  value < 1_000_000_000_000 ? value * 1000 : value

const getDayStart = (value: number): number => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const calculateLearningStreak = (sessions: SessionHistoryItem[]): number => {
  if (sessions.length === 0)
    return 0

  const dayStarts = Array.from(
    new Set(
      sessions
        .filter(session => session.total_answered > 0)
        .map(session => getDayStart(toTimestampMs(session.updated_at || session.created_at))),
    ),
  ).sort((a, b) => b - a)

  if (dayStarts.length === 0)
    return 0

  let streak = 0
  let expectedDay = getDayStart(Date.now())

  for (const day of dayStarts) {
    if (day === expectedDay) {
      streak += 1
      expectedDay -= ONE_DAY_MS
      continue
    }

    if (streak === 0 && day === expectedDay - ONE_DAY_MS) {
      streak += 1
      expectedDay = day - ONE_DAY_MS
      continue
    }

    break
  }

  return streak
}

const clearSelectedPipelineJob = (jobId: string) => {
  if (localStorage.getItem('al_pipeline_job_id') !== jobId)
    return

  localStorage.removeItem('al_pipeline_job_id')
  localStorage.removeItem('al_pipeline_filename')
  localStorage.removeItem('al_pipeline_subject_name')
}

type UseAdaptiveDashboardParams = {
  initialSubjects: PipelineJobHistoryItem[]
  initialSessionHistory: SessionHistoryItem[]
  didHydrateFromServer: boolean
  t: TranslateFn
  tAdaptive: TranslateFn
}

export const useAdaptiveDashboard = ({
  initialSubjects,
  initialSessionHistory,
  didHydrateFromServer,
  t,
  tAdaptive,
}: UseAdaptiveDashboardParams) => {
  const router = useRouter()

  const [subjects, setSubjects] = useState<PipelineJobHistoryItem[]>(initialSubjects)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiOnline, setApiOnline] = useState<boolean | null>(true)
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [itemToDelete, setItemToDelete] = useState<PipelineJobHistoryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(initialSessionHistory)
  const [toastMsg, setToastMsg] = useState<ToastPayload>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((title: string, type: 'error' | 'success' = 'error') => {
    if (toastTimerRef.current)
      clearTimeout(toastTimerRef.current)

    setToastMsg({ title, type })
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null)
      toastTimerRef.current = null
    }, 5000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current)
        clearTimeout(toastTimerRef.current)
    }
  }, [])

  const refreshSubjects = useCallback(async () => {
    try {
      const data = await getSubjects()
      setSubjects(data)
    }
    catch (e) {
      console.error('Failed to refresh subjects', e)
    }
  }, [])

  const handleGoUpload = useCallback(() => {
    router.push(ADAPTIVE_ROUTES.upload)
  }, [router])

  const handleOpenSubject = useCallback(async (jobId: string) => {
    if (loadingJobId || deletingJobId)
      return

    setLoadingJobId(jobId)
    try {
      const session = await createSessionFromPipeline(jobId, 50)
      localStorage.setItem('al_session_id', session.session_id)
      saveSessionJobMapping(session.session_id, jobId)
      router.push(ADAPTIVE_ROUTES.subject(session.session_id))
    }
    catch (err) {
      console.error(`Error creating session: ${(err as Error).message}`)
      const feedback = getSessionStartFeedback(tAdaptive, 'dashboard', err)
      showToast(feedback.message, 'error')
      setLoadingJobId(null)
    }
  }, [deletingJobId, loadingJobId, router, showToast, tAdaptive])

  const handleDeleteClick = useCallback((job: PipelineJobHistoryItem) => {
    setItemToDelete(job)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!itemToDelete || loadingJobId || deletingJobId)
      return

    setDeletingJobId(itemToDelete.job_id)
    try {
      await deleteSubject(itemToDelete.job_id, true)
      await refreshSubjects()
      clearSelectedPipelineJob(itemToDelete.job_id)
      showToast(t('deleteSuccess'), 'success')
    }
    catch (err) {
      console.error(`Error deleting subject: ${(err as Error).message}`)
      showToast(t('deleteFailed'), 'error')
    }
    finally {
      setDeletingJobId(null)
      setItemToDelete(null)
    }
  }, [deletingJobId, itemToDelete, loadingJobId, refreshSubjects, showToast, t])

  const handleCancelDelete = useCallback(() => {
    if (!deletingJobId)
      setItemToDelete(null)
  }, [deletingJobId])

  const normalizedSubjects = useMemo(() => {
    return subjects.map((job) => {
      const displayName = job.filename?.replace(/\.[^.]+$/, '') || job.subject_id || job.job_id
      return {
        job,
        normalizedDisplayName: displayName.toLowerCase(),
      }
    })
  }, [subjects])

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()
    if (!normalizedQuery)
      return normalizedSubjects.map(({ job }) => job)

    return normalizedSubjects
      .filter(({ normalizedDisplayName }) => normalizedDisplayName.includes(normalizedQuery))
      .map(({ job }) => job)
  }, [deferredSearchQuery, normalizedSubjects])

  const streakDays = useMemo(() => calculateLearningStreak(sessionHistory), [sessionHistory])

  const dailyGoalProgress = useMemo(() => {
    const todayStart = getDayStart(Date.now())
    const current = sessionHistory.filter((session) => {
      if (session.total_answered <= 0)
        return false
      const dayStart = getDayStart(toTimestampMs(session.updated_at || session.created_at))
      return dayStart === todayStart
    }).length

    return {
      current,
      total: DAILY_GOAL_TARGET,
      percent: Math.min(100, Math.round((current / DAILY_GOAL_TARGET) * 100)),
    }
  }, [sessionHistory])

  const upNextSubject = subjects.length > 0 ? subjects[0] : null

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.upload)
  }, [router])

  useEffect(() => {
    let isActive = true

    const applyHealthResult = (healthResult: PromiseSettledResult<boolean>) => {
      if (healthResult.status === 'fulfilled')
        setApiOnline(healthResult.value)
      else
        setApiOnline(false)
    }

    const hydrateDashboard = async () => {
      setError(null)

      if (didHydrateFromServer) {
        // Server already provided initial data — only check API health.
        const healthResult = await checkApiHealth().catch(() => false)
        if (isActive)
          setApiOnline(healthResult)
        return
      }

      setLoading(true)

      const [healthResult, subjectsResult, historyResult] = await Promise.allSettled([
        checkApiHealth(),
        getSubjects(),
        getSubjectProgressHistory(5),
      ])

      if (!isActive)
        return

      applyHealthResult(healthResult)

      if (subjectsResult.status === 'fulfilled') {
        setSubjects(subjectsResult.value)
      }
      else {
        console.error('Failed to hydrate subjects', subjectsResult.reason)
        setError(t('connectionLimited'))
      }

      if (historyResult.status === 'fulfilled') {
        setSessionHistory(historyResult.value)
      }
      else {
        console.error('Failed to hydrate session history', historyResult.reason)
      }

      setLoading(false)
    }

    void hydrateDashboard()

    return () => {
      isActive = false
    }
  }, [didHydrateFromServer, t])

  return {
    apiOnline,
    dailyGoalProgress,
    deletingJobId,
    error,
    filteredSubjects,
    handleCancelDelete,
    handleConfirmDelete,
    handleDeleteClick,
    handleGoUpload,
    handleOpenSubject,
    itemToDelete,
    loading,
    loadingJobId,
    searchQuery,
    sessionHistory,
    setSearchQuery,
    streakDays,
    toastMsg,
    upNextSubject,
  }
}
