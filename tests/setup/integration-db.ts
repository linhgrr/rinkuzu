/**
 * The fence between the integration suite and any database that matters.
 *
 * These tests create orders, take leases, revoke entitlements and delete what
 * they made. Running them once against a production URI would be
 * unrecoverable, so the suite refuses to start unless three independent things
 * are true of `MONGODB_URI`: the host is loopback, the scheme is the plain
 * `mongodb://` one rather than the `mongodb+srv://` that a managed cluster
 * hands out, and the database name says it is a test database.
 *
 * All three, not any one. A local proxy to a remote cluster passes the host
 * check; a staging database on localhost passes the scheme check; a production
 * database can be reached at a name containing "test". The guard runs as a
 * setup file so it fires once per worker before any suite has a chance to
 * connect, and it throws rather than skipping — a silent skip is how an
 * "integration suite" ends up green having run nothing.
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const SAFE_DATABASE_NAME = /(^|[-_])(test|ci)($|[-_])/i;

function refuse(reason: string): never {
  throw new Error(
    `Refusing to run billing integration tests: ${reason}. ` +
      'Point MONGODB_URI at a local replica set whose database name contains "test".',
  );
}

/**
 * Splits a connection string the way a MongoDB driver does, rather than the way
 * `new URL` does.
 *
 * `new URL` cannot parse a seed list: `mongodb://a:27017,b:27018/db` is not a
 * valid URL because of the second colon, and it throws. Handing that to the
 * guard made an ordinary replica-set URI look like a malformed one — which
 * failed closed, but also meant the per-member host check below could never
 * actually run on the shape it was written for.
 */
const URI_PATTERN =
  /^(?<scheme>[a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?(?<hosts>[^/?#]+)(?:\/(?<database>[^?#]*))?(?:[?#].*)?$/i;

export function assertIsolatedTestDatabase(uri: string | undefined): string {
  if (!uri) refuse('MONGODB_URI is not set');

  const groups = URI_PATTERN.exec(uri)?.groups;
  const scheme = groups?.['scheme'];
  const hostList = groups?.['hosts'];
  if (!scheme || !hostList) refuse('MONGODB_URI is not a URL');

  if (scheme.toLowerCase() !== 'mongodb') {
    refuse(`the "${scheme}:" scheme is not a local MongoDB connection`);
  }
  // Every member of a seed list has to be loopback, not merely the first.
  const hosts = hostList.split(',').map((host) => host.trim().replace(/:\d+$/, ''));
  const remote = hosts.find((host) => !LOOPBACK_HOSTS.has(host));
  if (remote !== undefined) refuse(`host "${remote}" is not loopback`);

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(groups?.['database'] ?? '');
  } catch {
    refuse('MONGODB_URI is not a URL');
  }
  if (!SAFE_DATABASE_NAME.test(databaseName)) {
    refuse(`database "${databaseName || '<empty>'}" is not named as a test database`);
  }
  return databaseName;
}

assertIsolatedTestDatabase(process.env['MONGODB_URI']);

/**
 * The URI, re-checked at the point of use.
 *
 * The setup file already refused at import time, so this cannot legitimately
 * fail — but a suite that connects to whatever `process.env` happens to hold
 * when it runs is one `vi.stubEnv` away from connecting somewhere else, and the
 * check costs nothing.
 */
export function integrationDatabaseUri(): string {
  const uri = process.env['MONGODB_URI'];
  assertIsolatedTestDatabase(uri);
  return uri as string;
}
