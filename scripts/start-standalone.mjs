import { access, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const serverPath = path.join(standaloneDir, 'server.js');
const sourceStaticDir = path.join(rootDir, '.next', 'static');
const targetStaticDir = path.join(standaloneDir, '.next', 'static');
const sourcePublicDir = path.join(rootDir, 'public');
const targetPublicDir = path.join(standaloneDir, 'public');

const portFlagIndex = process.argv.findIndex(
  (argument) => argument === '--port' || argument === '-p',
);
const inlinePort = process.argv.find((argument) => argument.startsWith('--port='))?.slice(7);
const requestedPort =
  inlinePort ?? (portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : undefined);
if (requestedPort !== undefined) {
  const port = Number(requestedPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${requestedPort}`);
  }
  process.env.PORT = String(port);
}

const requireNonEmptyDirectory = async (directoryPath, label) => {
  const entries = await readdir(directoryPath).catch(() => []);
  if (entries.length === 0) {
    throw new Error(`${label} is missing or empty: ${path.relative(rootDir, directoryPath)}`);
  }
};

await access(serverPath).catch(() => {
  throw new Error('Standalone server is missing; run `npm run build` first');
});
await Promise.all([
  requireNonEmptyDirectory(sourcePublicDir, 'Public asset directory'),
  requireNonEmptyDirectory(sourceStaticDir, 'Next.js static asset directory'),
]);

await Promise.all([
  rm(targetPublicDir, { force: true, recursive: true }),
  rm(targetStaticDir, { force: true, recursive: true }),
]);
await mkdir(path.dirname(targetStaticDir), { recursive: true });
await Promise.all([
  cp(sourcePublicDir, targetPublicDir, { recursive: true }),
  cp(sourceStaticDir, targetStaticDir, { recursive: true }),
]);

await import(pathToFileURL(serverPath).href);
