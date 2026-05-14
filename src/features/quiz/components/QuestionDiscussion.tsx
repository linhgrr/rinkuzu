'use client';

import { useEffect, useReducer } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { UserProfileLink } from '@/components/user/UserProfileLink';
import { fetchApiData } from '@/lib/api/client';

interface Comment {
  _id: string;
  author: {
    _id: string;
    email: string;
    name?: string;
    displayName?: string;
    avatar?: string;
  };
  authorEmail: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
}

interface Discussion {
  _id: string;
  quiz: string;
  questionIndex: number;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

interface QuestionDiscussionProps {
  quizSlug: string;
  questionIndex: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
}

interface QuestionDiscussionState {
  comments: Comment[];
  newComment: string;
  loading: boolean;
  submitting: boolean;
  error: string;
}

type QuestionDiscussionAction =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; comments: Comment[] }
  | { type: 'fetch:error'; error: string }
  | { type: 'comment:setDraft'; value: string }
  | { type: 'submit:start' }
  | { type: 'submit:success'; comments: Comment[] }
  | { type: 'submit:error'; error: string }
  | { type: 'error:set'; error: string };

const initialState: QuestionDiscussionState = {
  comments: [],
  newComment: '',
  loading: true,
  submitting: false,
  error: '',
};

function questionDiscussionReducer(
  state: QuestionDiscussionState,
  action: QuestionDiscussionAction,
): QuestionDiscussionState {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true, error: '' };
    case 'fetch:success':
      return { ...state, comments: action.comments, loading: false, error: '' };
    case 'fetch:error':
      return { ...state, loading: false, error: action.error };
    case 'comment:setDraft':
      return { ...state, newComment: action.value };
    case 'submit:start':
      return { ...state, submitting: true, error: '' };
    case 'submit:success':
      return {
        ...state,
        comments: action.comments,
        newComment: '',
        submitting: false,
        error: '',
      };
    case 'submit:error':
      return { ...state, submitting: false, error: action.error };
    case 'error:set':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

export function QuestionDiscussion({
  quizSlug,
  questionIndex,
  isCollapsed,
  onToggleCollapse,
  isMobile = false,
}: QuestionDiscussionProps) {
  const { data: session } = useSession();
  const t = useTranslations('discussion');
  const [state, dispatch] = useReducer(questionDiscussionReducer, initialState);

  useEffect(() => {
    if (isCollapsed) return;

    let isActive = true;

    const fetchComments = async () => {
      try {
        dispatch({ type: 'fetch:start' });
        const discussions = await fetchApiData<Discussion[]>(`/api/quiz/${quizSlug}/discussions`);
        const questionDiscussion = discussions.find((d) => d.questionIndex === questionIndex);

        if (!isActive) {
          return;
        }

        dispatch({
          type: 'fetch:success',
          comments: questionDiscussion?.comments || [],
        });
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        dispatch({
          type: 'fetch:error',
          error: error instanceof Error ? error.message : t('failedToLoad'),
        });
      }
    };

    void fetchComments();

    return () => {
      isActive = false;
    };
  }, [quizSlug, questionIndex, isCollapsed, t]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.email) {
      dispatch({ type: 'error:set', error: t('pleaseLoginToPost') });
      return;
    }

    if (!state.newComment.trim()) {
      dispatch({ type: 'error:set', error: t('pleaseEnterComment') });
      return;
    }

    try {
      dispatch({ type: 'submit:start' });

      const discussion = await fetchApiData<Discussion>(`/api/quiz/${quizSlug}/discussions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionIndex,
          content: state.newComment.trim(),
        }),
      });
      dispatch({ type: 'submit:success', comments: discussion.comments });
    } catch (error: unknown) {
      dispatch({
        type: 'submit:error',
        error: error instanceof Error ? error.message : t('failedToPost'),
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const commentCount = state.comments.length;

  // Don't show anything when collapsed - button is now in the quiz page header
  if (isCollapsed && !isMobile) {
    return null;
  }

  return (
    <div
      className={
        isMobile
          ? 'h-full w-full'
          : 'sticky top-0 hidden h-screen w-80 flex-col border-l border-neutral-200 bg-white transition-[width,border-color] duration-300 md:flex'
      }
    >
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-neutral-100 bg-neutral-50">
        <Button
          type="button"
          onClick={onToggleCollapse}
          variant="ghost"
          className="h-auto w-full justify-between rounded-xl p-2 text-left"
        >
          <div className="flex items-center gap-x-2">
            <svg
              className="size-4 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-sm font-medium text-neutral-900">{t('title')}</span>
            {commentCount > 0 && (
              <span className="inline-flex min-h-[28px] items-center rounded-full bg-orange-100 px-3 text-[13px] font-semibold text-orange-800">
                {commentCount}
              </span>
            )}
          </div>
          <svg
            className="size-4 text-neutral-400 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Button>
      </div>

      {/* Comment Form - Moved to top */}
      <div className="flex-shrink-0 border-b border-neutral-100 p-3 bg-white">
        {session?.user?.email ? (
          <form onSubmit={handleSubmitComment} className="space-y-2">
            <Textarea
              value={state.newComment}
              onChange={(e) => dispatch({ type: 'comment:setDraft', value: e.target.value })}
              placeholder={t('sharePlaceholder')}
              className="min-h-[80px] resize-none text-sm"
              rows={2}
              maxLength={2000}
            />
            {state.error && <p className="text-xs text-red-600">{state.error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">{state.newComment.length}/2000</span>
              <Button
                type="submit"
                size="sm"
                loading={state.submitting}
                disabled={!state.newComment.trim()}
                className="px-3"
              >
                {t('post')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-neutral-500 mb-2">{t('pleaseLoginToJoin')}</p>
            <Button size="sm" variant="outline" className="px-3">
              {t('logIn')}
            </Button>
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {state.loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          </div>
        ) : state.comments.length === 0 ? (
          <div className="text-center py-6 text-neutral-500">
            <svg
              className="size-8 mx-auto mb-2 text-neutral-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-xs">{t('noComments')}</p>
            <p className="text-xs mt-1 text-neutral-400">{t('beFirstToDiscuss')}</p>
          </div>
        ) : (
          state.comments.map((comment) => (
            <div
              key={comment._id}
              className="bg-neutral-50 rounded-lg p-3 border border-neutral-100"
            >
              <div className="flex items-start gap-x-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <UserProfileLink
                      user={{
                        ...comment.author,
                        email: comment.author?.email || comment.authorEmail,
                      }}
                      avatarSize={24}
                      className="max-w-[65%] text-xs font-medium text-neutral-900"
                      nameClassName="text-xs font-medium text-neutral-900"
                    />
                    <span className="text-xs text-neutral-500 flex-shrink-0">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed mt-1">{comment.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
