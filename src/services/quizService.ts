import { Question } from '@/types/quiz';

export async function createQuiz(quizData: {
  title: string;
  description: string;
  questions: Question[];
  category: string;
  isPrivate: boolean;
  pdfUrl?: string; // S3 URL to the extracted PDF
}) {
  const response = await fetch('/api/quizzes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(quizData),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create quiz');
  }

  return data;
} 