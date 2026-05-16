import { afterEach, vi } from 'vitest';

// Allow tests to import modules guarded by `import 'server-only'`. Next.js
// ships a stub that throws when imported from a client bundle; in node-env
// vitest we want a no-op.
vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
