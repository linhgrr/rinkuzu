'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import {
  decidePremiumSubmission,
  fetchPremiumSubmissions,
  fetchPremiumSourceUrl,
  startPremiumReview,
  type PremiumSubmissionStatusViewModel,
  type PremiumSubmissionViewModel,
} from '@/features/admin/premium-submissions/api/premium-submissions-api';

interface ReviewIssueKeyFields {
  code: string;
  questionIndex?: number;
  message: string;
}

/** Keys review issues by their content so identical issues stay distinct without the array index. */
function keyedReviewIssues<T extends ReviewIssueKeyFields>(issues: readonly T[]) {
  const fingerprints = issues.map((issue) =>
    JSON.stringify([issue.code, issue.questionIndex ?? null, issue.message]),
  );
  return toStableContentEntries(fingerprints).flatMap(({ key, sourceIndex }) => {
    const issue = issues[sourceIndex];
    return issue ? [{ issue, key }] : [];
  });
}

export function PremiumSubmissionsPageClient() {
  const t = useTranslations('admin');
  const describeError = useAdminApiErrorMessage();
  const [status, setStatus] = useState<'' | PremiumSubmissionStatusViewModel>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credits, setCredits] = useState(3);
  const [note, setNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // The reject outcome belongs to one submission: shown in its card only (RIN-1348).
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);

  const {
    data,
    error: loadError,
    mutate,
  } = useSWR(
    ['premium-submissions', status],
    () => fetchPremiumSubmissions(status).then((result) => result.items),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (loadedItems) => {
        setError('');
        setSelectedId((current) =>
          current && loadedItems.some((item) => item.id === current)
            ? current
            : (loadedItems[0]?.id ?? null),
        );
      },
    },
  );
  const items = data ?? [];

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function runReview(submission: PremiumSubmissionViewModel) {
    setBusy(`review:${submission.id}`);
    setError('');
    try {
      const updated = await startPremiumReview(submission.id);
      await mutate((current) => current?.map((item) => (item.id === updated.id ? updated : item)), {
        revalidate: false,
      });
    } catch (reviewError) {
      setError(describeError(reviewError, t('premiumReviewAiError')));
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: 'approve' | 'request_changes' | 'reject') {
    if (!selected) return;
    setBusy(`decision:${selected.id}`);
    setError('');
    setNotice(null);
    try {
      const result = await decidePremiumSubmission(selected.id, {
        decision,
        credits: decision === 'approve' ? credits : 0,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
      });
      await mutate(
        (current) =>
          current?.map((item) => (item.id === result.submission.id ? result.submission : item)),
        { revalidate: false },
      );
      setNote('');
      setOverrideReason('');
      // A reject makes the quiz public unless it cannot be (RIN-1337); say which (RIN-1348).
      if (decision === 'reject') {
        setNotice({
          id: result.submission.id,
          text: t(
            result.quizMadePublic ? 'premiumReviewRejectedPublic' : 'premiumReviewRejectedPrivate',
          ),
        });
      }
    } catch (decisionError) {
      setError(describeError(decisionError, t('premiumReviewDecisionError')));
    } finally {
      setBusy(null);
    }
  }

  async function openSource(submission: PremiumSubmissionViewModel) {
    setBusy(`source:${submission.id}`);
    setError('');
    try {
      const source = await fetchPremiumSourceUrl(submission.id);
      window.open(source.url, '_blank', 'noopener,noreferrer');
    } catch (sourceError) {
      setError(describeError(sourceError, t('premiumReviewSourceError')));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">{t('premiumReviewTitle')}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t('premiumReviewDescription')}</p>
        </div>
        <div className="w-full sm:w-60">
          <Select
            label={t('premiumReviewStatus')}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as '' | PremiumSubmissionStatusViewModel)
            }
          >
            <option value="">{t('statusFilterAll')}</option>
            <option value="pending">{t('premiumStatusPending')}</option>
            <option value="changes_requested">{t('premiumStatusChanges')}</option>
            <option value="approved">{t('premiumStatusApproved')}</option>
            <option value="rejected">{t('premiumStatusRejected')}</option>
            <option value="withdrawn">{t('premiumStatusWithdrawn')}</option>
          </Select>
        </div>
      </header>

      {error ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      {/* A failed load replaces the queue: an empty queue would read as "nothing to review" (RIN-1159). */}
      {loadError ? (
        <ErrorState
          error={loadError}
          message={t('premiumReviewLoadError')}
          onRetry={() => mutate()}
          className="mt-6"
        />
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <section className="space-y-3" aria-label={t('premiumReviewQueue')}>
            {items.map((item) => (
              <Button
                variant="ghost"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`h-auto w-full justify-start rounded-2xl border p-4 text-left transition ${
                  selectedId === item.id
                    ? 'border-brand-trust bg-brand-trust/5'
                    : 'border-line-blue/40 bg-white hover:border-brand-trust/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-ink">{item.snapshot.title}</h2>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {item.sourceType.toUpperCase()} · {item.snapshot.questions.length}{' '}
                  {t('questions')} · v{item.version}
                </p>
              </Button>
            ))}
            {!items.length ? (
              <SurfaceCard className="p-8 text-center text-sm text-ink-muted">
                {t('premiumReviewEmpty')}
              </SurfaceCard>
            ) : null}
          </section>

          {selected ? (
            <SurfaceCard className="space-y-6 p-5 sm:p-7 lg:col-span-2">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-ink">{selected.snapshot.title}</h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      {t('premiumReviewContributor')}: {selected.authorId} · SHA{' '}
                      {selected.snapshotHash.slice(0, 12)}…
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.sourceType === 'pdf' ? (
                      <Button
                        variant="outline"
                        loading={busy === `source:${selected.id}`}
                        onClick={() => void openSource(selected)}
                      >
                        {t('premiumReviewOpenSource')}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      loading={busy === `review:${selected.id}`}
                      disabled={!['pending', 'changes_requested'].includes(selected.status)}
                      onClick={() => void runReview(selected)}
                    >
                      {t('premiumReviewRunAi')}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric
                    label={t('premiumReviewSimilarity')}
                    value={`${Math.round(selected.duplicateReport.highestSimilarity * 100)}%`}
                  />
                  <Metric
                    label={t('premiumReviewSharedQuestions')}
                    value={String(selected.duplicateReport.sharedQuestionCount)}
                  />
                  <Metric label={t('premiumReviewAiStatus')} value={selected.reviewStatus} />
                </div>
                {selected.duplicateReport.exactDocumentRewarded ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    {t('premiumReviewDuplicateReward')}
                  </p>
                ) : null}
              </div>

              {selected.reviewResult ? (
                <section className="rounded-2xl border border-line-blue/40 bg-neutral-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-ink">{t('premiumReviewAiReport')}</h3>
                    <span className="text-sm font-semibold text-brand-trust">
                      {selected.reviewResult.score}/100 · {selected.reviewResult.verdict}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{selected.reviewResult.summary}</p>
                  <ul className="mt-3 space-y-2 text-sm text-ink">
                    {selected.reviewResult.criteria.map((criterion) => (
                      <li key={criterion.key}>
                        <strong>{criterion.key}</strong> ({criterion.score}): {criterion.note}
                      </li>
                    ))}
                    {keyedReviewIssues(selected.reviewResult.issues).map(({ issue, key }) => (
                      <li key={key} className="text-red-700">
                        {issue.questionIndex === undefined ? '' : `#${issue.questionIndex + 1} · `}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <details>
                <summary className="cursor-pointer font-semibold text-ink">
                  {t('premiumReviewQuestions')} ({selected.snapshot.questions.length})
                </summary>
                <ol className="mt-4 space-y-4">
                  {selected.snapshot.questions.map((question, index) => (
                    <li key={question.id} className="rounded-xl border border-line-blue/30 p-4">
                      <div className="flex gap-1 font-medium text-ink">
                        <span>{index + 1}.</span>
                        <QuestionContent content={question.question} />
                      </div>
                      <ul className="mt-2 grid gap-1 text-sm text-ink-muted sm:grid-cols-2">
                        {question.options.map((option, optionIndex) => {
                          const correct =
                            question.type === 'single'
                              ? question.correctIndex === optionIndex
                              : question.correctIndexes?.includes(optionIndex);
                          return (
                            <li
                              key={`${optionIndex}:${option}`}
                              className={correct ? 'font-semibold text-green-700' : ''}
                            >
                              <QuestionContent content={option} variant="answer" />
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              </details>

              {['pending', 'changes_requested'].includes(selected.status) ? (
                <section className="space-y-3 border-t border-line-blue/30 pt-5">
                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <Select
                      label={t('premiumReviewCredits')}
                      value={credits}
                      onChange={(event) => setCredits(Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                    <label className="text-xs font-semibold text-ink">
                      {t('premiumReviewNote')}
                      <textarea
                        className="input mt-1.5 min-h-20 w-full"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </label>
                  </div>
                  {selected.reviewStatus !== 'completed' ? (
                    <label className="block text-xs font-semibold text-ink">
                      {t('premiumReviewOverride')}
                      <textarea
                        className="input mt-1.5 min-h-20 w-full"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="success"
                      loading={busy === `decision:${selected.id}`}
                      onClick={() => void decide('approve')}
                    >
                      {t('premiumReviewApprove')}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void decide('request_changes')}
                    >
                      {t('premiumReviewRequestChanges')}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy !== null}
                      onClick={() => void decide('reject')}
                    >
                      {t('premiumReviewReject')}
                    </Button>
                  </div>
                  <p className="text-xs text-ink-muted">{t('premiumReviewRejectNote')}</p>
                </section>
              ) : null}
              {notice?.id === selected.id ? (
                <p
                  role="status"
                  className="rounded-xl bg-success-surface p-4 text-sm text-green-800"
                >
                  {notice.text}
                </p>
              ) : null}
            </SurfaceCard>
          ) : null}
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-1 font-semibold text-ink">{value}</div>
    </div>
  );
}
