/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'close' ? 'Close' : key),
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('Modal', () => {
  it('adds content padding when a header is present', async () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title="Details">
        <p>Content</p>
      </Modal>,
    );

    expect(
      screen.getByRole('heading', { name: 'Details' }).parentElement?.nextElementSibling,
    ).toHaveClass('p-5');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps the title and close button in a header pinned on small screens (RIN-1019)', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Details">
        <p>Content</p>
      </Modal>,
    );

    const header = screen.getByRole('heading', { name: 'Details' }).parentElement;
    expect(header).toHaveClass('sticky', 'top-0', 'sm:relative');
    const close = screen
      .getAllByRole('button', { name: 'Close' })
      .find((button) => button.hasAttribute('data-modal-close'));
    expect(close?.parentElement).toBe(header);
  });

  it('does not impose padding on full-bleed content without a header', () => {
    render(
      <Modal isOpen onClose={vi.fn()}>
        <section data-testid="full-bleed">Content</section>
      </Modal>,
    );

    expect(screen.getByTestId('full-bleed').parentElement).not.toHaveClass('p-5');
  });
});
