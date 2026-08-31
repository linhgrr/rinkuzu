import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { listFiles, toRepoPath } from './repo-files.shared.mjs';

function isTypeOnlyImport(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  return (
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

export function runtimeSpecifiers(sourceText, filePath = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = new Set();

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImport(node)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly &&
      !(
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.every((element) => element.isTypeOnly)
      )
    ) {
      specifiers.add(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...specifiers];
}

function resolveSourceImport(root, importer, specifier) {
  let basePath;
  if (specifier.startsWith('@/')) basePath = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) basePath = path.resolve(path.dirname(importer), specifier);
  else return null;

  basePath = basePath.replace(/\.(?:js|jsx|mjs|cjs)$/, '');
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  );
}

export function findRuntimeCycles(graph) {
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function connect(node) {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of graph.get(node) ?? []) {
      if (!graph.has(dependency)) continue;
      if (!indices.has(dependency)) {
        connect(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(dependency)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);

    const selfCycle = component.length === 1 && (graph.get(node) ?? []).includes(node);
    if (component.length > 1 || selfCycle) cycles.push(component.sort());
  }

  for (const node of [...graph.keys()].sort()) {
    if (!indices.has(node)) connect(node);
  }
  return cycles.sort((left, right) => left.join('\0').localeCompare(right.join('\0')));
}

export function buildRuntimeGraph(root = process.cwd()) {
  const files = listFiles('src/**/*.{ts,tsx}', {
    exclude: ['**/generated/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/*.d.ts'],
  });
  const graph = new Map();
  for (const file of files) {
    const key = toRepoPath(file);
    const dependencies = runtimeSpecifiers(readFileSync(file, 'utf8'), file)
      .map((specifier) => resolveSourceImport(root, file, specifier))
      .filter(Boolean)
      .map((dependency) => toRepoPath(dependency));
    graph.set(key, [...new Set(dependencies)].sort());
  }
  return graph;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const graph = buildRuntimeGraph();
  const cycles = findRuntimeCycles(graph);
  if (cycles.length > 0) {
    console.error('Runtime import cycle check failed:');
    for (const cycle of cycles) console.error(`- ${cycle.join(' -> ')} -> ${cycle[0]}`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Runtime import cycle check passed (${graph.size} files).\n`);
  }
}
