'use client';

interface LoadingStateProps {
  text?: string;
  className?: string;
}

export function LoadingState({ text = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex justify-center py-12 ${className}`.trim()}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
        <p className="text-sm text-neutral-500">{text}</p>
      </div>
    </div>
  );
}
