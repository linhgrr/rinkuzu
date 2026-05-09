import {
  GENERATED_TYPES_PATH,
  createTempSchemaPath,
  ensureGeneratedDir,
  exportOpenApi,
  generateTypes,
  lintOpenApi,
} from './adaptive-contract.shared.mjs';

const schemaPath = createTempSchemaPath();

ensureGeneratedDir();
exportOpenApi(schemaPath);
lintOpenApi(schemaPath);
generateTypes(schemaPath, GENERATED_TYPES_PATH);

process.stdout.write(`Generated adaptive contract types at ${GENERATED_TYPES_PATH}\n`);
