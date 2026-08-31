import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { listFiles } from './repo-files.shared.mjs';

function callPath(expression) {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    return [...callPath(expression.expression), expression.name.text];
  }
  if (ts.isCallExpression(expression)) return callPath(expression.expression);
  return [];
}

export function collectPlaywrightTitles(sourceText, filePath = 'flow.spec.ts') {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const titles = [];

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const parts = callPath(node.expression);
      const isPlaywrightRegistration =
        parts[0] === 'test' &&
        (parts.length === 1 ||
          parts.slice(1).every((part) => ['describe', 'serial'].includes(part)));
      const title = node.arguments[0];
      if (
        isPlaywrightRegistration &&
        title &&
        (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))
      ) {
        titles.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return titles;
}

export function validateRequiredFlows(policy, titles) {
  const errors = [];
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.flows)) {
    return ['Required E2E flow policy is invalid.'];
  }

  const ids = new Set();
  const tags = new Set();
  for (const flow of policy.flows) {
    if (ids.has(flow.id)) errors.push(`Duplicate E2E flow id: ${flow.id}.`);
    if (tags.has(flow.tag)) errors.push(`Duplicate E2E flow tag: ${flow.tag}.`);
    ids.add(flow.id);
    tags.add(flow.tag);

    if (!/^@critical-[a-z0-9-]+$/.test(flow.tag)) {
      errors.push(`${flow.id}: invalid critical flow tag ${flow.tag}.`);
    }
    if (!titles.some((title) => title.split(/\s+/).includes(flow.tag))) {
      errors.push(`${flow.id}: no executable Playwright test is tagged ${flow.tag}.`);
    }
  }
  return errors;
}

export function runRequiredFlowCheck(root = process.cwd()) {
  const policy = JSON.parse(
    readFileSync(path.join(root, 'quality', 'required-e2e-flows.json'), 'utf8'),
  );
  const testFiles = listFiles('tests/e2e/**/*.spec.{js,jsx,ts,tsx,cjs,mjs,cts,mts}');
  const titles = testFiles.flatMap((file) =>
    collectPlaywrightTitles(readFileSync(file, 'utf8'), file),
  );
  return {
    files: testFiles.length,
    titles: titles.length,
    errors: validateRequiredFlows(policy, titles),
  };
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const result = runRequiredFlowCheck();
  if (result.errors.length > 0) {
    console.error('Required E2E flow check failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Required E2E flow check passed (${result.titles} tests/suites in ${result.files} files).\n`,
    );
  }
}
