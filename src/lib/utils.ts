import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    + '-' + Date.now().toString().slice(-6);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function calculateScore(
  userAnswers: (number | number[])[], 
  questions: { type: 'single' | 'multiple'; correctIndex?: number; correctIndexes?: number[] }[]
): number {
  let correct = 0;
  
  for (let i = 0; i < userAnswers.length; i++) {
    const question = questions[i];
    const userAnswer = userAnswers[i];
    
    if (question.type === 'single') {
      // Single choice: compare single answer with correctIndex
      if (typeof userAnswer === 'number' && userAnswer === question.correctIndex) {
        correct++;
      }
    } else if (question.type === 'multiple') {
      // Multiple choice: compare arrays
      if (Array.isArray(userAnswer) && question.correctIndexes) {
        const userSet = new Set(userAnswer.sort());
        const correctSet = new Set(question.correctIndexes.sort());
        
        // Check if arrays are equal
        if (userSet.size === correctSet.size && 
            [...userSet].every(x => correctSet.has(x))) {
          correct++;
        }
      }
    }
  }
  
  return Math.round((correct / userAnswers.length) * 100);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): boolean {
  return password.length >= 6;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export const fileToBuffer = (file: File): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(Buffer.from(reader.result));
      } else {
        reject(new Error('Failed to read file as buffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

 