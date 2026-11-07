'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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

interface OverflowEdges {
  end: boolean;
  start: boolean;
}

const NO_OVERFLOW: OverflowEdges = { end: false, start: false };

function readOverflowEdges(list: HTMLElement): OverflowEdges {
  const maxScroll = list.scrollWidth - list.clientWidth;
  return { start: list.scrollLeft > 1, end: list.scrollLeft < maxScroll - 1 };
}

function sameEdges(a: OverflowEdges, b: OverflowEdges) {
  return a.start === b.start && a.end === b.end;
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Scroll the bar horizontally (never the page) so the selected tab sits in the middle. */
function centreTab(list: HTMLElement, tab: HTMLElement, animate: boolean) {
  const maxScroll = list.scrollWidth - list.clientWidth;
  if (maxScroll <= 0) return;
  const listBox = list.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  const target =
    list.scrollLeft + tabBox.left - listBox.left - (list.clientWidth - tabBox.width) / 2;
  list.scrollTo({
    left: Math.round(Math.min(Math.max(target, 0), maxScroll)),
    behavior: animate && !prefersReducedMotion() ? 'smooth' : 'auto',
  });
}

export function TabBar<Value extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: TabBarProps<Value>) {
  const listRef = useRef<HTMLDivElement>(null);
  const hasCentredRef = useRef(false);
  const [edges, setEdges] = useState<OverflowEdges>(NO_OVERFLOW);
  const selectedTabId = options.find((option) => option.value === value)?.tabId;

  const syncEdges = () => {
    const list = listRef.current;
    if (!list) return;
    const next = readOverflowEdges(list);
    setEdges((current) => (sameEdges(current, next) ? current : next));
  };

  // Keep the selected tab in view on a narrow screen: on mount (a ?tab= deep
  // link to the last tab) and on every change (click, arrow keys, back/forward).
  useEffect(() => {
    const list = listRef.current;
    const tab = selectedTabId ? document.getElementById(selectedTabId) : null;
    if (!list || !tab) return;
    centreTab(list, tab, hasCentredRef.current);
    hasCentredRef.current = true;
  }, [selectedTabId]);

  // Fade the side that hides tabs; the observer also fires once on observe.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = readOverflowEdges(list);
      setEdges((current) => (sameEdges(current, next) ? current : next));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

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
    <div className={cn('relative w-fit max-w-full', className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onScroll={syncEdges}
        className="flex w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
      {edges.start ? (
        <span
          data-testid="tab-bar-fade-start"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-px left-px w-8 rounded-l-xl bg-gradient-to-r from-surface to-transparent"
        />
      ) : null}
      {edges.end ? (
        <span
          data-testid="tab-bar-fade-end"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-px right-px w-8 rounded-r-xl bg-gradient-to-l from-surface to-transparent"
        />
      ) : null}
    </div>
  );
}
