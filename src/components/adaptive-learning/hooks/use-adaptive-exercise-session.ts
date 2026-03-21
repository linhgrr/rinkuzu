import { useCallback, useEffect, useRef, useState } from 'react'
import { AdaptiveApiError, getExercise, getNextConcept, getTheory, isSessionNotFoundError, submitAnswer } from '../api-client'
import { ADAPTIVE_ROUTES } from '../routes'
import { saveSessionExerciseOutcome } from '../session-storage'
import type { Exercise, NextConcept, TheoryData } from '../types'

type RouterLike = {
  push: (href: string) => void
  replace: (href: string) => void
  prefetch: (href: string) => void
}

type TranslateFn = (key: string, values?: Record<string, any>) => string

type UseAdaptiveExerciseSessionParams = {
  sessionId: string
  router: RouterLike
  t: TranslateFn
}

function resolveExerciseFeedback(
  error: unknown,
  t: TranslateFn,
  intent: 'load' | 'submit',
): string {
  const fallback = intent === 'load'
    ? t('exercise.failedToLoadExercise')
    : t('exercise.failedToSubmitAnswer')

  if (error instanceof AdaptiveApiError) {
    if (
      error.code === 'temporary_unavailable'
      || error.code === 'request_aborted'
      || error.code === 'network_error'
      || error.code === 'upstream_html_error'
      || error.code === 'invalid_response'
    ) {
      return intent === 'load'
        ? t('exercise.serviceUnavailable')
        : t('exercise.submitUnavailable')
    }
  }

  return fallback
}

export const useAdaptiveExerciseSession = ({ sessionId, router, t }: UseAdaptiveExerciseSessionParams) => {
  const [concept, setConcept] = useState<NextConcept | null>(null)
  const [theory, setTheory] = useState<TheoryData | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [loadingConcept, setLoadingConcept] = useState(true)
  const [loadingTheory, setLoadingTheory] = useState(false)
  const [loadingExercise, setLoadingExercise] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTheory, setShowTheory] = useState(false)

  const loadingRef = useRef(false)
  const isMountedRef = useRef(true)
  const activeRequestIdRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!isMountedRef.current || loadingRef.current)
      return

    loadingRef.current = true
    const requestId = activeRequestIdRef.current + 1
    activeRequestIdRef.current = requestId

    setLoadingConcept(true)
    setError(null)
    setSelectedOption(null)
    setConcept(null)
    setTheory(null)
    setExercise(null)
    setShowTheory(false)

    const isLatestActiveRequest = () =>
      isMountedRef.current && activeRequestIdRef.current === requestId

    try {
      const nextConcept = await getNextConcept(sessionId)
      if (!isLatestActiveRequest())
        return

      setConcept(nextConcept)
      setLoadingConcept(false)

      if (nextConcept.bloom_level <= 2) {
        setShowTheory(true)
        setLoadingTheory(true)
        setLoadingExercise(true)

        const theoryPromise = getTheory(sessionId)
          .then((theoryData) => {
            if (!isLatestActiveRequest())
              return
            setTheory(theoryData)
          })
          .catch((reason) => {
            if (!isLatestActiveRequest())
              return
            console.error('Failed to load theory:', reason)
          })
          .finally(() => {
            if (!isLatestActiveRequest())
              return
            setLoadingTheory(false)
          })

        const exercisePromise = getExercise(sessionId)
          .then((exerciseData) => {
            if (!isLatestActiveRequest())
              return
            setExercise(exerciseData)
          })
          .catch((reason) => {
            if (!isLatestActiveRequest())
              return
            console.error('Failed to load exercise:', reason)
            setError(resolveExerciseFeedback(reason, t, 'load'))
          })
          .finally(() => {
            if (!isLatestActiveRequest())
              return
            setLoadingExercise(false)
          })

        await Promise.allSettled([theoryPromise, exercisePromise])
      }
      else {
        setLoadingExercise(true)
        const ex = await getExercise(sessionId)
        if (!isLatestActiveRequest())
          return
        setExercise(ex)
        setLoadingExercise(false)
      }
    }
    catch (err) {
      if (!isLatestActiveRequest())
        return

      if (isSessionNotFoundError(err)) {
        setError(t('exercise.failedToLoadExercise'))
        setLoadingConcept(false)
        setLoadingTheory(false)
        setLoadingExercise(false)
        return
      }

      setError(resolveExerciseFeedback(err, t, 'load'))
      setLoadingConcept(false)
      setLoadingTheory(false)
      setLoadingExercise(false)
    }
    finally {
      loadingRef.current = false
    }
  }, [sessionId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.dashboard)
    router.prefetch(ADAPTIVE_ROUTES.result(sessionId))
  }, [router, sessionId])

  const handleSubmit = useCallback(async () => {
    if (!selectedOption || !exercise)
      return

    setSubmitting(true)
    try {
      router.prefetch(ADAPTIVE_ROUTES.result(sessionId))
      const result = await submitAnswer(sessionId, selectedOption)
      if (!isMountedRef.current)
        return

      saveSessionExerciseOutcome(sessionId, { result, exercise })
      router.push(ADAPTIVE_ROUTES.result(sessionId))
    }
    catch (err) {
      if (!isMountedRef.current)
        return

      if (isSessionNotFoundError(err)) {
        setError(t('exercise.failedToSubmitAnswer'))
        return
      }

      setError(resolveExerciseFeedback(err, t, 'submit'))
    }
    finally {
      if (!isMountedRef.current)
        return
      setSubmitting(false)
    }
  }, [exercise, router, selectedOption, sessionId, t])

  return {
    concept,
    theory,
    exercise,
    selectedOption,
    loadingConcept,
    loadingTheory,
    loadingExercise,
    submitting,
    error,
    showTheory,
    setShowTheory,
    setSelectedOption,
    loadData,
    handleSubmit,
  }
}
