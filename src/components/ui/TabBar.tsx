'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface TabBarOption<Value extends string> {
  controlsId: string;
  icon?: ReactNode;
  label: string;
  tabId: string;
  value: Value;
}

interface TabBarProps<Value extends string> {
  ariaLabel: string;
  className?: string;
  onChange: (value: Value) => void;
  options: readonly TabBarOption<Value>[];
  value: Value;
}

export function TabBar<Value extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: TabBarProps<Value>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + options.length) %
            options.length;
    const nextOption = options[nextIndex];
    if (!nextOption) return;

    onChange(nextOption.value);
    document.getElementById(nextOption.tabId)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            id={option.tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={option.controlsId}
            tabIndex={selected ? 0 : -1}
            size="sm"
            variant={selected ? 'primary' : 'ghost'}
            className="min-h-10 shrink-0 whitespace-nowrap"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.icon}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
