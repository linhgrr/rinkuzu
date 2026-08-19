export function isQuizAttemptPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const quizSegmentIndex = segments.lastIndexOf('quiz');

  return (
    quizSegmentIndex >= 0 &&
    quizSegmentIndex === segments.length - 2 &&
    Boolean(segments[quizSegmentIndex + 1])
  );
}

export function isDevtoolShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();

  if (key === 'f12') {
    return true;
  }

  if (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) {
    return true;
  }

  if (event.metaKey && event.altKey && ['i', 'j', 'c'].includes(key)) {
    return true;
  }

  return (event.ctrlKey || event.metaKey) && key === 'u';
}

function isQuizEmailGateInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'email';
}

export function shouldBlockQuizClipboard(pathname: string, target: EventTarget | null): boolean {
  return isQuizAttemptPath(pathname) && !isQuizEmailGateInput(target);
}
