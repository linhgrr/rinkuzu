import { describe, expect, it, vi } from 'vitest';

import { readCliOptions } from '../../scripts/cli-options.shared.mjs';

const SPEC = {
  apply: { type: 'boolean', default: false },
  'approve-plan': { type: 'string' },
  'max-delete': { type: 'string' },
} as const;

describe('readCliOptions', () => {
  it('reads a boolean flag, and defaults it to false when absent', () => {
    expect(readCliOptions(SPEC, ['--apply'])['apply']).toBe(true);
    expect(readCliOptions(SPEC, [])['apply']).toBe(false);
  });

  it('reads --name=value, the only form the old helper understood', () => {
    expect(readCliOptions(SPEC, ['--max-delete=500'])['max-delete']).toBe('500');
  });

  it('reads --name value, which the old helper dropped on the floor', () => {
    expect(readCliOptions(SPEC, ['--max-delete', '500'])['max-delete']).toBe('500');
  });

  it('leaves an unsupplied string option undefined', () => {
    expect(readCliOptions(SPEC, ['--apply'])['approve-plan']).toBeUndefined();
  });

  it('refuses a misspelled flag instead of ignoring it', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited');
    });
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(() => readCliOptions(SPEC, ['--max-delet=500'])).toThrow('exited');
    expect(exit).toHaveBeenCalledWith(2);
    expect(String(stderr.mock.calls[0]?.[0])).toContain('--max-delete=<value>');

    exit.mockRestore();
    stderr.mockRestore();
  });

  it('refuses a positional argument, so a dropped flag prefix is not silently accepted', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited');
    });
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(() => readCliOptions(SPEC, ['apply'])).toThrow('exited');

    exit.mockRestore();
    stderr.mockRestore();
  });
});
