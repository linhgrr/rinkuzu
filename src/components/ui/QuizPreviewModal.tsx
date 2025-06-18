'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { IQuestion } from '@/types';

interface QuizPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questions: IQuestion[];
}

export function QuizPreviewModal({ isOpen, onClose, title, questions }: QuizPreviewModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  if (!questions || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex];

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const getCorrectAnswerText = (question: IQuestion) => {
    if (question.type === 'single' && question.correctIndex !== undefined) {
      return question.options[question.correctIndex];
    } else if (question.type === 'multiple' && question.correctIndexes) {
      return question.correctIndexes.map(idx => question.options[idx]).join(', ');
    }
    return 'No correct answer defined';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Quiz Preview</h2>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
          <div className="text-sm text-gray-600">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>{currentQuestion.question}</span>
              {currentQuestion.type === 'single' ? (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  📝 Single Choice
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                  ☑️ Multiple Choice
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                let isCorrect = false;
                if (currentQuestion.type === 'single') {
                  isCorrect = index === currentQuestion.correctIndex;
                } else if (currentQuestion.type === 'multiple') {
                  isCorrect = currentQuestion.correctIndexes?.includes(index) || false;
                }

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 ${
                      isCorrect
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded ${
                        currentQuestion.type === 'single' ? 'rounded-full' : 'rounded'
                      } border-2 flex items-center justify-center ${
                        isCorrect
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {isCorrect && (
                          currentQuestion.type === 'single' ? (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          ) : (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )
                        )}
                      </div>
                      <span className={`${isCorrect ? 'font-medium text-green-800' : 'text-gray-700'}`}>
                        {option}
                      </span>
                      {isCorrect && (
                        <span className="ml-auto text-green-600 text-sm font-medium">
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-1">Correct Answer(s):</div>
              <div className="text-sm text-blue-800">{getCorrectAnswerText(currentQuestion)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            ← Previous
          </Button>

          <div className="text-sm text-gray-600">
            {currentQuestionIndex + 1} / {questions.length}
          </div>

          <Button
            variant="outline"
            onClick={nextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Next →
          </Button>
        </div>

        {/* Question Overview */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Question Overview</h4>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </Modal>
  );
} 