const MODES = new Set(['plan', 'check', 'apply', 'apply-safe-only', 'apply-selected', 'verify']);
const APPLY_MODES = new Set(['apply', 'apply-safe-only', 'apply-selected']);
const ACTION_TYPES = new Set(['create', 'hide', 'unhide', 'update_ttl', 'drop']);
const APPROVAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export function parseIndexCliArgs(args, env = {}) {
  let mode = null;
  let verifyAfterApply = false;
  let planSha = env.INDEX_PLAN_SHA ?? null;
  let approvalFile = env.INDEX_APPROVAL_FILE ?? null;
  let actionTypes = parseActionTypes(env.INDEX_ACTION_TYPES ?? null);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--plan' || argument === '--check' || argument === '--apply') {
      mode = chooseMode(mode, argument.slice(2));
      continue;
    }
    if (argument === '--apply-safe-only') {
      mode = chooseMode(mode, 'apply-safe-only');
      continue;
    }
    if (argument === '--apply-selected') {
      mode = chooseMode(mode, 'apply-selected');
      continue;
    }
    if (argument === '--verify') {
      if (mode === 'apply') verifyAfterApply = true;
      else mode = chooseMode(mode, 'verify');
      continue;
    }
    if (argument === '--mode') {
      mode = chooseMode(mode, requireValue(args, ++index, '--mode'));
      continue;
    }
    if (argument.startsWith('--mode=')) {
      mode = chooseMode(mode, argument.slice('--mode='.length));
      continue;
    }
    if (argument === '--plan-sha') {
      planSha = requireValue(args, ++index, '--plan-sha');
      continue;
    }
    if (argument.startsWith('--plan-sha=')) {
      planSha = argument.slice('--plan-sha='.length);
      continue;
    }
    if (argument === '--approval-file') {
      approvalFile = requireValue(args, ++index, '--approval-file');
      continue;
    }
    if (argument.startsWith('--approval-file=')) {
      approvalFile = argument.slice('--approval-file='.length);
      continue;
    }
    if (argument === '--action-types') {
      actionTypes = parseActionTypes(requireValue(args, ++index, '--action-types'));
      continue;
    }
    if (argument.startsWith('--action-types=')) {
      actionTypes = parseActionTypes(argument.slice('--action-types='.length));
      continue;
    }

    throw new CliUsageError(`Unknown argument: ${argument}`);
  }

  mode ??= 'plan';
  if (!MODES.has(mode)) {
    throw new CliUsageError(`Unsupported mode: ${mode}`);
  }
  if (APPLY_MODES.has(mode) && planSha !== null && !/^[a-f0-9]{64}$/i.test(planSha)) {
    throw new CliUsageError('--plan-sha must be a 64-character SHA-256 digest');
  }
  if (actionTypes !== null && !['apply-safe-only', 'apply-selected'].includes(mode)) {
    throw new CliUsageError(
      '--action-types is allowed only with --apply-safe-only or --apply-selected',
    );
  }
  if (mode === 'apply-selected' && actionTypes === null) {
    throw new CliUsageError('--apply-selected requires --action-types');
  }

  return { mode, planSha, approvalFile, verifyAfterApply, actionTypes };
}

export function isIndexApplyMode(mode) {
  return APPLY_MODES.has(mode);
}

/**
 * @param {{ actions: Array<{
 *   fingerprint: string,
 *   collection?: string,
 *   indexId?: string,
 *   sensitive?: boolean,
 *   type?: string
 * }> }} plan
 * @param {string} mode
 * @param {string[] | null} actionTypes
 */
export function selectIndexActionsForMode(plan, mode, actionTypes = null) {
  if (mode === 'apply') return plan.actions;
  if (mode === 'apply-safe-only') {
    return plan.actions.filter(
      (action) =>
        action.sensitive !== true && (actionTypes === null || actionTypes.includes(action.type)),
    );
  }
  if (mode === 'apply-selected') {
    const selected = plan.actions.filter((action) => actionTypes?.includes(action.type));
    if (selected.length === 0) {
      throw new CliUsageError('No current index actions match --action-types');
    }
    return selected;
  }
  throw new CliUsageError(`Mode ${mode} is not an apply mode`);
}

export function validatePartialApplyRemainder({
  sourcePlan,
  verificationPlan,
  selectedFingerprints,
}) {
  const expected = sourcePlan.actions
    .filter((action) => !selectedFingerprints.includes(action.fingerprint))
    .map((action) => action.fingerprint)
    .sort();
  const actual = verificationPlan.actions.map((action) => action.fingerprint).sort();
  const issues = [];

  if (verificationPlan.manualCount > 0) {
    issues.push('Post-apply verification contains manual index drift');
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push('Post-apply drift does not exactly match the unselected source actions');
  }
  return issues;
}

export function readModeExitCode(mode, plan) {
  if (mode === 'plan') return 0;
  if (mode === 'check' || mode === 'verify') return plan.blockingCount === 0 ? 0 : 2;
  throw new CliUsageError(`Mode ${mode} is not read-only`);
}

export function validateSensitiveApproval({ approval, plan, now = new Date() }) {
  const requiredFingerprints = plan.actions
    .filter((action) => action.sensitive === true)
    .map((action) => action.fingerprint)
    .sort();

  if (requiredFingerprints.length === 0) return [];

  const issues = [];
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
    return ['Sensitive index actions require a JSON approval file'];
  }
  if (approval.planSha !== plan.planSha) {
    issues.push('Approval planSha does not match the current plan');
  }
  if (!nonEmpty(approval.approvedBy)) issues.push('Approval approvedBy is required');
  if (!nonEmpty(approval.ticket)) issues.push('Approval ticket is required');

  const approvedAt = new Date(approval.approvedAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(approvedAt)) {
    issues.push('Approval approvedAt must be a valid timestamp');
  } else {
    if (approvedAt > nowMs) issues.push('Approval approvedAt cannot be in the future');
    if (nowMs - approvedAt > APPROVAL_MAX_AGE_MS) {
      issues.push('Approval is older than 7 days');
    }
  }

  const approvedFingerprints = Array.isArray(approval.actions)
    ? [...new Set(approval.actions)].sort()
    : [];
  if (JSON.stringify(approvedFingerprints) !== JSON.stringify(requiredFingerprints)) {
    issues.push('Approval actions must exactly match every sensitive action fingerprint');
  }

  return issues;
}

function chooseMode(current, next) {
  if (!MODES.has(next)) throw new CliUsageError(`Unsupported mode: ${next}`);
  if (current !== null && current !== next) {
    throw new CliUsageError(`Conflicting modes: ${current} and ${next}`);
  }
  return next;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new CliUsageError(`${flag} requires a value`);
  return value;
}

function parseActionTypes(value) {
  if (value === null) return null;
  const parsed = [
    ...new Set(
      String(value)
        .split(',')
        .map((entry) => entry.trim()),
    ),
  ].filter(Boolean);
  if (parsed.length === 0) throw new CliUsageError('--action-types requires at least one type');
  const unsupported = parsed.filter((type) => !ACTION_TYPES.has(type));
  if (unsupported.length > 0) {
    throw new CliUsageError(`Unsupported index action type(s): ${unsupported.join(', ')}`);
  }
  return parsed.sort();
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
