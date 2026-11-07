import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise, SubmitResult } from '@/features/adaptive/types/learning';
import { ResultCorrectAnswer, ResultLearnerAnswer } from '../ResultAnswers';

vi.mock('@/components/ui/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <span>{content}</span>,
}));

const t = (key: string) => key;

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-1',
    exercise_id: 'exercise-1',
    concept_name: 'Concept',
    concept_idx: 0,
    bloom_level: 1,
    bloom_label: 'Remember',
    exercise_type: 'mcq',
    question: 'What is 2+2?',
    options: { A: 'Four', B: 'Three', C: 'Five' },
    items: [],
    pairs: [],
    right_items: [],
    step: 1,
    max_steps: 5,
    ...overrides,
  };
}

function createResult(overrides: Partial<SubmitResult> = {}): SubmitResult {
  return {
    is_correct: false,
    correct_option: 'A',
    explanation: 'Because four',
    concept_name: 'Concept',
    bloom_level: 1,
    mastery_after: 0.3,
    avg_mastery: 0.3,
    step: 1,
    session_completed: false,
    stats: { total_correct: 0, total_answered: 1, accuracy: 0 },
    ...overrides,
  };
}

describe('ResultCorrectAnswer (RIN-1011)', () => {
  it('shows the MCQ letter together with the option text', () => {
    render(<ResultCorrectAnswer exercise={createExercise()} result={createResult()} t={t} />);

    expect(screen.getByText('A.')).toBeInTheDocument();
    expect(screen.getByText('Four')).toBeInTheDocument();
  });

  it('shows every correct multi-correct option with its text', () => {
    render(
      <ResultCorrectAnswer
        exercise={createExercise({ exercise_type: 'multi_correct', correct_answer: ['A', 'C'] })}
        result={createResult()}
        t={t}
      />,
    );

    expect(screen.getByText('Four')).toBeInTheDocument();
    expect(screen.getByText('Five')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();
  });

  it('falls back to the raw answer when the letter has no option text', () => {
    render(
      <ResultCorrectAnswer
        exercise={createExercise({ options: {} })}
        result={createResult({ correct_option: 'Z' })}
        t={t}
      />,
    );

    expect(screen.getByText('Z')).toBeInTheDocument();
  });
});

describe('ResultLearnerAnswer (RIN-1011)', () => {
  it('shows the wrong MCQ pick with its text under "your answer"', () => {
    render(
      <ResultLearnerAnswer
        answer={{ type: 'mcq', selection: 'B' }}
        exercise={createExercise()}
        isCorrect={false}
        t={t}
      />,
    );

    expect(screen.getByText('result.yourAnswerLabel')).toBeInTheDocument();
    expect(screen.getByText('B.')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
  });

  it('shows true/false and short-answer picks', () => {
    const { unmount } = render(
      <ResultLearnerAnswer
        answer={{ type: 'true_false', value: false }}
        exercise={createExercise({ exercise_type: 'true_false' })}
        isCorrect={false}
        t={t}
      />,
    );
    expect(screen.getByText('exercise.interactions.falseLabel')).toBeInTheDocument();
    unmount();

    render(
      <ResultLearnerAnswer
        answer={{ type: 'short_answer', text: 'my words' }}
        exercise={createExercise({ exercise_type: 'short_answer' })}
        isCorrect={false}
        t={t}
      />,
    );
    expect(screen.getByText('my words')).toBeInTheDocument();
  });

  it('renders nothing when correct, when the answer is missing, or when it belongs to another type', () => {
    const exercise = createExercise();
    const { container, rerender } = render(
      <ResultLearnerAnswer
        answer={{ type: 'mcq', selection: 'B' }}
        exercise={exercise}
        isCorrect
        t={t}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<ResultLearnerAnswer answer={null} exercise={exercise} isCorrect={false} t={t} />);
    expect(container).toBeEmptyDOMElement();

    rerender(
      <ResultLearnerAnswer
        answer={{ type: 'true_false', value: true }}
        exercise={exercise}
        isCorrect={false}
        t={t}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
