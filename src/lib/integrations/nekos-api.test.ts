import { describe, expect, it } from 'vitest';
import { NekosApiContractError, parseNekosApiImageUrls } from '@/lib/integrations/nekos-api';

describe('NekosAPI response contract', () => {
  it('extracts URLs from the documented array response', () => {
    expect(
      parseNekosApiImageUrls([
        {
          id: 1,
          url: 'https://images.example/one.webp',
          rating: 'safe',
        },
      ]),
    ).toEqual(['https://images.example/one.webp']);
  });

  it('rejects former aliases and alternative envelopes', () => {
    expect(() =>
      parseNekosApiImageUrls([{ image_url: 'https://images.example/one.webp' }]),
    ).toThrow(NekosApiContractError);
    expect(() =>
      parseNekosApiImageUrls({
        images: [{ url: 'https://images.example/one.webp' }],
      }),
    ).toThrow(NekosApiContractError);
  });
});
