import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput';

function SearchHarness({ onEnter, onSubmit }: { onEnter?: () => void; onSubmit?: () => void }) {
  const [value, setValue] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <AdminSearchInput
        value={value}
        placeholder="Search users"
        onChange={setValue}
        onEnter={onEnter}
      />
    </form>
  );
}

describe('AdminSearchInput', () => {
  it('updates the accessible search field and submits its form with Enter', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchHarness onSubmit={onSubmit} />);
    const searchInput = screen.getByRole('textbox', { name: 'Search users' });

    await user.type(searchInput, 'linh{Enter}');

    expect(searchInput).toHaveValue('linh');
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument();
  });

  it('uses the explicit Enter action instead of submitting its containing form', async () => {
    const onEnter = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchHarness onEnter={onEnter} onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Search users' }), 'quiz{Enter}');

    expect(onEnter).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
