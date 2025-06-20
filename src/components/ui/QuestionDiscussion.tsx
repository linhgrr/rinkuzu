'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Input } from './Input';

interface Comment {
  _id: string;
  author: {
    _id: string;
    email: string;
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
  isMobile = false 
}: QuestionDiscussionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isCollapsed) {
      fetchComments();
    }
  }, [quizSlug, questionIndex, isCollapsed]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quiz/${quizSlug}/discussions`);
      const data = await response.json();

      if (data.success) {
        const questionDiscussion = data.data.find(
          (d: Discussion) => d.questionIndex === questionIndex
        );
        setComments(questionDiscussion?.comments || []);
      } else {
        setError(data.error || 'Failed to load comments');
      }
    } catch (error) {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.email) {
      setError('Please log in to post a comment');
      return;
    }

    if (!newComment.trim()) {
      setError('Please enter a comment');
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
        setError(data.error || 'Failed to post comment');
      }
    } catch (error) {
      setError('Failed to post comment');
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
    <div className={isMobile ? 'w-full h-full' : 'w-80 h-screen sticky top-0 border-l border-gray-200 bg-white transition-all duration-300 hidden md:flex flex-col'}>
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-100 bg-gray-50">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium text-gray-900">Discussion</span>
            {commentCount > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded-full">
                {commentCount}
              </span>
            )}
          </div>
          <svg 
            className="w-4 h-4 text-gray-400 transition-transform" 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Comment Form - Moved to top */}
      <div className="flex-shrink-0 border-b border-gray-100 p-3 bg-white">
        {session?.user?.email ? (
          <form onSubmit={handleSubmitComment} className="space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts..."
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-xs resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              maxLength={2000}
            />
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {newComment.length}/2000
              </span>
              <Button
                type="submit"
                size="sm"
                loading={submitting}
                disabled={!newComment.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
              >
                Post
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-gray-500 mb-2">
              Please log in to join the discussion
            </p>
            <Button size="sm" variant="outline" className="text-xs px-3 py-1">
              Log In
            </Button>
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs">No comments yet</p>
                <p className="text-xs mt-1 text-gray-400">Be the first to discuss!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-start space-x-2 mb-2">
                    <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                      {comment.authorEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {comment.authorEmail.split('@')[0]}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed mt-1">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
    </div>
  );
} 