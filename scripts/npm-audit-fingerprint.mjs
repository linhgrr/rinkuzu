import { createHash } from 'node:crypto';

export function canonicalAuditValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalAuditValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalAuditValue(entry)]),
    );
  }
  return value;
}

// The top-level `range` is deliberately not hashed (RIN-880). For a finding reached only
// through another package, npm computes that range from the registry's version list, so it
// moves whenever the publisher ships a new (canary) version or the npm cache is fresher, with
// the same lockfile. Advisory objects inside `via` keep their own advisory id and vulnerable
// range, so a new or changed advisory still changes the fingerprint; `nodes` pins the
// installed locations.
export function fingerprintAuditFinding(name, vulnerability) {
  const evidence = {
    name,
    severity: vulnerability.severity,
    isDirect: vulnerability.isDirect,
    via: vulnerability.via,
    nodes: vulnerability.nodes,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalAuditValue(evidence)))
    .digest('hex');
}
