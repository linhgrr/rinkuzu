import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from './Reveal';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const observers: Array<{ callback: ObserverCallback; threshold: unknown; disconnect: () => void }> =
  [];

class FakeIntersectionObserver {
  readonly disconnect = vi.fn();
  constructor(callback: ObserverCallback, options?: { threshold?: unknown }) {
    observers.push({ callback, threshold: options?.threshold, disconnect: this.disconnect });
  }
  observe() {}
}

function enterViewport() {
  act(() => {
    for (const observer of observers) observer.callback([{ isIntersecting: true }]);
  });
}

describe('landing Reveal (RIN-1370)', () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts hidden and offset, then fades up with the framer easing and delay once in view', () => {
    render(
      <Reveal y={28} amount={0.4} duration={0.55} delay={0.1}>
        Feature
      </Reveal>,
    );
    const element = screen.getByText('Feature');

    expect(element).toHaveStyle({ opacity: '0', transform: 'translateY(28px) scale(1)' });
    expect(observers[0]?.threshold).toBe(0.4);

    enterViewport();

    expect(element).toHaveStyle({ opacity: '1', transform: 'none' });
    expect(element.style.transition).toBe(
      'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.1s, transform 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
    );
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  it('scales in when given a starting scale', () => {
    render(
      <Reveal y={0} scale={0.96}>
        Image
      </Reveal>,
    );

    expect(screen.getByText('Image')).toHaveStyle({ transform: 'translateY(0px) scale(0.96)' });
  });

  it('lifts on mouse hover after the reveal, never on touch', () => {
    render(<Reveal hoverLift={16}>Card</Reveal>);
    const card = screen.getByText('Card');
    enterViewport();
    fireEvent.transitionEnd(card);

    fireEvent.pointerEnter(card, { pointerType: 'touch' });
    expect(card).toHaveStyle({ transform: 'none' });

    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    expect(card).toHaveStyle({ transform: 'translateY(-16px)' });
    expect(card.style.transition).toBe('transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)');

    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    expect(card).toHaveStyle({ transform: 'none' });
  });

  it('shows content without motion for reduced-motion users', () => {
    render(<Reveal className="flex">Calm</Reveal>);

    expect(screen.getByText('Calm')).toHaveClass(
      'flex',
      'motion-reduce:!opacity-100',
      'motion-reduce:!transform-none',
      'motion-reduce:!transition-none',
    );
  });

  it('keeps framer-motion out of the landing sections', () => {
    for (const file of ['Reveal', 'StruggleSection', 'CoreIntelligence', 'HowItWorks', 'Metrics']) {
      const source = readFileSync(path.join(__dirname, `${file}.tsx`), 'utf8');
      expect(source, file).not.toMatch(/from 'framer-motion'/);
    }
  });
});
