import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-contract test for critical E2E database fixture fencing.
 * Prefer this over Playwright in a dirty tree: enforces insert-only
 * active-admin seed semantics and no shared-fence cleanup.
 */
describe('critical-flows fixture active-admin fence contract', () => {
  const source = readFileSync(path.join(process.cwd(), 'tests/e2e/critical-flows.spec.ts'), 'utf8');

  it('seeds the canonical active-admin fence with insert-once semantics before mutations', () => {
    expect(source).toContain("const ACTIVE_ADMIN_FENCE_ID = 'active-admin'");
    expect(source).toContain("const ACTIVE_ADMIN_FENCE_COLLECTION = 'adminmutationfences'");
    expect(source).toContain('ensureCanonicalActiveAdminFence');
    expect(source).toContain('$setOnInsert');
    expect(source).toMatch(/revision:\s*0/);
    expect(source).toContain('isCanonicalActiveAdminFence');
    // Fail closed on malformed existing fence — no silent repair.
    expect(source).toMatch(/refuse to repair|malformed/);
  });

  it('preserves the strict localhost + rinkuzu_ci guard', () => {
    expect(source).toContain("databaseName !== 'rinkuzu_ci'");
    expect(source).toContain("'127.0.0.1', 'localhost'");
    expect(source).toContain(
      'Critical E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci',
    );
  });

  it('never deletes, drops, or resets the shared active-admin fence in cleanup', () => {
    expect(source).not.toMatch(
      /adminmutationfences['"`)]\s*\.(deleteMany|deleteOne|drop|updateOne|replaceOne|findOneAndDelete)/,
    );
    // Cleanup is scoped to run-tagged documents / seeded ids only.
    expect(source).toContain('deleteMany({ _e2eRun: runId })');
    expect(source).not.toContain('$unset: { revision');
    expect(source).not.toMatch(/revision:\s*0[\s\S]*\$set:\s*\{\s*revision/);
  });
});
