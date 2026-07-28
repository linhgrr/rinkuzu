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

export function fingerprintAuditFinding(name, vulnerability) {
  const evidence = {
    name,
    severity: vulnerability.severity,
    isDirect: vulnerability.isDirect,
    range: vulnerability.range,
    via: vulnerability.via,
    nodes: vulnerability.nodes,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalAuditValue(evidence)))
    .digest('hex');
}
