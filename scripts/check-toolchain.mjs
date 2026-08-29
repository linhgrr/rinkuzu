import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const expected = { node: '22.23.1', npm: '10.9.8' };
const failures = [];
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const nvmrc = fs.readFileSync('.nvmrc', 'utf8').trim();
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');

/**
 * The npm actually running this script, not whichever one happens to be first on
 * PATH. When invoked through npm — which is how the gate runs — `npm_config_user_agent`
 * names the running client exactly, and reading it needs no child process at all.
 *
 * The fallback is for a direct `node scripts/check-toolchain.mjs`. It has to go
 * through a shell on Windows: npm there is `npm.cmd`, and since the CVE-2024-27980
 * mitigation Node refuses to `execFile` a `.cmd` without one. The command and its
 * arguments are literals, so there is nothing for a shell to interpolate.
 */
function detectNpmVersion() {
  const agent = /(?:^|\s)npm\/(\S+)/.exec(process.env.npm_config_user_agent ?? '');
  if (agent?.[1]) return agent[1];
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return execFileSync(command, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }).trim();
}

const actualNode = process.versions.node;
const actualNpm = detectNpmVersion();
if (actualNode !== expected.node) failures.push(`Node must be ${expected.node}; got ${actualNode}`);
if (actualNpm !== expected.npm) failures.push(`npm must be ${expected.npm}; got ${actualNpm}`);
if (nvmrc !== expected.node) failures.push(`.nvmrc must pin ${expected.node}`);
if (packageJson.packageManager !== `npm@${expected.npm}`) {
  failures.push(`packageManager must be npm@${expected.npm}`);
}
if (packageJson.engines?.node !== expected.node || packageJson.engines?.npm !== expected.npm) {
  failures.push('package engines must use exact production toolchain versions');
}
if (packageLock.lockfileVersion !== 3)
  failures.push('package-lock.json must use lockfileVersion 3');
if (!dockerfile.includes(`node:${expected.node}-alpine@sha256:`)) {
  failures.push('Dockerfile must pin the exact Node tag and immutable manifest digest');
}
if (/NEXT_IMAGE_UNOPTIMIZED\s*=\s*true/.test(dockerfile)) {
  failures.push('production Docker image optimization must not be disabled');
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Toolchain pinned: Node ${expected.node}, npm ${expected.npm}.\n`);
