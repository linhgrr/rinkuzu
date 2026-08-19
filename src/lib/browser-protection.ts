export function isQuizAttemptPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const quizSegmentIndex = segments.lastIndexOf('quiz');

  return (
    quizSegmentIndex >= 0 &&
    quizSegmentIndex === segments.length - 2 &&
    Boolean(segments[quizSegmentIndex + 1])
  );
}

function isQuizEmailGateInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'email';
}

export function shouldBlockQuizClipboard(pathname: string, target: EventTarget | null): boolean {
  return isQuizAttemptPath(pathname) && !isQuizEmailGateInput(target);
}
