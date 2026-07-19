import { describe, expect, it } from 'vitest';

import config from '../playwright.config';

describe('Playwright production configuration', () => {
  it('blocks service workers so network interception cannot leak to real services', () => {
    expect(config.use).toMatchObject({ serviceWorkers: 'block' });
  });
});
