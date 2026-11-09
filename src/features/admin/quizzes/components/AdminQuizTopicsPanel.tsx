'use client';

import { useTranslations } from 'next-intl';
import {
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlineExclamation,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineX,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { AdminStarterQuizzesSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';
import {
  AssignTopicDialog,
  QuizTopicEditorDialog,
} from '@/features/admin/quizzes/components/QuizTopicDialogs';
import type { AdminQuizTopicsController } from '@/features/admin/quizzes/hooks/useAdminQuizTopics';
import type {
  AdminQuizTopicQuizViewModel,
  AdminQuizTopicViewModel,
} from '@/features/admin/quizzes/types/admin-quiz-topics-view-model';
import { isTopicIntroPublishable } from '@/shared/constants/quiz-topic';

/** Row actions are 36px (`sm`); below lg they grow to a 44px touch target (RIN-1228). */
const ROW_ACTION_TOUCH_TARGET = 'min-h-11 min-w-11 lg:min-h-0 lg:min-w-0';

interface ControllerProps {
  controller: AdminQuizTopicsController;
}

interface TopicQuizRowProps extends ControllerProps {
  quiz: AdminQuizTopicQuizViewModel;
  total: number;
}

function TopicQuizRow({ quiz, total, controller }: TopicQuizRowProps) {
  const t = useTranslations('admin.quizTopics');
  const title = quiz.title ?? t('untitled');
  const busy = controller.pendingId !== null;

  return (
    <li className="grid gap-2 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">
          {quiz.order}. {title}
        </p>
        <p className="text-xs text-ink/55">{t('questionCount', { count: quiz.questionCount })}</p>
        {quiz.isPublic ? null : (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800">
            <HiOutlineExclamation className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t('quizNotPublic')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <Button
          size="sm"
          variant="outline"
          className={ROW_ACTION_TOUCH_TARGET}
          aria-label={t('moveUp', { title })}
          disabled={busy || quiz.order <= 1}
          onClick={() => void controller.moveQuiz(quiz.quizId, quiz.order - 1)}
        >
          <HiOutlineArrowUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={ROW_ACTION_TOUCH_TARGET}
          aria-label={t('moveDown', { title })}
          disabled={busy || quiz.order >= total}
          onClick={() => void controller.moveQuiz(quiz.quizId, quiz.order + 1)}
        >
          <HiOutlineArrowDown className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`${ROW_ACTION_TOUCH_TARGET} border-red-200 text-red-600 hover:border-red-300 hover:text-red-700`}
          aria-label={t('removeQuiz', { title })}
          disabled={busy}
          onClick={() => void controller.removeQuiz(quiz.quizId)}
        >
          <HiOutlineX className="mr-1 size-4" aria-hidden="true" />
          {t('remove')}
        </Button>
      </div>
    </li>
  );
}

function TopicQuizzes({ controller }: ControllerProps) {
  const t = useTranslations('admin.quizTopics');
  const { detail, detailError } = controller;

  if (detailError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t('detailError')}
      </p>
    );
  }
  if (!detail) {
    return (
      <p role="status" className="text-sm text-ink/55">
        {t('detailLoading')}
      </p>
    );
  }
  if (detail.quizzes.length === 0) {
    return <p className="text-sm text-ink/55">{t('noQuizzes')}</p>;
  }
  return (
    <ol
      className="divide-y divide-line-blue/20"
      aria-label={t('quizListLabel', { topic: detail.topic.name })}
    >
      {detail.quizzes.map((quiz) => (
        <TopicQuizRow
          key={quiz.quizId}
          quiz={quiz}
          total={detail.quizzes.length}
          controller={controller}
        />
      ))}
    </ol>
  );
}

interface TopicRowProps extends ControllerProps {
  topic: AdminQuizTopicViewModel;
}

function TopicRow({ topic, controller }: TopicRowProps) {
  const t = useTranslations('admin.quizTopics');
  const open = controller.openTopicId === topic.id;
  const busy = controller.pendingId !== null;
  const canPublish = isTopicIntroPublishable(topic.intro);
  const panelId = `quiz-topic-quizzes-${topic.id}`;

  return (
    <li className="p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">{topic.name}</h3>
            <span
              className={
                topic.published
                  ? 'rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700'
                  : 'rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600'
              }
            >
              {t(topic.published ? 'publishedBadge' : 'draftBadge')}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-ink/55">
            /vi/explore/{topic.slug} · {t('quizCount', { count: topic.quizCount })} ·{' '}
            {t('introWordCount', { count: topic.introWords })}
          </p>
          {!topic.published && !canPublish ? (
            <p className="mt-1 text-xs text-amber-800">{t('publishNeedsIntro')}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            className={ROW_ACTION_TOUCH_TARGET}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => controller.toggleTopic(topic.id)}
          >
            {t(open ? 'hideQuizzes' : 'showQuizzes', { count: topic.quizCount })}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={ROW_ACTION_TOUCH_TARGET}
            disabled={busy}
            onClick={() => controller.openEditor({ mode: 'edit', topic })}
          >
            <HiOutlinePencil className="mr-1 size-4" aria-hidden="true" />
            {t('edit')}
          </Button>
          <Button
            size="sm"
            variant={topic.published ? 'outline' : 'primary'}
            className={ROW_ACTION_TOUCH_TARGET}
            disabled={busy || (!topic.published && !canPublish)}
            loading={controller.pendingId === topic.id}
            onClick={() => void controller.setPublished(topic, !topic.published)}
          >
            {t(topic.published ? 'unpublish' : 'publish')}
          </Button>
        </div>
      </div>
      {open ? (
        <div id={panelId} className="mt-3 rounded-xl bg-surface-blue/40 px-4 py-2">
          <TopicQuizzes controller={controller} />
          <p className="mt-2 text-xs text-ink/55">{t('assignHint')}</p>
        </div>
      ) : null}
    </li>
  );
}

function TopicPanelBody({ controller }: ControllerProps) {
  const t = useTranslations('admin.quizTopics');

  if (controller.loadError) {
    return <ErrorState error={controller.loadError} onRetry={controller.retry} className="m-4" />;
  }
  if (controller.loading) return <AdminStarterQuizzesSkeleton />;
  if (controller.items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold text-ink">{t('emptyTitle')}</p>
        <p className="mt-1 text-sm text-ink/55">{t('emptyHint')}</p>
      </div>
    );
  }
  return (
    <ol className="divide-y divide-line-blue/25" aria-label={t('listLabel')}>
      {controller.items.map((topic) => (
        <TopicRow key={topic.id} topic={topic} controller={controller} />
      ))}
    </ol>
  );
}

/** Topic hubs ("Chủ đề"): drafts, published hubs and their quizzes in order (RIN-1248). */
export function AdminQuizTopicsPanel({ controller }: ControllerProps) {
  const t = useTranslations('admin.quizTopics');

  return (
    <section
      aria-labelledby="admin-quiz-topics-heading"
      aria-busy={controller.loading}
      className="mt-6 overflow-hidden rounded-2xl border border-line-blue/30 bg-white"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-blue/25 px-5 py-4">
        <div className="min-w-0">
          <h2 id="admin-quiz-topics-heading" className="text-lg font-semibold text-ink">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-ink/60">{t('description')}</p>
        </div>
        <Button
          size="sm"
          className="min-h-11 lg:min-h-0"
          disabled={controller.loading || controller.loadError !== null}
          onClick={() => controller.openEditor({ mode: 'create' })}
        >
          <HiOutlinePlus className="mr-1 size-4" aria-hidden="true" />
          {t('create')}
        </Button>
      </header>
      <TopicPanelBody controller={controller} />
      <QuizTopicEditorDialog controller={controller} />
      <AssignTopicDialog controller={controller} />
    </section>
  );
}
