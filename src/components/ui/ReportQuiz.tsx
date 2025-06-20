'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ReportQuizProps {
  quizSlug: string;
  quizTitle: string;
}

export default function ReportQuiz({ quizSlug, quizTitle }: ReportQuizProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/quiz/${quizSlug}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setContent('');
        setTimeout(() => {
          setIsOpen(false);
          setIsSubmitted(false);
        }, 2000);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
        title="Report this quiz"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        Report Quiz
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Report Quiz">
        <div>
          {isSubmitted ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Report Submitted</h3>
              <p className="text-gray-600">Thank you for your report. Our team will review it soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quiz: <span className="font-semibold">{quizTitle}</span>
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  Please describe the issue with this quiz. Your report will help us improve the content quality.
                </p>
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  Report Details *
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={6}
                  maxLength={2000}
                  placeholder="Please provide details about the issue (e.g., incorrect answers, inappropriate content, spam, etc.)"
                  required
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    Describe the problem clearly and specifically
                  </span>
                  <span className="text-xs text-gray-500">
                    {content.length}/2000
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
} 