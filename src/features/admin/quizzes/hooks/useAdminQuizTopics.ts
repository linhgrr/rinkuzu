'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  assignQuizToTopic,
  createQuizTopic,
  fetchAdminQuizTopicDetail,
  fetchAdminQuizTopics,
  reorderTopicQuiz,
  unassignTopicQuiz,
  updateQuizTopic,
} from '@/features/admin/quizzes/api/admin-quiz-topics-api';
import { moveTopicQuiz } from '@/features/admin/quizzes/mappers/admin-quiz-topics.mapper';
import type {
  AdminQuizTopicDetailViewModel,
  AdminQuizTopicFormInput,
  AdminQuizTopicViewModel,
} from '@/features/admin/quizzes/types/admin-quiz-topics-view-model';
import { useReloadSettled } from '@/features/admin/hooks/useReloadSettled';
import { ApiResponseError } from '@/lib/api/client';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

/** The topic editor: a new draft, or an existing topic's fields. */
export type QuizTopicEditor = { mode: 'create' } | { mode: 'edit'; topic: AdminQuizTopicViewModel };

export interface TopicAssignTarget {
  quizId: string;
  title: string;
}

interface State {
  items: readonly AdminQuizTopicViewModel[];
  loading: boolean;
  loadError: unknown;
  reloadToken: number;
  /** `editor`, `assign`, a topic id or a quiz id while its write is in flight. */
  pendingId: string | null;
  editor: QuizTopicEditor | null;
  editorError: string;
  openTopicId: string | null;
  detail: AdminQuizTopicDetailViewModel | null;
  detailError: unknown;
  assignTarget: TopicAssignTarget | null;
  assignError: string;
}

type Action =
  | { type: 'loaded'; items: readonly AdminQuizTopicViewModel[] }
  | { type: 'loadFailed'; error: unknown }
  | { type: 'reload' }
  | { type: 'pending'; pendingId: string | null }
  | { type: 'listSettled'; items: readonly AdminQuizTopicViewModel[] }
  | { type: 'detailSettled'; detail: AdminQuizTopicDetailViewModel }
  | { type: 'detailFailed'; error: unknown }
  | { type: 'editorOpened'; editor: QuizTopicEditor | null }
  | { type: 'editorFailed'; message: string }
  | { type: 'topicOpened'; topicId: string | null }
  | { type: 'assignOpened'; target: TopicAssignTarget | null }
  | { type: 'assignFailed'; message: string };

const initialState: State = {
  items: [],
  loading: true,
  loadError: null,
  reloadToken: 0,
  pendingId: null,
  editor: null,
  editorError: '',
  openTopicId: null,
  detail: null,
  detailError: null,
  assignTarget: null,
  assignError: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { ...state, items: action.items, loading: false, loadError: null };
    case 'loadFailed':
      return { ...state, loading: false, loadError: action.error };
    case 'reload':
      return { ...state, reloadToken: state.reloadToken + 1 };
    case 'pending':
      return { ...state, pendingId: action.pendingId };
    case 'listSettled':
      return { ...state, pendingId: null, items: action.items };
    case 'detailSettled': {
      const { topic } = action.detail;
      const open = state.openTopicId === topic.id;
      return {
        ...state,
        pendingId: null,
        // The detail carries the topic's new quiz count.
        items: state.items.map((item) => (item.id === topic.id ? topic : item)),
        detail: open ? action.detail : state.detail,
        detailError: open ? null : state.detailError,
      };
    }
    case 'detailFailed':
      return { ...state, detailError: action.error };
    case 'editorOpened':
      return { ...state, editor: action.editor, editorError: '' };
    case 'editorFailed':
      return { ...state, pendingId: null, editorError: action.message };
    case 'topicOpened':
      return { ...state, openTopicId: action.topicId, detail: null, detailError: null };
    case 'assignOpened':
      return { ...state, assignTarget: action.target, assignError: '' };
    case 'assignFailed':
      return { ...state, pendingId: null, assignError: action.message };
    default:
      return state;
  }
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function settle<T>(request: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await request() };
  } catch (error) {
    return { ok: false, error };
  }
}

function statusOf(error: unknown): number | null {
  return error instanceof ApiResponseError ? error.status : null;
}

export interface AdminQuizTopicsController {
  items: readonly AdminQuizTopicViewModel[];
  loading: boolean;
  loadError: unknown;
  pendingId: string | null;
  editor: QuizTopicEditor | null;
  editorError: string;
  openTopicId: string | null;
  detail: AdminQuizTopicDetailViewModel | null;
  detailError: unknown;
  assignTarget: TopicAssignTarget | null;
  assignError: string;
  retry: () => Promise<void>;
  openEditor: (editor: QuizTopicEditor | null) => void;
  save: (input: AdminQuizTopicFormInput) => Promise<void>;
  setPublished: (topic: AdminQuizTopicViewModel, published: boolean) => Promise<void>;
  toggleTopic: (topicId: string) => void;
  moveQuiz: (quizId: string, position: number) => Promise<void>;
  removeQuiz: (quizId: string) => Promise<void>;
  openAssign: (target: TopicAssignTarget | null) => void;
  assign: (topicId: string, order?: number) => Promise<void>;
}

/** The `/admin/quizzes` topic panel: list, edit, publish, and each topic's quizzes (RIN-1248). */
export function useAdminQuizTopics(): AdminQuizTopicsController {
  const t = useTranslations('admin.quizTopics');
  const describeError = useAdminApiErrorMessage();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { waitForReload, settleReload } = useReloadSettled();

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      const result = await settle(() => fetchAdminQuizTopics(controller.signal));
      if (cancelled) return;
      dispatch(
        result.ok
          ? { type: 'loaded', items: result.value }
          : { type: 'loadFailed', error: result.error },
      );
      settleReload();
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.reloadToken, settleReload]);

  const openTopicId = state.openTopicId;
  useEffect(() => {
    if (!openTopicId) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    async function load(topicId: string) {
      const result = await settle(() => fetchAdminQuizTopicDetail(topicId, controller.signal));
      if (cancelled) return;
      dispatch(
        result.ok
          ? { type: 'detailSettled', detail: result.value }
          : { type: 'detailFailed', error: result.error },
      );
    }
    void load(openTopicId);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [openTopicId]);

  async function save(input: AdminQuizTopicFormInput) {
    const editor = state.editor;
    if (!editor) return;
    dispatch({ type: 'pending', pendingId: 'editor' });
    const result = await settle(() =>
      editor.mode === 'create' ? createQuizTopic(input) : updateQuizTopic(editor.topic.id, input),
    );
    if (result.ok) {
      dispatch({ type: 'listSettled', items: result.value });
      dispatch({ type: 'editorOpened', editor: null });
      toast.success(t(editor.mode === 'create' ? 'created' : 'saved'));
      return;
    }
    const message =
      statusOf(result.error) === 409 ? t('slugTaken') : describeError(result.error, t('saveError'));
    dispatch({ type: 'editorFailed', message });
  }

  async function setPublished(topic: AdminQuizTopicViewModel, published: boolean) {
    dispatch({ type: 'pending', pendingId: topic.id });
    const result = await settle(() => updateQuizTopic(topic.id, { published }));
    if (result.ok) {
      dispatch({ type: 'listSettled', items: result.value });
      toast.success(t(published ? 'publishedToast' : 'unpublishedToast'));
      return;
    }
    dispatch({ type: 'pending', pendingId: null });
    toast.error(
      statusOf(result.error) === 422
        ? t('publishNeedsIntro')
        : describeError(result.error, t('saveError')),
    );
  }

  /** Shows `optimistic` at once; on failure puts the quizzes back and says so in a toast. */
  async function writeDetail(
    quizId: string,
    request: (topicId: string) => Promise<AdminQuizTopicDetailViewModel>,
    fallback: string,
    optimistic?: AdminQuizTopicDetailViewModel,
  ) {
    const topicId = state.openTopicId;
    const previous = state.detail;
    if (!topicId || !previous) return;
    if (optimistic) dispatch({ type: 'detailSettled', detail: optimistic });
    dispatch({ type: 'pending', pendingId: quizId });
    const result = await settle(() => request(topicId));
    dispatch({ type: 'detailSettled', detail: result.ok ? result.value : previous });
    if (!result.ok) toast.error(describeError(result.error, fallback));
  }

  async function moveQuiz(quizId: string, position: number) {
    const detail = state.detail;
    if (!detail) return;
    await writeDetail(
      quizId,
      (topicId) => reorderTopicQuiz(topicId, quizId, position),
      t('moveError'),
      { ...detail, quizzes: moveTopicQuiz(detail.quizzes, quizId, position) },
    );
  }

  async function removeQuiz(quizId: string) {
    await writeDetail(quizId, (topicId) => unassignTopicQuiz(topicId, quizId), t('removeError'));
  }

  async function assign(topicId: string, order?: number) {
    const target = state.assignTarget;
    if (!target) return;
    dispatch({ type: 'pending', pendingId: 'assign' });
    const result = await settle(() =>
      assignQuizToTopic({ topicId, quizId: target.quizId, ...(order ? { order } : {}) }),
    );
    if (result.ok) {
      dispatch({ type: 'detailSettled', detail: result.value });
      dispatch({ type: 'assignOpened', target: null });
      toast.success(t('assigned', { topic: result.value.topic.name }));
      return;
    }
    const status = statusOf(result.error);
    const message =
      status === 409
        ? t('assignRefusedHasTopic')
        : status === 422
          ? t('assignRefusedNotPublic')
          : describeError(result.error, t('assignError'));
    dispatch({ type: 'assignFailed', message });
  }

  return {
    ...state,
    retry: () => {
      dispatch({ type: 'reload' });
      return waitForReload();
    },
    openEditor: (editor) => dispatch({ type: 'editorOpened', editor }),
    save,
    setPublished,
    toggleTopic: (topicId) =>
      dispatch({ type: 'topicOpened', topicId: state.openTopicId === topicId ? null : topicId }),
    moveQuiz,
    removeQuiz,
    openAssign: (target) => dispatch({ type: 'assignOpened', target }),
    assign,
  };
}
