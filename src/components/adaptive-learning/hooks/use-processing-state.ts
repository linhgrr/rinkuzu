'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdaptiveApiError,
  createSessionFromPipeline,
  getPipelineJobStatus,
  isRetryableAdaptiveError,
} from '../api-client'
import { ADAPTIVE_ROUTES } from '../routes'
import { saveSessionJobMapping } from '../session-storage'
import type { PipelineJobStatus, PipelineStatus } from '../types'

const STATUS_TO_STEP: Record<PipelineStatus, number> = {
  pending: 0,
  queued: 0,
  loading: 1,
  chunking: 1,
  extracting: 2,
  embedding: 3,
  merging: 3,
  ranking: 4,
  verifying: 4,
  building_graph: 5,
  optimizing: 5,
  completed: 6,
  failed: -1,
  cancelled: -1,
}

const STATUS_LABEL_KEYS: Record<PipelineStatus, string> = {
  pending: 'waitingToStart',
  queued: 'queuedForProcessing',
  loading: 'readingDocument',
  chunking: 'splittingChunks',
  extracting: 'extractingConceptsWithAI',
  embedding: 'computingEmbeddings',
  merging: 'mergingDuplicateConcepts',
  ranking: 'rankingPrerequisites',
  verifying: 'verifyingRelationsWithAI',
  building_graph: 'buildingKnowledgeGraph',
  optimizing: 'optimizingDAG',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'failed',
}

type TranslateFn = (key: string, values?: Record<string, any>) => string

type ProcessingStats = {
  concepts_extracted: number
  concepts_after_merge: number
  relations_verified: number
}

export type ProcessingStep = {
  id: number
  label: string
}

const getStoredFilename = (fallback: string) =>
  localStorage.getItem('al_pipeline_filename') || fallback

export const useProcessingState = (t: TranslateFn) => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [statusLabel, setStatusLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [partialGraph, setPartialGraph] = useState<PipelineJobStatus['partial_graph']>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [filename, setFilename] = useState('')
  const [showGraphPanel, setShowGraphPanel] = useState(false)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollInFlightRef = useRef(false)
  const creatingSessionRef = useRef(false)

  const steps = useMemo<ProcessingStep[]>(
    () => [
      { id: 1, label: t('processing.steps.readingPdf') },
      { id: 2, label: t('processing.steps.extractingConcepts') },
      { id: 3, label: t('processing.steps.buildingGraph') },
      { id: 4, label: t('processing.steps.generatingPath') },
      { id: 5, label: t('processing.steps.preparingExercise') },
    ],
    [t],
  )

  const getStatusLabel = useCallback(
    (status: PipelineStatus) => t(`processing.status.${STATUS_LABEL_KEYS[status]}`),
    [t],
  )

  const getFriendlyProcessingError = useCallback((err: unknown) => {
    if (err instanceof AdaptiveApiError) {
      if (err.code === 'unauthorized')
        return t('processing.errors.unauthorized')
      if (err.code === 'not_found')
        return t('processing.errors.jobNotFound')
      if (err.code === 'conflict')
        return t('processing.errors.conflict')
      if (err.code === 'temporary_unavailable')
        return t('processing.errors.serviceUnavailable')
    }

    return err instanceof Error ? err.message : t('processing.errors.generic')
  }, [t])

  const getRetryNotice = useCallback((err: unknown, phase: 'polling' | 'createSession') => {
    if (phase === 'createSession')
      return t('processing.notices.retryingCreateSession')

    if (err instanceof AdaptiveApiError) {
      if (err.code === 'request_aborted')
        return t('processing.notices.connectionInterrupted')
      if (err.code === 'temporary_unavailable')
        return t('processing.notices.backendSlowRetrying')
    }

    return t('processing.notices.connectionInterrupted')
  }, [t])

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    pollInFlightRef.current = false
  }, [])

  const runFallbackProgress = useCallback(() => {
    const totalDuration = 5000
    const interval = 50
    const increment = 100 / (totalDuration / interval)
    let currentProgress = 0

    clearPolling()
    setStatusLabel(t('processing.status.processing'))
    pollingRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + increment, 100)
      setProgress(currentProgress)

      const step = Math.min(Math.ceil((currentProgress / 100) * steps.length), steps.length)
      setCurrentStep(step)

      if (currentProgress < 100)
        return

      clearPolling()
      const sessionId = localStorage.getItem('al_session_id')
      timeoutRef.current = setTimeout(() => {
        if (sessionId) {
          router.push(ADAPTIVE_ROUTES.subject(sessionId))
          return
        }

        router.push(ADAPTIVE_ROUTES.upload)
      }, 800)
    }, interval)
  }, [clearPolling, router, steps.length, t])

  const updateStats = useCallback((job: PipelineJobStatus) => {
    if (job.concepts_extracted <= 0)
      return

    setStats((prev) => {
      if (
        prev &&
        prev.concepts_extracted === job.concepts_extracted &&
        prev.concepts_after_merge === job.concepts_after_merge &&
        prev.relations_verified === job.relations_verified
      )
        return prev

      return {
        concepts_extracted: job.concepts_extracted,
        concepts_after_merge: job.concepts_after_merge,
        relations_verified: job.relations_verified,
      }
    })
  }, [])

  const handleCompletedJob = useCallback(async (jobId: string) => {
    creatingSessionRef.current = true
    setCreatingSession(true)
    setNotice(null)

    try {
      const session = await createSessionFromPipeline(jobId, 50)
      clearPolling()
      localStorage.setItem('al_session_id', session.session_id)
      saveSessionJobMapping(session.session_id, jobId)
      localStorage.removeItem('al_pipeline_job_id')
      timeoutRef.current = setTimeout(() => {
        router.push(ADAPTIVE_ROUTES.subject(session.session_id))
      }, 800)
    }
    catch (err) {
      setCreatingSession(false)
      creatingSessionRef.current = false

      if (isRetryableAdaptiveError(err)) {
        setNotice(getRetryNotice(err, 'createSession'))
        return
      }

      setError(getFriendlyProcessingError(err) || t('createSessionFailed'))
      clearPolling()
    }
  }, [clearPolling, getFriendlyProcessingError, getRetryNotice, router, t])

  const pollJob = useCallback(async (jobId: string) => {
    if (pollInFlightRef.current || creatingSessionRef.current)
      return

    pollInFlightRef.current = true

    try {
      const job = await getPipelineJobStatus(jobId)
      setNotice(null)
      setCurrentStep(STATUS_TO_STEP[job.status] ?? 0)
      setProgress(job.progress * 100)
      setStatusLabel(job.current_step || getStatusLabel(job.status))

      if (job.partial_graph)
        setPartialGraph(job.partial_graph)

      updateStats(job)

      if (job.status === 'completed' && !creatingSessionRef.current) {
        await handleCompletedJob(jobId)
      }
      else if (job.status === 'failed' || job.status === 'cancelled') {
        clearPolling()
        setError(job.error_message || t('processing.errors.pipelineFailed'))
      }
    }
    catch (err) {
      if (isRetryableAdaptiveError(err)) {
        setNotice(getRetryNotice(err, 'polling'))
        return
      }

      clearPolling()
      setError(getFriendlyProcessingError(err))
    }
    finally {
      pollInFlightRef.current = false
    }
  }, [clearPolling, getFriendlyProcessingError, getRetryNotice, getStatusLabel, handleCompletedJob, t, updateStats])

  useEffect(() => {
    setStatusLabel(t('processing.status.starting'))
    setFilename(getStoredFilename(t('processing.defaultFilename')))
  }, [t])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const applyMatch = () => setShowGraphPanel(mediaQuery.matches)

    applyMatch()
    mediaQuery.addEventListener('change', applyMatch)

    return () => {
      mediaQuery.removeEventListener('change', applyMatch)
    }
  }, [])

  useEffect(() => {
    const jobId = localStorage.getItem('al_pipeline_job_id')
    if (!jobId) {
      runFallbackProgress()
      return () => clearPolling()
    }

    creatingSessionRef.current = false
    void pollJob(jobId)
    pollingRef.current = setInterval(() => {
      void pollJob(jobId)
    }, 2000)

    return () => clearPolling()
  }, [clearPolling, pollJob, runFallbackProgress])

  const handleGoBack = useCallback(() => {
    clearPolling()
    creatingSessionRef.current = false
    setNotice(null)
    localStorage.removeItem('al_pipeline_job_id')
    localStorage.removeItem('al_pipeline_filename')
    router.push(ADAPTIVE_ROUTES.upload)
  }, [clearPolling, router])

  return {
    creatingSession,
    currentStep,
    error,
    filename,
    handleGoBack,
    notice,
    partialGraph,
    progress,
    showGraphPanel,
    stats,
    statusLabel,
    steps,
  }
}
