const port = process.env.LIGHTHOUSE_PORT || '3000';
const numericPort = Number(port);
if (
  !/^\d+$/.test(port) ||
  !Number.isInteger(numericPort) ||
  numericPort < 1 ||
  numericPort > 65535
) {
  throw new Error(
    `LIGHTHOUSE_PORT must be an integer from 1 to 65535; received ${JSON.stringify(port)}`,
  );
}
const baseUrl = `http://127.0.0.1:${port}`;
const mode = process.env.PERF_MODE || 'local';
/** @type {Readonly<Record<'local' | 'pr' | 'release', number>>} */
const runsByMode = Object.freeze({ local: 3, pr: 3, release: 5 });

if (!Object.hasOwn(runsByMode, mode)) {
  throw new Error(
    `PERF_MODE must be one of local, pr, or release; received ${JSON.stringify(mode)}`,
  );
}

if (process.env.CI === 'true' && mode === 'local') {
  throw new Error('PERF_MODE=local is not valid in CI; use pr or release');
}

const expectedRuns = runsByMode[/** @type {'local' | 'pr' | 'release'} */ (mode)];
const urls = [`${baseUrl}/en`, `${baseUrl}/en/login`];
const publicIndexableUrls = [`${baseUrl}/en`];
/** @type {{ aggregationMethod: 'median' }} */
const median = { aggregationMethod: 'median' };

/** @typedef {['error', { aggregationMethod: 'median', minScore?: number, maxNumericValue?: number }]} LighthouseAssertion */
/** @type {Record<string, LighthouseAssertion>} */
const commonAssertions = {
  'categories:accessibility': ['error', { minScore: 1, ...median }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500, ...median }],
  'total-blocking-time': ['error', { maxNumericValue: 200, ...median }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, ...median }],
  'errors-in-console': ['error', { minScore: 1, ...median }],
};

if (mode === 'release') {
  commonAssertions['categories:performance'] = ['error', { minScore: 0.9, ...median }];
  commonAssertions['categories:best-practices'] = ['error', { minScore: 0.95, ...median }];
}

/** @type {Array<{ matchingUrlPattern: string, assertions: Record<string, LighthouseAssertion> }>} */
const assertMatrix = [
  {
    matchingUrlPattern: '.*',
    assertions: commonAssertions,
  },
];

if (mode === 'release') {
  const publicUrlPattern = `^${publicIndexableUrls[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`;
  assertMatrix.push({
    matchingUrlPattern: publicUrlPattern,
    assertions: {
      'categories:seo': ['error', { minScore: 0.95, ...median }],
    },
  });
}

module.exports = {
  productionPolicy: {
    schemaVersion: 1,
    mode,
    expectedRuns,
    urls,
    publicIndexableUrls,
    thresholds: {
      lcpMsMax: 2500,
      tbtMsMax: 200,
      clsMax: 0.1,
      accessibilityScoreMin: 1,
      releasePerformanceScoreMin: 0.9,
      releaseBestPracticesScoreMin: 0.95,
      releaseSeoScoreMin: 0.95,
    },
    consoleErrorAllowlist: [],
    networkFailureAllowlist: [],
  },
  ci: {
    collect: {
      url: urls,
      numberOfRuns: expectedRuns,
      startServerCommand: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 120000,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        throttlingMethod: 'provided',
      },
    },
    assert: {
      assertMatrix,
    },
    upload: {
      target: 'filesystem',
      outputDir: './perf/lighthouse',
    },
  },
};
