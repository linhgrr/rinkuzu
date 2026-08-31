import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { listFiles, toRepoPath } from './repo-files.shared.mjs';

const QUESTION_METADATA_PROPERTIES = new Set([
  'correctIndex',
  'correctIndexes',
  'id',
  'optionImages',
  'options',
  'questionImage',
  'type',
]);

function sourceFiles(root, directory = path.join(root, 'src')) {
  if (!existsSync(directory)) {
    return [];
  }

  return listFiles('**/*.tsx', { cwd: directory }).map((absolute) => ({
    path: toRepoPath(absolute, root),
    content: readFileSync(absolute, 'utf8'),
  }));
}

function containsJsx(expression) {
  let found = false;

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(expression, visit);
  return found;
}

function containsRawQuestionContent(expression) {
  let found = false;

  function visit(node) {
    if (found) {
      return;
    }

    if (ts.isPropertyAccessExpression(node)) {
      if (
        node.name.text === 'text' &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'question'
      ) {
        found = true;
        return;
      }

      if (node.name.text === 'question') {
        const parentProperty =
          ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node
            ? node.parent.name.text
            : null;
        if (!parentProperty || !QUESTION_METADATA_PROPERTIES.has(parentProperty)) {
          found = true;
          return;
        }
      }
    }

    if (ts.isIdentifier(node)) {
      if (node.text === 'questionText') {
        found = true;
        return;
      }

      if (
        (node.text === 'option' || node.text === 'opt') &&
        !(
          ts.isPropertyAccessExpression(node.parent) &&
          (node.parent.expression === node || node.parent.name === node)
        )
      ) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(expression);
  return found;
}

export function findRawQuestionContent(files) {
  const occurrences = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    function visit(node) {
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
        !containsJsx(node.expression)
      ) {
        const value = node.expression.getText(sourceFile);
        if (containsRawQuestionContent(node.expression)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          occurrences.push({
            path: file.path,
            line: position.line + 1,
            value,
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return occurrences;
}

export function checkQuestionContent(root) {
  return findRawQuestionContent(sourceFiles(root));
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const occurrences = checkQuestionContent(process.cwd());

  if (occurrences.length > 0) {
    process.stderr.write(
      [
        'Question Markdown policy failed. Render educational content with QuestionContent or QuestionExcerpt:',
        ...occurrences.map(({ path: filePath, line, value }) => `- ${filePath}:${line} (${value})`),
      ].join('\n') + '\n',
    );
    process.exitCode = 1;
  } else {
    process.stdout.write('Question Markdown policy passed.\n');
  }
}
