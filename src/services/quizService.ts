import { Question } from '@/types/quiz';

export async function extractQuestionsFromPDF(formData: FormData) {
  const response = await fetch('/api/quizzes/preview', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(300000), // 5 minutes timeout
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to extract questions');
  }

  // Process questions to ensure correct format
  const processedQuestions = data.data.questions.map((q: any, index: number) => {
    const questionType = q.type || 'single';
    let processedQuestion: Question = {
      question: q.question,
      options: q.options,
      type: questionType
    };

    if (questionType === 'single') {
      let finalCorrectAnswer = q.correctAnswer;
      
      if (typeof finalCorrectAnswer === 'undefined') {
        if (typeof q.correctIndex === 'number') {
          finalCorrectAnswer = q.correctIndex;
        } else if (typeof q.originalCorrectIndex === 'number') {
          finalCorrectAnswer = q.originalCorrectIndex;
        } else {
          finalCorrectAnswer = 0;
        }
      }
      
      processedQuestion.correctIndex = finalCorrectAnswer;
    } else {
      processedQuestion.correctIndexes = q.correctIndexes || q.correctAnswers || [];
    }

    return processedQuestion;
  });

  return {
    ...data.data,
    questions: processedQuestions
  };
}

export async function createQuiz(quizData: {
  title: string;
  description: string;
  questions: Question[];
  category: string;
  isPrivate: boolean;
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