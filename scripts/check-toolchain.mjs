import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const expected = { node: '22.23.1', npm: '10.9.8' };
const failures = [];
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const nvmrc = fs.readFileSync('.nvmrc', 'utf8').trim();
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');

const actualNode = process.versions.node;
const actualNpm = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
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
