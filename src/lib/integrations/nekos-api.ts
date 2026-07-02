import { z } from 'zod';

const nekosApiImageListSchema = z.array(
  z
    .object({
      url: z.string().url(),
    })
    .passthrough(),
);

export class NekosApiContractError extends Error {
  constructor() {
    super('NekosAPI returned an invalid image list');
    this.name = 'NekosApiContractError';
  }
}

export function parseNekosApiImageUrls(payload: unknown): string[] {
  const parsed = nekosApiImageListSchema.safeParse(payload);
  if (!parsed.success) throw new NekosApiContractError();
  return parsed.data.map((image) => image.url);
}
