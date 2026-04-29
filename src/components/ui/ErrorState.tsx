'use client';

interface ErrorStateProps {
  message: string;
  className?: string;
}

export function ErrorState({ message, className = '' }: ErrorStateProps) {
  return (
    <div className={`rounded-md bg-red-50 p-4 ${className}`.trim()}>
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}
