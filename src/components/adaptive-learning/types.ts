export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export interface Exercise {
    id: string;
    courseId: string;
    title: string;
    bloomLevel: BloomLevel;
    question: string;
    type: 'MCQ' | 'FillBlank' | 'ProblemSolving' | 'Essay';
    options?: string[]; // For MCQ
    correctAnswer?: string;
    hint?: string;
    explanation?: string;
}

export interface Course {
    id: string;
    title: string;
    progress: number; // 0-100
    totalConcepts: number;
    conceptsLearned: number;
    streak: number;
    lastAccessed: string; // ISO date
    currentTopic: string;
}

export interface DailyStats {
    exercisesCompleted: number;
    accuracy: number; // 0-100
    timeSpentMinutes: number;
    conceptsLearned: number;
    streakDays: number;
}
