import { readFileSync } from 'node:fs';

import ts from 'typescript';

import { listFiles, toRepoPath } from './repo-files.shared.mjs';

const bannedCallNames = new Set(['fetch', 'fetchWithRetry', 'timedFetch']);
const allowedDirectInternalFetches = new Map([
  [
    'src/hooks/usePdfProcessor.ts',
    'Chunk processing needs custom retry and 409 backoff handling before decoding the response.',
  ],
  [
    'src/lib/ask-rin-chan/client.ts',
    'Ask Rin-chan streams SSE data and must hand the raw Response to the shared stream parser.',
  ],
  [
    'src/features/adaptive/lib/adaptive-api-methods.ts',
    'Adaptive transport owns its own low-level health/upload flow and is the approved boundary.',
  ],
]);

const failures = [];

function shouldScanFile(repoPath) {
  if (!/\.(ts|tsx)$/.test(repoPath)) return false;
  if (repoPath.startsWith('src/app/api/')) return false;
  if (repoPath.includes('/__tests__/')) return false;
  if (/(\.test|\.spec)\.(ts|tsx)$/.test(repoPath)) return false;
  return true;
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  return null;
}

function collectDeclarations(sourceFile) {
  const declarations = new Map();

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      declarations.set(node.name.text, node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function unwrapNode(node) {
  let current = node;

  while (current) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }

    if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }

    if (ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }

    break;
  }

  return current;
}

function resolveObjectPropertyPrefix(propertyName, objectNode, declarations, seen) {
  if (!objectNode || !ts.isObjectLiteralExpression(objectNode)) {
    return null;
  }

  for (const property of objectNode.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === propertyName) ||
        (ts.isStringLiteral(property.name) && property.name.text === propertyName))
    ) {
      return resolveStringPrefix(property.initializer, declarations, seen);
    }
  }

  return null;
}

function resolveCommonApiPrefix(prefixes) {
  const validPrefixes = prefixes.filter((prefix) => typeof prefix === 'string');
  if (validPrefixes.length === 0) {
    return null;
  }

  if (validPrefixes.every((prefix) => prefix.startsWith('/api/'))) {
    return '/api/';
  }

  return null;
}

function resolveStringPrefix(node, declarations, seen = new Set()) {
  if (!node) return null;
  const current = unwrapNode(node);

  if (!current) return null;

  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
    return current.text;
  }

  if (ts.isTemplateExpression(current)) {
    let prefix = current.head.text;

    for (const span of current.templateSpans) {
      const expressionPrefix = resolveStringPrefix(span.expression, declarations, new Set(seen));
      if (expressionPrefix === null) {
        break;
      }

      prefix += expressionPrefix;
      prefix += span.literal.text;
    }

    return prefix;
  }

  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const leftPrefix = resolveStringPrefix(current.left, declarations, new Set(seen));
    const rightPrefix = resolveStringPrefix(current.right, declarations, new Set(seen));

    if (leftPrefix && rightPrefix) {
      return `${leftPrefix}${rightPrefix}`;
    }

    return leftPrefix;
  }

  if (ts.isConditionalExpression(current)) {
    return resolveCommonApiPrefix([
      resolveStringPrefix(current.whenTrue, declarations, new Set(seen)),
      resolveStringPrefix(current.whenFalse, declarations, new Set(seen)),
    ]);
  }

  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) {
      return null;
    }

    const declaration = declarations.get(current.text);
    if (!declaration) {
      return null;
    }

    seen.add(current.text);

    if (ts.isFunctionDeclaration(declaration)) {
      if (declaration.parameters.length > 0 || !declaration.body) {
        return null;
      }

      for (const statement of declaration.body.statements) {
        if (ts.isReturnStatement(statement) && statement.expression) {
          return resolveStringPrefix(statement.expression, declarations, new Set(seen));
        }
      }

      return null;
    }

    if (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) {
      if (declaration.parameters.length > 0) {
        return null;
      }

      if (ts.isBlock(declaration.body)) {
        for (const statement of declaration.body.statements) {
          if (ts.isReturnStatement(statement) && statement.expression) {
            return resolveStringPrefix(statement.expression, declarations, new Set(seen));
          }
        }
        return null;
      }

      return resolveStringPrefix(declaration.body, declarations, new Set(seen));
    }

    return resolveStringPrefix(declaration, declarations, seen);
  }

  if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
    const objectDeclaration = declarations.get(current.expression.text);
    return resolveObjectPropertyPrefix(
      current.name.text,
      objectDeclaration,
      declarations,
      new Set(seen),
    );
  }

  if (
    ts.isElementAccessExpression(current) &&
    ts.isIdentifier(current.expression) &&
    ts.isStringLiteral(current.argumentExpression)
  ) {
    const objectDeclaration = declarations.get(current.expression.text);
    return resolveObjectPropertyPrefix(
      current.argumentExpression.text,
      objectDeclaration,
      declarations,
      new Set(seen),
    );
  }

  if (
    ts.isCallExpression(current) &&
    ts.isIdentifier(current.expression) &&
    current.arguments.length === 0
  ) {
    return resolveStringPrefix(current.expression, declarations, new Set(seen));
  }

  return null;
}

for (const filePath of listFiles('src/**/*.{ts,tsx}').filter((file) =>
  shouldScanFile(toRepoPath(file)),
)) {
  const repoPath = toRepoPath(filePath);
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const declarations = collectDeclarations(sourceFile);

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callName = getCallName(node.expression);
      const firstArg = node.arguments[0];
      const resolvedValue = resolveStringPrefix(firstArg, declarations);

      if (
        callName &&
        bannedCallNames.has(callName) &&
        typeof resolvedValue === 'string' &&
        resolvedValue.startsWith('/api/')
      ) {
        const allowedReason = allowedDirectInternalFetches.get(repoPath);

        if (!allowedReason) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          failures.push(
            `${repoPath}:${line + 1} uses ${callName}(${JSON.stringify(
              resolvedValue,
            )}). Use fetchApiData()/fetchApiResponse() for app APIs, or move the low-level transport into an approved boundary.`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (failures.length > 0) {
  console.error('Internal API fetch guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  if (allowedDirectInternalFetches.size > 0) {
    console.error('\nApproved low-level boundaries:');
    for (const [repoPath, reason] of allowedDirectInternalFetches.entries()) {
      console.error(`- ${repoPath}: ${reason}`);
    }
  }

  process.exit(1);
}

process.stdout.write('Internal API fetch guard passed.\n');
