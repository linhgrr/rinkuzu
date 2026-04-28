import type React from 'react';

interface CategoryOptionItemProps {
  title: string;
  subtitle?: string;
  color?: string;
  selected?: boolean;
  onClick: () => void;
}

export function CategoryOptionItem({
  title,
  subtitle,
  color,
  selected = false,
  onClick,
}: CategoryOptionItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset ${
        selected ? 'bg-neutral-100 text-brand-trust' : 'hover:bg-neutral-50 text-neutral-700'
      }`}
    >
      <div className="flex items-center space-x-3">
        {color ? (
          <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle ? <div className="truncate text-xs text-neutral-500">{subtitle}</div> : null}
        </div>
      </div>
    </button>
  );
}
