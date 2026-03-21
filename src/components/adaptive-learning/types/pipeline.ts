import type { KnowledgeGraphData } from './graph'

export interface PipelineUploadResponse {
  job_id: string
  filename: string
  file_size: number
  subject_id: string
  status: string
  message: string
}

export type PipelineStatus =
  | 'pending'
  | 'queued'
  | 'loading'
  | 'chunking'
  | 'extracting'
  | 'embedding'
  | 'merging'
  | 'ranking'
  | 'verifying'
  | 'building_graph'
  | 'optimizing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface PipelineJobStatus {
  job_id: string
  filename: string
  subject_id: string
  status: PipelineStatus
  is_terminal?: boolean
  current_step: string
  progress: number
  total_chunks: number
  concepts_extracted: number
  concepts_after_merge: number
  relations_verified: number
  graph_stats: Record<string, any>
  error_message: string | null
  error_code?: string | null
  user_message?: string | null
  retryable?: boolean
  partial_graph?: {
    nodes: { id: string; name: string }[]
    edges: { source: string; target: string }[]
  } | null
  result?: {
    graph: KnowledgeGraphData
    stats: Record<string, any>
    n_concepts: number
  }
}

export interface PipelineSessionResponse {
  session_id: string
  n_concepts: number
  source: string
  job_id: string
  status: string
}

export interface PipelineJobHistoryItem {
  job_id: string
  filename: string
  subject_id: string
  status: string
  concepts_after_merge: number
  relations_verified: number
  completed_at: number
  mastered_concept?: number
  all_concept?: number
  progress_percent?: number
}

export interface DeleteSubjectResponse {
  job_id: string
  deleted_job: number
  deleted_sessions: number
  status: string
}
