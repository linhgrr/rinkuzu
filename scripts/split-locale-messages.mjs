import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const locales = ['en', 'vi'];

for (const locale of locales) {
  const sourcePath = path.join(rootDir, 'messages', `${locale}.json`);
  const localeDir = path.join(rootDir, 'messages', locale);
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));

  await mkdir(localeDir, { recursive: true });

  for (const [namespace, payload] of Object.entries(source)) {
    const targetPath = path.join(localeDir, `${namespace}.json`);
    await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
