import { existsSync } from 'node:fs';

import {
  GENERATED_TYPES_PATH,
  createTempSchemaPath,
  exportOpenApi,
  generateTypes,
  lintOpenApi,
  readText,
} from './adaptive-contract.shared.mjs';

const schemaPath = createTempSchemaPath();
const generatedCheckPath = createTempSchemaPath('adaptive-api.d.ts');

exportOpenApi(schemaPath);
lintOpenApi(schemaPath);
generateTypes(schemaPath, generatedCheckPath);

if (!existsSync(GENERATED_TYPES_PATH)) {
  console.error(`Missing ${GENERATED_TYPES_PATH}. Run: npm run generate:adaptive-contract`);
  process.exit(1);
}

if (readText(GENERATED_TYPES_PATH) !== readText(generatedCheckPath)) {
  console.error('Adaptive contract types are stale. Run: npm run generate:adaptive-contract');
  process.exit(1);
}

process.stdout.write('Adaptive contract types are up to date.\n');
