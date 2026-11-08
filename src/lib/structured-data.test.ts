import { describe, expect, it } from 'vitest';
import { buildOrganizationSchema } from './structured-data';

describe('buildOrganizationSchema', () => {
  it('links only the verified, owned Threads profile via sameAs', () => {
    expect(buildOrganizationSchema().sameAs).toEqual(['https://www.threads.com/@rinkuzu_app']);
  });

  it('keeps the existing ContactPoint and PostalAddress entities', () => {
    const schema = buildOrganizationSchema();

    expect(schema['@type']).toBe('Organization');
    expect(schema.contactPoint).toEqual({
      '@type': 'ContactPoint',
      email: 'support@rinkuzu.app',
      contactType: 'customer support',
    });
    expect(schema.address['@type']).toBe('PostalAddress');
  });
});
