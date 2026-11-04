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

// The standalone server.js binds to process.env.HOSTNAME and ignores a
// --hostname flag. Inside Docker HOSTNAME is the container id, so without this
// the server listens on the container IP only and 127.0.0.1 refuses connections
// (Lighthouse then reports CHROME_INTERSTITIAL_ERROR, RIN-813).
const hostnameFlagIndex = process.argv.findIndex(
  (argument) => argument === '--hostname' || argument === '-H',
);
const inlineHostname = process.argv
  .find((argument) => argument.startsWith('--hostname='))
  ?.slice(11);
const requestedHostname =
  inlineHostname ?? (hostnameFlagIndex >= 0 ? process.argv[hostnameFlagIndex + 1] : undefined);
if (requestedHostname) {
  process.env.HOSTNAME = requestedHostname;
}

const requireNonEmptyDirectory = async (directoryPath, label) => {
  const entries = await readdir(directoryPath).catch(() => []);
  if (entries.length === 0) {
    throw new Error(`${label} is missing or empty: ${path.relative(rootDir, directoryPath)}`);
  }
};

await access(serverPath).catch(() => {
  // A build that was interrupted, or one run before `output: 'standalone'` was
  // configured, leaves the surrounding directory in place without the server
  // entrypoint. That state is indistinguishable from a healthy build by a
  // directory check alone, and starting from it is what once made the E2E suite
  // look unrunnable, so the entrypoint itself is what this asserts on.
  throw new Error(
    'Standalone server is missing; run `npm run build` first ' +
      '(a partial .next can carry a standalone directory without server.js)',
  );
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
