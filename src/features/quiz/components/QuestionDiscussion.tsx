'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { UserProfileLink } from '@/components/user/UserProfileLink';

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

export function QuestionDiscussion({
  quizSlug,
  questionIndex,
  isCollapsed,
  onToggleCollapse,
  isMobile = false,
}: QuestionDiscussionProps) {
  const { data: session } = useSession();
  const t = useTranslations('discussion');
  const _tCommon = useTranslations('common');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isCollapsed) return;

    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/quiz/${quizSlug}/discussions`);
        const data = await response.json();

        if (data.success) {
          const questionDiscussion = data.data.find(
            (d: Discussion) => d.questionIndex === questionIndex,
          );
          setComments(questionDiscussion?.comments || []);
        } else {
          setError(data.error || t('failedToLoad'));
        }
      } catch (_error) {
        setError(t('failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    void fetchComments();
  }, [quizSlug, questionIndex, isCollapsed, t]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.email) {
      setError(t('pleaseLoginToPost'));
      return;
    }

    if (!newComment.trim()) {
      setError(t('pleaseEnterComment'));
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`/api/quiz/${quizSlug}/discussions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionIndex,
          content: newComment.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setComments(data.data.comments);
        setNewComment('');
      } else {
        setError(data.error || t('failedToPost'));
      }
    } catch (_error) {
      setError(t('failedToPost'));
    } finally {
      setSubmitting(false);
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

  const commentCount = comments.length;

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
          className="h-auto w-full justify-between rounded-xl px-2 py-2 text-left"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-neutral-600"
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
            className="w-4 h-4 text-neutral-400 transition-transform"
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
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('sharePlaceholder')}
              className="min-h-[80px] resize-none text-sm"
              rows={2}
              maxLength={2000}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">{newComment.length}/2000</span>
              <Button
                type="submit"
                size="sm"
                loading={submitting}
                disabled={!newComment.trim()}
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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-neutral-500">
            <svg
              className="w-8 h-8 mx-auto mb-2 text-neutral-300"
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
          comments.map((comment) => (
            <div
              key={comment._id}
              className="bg-neutral-50 rounded-lg p-3 border border-neutral-100"
            >
              <div className="flex items-start space-x-2 mb-2">
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
