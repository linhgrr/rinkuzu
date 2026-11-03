import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface VercelProjectConfig {
  regions?: string[];
}

// Every backend a server render talks to is in South-East Asia: MongoDB Atlas
// (Singapore), the adaptive API VPS (Viet Nam) and object storage
// (ap-southeast-1). Functions in Vercel's default iad1 paid ~200 ms per Mongo
// round trip (RIN-681), so they are pinned next to the database.
describe('Vercel function region', () => {
  it('runs serverless functions in sin1, next to the database', () => {
    const config = JSON.parse(
      readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
    ) as VercelProjectConfig;

    expect(config.regions).toEqual(['sin1']);
  });
});
