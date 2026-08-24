import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

const DDL_METHODS = new Set([
  'cleanIndexes',
  'createCollection',
  'createIndex',
  'createIndexes',
  'diffIndexes',
  'dropCollection',
  'dropIndex',
  'dropIndexes',
  'ensureIndexes',
  'renameCollection',
  'syncIndexes',
]);
const DATABASE_COMMAND_METHODS = new Set(['adminCommand', 'command', 'runCommand']);
const RAW_DDL_COMMANDS = new Set([
  'collMod',
  'convertToCapped',
  'create',
  'createIndexes',
  'createSearchIndexes',
  'drop',
  'dropIndexes',
  'dropSearchIndex',
  'emptycapped',
  'renameCollection',
]);
const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const SKIPPED_DIRECTORIES = new Set(['.git', '.next', 'coverage', 'node_modules', 'public']);

export function findDdlViolations(source, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName),
  );
  const violations = [];
  let parseErrorFound = false;

  function visit(node) {
    if (!parseErrorFound && (node.flags & ts.NodeFlags.ThisNodeHasError) !== 0) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        file: fileName,
        line: location.line + 1,
        column: location.character + 1,
        kind: 'parse_error',
        operation: null,
        message: 'TypeScript parser reported malformed source',
      });
      parseErrorFound = true;
    }

    if (ts.isCallExpression(node)) {
      const operation = calledOperation(node.expression);
      if (operation && DDL_METHODS.has(operation)) {
        violations.push(toViolation(sourceFile, fileName, node, 'ddl_method', operation));
      } else if (operation && DATABASE_COMMAND_METHODS.has(operation)) {
        const command = databaseCommandName(node.arguments[0]);
        if (command === null) {
          violations.push(
            toViolation(
              sourceFile,
              fileName,
              node,
              'unclassified_database_command',
              `${operation}:dynamic`,
            ),
          );
        } else if (RAW_DDL_COMMANDS.has(command)) {
          violations.push(toViolation(sourceFile, fileName, node, 'raw_ddl_command', command));
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export async function scanDatabaseDdlBoundary({
  repoRoot,
  allowedFiles = [
    'scripts/sync-performance-indexes.mjs',
    'scripts/migrate-first-purchase-eligibility.mjs',
    'scripts/migrate-premium-quiz-catalog.mjs',
  ],
}) {
  const allowed = new Set(allowedFiles.map(normalizePath));
  const sourceFiles = [];

  for (const directory of ['scripts', 'src']) {
    await collectSourceFiles(path.join(repoRoot, directory), sourceFiles);
  }

  const violations = [];
  for (const absoluteFile of sourceFiles.sort()) {
    const relativeFile = normalizePath(path.relative(repoRoot, absoluteFile));
    if (allowed.has(relativeFile)) continue;
    const source = await readFile(absoluteFile, 'utf8');
    violations.push(...findDdlViolations(source, relativeFile));
  }

  return violations;
}

async function collectSourceFiles(directory, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) await collectSourceFiles(absolutePath, output);
    } else if (
      entry.isFile() &&
      !entry.name.endsWith('.d.ts') &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      output.push(absolutePath);
    }
  }
}

function calledOperation(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    if (
      ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression)
    ) {
      return expression.argumentExpression.text;
    }
  }
  return null;
}

function propertyName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function databaseCommandName(argument) {
  if (!argument || !ts.isObjectLiteralExpression(argument)) return null;
  const firstProperty = argument.properties[0];
  if (!firstProperty || !('name' in firstProperty)) return null;
  return propertyName(firstProperty.name);
}

function toViolation(sourceFile, file, node, kind, operation) {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file,
    line: location.line + 1,
    column: location.character + 1,
    kind,
    operation,
    message: `Database DDL operation ${operation} is only allowed in approved migration writers`,
  };
}

function scriptKindFor(fileName) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
