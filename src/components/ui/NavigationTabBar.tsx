'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type NavigationHref = ComponentProps<typeof Link>['href'];

interface NavigationTabBarOption<Value extends string> {
  href: NavigationHref;
  icon?: ReactNode;
  label: string;
  value: Value;
}

interface NavigationTabBarProps<Value extends string> {
  ariaLabel: string;
  className?: string;
  options: readonly NavigationTabBarOption<Value>[];
  value: Value;
}

export function NavigationTabBar<Value extends string>({
  ariaLabel,
  className,
  options,
  value,
}: NavigationTabBarProps<Value>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'btn h-9 min-h-10 shrink-0 whitespace-nowrap px-3 text-xs font-medium',
              selected ? 'btn-primary' : 'btn-ghost',
            )}
          >
            <span className="flex items-center gap-2">
              {option.icon}
              {option.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
