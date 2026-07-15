import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const TEST_APIS = new Set(['describe', 'it', 'test']);
const DISABLED_ALIASES = new Set(['fdescribe', 'fit', 'xdescribe', 'xit', 'xtest']);
const DISABLED_MODIFIERS = new Set(['only', 'skip', 'todo', 'skipIf', 'runIf']);
const CONTROL_FLOW_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.DefaultClause,
  ts.SyntaxKind.TryStatement,
]);

export function collectFiles(directory, predicate, files = []) {
  if (!existsSync(directory)) return files;

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!['.git', '.next', 'coverage', 'node_modules'].includes(entry)) {
        collectFiles(fullPath, predicate, files);
      }
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function scriptKind(filePath) {
  if (/\.tsx$/i.test(filePath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(filePath)) return ts.ScriptKind.JSX;
  if (/\.[cm]?ts$/i.test(filePath)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function callPath(expression) {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    return [...callPath(expression.expression), expression.name.text];
  }
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteral(expression.argumentExpression)
  ) {
    return [...callPath(expression.expression), expression.argumentExpression.text];
  }
  if (ts.isCallExpression(expression)) return callPath(expression.expression);
  return [];
}

function isConditionallyRegistered(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current) && !ts.isFunctionLike(current)) {
    if (CONTROL_FLOW_KINDS.has(current.kind)) return true;
    current = current.parent;
  }
  return false;
}

function testCallback(call) {
  for (let index = call.arguments.length - 1; index >= 0; index -= 1) {
    const argument = call.arguments[index];
    if (argument && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) {
      return argument;
    }
  }
  return null;
}

function hasNonZeroRetry(call) {
  return call.arguments.some(
    (argument) =>
      ts.isObjectLiteralExpression(argument) &&
      argument.properties.some((property) => {
        if (!ts.isPropertyAssignment(property)) return false;
        const name = property.name.getText().replace(/^['"]|['"]$/g, '');
        return (
          name === 'retry' &&
          (!ts.isNumericLiteral(property.initializer) || Number(property.initializer.text) !== 0)
        );
      }),
  );
}

export function collectTestViolations(sourceText, filePath = 'fixture.test.ts') {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );
  const violations = [];

  function addViolation(node, message) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      file: filePath,
      line: position.line + 1,
      column: position.character + 1,
      message,
    });
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const parts = callPath(node.expression);
      const base = parts[0];
      const modifiers = parts.slice(1);

      if (base && DISABLED_ALIASES.has(base)) {
        addViolation(node, `${base} is forbidden; committed tests must always execute.`);
      }

      if (base && TEST_APIS.has(base)) {
        const disabledModifier = modifiers.find((modifier) => DISABLED_MODIFIERS.has(modifier));
        if (disabledModifier) {
          addViolation(
            node,
            `${base}.${disabledModifier} is forbidden; remove the disabled or conditional test.`,
          );
        }

        const registersTest =
          !(
            modifiers.includes('each') &&
            ts.isCallExpression(node.parent) &&
            node.parent.expression === node
          ) &&
          (modifiers.length === 0 ||
            modifiers.every((modifier) =>
              ['describe', 'each', 'concurrent', 'fails', 'sequential'].includes(modifier),
            ));

        if (registersTest) {
          if (isConditionallyRegistered(node)) {
            addViolation(node, 'Conditional test registration is forbidden.');
          }

          const callback = testCallback(node);
          if (!callback) {
            addViolation(node, 'A test or suite must provide an executable callback.');
          } else if (ts.isBlock(callback.body) && callback.body.statements.length === 0) {
            addViolation(node, 'Empty test or suite callbacks are forbidden.');
          }

          if (hasNonZeroRetry(node)) {
            addViolation(node, 'Per-test retries are forbidden in Vitest.');
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export function collectCoverageDirectives(sourceText, filePath) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    sourceText,
  );
  const directives = [];
  const lines = sourceText.split(/\r?\n/);

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }

    const directive = scanner
      .getTokenText()
      .match(/\b(?:v8|istanbul|c8)\s+ignore(?:\s+[a-z]+)?(?:\s+\d+)?/i)?.[0];
    if (!directive) continue;

    const line = sourceText.slice(0, scanner.getTokenPos()).split(/\r?\n/).length;
    const sourceLine = lines[line - 1]?.trim() ?? '';
    directives.push({
      file: filePath,
      line,
      directive: directive.replace(/\s+/g, ' ').toLowerCase(),
      sourceHash: createHash('sha256').update(sourceLine).digest('hex'),
    });
  }

  return directives;
}

export function validateCoverageWaivers(directives, registry, now = new Date()) {
  const errors = [];
  const waivers = Array.isArray(registry?.waivers) ? registry.waivers : [];
  const actualKeys = new Set(directives.map(({ file, line }) => `${file}:${line}`));
  const waiverKeys = new Set();

  if (registry?.schemaVersion !== 1) {
    errors.push('Coverage waiver registry schemaVersion must be 1.');
  }

  for (const waiver of waivers) {
    const key = `${waiver.file}:${waiver.line}`;
    if (waiverKeys.has(key)) errors.push(`Duplicate coverage waiver for ${key}.`);
    waiverKeys.add(key);

    if (waiver.kind !== 'defensive') errors.push(`${key}: only defensive waivers are allowed.`);
    if (typeof waiver.reason !== 'string' || waiver.reason.trim().length < 20) {
      errors.push(`${key}: waiver reason must be specific.`);
    }
    if (typeof waiver.owner !== 'string' || waiver.owner.trim().length === 0) {
      errors.push(`${key}: waiver owner is required.`);
    }

    const expiresAt = new Date(waiver.expiresAt);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= now) {
      errors.push(`${key}: waiver is expired or has an invalid expiresAt.`);
    }
    if (!actualKeys.has(key)) errors.push(`${key}: stale waiver has no matching directive.`);
  }

  for (const directive of directives) {
    const key = `${directive.file}:${directive.line}`;
    const waiver = waivers.find((candidate) => `${candidate.file}:${candidate.line}` === key);
    if (!waiver) {
      errors.push(`${key}: unwaived ${directive.directive} directive.`);
      continue;
    }
    if (waiver.directive !== directive.directive) {
      errors.push(`${key}: waiver directive does not match source.`);
    }
    if (waiver.sourceHash !== directive.sourceHash) {
      errors.push(`${key}: waiver fingerprint is stale.`);
    }
  }

  return errors;
}

export function runTestIntegrityCheck(root = process.cwd()) {
  const testFiles = [path.join(root, 'src'), path.join(root, 'tests')]
    .flatMap((directory) => collectFiles(directory, (file) => TEST_FILE_PATTERN.test(file)))
    .sort();
  const sourceFiles = [path.join(root, 'src'), path.join(root, 'tests')]
    .flatMap((directory) => collectFiles(directory, (file) => SOURCE_FILE_PATTERN.test(file)))
    .sort();
  const failures = [];

  for (const filePath of testFiles) {
    const repoPath = path.relative(root, filePath).split(path.sep).join('/');
    failures.push(...collectTestViolations(readFileSync(filePath, 'utf8'), repoPath));
  }

  const directives = sourceFiles.flatMap((filePath) => {
    const repoPath = path.relative(root, filePath).split(path.sep).join('/');
    return collectCoverageDirectives(readFileSync(filePath, 'utf8'), repoPath);
  });
  const registry = JSON.parse(
    readFileSync(path.join(root, 'quality', 'coverage-waivers.json'), 'utf8'),
  );
  failures.push(
    ...validateCoverageWaivers(directives, registry).map((message) => ({
      file: 'quality/coverage-waivers.json',
      line: 1,
      column: 1,
      message,
    })),
  );

  return { testFiles: testFiles.length, directives: directives.length, failures };
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const result = runTestIntegrityCheck();
  if (result.failures.length > 0) {
    console.error('Test integrity check failed:');
    for (const failure of result.failures) {
      console.error(`- ${failure.file}:${failure.line}:${failure.column} ${failure.message}`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Test integrity check passed (${result.testFiles} files, ${result.directives} approved directives).\n`,
    );
  }
}
