'use client';

import { copyToClipboard } from '@/lib/clipboard';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  HiCheck,
  HiOutlineArrowPath,
  HiOutlineBeaker,
  HiOutlineClipboardDocument,
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  getPipelineJobStatus,
  listPipelineJobs,
} from '@/features/adaptive/lib/adaptive-api-methods';
import type {
  PipelineJobListItem,
  PipelineJobStatus,
  PipelineStatus,
} from '@/features/adaptive/types/pipeline';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

type PipelineQualityReport = {
  passed: boolean;
  checks: Record<string, boolean>;
  concept_count: number;
  candidate_relation_count: number;
  verified_relation_count: number;
  extraction_failure_ratio: number;
  invalid_edge_count: number;
};

type DebugGraphStats = NonNullable<PipelineJobStatus['graph_stats']> & {
  relation_candidates?: number | null;
  relation_candidates_from_extraction?: number | null;
  relation_candidates_from_mlp?: number | null;
  relations_inserted_after_verification?: number | null;
  relations_extraction_candidates_dropped?: number | null;
  quality_report?: PipelineQualityReport | null;
};

type DebugPipelineResult = NonNullable<PipelineJobStatus['result']> & {
  concepts_data?: Record<string, JsonValue>;
  concept_map?: Record<string, number>;
  concept_embedding_count?: number;
  prereq_edges?: JsonValue[];
  failed_batches?: JsonValue[];
  warnings?: string[];
  quality_report?: PipelineQualityReport | null;
};

type PipelineDebugTraceEntry = {
  step_id: string;
  label: string;
  status: 'running' | 'completed' | 'failed';
  started_at: number;
  completed_at?: number | null;
  duration_ms?: number | null;
  input: Record<string, JsonValue>;
  output?: Record<string, JsonValue> | null;
  error?: string | null;
  artifacts?: PipelineDebugArtifact[];
};

type PipelineDebugArtifact = {
  artifact_id: string;
  kind: string;
  label: string;
  index: number;
  page_start?: number | null;
  page_end?: number | null;
  input: Record<string, JsonValue>;
  output: Record<string, JsonValue>;
  content_type: string;
  content: string;
  truncated: boolean;
};

type RawPipelineDebugArtifact = {
  artifact_id: string;
  kind: string;
  label: string;
  index: number;
  page_start?: number | null;
  page_end?: number | null;
  input?: unknown;
  output?: unknown;
  content_type: string;
  content: string;
  truncated: boolean;
};

type DebugPipelineJobStatus = PipelineJobStatus & {
  graph_stats?: DebugGraphStats;
  quality_report?: PipelineQualityReport | null;
  result?: DebugPipelineResult | null;
  debug_trace?: PipelineDebugTraceEntry[];
};

type DebugStage = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  input: JsonValue;
  output: JsonValue;
  artifacts: PipelineDebugArtifact[];
  note?: string;
};

const STAGE_ORDER: PipelineStatus[] = [
  'pending',
  'queued',
  'loading',
  'chunking',
  'extracting',
  'embedding',
  'merging',
  'ranking',
  'verifying',
  'building_graph',
  'optimizing',
  'completed',
];

const TERMINAL: ReadonlySet<PipelineStatus> = new Set(['completed', 'failed', 'cancelled']);
const PIPELINE_TIME_FORMATTER = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

function statusIndex(status: PipelineStatus): number {
  const index = STAGE_ORDER.indexOf(status);
  return index >= 0 ? index : 0;
}

function stageState(job: DebugPipelineJobStatus, first: PipelineStatus, last?: PipelineStatus) {
  if (job.status === 'failed' || job.status === 'cancelled') {
    const current = statusIndex(job.status);
    const start = statusIndex(first);
    const end = last ? statusIndex(last) : start;
    return current >= start && current <= end ? 'failed' : current > end ? 'done' : 'pending';
  }
  const current = statusIndex(job.status);
  const start = statusIndex(first);
  const end = last ? statusIndex(last) : start;
  if (current > end || job.status === 'completed') return 'done';
  if (current >= start && current <= end) return 'active';
  return 'pending';
}

function compactJson(value: unknown): JsonValue {
  if (value === undefined) return null;
  try {
    return structuredClone(value) as JsonValue;
  } catch {
    return null;
  }
}

function compactJsonRecord(value: unknown): Record<string, JsonValue> {
  const compacted = compactJson(value);
  return compacted && !Array.isArray(compacted) && typeof compacted === 'object'
    ? (compacted as Record<string, JsonValue>)
    : {};
}

function normalizeDebugArtifact(artifact: RawPipelineDebugArtifact): PipelineDebugArtifact {
  return {
    artifact_id: artifact.artifact_id,
    kind: artifact.kind,
    label: artifact.label,
    index: artifact.index,
    page_start: artifact.page_start,
    page_end: artifact.page_end,
    input: compactJsonRecord(artifact.input),
    output: compactJsonRecord(artifact.output),
    content_type: artifact.content_type,
    content: artifact.content,
    truncated: artifact.truncated,
  };
}

function buildDebugStages(job: DebugPipelineJobStatus): DebugStage[] {
  if (job.debug_trace?.length) {
    return job.debug_trace.map((entry) => ({
      id: entry.step_id,
      label: entry.label,
      status:
        entry.status === 'completed' ? 'done' : entry.status === 'failed' ? 'failed' : 'active',
      input: compactJson(entry.input ?? {}),
      output: compactJson(
        entry.output ?? {
          duration_ms: entry.duration_ms ?? null,
          error: entry.error ?? null,
        },
      ),
      artifacts: (entry.artifacts ?? []).map(normalizeDebugArtifact),
      note:
        entry.status === 'running'
          ? 'Stage đang chạy; output sẽ được ghi khi wrapper hoàn tất hoặc fail.'
          : undefined,
    }));
  }

  const result = job.result ?? null;
  const stats = {
    ...(result?.stats ?? {}),
    ...(job.graph_stats ?? {}),
  };
  const qualityReport =
    job.quality_report ?? result?.quality_report ?? stats.quality_report ?? null;
  const partialGraph = job.partial_graph ?? null;
  const finalGraph = result?.graph ?? null;
  const warnings = result?.warnings ?? [];
  const failedBatches = result?.failed_batches ?? [];

  return [
    {
      id: 'request',
      label: 'Request + job envelope',
      status: stageState(job, 'pending', 'queued'),
      input: {
        job_id: job.job_id,
      },
      output: {
        filename: job.filename,
        subject_id: job.subject_id,
        status: job.status,
        current_step: job.current_step,
        retry_after_seconds: job.retry_after_seconds,
        retryable: job.retryable,
        error_code: job.error_code,
      },
      artifacts: [],
    },
    {
      id: 'document',
      label: 'PDF loading + chunking',
      status: stageState(job, 'loading', 'chunking'),
      input: {
        filename: job.filename,
        page_batch_size: job.page_batch_size,
      },
      output: {
        total_chunks: job.total_chunks,
        batch_count: job.batch_count,
        failed_batch_count: job.failed_batch_count,
        partial_success: job.partial_success,
        failed_batches: failedBatches,
      },
      artifacts: [],
      note: 'BE hiện expose chunk count và failed batch summary, chưa expose raw OCR text/chunk payload.',
    },
    {
      id: 'extraction',
      label: 'Concept extraction',
      status: stageState(job, 'extracting'),
      input: {
        batch_count: job.batch_count,
        page_batch_size: job.page_batch_size,
      },
      output: {
        concepts_extracted: job.concepts_extracted,
        warnings,
        concepts_data: result?.concepts_data ?? null,
      },
      artifacts: [],
      note: 'concepts_data chỉ có sau khi pipeline hoàn tất hoặc cache restore trả result.',
    },
    {
      id: 'embedding_merge',
      label: 'Embedding + duplicate merge',
      status: stageState(job, 'embedding', 'merging'),
      input: {
        concepts_extracted: job.concepts_extracted,
      },
      output: {
        concepts_after_merge: job.concepts_after_merge,
        concept_map: result?.concept_map ?? null,
        concept_embedding_count: result?.concept_embedding_count ?? null,
      },
      artifacts: [],
    },
    {
      id: 'relations',
      label: 'Candidate ranking + LLM verification',
      status: stageState(job, 'ranking', 'verifying'),
      input: {
        concepts_after_merge: job.concepts_after_merge,
        source_candidates: ['mlp', 'extraction'],
      },
      output: {
        relation_candidates: stats.relation_candidates ?? null,
        relation_candidates_from_mlp: stats.relation_candidates_from_mlp ?? null,
        relation_candidates_from_extraction: stats.relation_candidates_from_extraction ?? null,
        relations_extraction_candidates_dropped:
          stats.relations_extraction_candidates_dropped ?? null,
        relations_verified: job.relations_verified,
      },
      artifacts: [],
    },
    {
      id: 'graph',
      label: 'Graph build + optimization',
      status: stageState(job, 'building_graph', 'optimizing'),
      input: {
        verified_relations: job.relations_verified,
        apply_reduction: true,
      },
      output: {
        partial_graph: partialGraph,
        final_graph: finalGraph,
        graph_stats: stats,
        prereq_edges: result?.prereq_edges ?? null,
      },
      artifacts: [],
    },
    {
      id: 'quality',
      label: 'Quality gate + final payload',
      status:
        qualityReport?.passed === false || job.error_code === 'pipeline_quality_gate_failed'
          ? 'failed'
          : stageState(job, 'completed'),
      input: {
        graph_edges: stats.num_edges ?? finalGraph?.edges?.length ?? null,
        concept_count: result?.n_concepts ?? Object.keys(result?.concept_map ?? {}).length,
      },
      output: {
        quality_report: qualityReport,
        result_summary: result
          ? {
              n_concepts: result.n_concepts,
              graph_nodes: result.graph?.nodes?.length ?? 0,
              graph_edges: result.graph?.edges?.length ?? 0,
            }
          : null,
        error_message: job.error_message,
        user_message: job.user_message,
      },
      artifacts: [],
    },
  ];
}

function formatTime(epochSeconds?: number | null): string {
  if (!epochSeconds) return 'n/a';
  return PIPELINE_TIME_FORMATTER.format(new Date(epochSeconds * 1000));
}

function stageTone(status: DebugStage['status']): string {
  switch (status) {
    case 'done':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'active':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-500';
  }
}

function StageIcon({ status }: { status: DebugStage['status'] }) {
  if (status === 'done') return <HiCheck className="size-4" />;
  if (status === 'failed') return <HiOutlineExclamationTriangle className="size-4" />;
  if (status === 'active') return <Spinner size="sm" label="Stage active" />;
  return <span className="size-2 rounded-full bg-current opacity-50" />;
}

function JsonBlock({ value }: { value: JsonValue }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ArtifactList({
  artifacts,
  onOpen,
}: {
  artifacts: PipelineDebugArtifact[];
  onOpen: (artifact: PipelineDebugArtifact) => void;
}) {
  if (!artifacts.length) return null;
  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
          Drill-down artifacts
        </div>
        <span className="rounded-md bg-white px-2 py-1 font-mono text-xs text-neutral-500">
          {artifacts.length}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {artifacts.map((artifact, renderIndex) => (
          <button
            key={`${artifact.kind}:${artifact.artifact_id}:${artifact.index}:${renderIndex}`}
            type="button"
            className="min-h-[72px] rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-brand-trust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,157,140,0.18)]"
            onClick={() => onOpen(artifact)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-semibold text-neutral-900">
                {artifact.label || artifact.artifact_id}
              </span>
              <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-1 font-mono text-[11px] text-neutral-600">
                {artifact.kind}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
              {artifact.page_start ? (
                <span>
                  page {artifact.page_start}
                  {artifact.page_end && artifact.page_end !== artifact.page_start
                    ? `-${artifact.page_end}`
                    : ''}
                </span>
              ) : null}
              <span>{artifact.content.length.toLocaleString('vi-VN')} chars</span>
              {artifact.truncated ? <span className="text-amber-700">truncated</span> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ArtifactModal({
  artifact,
  onClose,
}: {
  artifact: PipelineDebugArtifact;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const copyContent = () => {
    void copyToClipboard(artifact.content || JSON.stringify(artifact.output));
  };

  return (
    <dialog
      ref={dialogRef}
      className="z-50 m-auto flex max-h-[88vh] w-[min(100%,72rem)] max-w-6xl flex-col rounded-xl border border-neutral-200 bg-white p-0 shadow-lg backdrop:bg-neutral-950/55"
      aria-label={artifact.label || 'Pipeline artifact'}
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
            {artifact.kind}
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold text-neutral-950">
            {artifact.label || artifact.artifact_id}
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">{artifact.artifact_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyContent}>
            Copy content
          </Button>
          <Button variant="outline" size="sm" aria-label="Close artifact" onClick={onClose}>
            <HiOutlineXMark className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-neutral-500">
              Input
            </div>
            <JsonBlock value={compactJson(artifact.input)} />
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-neutral-500">
              Output
            </div>
            <JsonBlock value={compactJson(artifact.output)} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
              Content
            </div>
            {artifact.truncated ? (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Truncated by backend limit
              </span>
            ) : null}
          </div>
          <pre className="max-h-[68vh] min-h-[420px] overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
            {artifact.content || JSON.stringify(artifact.output, null, 2)}
          </pre>
        </div>
      </div>
    </dialog>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
        {label}
      </div>
      <div className="mt-2 font-mono text-xl font-semibold text-neutral-900">{value ?? 'n/a'}</div>
    </div>
  );
}

export default function PipelineDebugPage() {
  const [jobIdInput, setJobIdInput] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobs, setJobs] = useState<PipelineJobListItem[]>([]);
  const [job, setJob] = useState<DebugPipelineJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<PipelineDebugArtifact | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stages = job ? buildDebugStages(job) : [];
  const isTerminal = job ? TERMINAL.has(job.status) : false;

  const loadJobs = async () => {
    const recentJobs = await listPipelineJobs(20);
    setJobs(recentJobs);
    if (!selectedJobId && recentJobs[0]) {
      setSelectedJobId(recentJobs[0].job_id);
      setJobIdInput(recentJobs[0].job_id);
    }
  };

  const loadJob = async (jobId: string) => {
    if (!jobId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const nextJob = (await getPipelineJobStatus(jobId.trim(), {
        includeDebug: true,
      })) as DebugPipelineJobStatus;
      setJob(nextJob);
      setSelectedJobId(nextJob.job_id);
      setJobIdInput(nextJob.job_id);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được pipeline job');
      setLoading(false);
    }
  };

  const onLoadJobs = useEffectEvent(() => {
    void loadJobs();
  });

  const onLoadJob = useEffectEvent((jobId: string) => {
    void loadJob(jobId);
  });

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) onLoadJobs();
    });
    return () => {
      active = false;
    };
    // Effect Events must not be listed as dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoadJobs is useEffectEvent
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) onLoadJob(selectedJobId);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoadJob is useEffectEvent
  }, [selectedJobId]);

  useEffect(() => {
    if (!autoRefresh || !job || isTerminal) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => onLoadJob(job.job_id),
      Math.max(1, job.retry_after_seconds ?? 3) * 1000,
    );
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoadJob is useEffectEvent
  }, [autoRefresh, isTerminal, job]);

  const activeStage = stages.find((stage) => stage.status === 'active');

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              <HiOutlineBeaker className="size-4" />
              Pipeline debug
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-neutral-950">
              PDF to KG step inspector
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Xem trạng thái, input/output theo stage, graph stats, quality gate, raw JSON và
              artifact chi tiết như OCR từng trang hoặc concept extraction từng batch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'success' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh((value) => !value)}
            >
              <HiOutlineArrowPath className="size-4" />
              Auto refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={loading}
              disabled={!selectedJobId}
              onClick={() => void loadJob(selectedJobId)}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setSelectedJobId(jobIdInput.trim());
            }}
          >
            <Input
              label="Pipeline job id"
              value={jobIdInput}
              onChange={(event) => setJobIdInput(event.target.value)}
              placeholder="vd: 8f2a1c0d"
              className="font-mono"
            />
            <Button className="mt-0 sm:mt-6" type="submit" disabled={!jobIdInput.trim()}>
              Load job
            </Button>
          </form>

          <label className="block text-sm font-medium text-neutral-700">
            Recent jobs
            <select
              className="mt-1 h-[44px] w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-trust focus:ring-2 focus:ring-[rgba(0,157,140,0.16)]"
              value={selectedJobId}
              onChange={(event) => {
                setSelectedJobId(event.target.value);
                setJobIdInput(event.target.value);
              }}
            >
              <option value="">Chọn job</option>
              {jobs.map((item) => (
                <option key={item.job_id} value={item.job_id}>
                  {item.job_id} · {item.status} · {item.filename || item.subject_id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {job ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Status" value={job.status} />
            <MetricTile label="Progress" value={`${Math.round(job.progress ?? 0)}%`} />
            <MetricTile
              label="Concepts"
              value={job.concepts_after_merge || job.concepts_extracted}
            />
            <MetricTile label="Relations" value={job.relations_verified} />
            <MetricTile label="Updated" value={formatTime(job.updated_at)} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-950">Stage timeline</h2>
                <span className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-600">
                  {activeStage?.id ?? job.status}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 transition-colors',
                      stageTone(stage.status),
                    )}
                  >
                    <div className="mt-0.5 flex size-5 items-center justify-center">
                      <StageIcon status={stage.status} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{stage.label}</div>
                      <div className="mt-0.5 font-mono text-[11px] uppercase tracking-normal opacity-80">
                        {stage.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="space-y-4">
              {stages.map((stage) => (
                <details
                  key={stage.id}
                  open={stage.status === 'active' || stage.status === 'failed'}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-md border',
                          stageTone(stage.status),
                        )}
                      >
                        <StageIcon status={stage.status} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-950">{stage.label}</h3>
                        <p className="font-mono text-xs text-neutral-500">{stage.id}</p>
                      </div>
                    </div>
                    <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-600">
                      {stage.status}
                    </span>
                  </summary>
                  {stage.note ? (
                    <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                      {stage.note}
                    </p>
                  ) : null}
                  <ArtifactList artifacts={stage.artifacts} onOpen={setSelectedArtifact} />
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-neutral-500">
                        <HiOutlineClipboardDocument className="size-4" />
                        Input
                      </div>
                      <JsonBlock value={compactJson(stage.input)} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-neutral-500">
                        <HiOutlineClipboardDocument className="size-4" />
                        Output
                      </div>
                      <JsonBlock value={compactJson(stage.output)} />
                    </div>
                  </div>
                </details>
              ))}

              <details className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-950">
                  Raw job response
                </summary>
                <div className="mt-4">
                  <JsonBlock value={compactJson(job)} />
                </div>
              </details>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <Spinner className="mx-auto" />
          <p className="mt-3 text-sm text-neutral-600">Đang tải danh sách pipeline jobs...</p>
        </section>
      )}
      {selectedArtifact ? (
        <ArtifactModal artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
      ) : null}
    </div>
  );
}
