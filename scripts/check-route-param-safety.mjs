import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'src');
const appDir = path.join(sourceDir, 'app');
const allowedUseParamsFile = 'src/lib/routing/useRequiredRouteParam.ts';
const failures = [];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function isClientComponent(source) {
  const firstStatement = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('//'));

  return firstStatement === "'use client';" || firstStatement === '"use client";';
}

for (const filePath of walk(sourceDir).filter((file) => /\.(ts|tsx)$/.test(file))) {
  const repoPath = toRepoPath(filePath);
  const source = readFileSync(filePath, 'utf8');

  if (repoPath !== allowedUseParamsFile && /\buseParams\s*\(/.test(source)) {
    failures.push(
      `${repoPath}: use useRequiredRouteParam() instead of raw useParams() so missing/array params cannot become "undefined" URLs.`,
    );
  }
}

for (const filePath of walk(appDir).filter((file) => file.endsWith('/page.tsx'))) {
  const repoPath = toRepoPath(filePath);

  if (!repoPath.includes('[')) {
    continue;
  }

  const source = readFileSync(filePath, 'utf8');

  if (!isClientComponent(source)) {
    continue;
  }

  if (
    /export\s+default\s+function\s+\w+\s*\(\s*\{\s*params\b/.test(source) ||
    /function\s+\w+\s*\(\s*\{\s*params\b/.test(source) ||
    /interface\s+\w*Props\s*\{[\s\S]*?\bparams\s*:/.test(source)
  ) {
    failures.push(
      `${repoPath}: client dynamic pages must not accept a handwritten params prop; use useRequiredRouteParam().`,
    );
  }

  const allowedUrlSearchParamsMethods = new Set([
    'append',
    'delete',
    'get',
    'has',
    'set',
    'sort',
    'toString',
  ]);
  const paramsPropertyMatches = source.matchAll(/\bparams\.([A-Za-z_$][\w$]*)/g);
  for (const match of paramsPropertyMatches) {
    const property = match[1];
    if (!allowedUrlSearchParamsMethods.has(property)) {
      failures.push(
        `${repoPath}: direct params.${property} access can be undefined on modern Next.js; use useRequiredRouteParam().`,
      );
    }
  }
}

for (const filePath of walk(appDir).filter((file) => file.endsWith('/route.ts'))) {
  const repoPath = toRepoPath(filePath);
  const source = readFileSync(filePath, 'utf8');

  if (/\bwith(?:Optional)?Auth\s*</.test(source)) {
    failures.push(
      `${repoPath}: do not type-assert route params through withAuth<T>; validate params with readAndValidateRouteParams().`,
    );
  }

  const rawParamsPatterns = [
    /\bparams\.(?:id|slug|jobId|path)\b/,
    /\bconst\s+\{\s*(?:id|slug|jobId|path)\s*\}\s*=\s*params\b/,
    /\bcontext\.params\s*\[/,
  ];

  if (rawParamsPatterns.some((pattern) => pattern.test(source))) {
    failures.push(
      `${repoPath}: validate dynamic API route params with readAndValidateRouteParams() before use.`,
    );
  }
}

if (failures.length > 0) {
  console.error('Route param safety check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

process.stdout.write('Route param safety check passed.\n');
