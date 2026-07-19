import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();

const allowedPresentationPersistenceDebt = new Set([]);

const allowedServicePersistenceDebt = new Set([]);

const allowedServiceContractLeakDebt = new Set([]);

const allowedDtoDomainLeakDebt = new Set([]);

const allowedQuizBuilderDomainLeakDebt = new Set([]);

const allowedPresentationDtoDebt = new Set([]);

const allowedPresentationApiClientDebt = new Set([]);

const allowedFeatureClientDtoDebt = new Set([]);

const allowedFeatureClientApiClientDebt = new Set([]);

const allowedFeatureBoundaryDtoDebt = new Set([]);

const allowedFeatureBoundaryApiClientDebt = new Set([]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function importSources(source) {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function collectViolations(files, predicate) {
  return files
    .filter((filePath) => predicate(importSources(fs.readFileSync(filePath, 'utf8'))))
    .map(relative)
    .sort();
}

function collectSourceViolations(files, predicate) {
  return files
    .filter((filePath) => predicate(fs.readFileSync(filePath, 'utf8')))
    .map(relative)
    .sort();
}

function isTestFile(filePath) {
  return /\.(?:test|spec)\.tsx?$/.test(filePath);
}

function isReexportOnlyFile(filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const importedNames = new Set();
  let hasReexport = false;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name) importedNames.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) importedNames.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) importedNames.add(element.name.text);
      }
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      hasReexport = true;
      continue;
    }

    const isDirective =
      ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression);
    if (isDirective) continue;

    const isImportedDefaultReexport =
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression) &&
      importedNames.has(statement.expression.text);
    if (isImportedDefaultReexport) {
      hasReexport = true;
      continue;
    }

    return false;
  }

  return hasReexport;
}

function checkRatchet(label, actual, allowed, errors) {
  for (const file of actual) {
    if (!allowed.has(file)) errors.push(`${label}: new violation in ${file}`);
  }
  for (const file of allowed) {
    if (!actual.includes(file)) {
      errors.push(`${label}: remove resolved debt entry for ${file}`);
    }
  }
}

function containsTypeLiteral(node) {
  if (!node) return false;
  if (ts.isTypeLiteralNode(node)) return true;

  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsTypeLiteral(child)) found = true;
  });
  return found;
}

function checkNamedBoundarySignatures(filePath, errors) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    const isCheckedDeclaration =
      ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node);

    if (isCheckedDeclaration && node.name) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const label = `${relative(filePath)}:${location.line + 1} ${node.name.getText(sourceFile)}`;

      if (!node.type) {
        errors.push(`boundary contract: explicit return type required for ${label}`);
      } else if (
        containsTypeLiteral(node.type) ||
        node.parameters.some((parameter) => containsTypeLiteral(parameter.type))
      ) {
        errors.push(`boundary contract: named input/output type required for ${label}`);
      }
    }

    const isCheckedTypedValue =
      ts.isPropertySignature(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node);

    if (isCheckedTypedValue && node.type && containsTypeLiteral(node.type)) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const name = node.name.getText(sourceFile);
      errors.push(
        `boundary contract: named object type required for ${relative(filePath)}:${
          location.line + 1
        } ${name}`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function checkTransactionParallelism(filePath, errors) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  function containsPromiseAll(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === 'Promise' &&
      node.expression.name.text === 'all'
    ) {
      return true;
    }

    let found = false;
    ts.forEachChild(node, (child) => {
      if (!found && containsPromiseAll(child)) found = true;
    });
    return found;
  }

  function visit(node) {
    const isTransactionCall =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'withTransaction';

    if (isTransactionCall) {
      const callback = node.arguments[0];
      if (callback && containsPromiseAll(callback)) {
        const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        errors.push(
          `transaction safety: Promise.all is not supported inside withTransaction in ${relative(
            filePath,
          )}:${location.line + 1}`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const presentationFiles = walk(path.join(root, 'src/app'));
const localePresentationFiles = walk(path.join(root, 'src/app/[locale]'));
const componentPresentationFiles = walk(path.join(root, 'src/components'));
const clientPresentationFiles = [...localePresentationFiles, ...componentPresentationFiles];
const featureClientFiles = walk(path.join(root, 'src/features')).filter(
  (filePath) => /\/(?:components|hooks)\//.test(relative(filePath)) && !isTestFile(filePath),
);
const featureApiFiles = walk(path.join(root, 'src/features')).filter(
  (filePath) => /\/api\//.test(relative(filePath)) && !isTestFile(filePath),
);
const approvedFeatureTransportBoundaries = new Set([
  'src/features/adaptive/lib/adaptive-api-fetch.ts',
  'src/features/adaptive/lib/adaptive-api-methods.ts',
]);
const featureNonBoundaryFiles = walk(path.join(root, 'src/features')).filter((filePath) => {
  if (isTestFile(filePath)) return false;
  const relativePath = relative(filePath);
  if (approvedFeatureTransportBoundaries.has(relativePath)) return false;
  return !relativePath.includes('/api/') && !relativePath.includes('/mappers/');
});
const serviceFiles = walk(path.join(root, 'src/services')).filter((file) => !isTestFile(file));
const serviceContractFiles = walk(path.join(root, 'src/interfaces/services'));
const repositoryFiles = walk(path.join(root, 'src/repositories')).filter(
  (file) => !isTestFile(file),
);
const repositoryContractFiles = walk(path.join(root, 'src/interfaces/repositories'));
const dtoFiles = walk(path.join(root, 'src/dtos'));
const quizBuilderClientFiles = [
  ...walk(path.join(root, 'src/lib/quiz')),
  ...walk(path.join(root, 'src/features/quiz/components/editor')),
  ...walk(path.join(root, 'src/app/[locale]/(app)/create')),
  ...walk(path.join(root, 'src/app/[locale]/(app)/edit')),
  ...walk(path.join(root, 'src/app/[locale]/(app)/draft')),
];
const sourceFiles = walk(path.join(root, 'src')).filter(
  (file) => !/\.(?:test|spec)\.tsx?$/.test(file),
);
const sourceAndTestFiles = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'tests'))];

const presentationPersistenceImports = collectViolations(presentationFiles, (imports) =>
  imports.some(
    (source) =>
      source === 'mongoose' ||
      source === '@/lib/mongoose' ||
      source.startsWith('@/models/') ||
      source.startsWith('@/repositories/'),
  ),
);
const presentationDtoImports = collectViolations(clientPresentationFiles, (imports) =>
  imports.some((source) => source.startsWith('@/dtos/')),
);
const presentationApiClientCalls = collectSourceViolations(clientPresentationFiles, (source) =>
  /\bfetchApi(?:Data|Response|Success)\b|\bfetch\s*\(/.test(source),
);
const featureClientDtoImports = collectViolations(featureClientFiles, (imports) =>
  imports.some((source) => source.startsWith('@/dtos/')),
);
const featureClientApiClientCalls = collectSourceViolations(featureClientFiles, (source) =>
  /\bfetchApi(?:Data|Response|Success)\b|\bfetch\s*\(/.test(source),
);
const featureNonBoundaryDtoImports = collectViolations(featureNonBoundaryFiles, (imports) =>
  imports.some((source) => source.startsWith('@/dtos/')),
);
const featureNonBoundaryApiClientCalls = collectSourceViolations(
  featureNonBoundaryFiles,
  (source) => /\bfetchApi(?:Data|Response|Success)\b|\bfetch\s*\(/.test(source),
);
const servicePersistenceImports = collectViolations(serviceFiles, (imports) =>
  imports.some(
    (source) =>
      source === 'mongoose' ||
      source === '@/lib/mongoose' ||
      source.startsWith('@/models/') ||
      source.startsWith('@/repositories/'),
  ),
);
const serviceContractLeaks = collectViolations(serviceContractFiles, (imports) =>
  imports.some(
    (source) => source.startsWith('@/models/') || source.startsWith('@/interfaces/repositories/'),
  ),
);
const dtoDomainLeaks = collectViolations(dtoFiles, (imports) =>
  imports.some(
    (source) =>
      source.startsWith('@/entities/') ||
      source.startsWith('@/models/') ||
      source.startsWith('@/repositories/') ||
      source.startsWith('@/interfaces/repositories/'),
  ),
);
const quizBuilderDomainLeaks = collectViolations(quizBuilderClientFiles, (imports) =>
  imports.some(
    (source) =>
      source.startsWith('@/entities/') ||
      source.startsWith('@/models/') ||
      source.startsWith('@/repositories/') ||
      source.startsWith('@/interfaces/repositories/'),
  ),
);

const errors = [];
checkRatchet(
  'presentation -> persistence',
  presentationPersistenceImports,
  allowedPresentationPersistenceDebt,
  errors,
);
checkRatchet('presentation -> dto', presentationDtoImports, allowedPresentationDtoDebt, errors);
checkRatchet(
  'presentation -> api client',
  presentationApiClientCalls,
  allowedPresentationApiClientDebt,
  errors,
);
checkRatchet('feature client -> dto', featureClientDtoImports, allowedFeatureClientDtoDebt, errors);
checkRatchet(
  'feature client -> api client',
  featureClientApiClientCalls,
  allowedFeatureClientApiClientDebt,
  errors,
);
checkRatchet(
  'feature non-boundary -> dto',
  featureNonBoundaryDtoImports,
  allowedFeatureBoundaryDtoDebt,
  errors,
);
checkRatchet(
  'feature non-boundary -> api client',
  featureNonBoundaryApiClientCalls,
  allowedFeatureBoundaryApiClientDebt,
  errors,
);
checkRatchet(
  'application -> persistence',
  servicePersistenceImports,
  allowedServicePersistenceDebt,
  errors,
);
checkRatchet(
  'service contract -> persistence',
  serviceContractLeaks,
  allowedServiceContractLeakDebt,
  errors,
);
checkRatchet('dto -> domain', dtoDomainLeaks, allowedDtoDomainLeakDebt, errors);
checkRatchet(
  'quiz builder client -> domain',
  quizBuilderDomainLeaks,
  allowedQuizBuilderDomainLeakDebt,
  errors,
);

for (const filePath of sourceAndTestFiles) {
  const count =
    fs.readFileSync(filePath, 'utf8').match(/\b(?:as unknown as|as any|as never)\b/g)?.length ?? 0;
  if (count > 0) {
    errors.push(`unsafe cast: remove ${count} occurrence(s) from ${relative(filePath)}`);
  }
}

for (const filePath of sourceFiles) {
  checkTransactionParallelism(filePath, errors);

  if (isReexportOnlyFile(filePath)) {
    errors.push(`re-export-only file: remove ${relative(filePath)} and import targets directly`);
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const relativePath = relative(filePath);
  if (relativePath.startsWith('src/entities/') && /(?:^|\W)_id(?:\W|$)/m.test(source)) {
    errors.push(`entity identity: use id instead of persistence _id in ${relativePath}`);
  }
  if (relativePath.startsWith('src/entities/') && importSources(source).includes('@/types/mongo')) {
    errors.push(`entity identity: remove Mongo persistence types from ${relativePath}`);
  }
  if (
    relativePath.startsWith('src/entities/') &&
    /(?:^|\s)(?:id|createdAt|updatedAt)\?:/m.test(source)
  ) {
    errors.push(
      `entity invariant: persisted identity and timestamps must be required in ${relativePath}`,
    );
  }
  if (
    relativePath.startsWith('src/interfaces/repositories/') &&
    /(?:^|\W)_id(?:\W|$)/m.test(source)
  ) {
    errors.push(`repository contract: move persistence identity out of ${relativePath}`);
  }

  if (relativePath.endsWith('DtoMapper.ts') && !relativePath.startsWith('src/mappers/')) {
    errors.push(`dto mapper location: move ${relativePath} to a domain folder under src/mappers`);
  }

  if (
    !relativePath.startsWith('src/repositories/types/') &&
    /^(?:export\s+)?(?:interface|type)\s+\w*PersistenceRecord\b/m.test(source)
  ) {
    errors.push(
      `persistence type location: move PersistenceRecord declarations to src/repositories/types (${relativePath})`,
    );
  }

  const forbiddenContractSentinels = [
    ['unknown@example.com', 'fabricated email'],
    ['new Date(0)', 'fabricated epoch date'],
    ['isAnonymous', 'obsolete anonymous-user compatibility field'],
    ['fallbackCards', 'fabricated dashboard fallback cards'],
    ['input.fields ?? {}', 'optional validation-field fallback'],
  ];
  for (const [token, label] of forbiddenContractSentinels) {
    if (source.includes(token)) {
      errors.push(`contract fallback: remove ${label} from ${relativePath}`);
    }
  }

  if (/setTimeout\s*\(\s*\(\)\s*=>\s*\w+\.abort\s*\(/.test(source)) {
    errors.push(`native platform boundary: use AbortSignal.timeout in ${relativePath}`);
  }

  const mixedSchemaMatches = source.match(/Schema\.Types\.Mixed/g) ?? [];
  const isAllowedAuditMetadata =
    relativePath === 'src/models/AuditLog.ts' &&
    mixedSchemaMatches.length === 1 &&
    source.includes('metadata: { type: Schema.Types.Mixed, default: null }');
  if (mixedSchemaMatches.length > 0 && !isAllowedAuditMetadata) {
    errors.push(`persistence contract: replace Schema.Types.Mixed in ${relativePath}`);
  }

  if (relativePath.startsWith('src/services/')) {
    if (/\bdata\s*:\s*\{/.test(source)) {
      errors.push(
        `service dto boundary: map object response data through src/mappers in ${relativePath}`,
      );
    }

    const forbiddenServiceValidationSentinels = [
      ['VALID_QUESTION_TYPES', 'question type DTO validation'],
      ['Missing or invalid question text', 'question text DTO validation'],
      ['Question options must be a non-empty array', 'question options DTO validation'],
      ['correctIndex out of range', 'question answer DTO validation'],
      ['Duplicate correct answer indexes', 'question answer DTO validation'],
      ['Unsupported question type', 'question type DTO validation'],
    ];
    for (const [token, label] of forbiddenServiceValidationSentinels) {
      if (source.includes(token)) {
        errors.push(`controller validation boundary: remove ${label} from ${relativePath}`);
      }
    }
  }

  if (relativePath.startsWith('src/app/api/') && relativePath.endsWith('/route.ts')) {
    if (source.includes('searchParams.get(')) {
      errors.push(
        `controller validation boundary: use readAndValidateSearchParams in ${relativePath}`,
      );
    }
    if (source.includes('readJsonBody')) {
      errors.push(`controller validation boundary: use readAndValidateJson in ${relativePath}`);
    }
  }
}

for (const filePath of [
  ...serviceFiles,
  ...serviceContractFiles,
  ...repositoryFiles,
  ...repositoryContractFiles,
  ...featureApiFiles,
]) {
  checkNamedBoundarySignatures(filePath, errors);
}

if (errors.length > 0) {
  console.error('Layer boundary check failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Layer boundary check passed (${presentationPersistenceImports.length} presentation, ` +
    `${servicePersistenceImports.length} service, ${serviceContractLeaks.length} contract, ` +
    `${dtoDomainLeaks.length} dto, ${quizBuilderDomainLeaks.length} quiz-builder, ` +
    `${featureClientDtoImports.length + featureClientApiClientCalls.length} feature-client, ` +
    `${
      featureNonBoundaryDtoImports.length + featureNonBoundaryApiClientCalls.length
    } feature-boundary debt files remain).`,
);
