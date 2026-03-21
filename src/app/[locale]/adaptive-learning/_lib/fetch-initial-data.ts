import type { PipelineJobHistoryItem, SessionHistoryItem } from '@/components/adaptive-learning/types'

type AdaptiveDashboardPayload = {
  subjects: PipelineJobHistoryItem[]
  sessionHistory: SessionHistoryItem[]
}

const DEFAULT_ADAPTIVE_API_URL = 'http://localhost:8000'
const DEFAULT_TIMEOUT_MS = 60_000

const getAdaptiveApiHeaders = (userId: string) => {
  const serviceToken = process.env.INTERNAL_SERVICE_TOKEN
  return {
    'x-user-id': userId,
    ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
  }
}

const fetchAdaptiveJson = async <T>(baseUrl: string, path: string, headers: Record<string, string>, timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok)
      return null

    return response.json() as Promise<T>
  }
  finally {
    clearTimeout(timeout)
  }
}

export async function fetchAdaptiveDashboardData(userId: string): Promise<AdaptiveDashboardPayload> {
  try {
    const baseUrl = process.env.ADAPTIVE_API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_ADAPTIVE_API_URL
    const timeoutMs = Number(process.env.ADAPTIVE_PROXY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
    const headers = getAdaptiveApiHeaders(userId)

    const [subjectsResult, historyResult] = await Promise.allSettled([
      fetchAdaptiveJson<{ subjects?: PipelineJobHistoryItem[] }>(baseUrl, '/api/history/subjects', headers, timeoutMs),
      fetchAdaptiveJson<{ subjects?: SessionHistoryItem[] }>(baseUrl, '/api/history/subjects/progress?limit=5', headers, timeoutMs),
    ])

    const subjects = subjectsResult.status === 'fulfilled'
      ? subjectsResult.value?.subjects ?? []
      : []

    const sessionHistory = historyResult.status === 'fulfilled'
      ? historyResult.value?.subjects ?? []
      : []

    return { subjects, sessionHistory }
  }
  catch (error) {
    console.error('Failed fetching adaptive learning data server-side:', error)
    return { subjects: [], sessionHistory: [] }
  }
}
