'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ImageDisplay } from '@/components/ui/ImageDisplay';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { PremiumCreditCost } from '@/features/quiz/components/PremiumCreditCost';
import {
  fetchPremiumFlashcard,
  revealPremiumFlashcard,
  startPremiumFlashcardSession,
  unlockPremiumQuiz,
  type PremiumCatalogMetadataViewModel,
  type PremiumFlashcardRevealViewModel,
  type PremiumFlashcardViewModel,
} from '@/features/quiz/api/premium-quiz-api';
import { ApiResponseError } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';

export function PremiumFlashcardClient({
  metadata,
}: {
  metadata: PremiumCatalogMetadataViewModel;
}) {
  const t = useTranslations('quiz');
  const tFlashcard = useTranslations('flashcard');
  const [card, setCard] = useState<PremiumFlashcardViewModel | null>(null);
  const [reveal, setReveal] = useState<PremiumFlashcardRevealViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockRequired, setUnlockRequired] = useState(false);
  const [error, setError] = useState('');

  async function begin() {
    setLoading(true);
    setError('');
    try {
      setCard(await startPremiumFlashcardSession(metadata.quizId));
      setReveal(null);
      setUnlockRequired(false);
    } catch (startError) {
      if (startError instanceof ApiResponseError && startError.status === 403) {
        setUnlockRequired(true);
      } else {
        setError(extractUnknownErrorMessage(startError, t('loadError')));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void startPremiumFlashcardSession(metadata.quizId)
      .then((started) => {
        if (!active) return;
        setCard(started);
        setReveal(null);
        setUnlockRequired(false);
        setError('');
      })
      .catch((startError: unknown) => {
        if (!active) return;
        if (startError instanceof ApiResponseError && startError.status === 403) {
          setUnlockRequired(true);
        } else {
          setError(extractUnknownErrorMessage(startError, t('loadError')));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [metadata.quizId, t]);

  async function showAnswer() {
    if (!card) return;
    setLoading(true);
    try {
      setReveal(await revealPremiumFlashcard(card.sessionId, card.revealCursor));
    } catch (revealError) {
      setError(extractUnknownErrorMessage(revealError, t('loadError')));
    } finally {
      setLoading(false);
    }
  }

  async function move(cursor: string | undefined) {
    if (!card || !cursor) return;
    setLoading(true);
    setError('');
    try {
      setCard(await fetchPremiumFlashcard(card.sessionId, cursor));
      setReveal(null);
    } catch (cardError) {
      setError(extractUnknownErrorMessage(cardError, t('loadError')));
    } finally {
      setLoading(false);
    }
  }

  async function unlock() {
    setLoading(true);
    try {
      await unlockPremiumQuiz(metadata.quizId);
      await begin();
    } catch (unlockError) {
      setError(extractUnknownErrorMessage(unlockError, t('premiumUnlockError')));
    } finally {
      setLoading(false);
    }
  }

  const correctIndexes = useMemo(() => {
    if (!reveal) return new Set<number>();
    return new Set(reveal.type === 'single' ? [reveal.correctIndex] : reveal.correctIndexes);
  }, [reveal]);

  if (unlockRequired) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <SurfaceCard className="p-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">{metadata.title}</h1>
          <p className="mt-4 text-sm text-ink-muted">{t('premiumUnlockDescription')}</p>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          <Button
            className="mt-5"
            loading={loading}
            aria-label={t('premiumUnlockButton')}
            title={t('premiumUnlockButton')}
            onClick={() => void unlock()}
          >
            <PremiumCreditCost />
          </Button>
        </SurfaceCard>
      </main>
    );
  }

  if (!card) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center text-ink-muted">
        {loading ? t('loadingQuiz') : error || t('loadError')}
      </div>
    );
  }

  return (
    <main className="premium-protected-content relative mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div
        className="pointer-events-none fixed inset-0 z-40 grid grid-cols-3 content-around overflow-hidden opacity-10"
        aria-hidden="true"
      >
        {Array.from({ length: 15 }, (_, index) => (
          <span
            key={`${card.watermark}:${index}`}
            className="-rotate-12 select-none text-center text-xs font-semibold text-ink"
          >
            {card.watermark}
          </span>
        ))}
      </div>
      <header className="relative z-50 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-trust">
          Quiz Premium · Flashcard
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold text-ink">{card.title}</h1>
          <span className="text-sm text-ink-muted">
            {card.questionIndex + 1}/{card.totalQuestions}
          </span>
        </div>
      </header>
      {error ? (
        <p className="relative z-50 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <SurfaceCard className="relative z-50 p-6 sm:p-8">
        <div className="text-xl font-semibold leading-relaxed text-ink">
          <QuestionContent content={card.question.question} />
        </div>
        {card.question.questionImage ? (
          <ImageDisplay
            src={card.question.questionImage}
            alt={t('questionImageAlt', { number: card.questionIndex + 1 })}
            className="mt-4"
          />
        ) : null}
        <ol className="mt-6 grid gap-3">
          {card.question.options.map((option, index) => (
            <li
              key={`${index}:${option}`}
              className={`rounded-xl border p-4 text-sm ${reveal && correctIndexes.has(index) ? 'border-green-400 bg-green-50 font-semibold text-green-800' : 'border-line-blue/40 text-ink'}`}
            >
              <div className="flex gap-1">
                <span>{String.fromCharCode(65 + index)}.</span>
                <QuestionContent content={option} variant="answer" />
              </div>
              {card.question.optionImages?.[index] ? (
                <ImageDisplay
                  src={card.question.optionImages[index]}
                  alt={t('optionImageAlt', { option: String.fromCharCode(65 + index) })}
                  className="mt-3"
                />
              ) : null}
            </li>
          ))}
        </ol>
        {!reveal ? (
          <Button className="mt-6 w-full" loading={loading} onClick={() => void showAnswer()}>
            {tFlashcard('revealAnswer')}
          </Button>
        ) : (
          <p className="mt-5 rounded-xl bg-green-50 p-3 text-center text-sm font-semibold text-green-800">
            {tFlashcard('correctAnswer')}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled={!card.previousCursor || loading}
            onClick={() => void move(card.previousCursor)}
          >
            {t('previousQuestion')}
          </Button>
          <Button
            disabled={!card.nextCursor || !reveal || loading}
            onClick={() => void move(card.nextCursor)}
          >
            {t('nextQuestion')}
          </Button>
        </div>
      </SurfaceCard>
    </main>
  );
}
