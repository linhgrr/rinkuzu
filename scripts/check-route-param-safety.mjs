/**
 * Route params must be validated, not read straight off the request.
 *
 * Two things were wrong with this guard before 2026-08-31, and they hid each
 * other. It selected files with `endsWith('/page.tsx')` against paths joined by
 * the platform, so on Windows it matched none of the 70 page files and none of
 * the 154 route files and reported "passed" -- while on Linux it selected them
 * all and failed CI. Nobody saw the failures locally, and nobody trusted the
 * red CI step enough to chase it.
 *
 * Once it ran, its regexes proved too blunt to act on: `\bparams\.id\b` also
 * matches `parsed.params.id`, which is the validated access the rule exists to
 * encourage. So the checks read the TypeScript AST now, where `params.id` and
 * `parsed.params.id` are different expressions.
 */
import { readFileSync } from 'node:fs';

import ts from 'typescript';

import { listFiles, toRepoPath } from './repo-files.shared.mjs';

const allowedUseParamsFile = 'src/lib/routing/useRequiredRouteParam.ts';

/** Params a Next.js route names dynamically; reading them raw is the risk. */
const DYNAMIC_PARAM_NAMES = new Set(['id', 'slug', 'jobId', 'path']);

/**
 * Helpers that prove a param's shape at runtime rather than asserting it.
 *
 * `parseRouteParams` is the current idiom -- 27 routes use it against 4 still
 * on `readAndValidateRouteParams`, after commit 5a05ba85 standardised them --
 * and both are real validation, so both satisfy the rule.
 */
const PARAM_VALIDATORS = new Set([
  'parseRouteParams',
  'parseParamsAndBody',
  'readAndValidateRouteParams',
]);

/**
 * `params` is also the name of a URLSearchParams instance in plenty of client
 * code, and calling a method on one of those is not a route-param read.
 */
const URL_SEARCH_PARAMS_METHODS = new Set([
  'append',
  'delete',
  'get',
  'has',
  'set',
  'sort',
  'toString',
]);

const failures = [];

function parse(filePath, source) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function forEachNode(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => forEachNode(child, visitor));
}

function isClientComponent(sourceFile) {
  const [first] = sourceFile.statements;
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use client'
  );
}

/** True for `params.x`, false for `parsed.params.x` or `context.params.x`. */
function isBareParamsAccess(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'params'
  );
}

/** A parameter destructured as `{ params }`, however deeply the function nests. */
function declaresParamsProp(node) {
  if (
    !ts.isFunctionDeclaration(node) &&
    !ts.isFunctionExpression(node) &&
    !ts.isArrowFunction(node)
  ) {
    return false;
  }
  return node.parameters.some(
    (parameter) =>
      ts.isObjectBindingPattern(parameter.name) &&
      parameter.name.elements.some(
        (element) => ts.isIdentifier(element.name) && element.name.text === 'params',
      ),
  );
}

/** A `Props`-shaped interface carrying a `params` member. */
function declaresParamsInProps(node) {
  return (
    ts.isInterfaceDeclaration(node) &&
    node.name.text.endsWith('Props') &&
    node.members.some((member) => member.name !== undefined && member.name.getText() === 'params')
  );
}

for (const filePath of listFiles('src/**/*.{ts,tsx}')) {
  const repoPath = toRepoPath(filePath);
  if (repoPath === allowedUseParamsFile) continue;

  const sourceFile = parse(filePath, readFileSync(filePath, 'utf8'));
  forEachNode(sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useParams'
    ) {
      failures.push(
        `${repoPath}: use useRequiredRouteParam() instead of raw useParams() so missing/array params cannot become "undefined" URLs.`,
      );
    }
  });
}

for (const filePath of listFiles('src/app/**/page.tsx')) {
  const repoPath = toRepoPath(filePath);
  if (!repoPath.includes('[')) continue;

  const sourceFile = parse(filePath, readFileSync(filePath, 'utf8'));
  if (!isClientComponent(sourceFile)) continue;

  let declaresParams = false;
  const readProperties = new Set();
  forEachNode(sourceFile, (node) => {
    if (declaresParamsProp(node) || declaresParamsInProps(node)) declaresParams = true;
    if (isBareParamsAccess(node) && !URL_SEARCH_PARAMS_METHODS.has(node.name.text)) {
      readProperties.add(node.name.text);
    }
  });

  if (declaresParams) {
    failures.push(
      `${repoPath}: client dynamic pages must not accept a handwritten params prop; use useRequiredRouteParam().`,
    );
  }
  for (const property of [...readProperties].sort()) {
    failures.push(
      `${repoPath}: direct params.${property} access can be undefined on modern Next.js; use useRequiredRouteParam().`,
    );
  }
}

for (const filePath of listFiles('src/app/**/route.ts')) {
  const repoPath = toRepoPath(filePath);
  const sourceFile = parse(filePath, readFileSync(filePath, 'utf8'));

  let typeArgumentsParams = false;
  let validatesParams = false;
  let readsRawParams = false;

  forEachNode(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;

    // withAuth<{ id: string }>(...) types the params bag.
    if (
      /^with(?:Optional)?Auth$/.test(node.expression.text) &&
      node.typeArguments !== undefined &&
      node.typeArguments.length > 0
    ) {
      typeArgumentsParams = true;
    }

    // ...which is only a problem if nothing then proves the shape at runtime.
    if (PARAM_VALIDATORS.has(node.expression.text)) validatesParams = true;
  });

  forEachNode(sourceFile, (node) => {
    // params.id, and only when `params` is the request's own object.
    if (isBareParamsAccess(node) && DYNAMIC_PARAM_NAMES.has(node.name.text)) {
      readsRawParams = true;
    }

    // const { id } = params
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer !== undefined &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === 'params' &&
      node.name.elements.some(
        (element) => ts.isIdentifier(element.name) && DYNAMIC_PARAM_NAMES.has(element.name.text),
      )
    ) {
      readsRawParams = true;
    }

    // context.params['id']
    if (
      ts.isElementAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'params'
    ) {
      readsRawParams = true;
    }
  });

  if (typeArgumentsParams && !validatesParams) {
    failures.push(
      `${repoPath}: withAuth<T> asserts the route param shape without proving it; validate with parseRouteParams().`,
    );
  }
  if (readsRawParams) {
    failures.push(
      `${repoPath}: validate dynamic API route params with parseRouteParams() before use.`,
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
