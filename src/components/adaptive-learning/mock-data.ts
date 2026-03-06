import { Course, DailyStats } from './types';

export const mockCourses: Course[] = [
    {
        id: 'math-12',
        title: 'Toán Giải tích 12',
        progress: 68,
        totalConcepts: 34,
        conceptsLearned: 23,
        streak: 5,
        lastAccessed: '2023-10-25T10:00:00Z',
        currentTopic: 'Đạo hàm hàm hợp',
    },
    {
        id: 'physics-11',
        title: 'Vật Lý 11',
        progress: 42,
        totalConcepts: 45,
        conceptsLearned: 18,
        streak: 2,
        lastAccessed: '2023-10-24T15:30:00Z',
        currentTopic: 'Điện tích - Điện trường',
    },
    {
        id: 'chemistry-10',
        title: 'Hóa học 10',
        progress: 0,
        totalConcepts: 20,
        conceptsLearned: 0,
        streak: 0,
        lastAccessed: '2023-10-20T09:00:00Z',
        currentTopic: 'Cấu tạo nguyên tử',
    },
];

export const mockDailyStats: DailyStats = {
    exercisesCompleted: 12,
    accuracy: 83,
    timeSpentMinutes: 45,
    conceptsLearned: 3,
    streakDays: 12,
};

export const mockExercises = [
    {
        id: 'ex-01',
        courseId: 'math-12',
        title: 'Đạo hàm cơ bản',
        bloomLevel: 'Remember',
        question: "Đạo hàm của hàm số f(x) = x³ là:",
        type: 'MCQ',
        options: {
            A: 'f\'(x) = 3x',
            B: 'f\'(x) = 3x²',
            C: 'f\'(x) = x²',
            D: 'f\'(x) = 2x³',
        },
        correctAnswer: 'f\'(x) = 3x²',
        explanation: "Áp dụng công thức đạo hàm của hàm lũy thừa: (xⁿ)' = n·xⁿ⁻¹. Với n=3, ta có (x³)' = 3x².",
    },
    {
        id: 'ex-02',
        courseId: 'math-12',
        title: 'Quy tắc đạo hàm',
        bloomLevel: 'Understand',
        question: "Điền vào chỗ trống công thức đạo hàm của tích: (u.v)' = u'.v + ...",
        type: 'FillBlank',
        correctAnswer: "u.v'",
        hint: "Quy tắc Leibniz cho tích hai hàm số",
    },
    {
        id: 'ex-03',
        courseId: 'math-12',
        title: 'Đạo hàm hàm hợp',
        bloomLevel: 'Apply',
        question: "Một vật chuyển động với phương trình s(t) = (2t + 1)³ (m). Tính vận tốc tại t = 2s.",
        type: 'ProblemSolving',
        correctAnswer: "150",
        explanation: "v(t) = s'(t) = 3(2t+1)² * 2 = 6(2t+1)². Tại t=2, v(2) = 6(5)² = 150 m/s.",
    },
    {
        id: 'ex-04',
        courseId: 'math-12',
        title: 'Ứng dụng đạo hàm',
        bloomLevel: 'Analyze',
        question: "So sánh phương pháp tìm cực trị dùng đạo hàm cấp 1 và đạo hàm cấp 2.",
        type: 'Essay',
        hint: "Xem lại điều kiện đủ của cực trị",
    },
];
