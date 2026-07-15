import fs from 'node:fs';
import path from 'node:path';

const [planPath, approvalPath] = process.argv.slice(2);

if (process.env.CI !== 'true') {
  throw new Error('Ephemeral index approval generation is restricted to CI=true');
}
if (!planPath || !approvalPath) {
  throw new Error('Usage: create-ephemeral-index-approval.mjs <plan.json> <approval.json>');
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

const parsedUri = new URL(uri);
const databaseName = decodeURIComponent(parsedUri.pathname.replace(/^\//, ''));
if (!['127.0.0.1', 'localhost'].includes(parsedUri.hostname) || databaseName !== 'rinkuzu_ci') {
  throw new Error('Ephemeral approval is allowed only for localhost/rinkuzu_ci');
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan.mode !== 'plan' || plan.databaseName !== 'rinkuzu_ci') {
  throw new Error('Input must be a rinkuzu_ci migration plan');
}
if (!/^[a-f0-9]{64}$/.test(plan.planSha ?? '')) {
  throw new Error('Migration plan has no valid planSha');
}
if (!Array.isArray(plan.actions)) {
  throw new Error('Migration plan actions are missing');
}

const approval = {
  planSha: plan.planSha,
  approvedBy: 'ci-ephemeral-bootstrap',
  ticket: 'CI-EPHEMERAL-INDEX-BOOTSTRAP',
  approvedAt: new Date().toISOString(),
  actions: plan.actions
    .filter((action) => action?.sensitive === true)
    .map((action) => action.fingerprint)
    .sort(),
};

const absoluteApprovalPath = path.resolve(approvalPath);
fs.mkdirSync(path.dirname(absoluteApprovalPath), { recursive: true });
const temporaryPath = `${absoluteApprovalPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(approval, null, 2)}\n`, { flag: 'wx' });
fs.renameSync(temporaryPath, absoluteApprovalPath);
process.stdout.write(`${approval.planSha}\n`);
