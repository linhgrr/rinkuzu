import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

import { computeNextBuildDigest, sha256File } from './run-lighthouse.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, '..');
const DEFAULT_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

const normalizeRelativePath = (value) => value.split(path.sep).join('/');

const isPathInside = (parentPath, candidatePath) => {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
};

const requireRecord = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
};

const requireFiniteNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

export const readJsonStrict = (targetPath, label = targetPath) => {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label} is missing or malformed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const writeJsonAtomic = (targetPath, value) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, targetPath);
};

export const parseHumanBytes = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== 'string') {
    throw new Error(
      `Byte value must be a non-negative number or string; received ${JSON.stringify(value)}`,
    );
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KiB|MiB)$/i);
  if (!match) {
    throw new Error(`Invalid byte value ${JSON.stringify(value)}; use B, KiB, or MiB`);
  }

  const amount = Number.parseFloat(match[1]);
  const multipliers = { b: 1, kib: 1024, mib: 1024 * 1024 };
  return amount * multipliers[match[2].toLowerCase()];
};

export const median = (values, label = 'values') => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${label} must contain at least one value`);
  }
  const sorted = values.map((value, index) => requireFiniteNumber(value, `${label}[${index}]`));
  sorted.sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const gzipSize = (filePath) => zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).length;

const validateSizeConfig = (rawConfig) => {
  const config = requireRecord(rawConfig, '.size-limit.json');
  if (config.schemaVersion !== 2) {
    throw new Error('.size-limit.json schemaVersion must be 2');
  }
  if (config.metric !== 'route-first-load-js-gzip') {
    throw new Error('.size-limit.json metric must be route-first-load-js-gzip');
  }
  if (typeof config.source !== 'string' || config.source.length === 0) {
    throw new Error('.size-limit.json source must be a non-empty string');
  }
  if (!Array.isArray(config.routeGroups) || config.routeGroups.length === 0) {
    throw new Error('.size-limit.json routeGroups must be a non-empty array');
  }

  const groupNames = new Set();
  const routeGroups = config.routeGroups.map((rawGroup, groupIndex) => {
    const group = requireRecord(rawGroup, `routeGroups[${groupIndex}]`);
    if (typeof group.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(group.name)) {
      throw new Error(`routeGroups[${groupIndex}].name must be a kebab-case identifier`);
    }
    if (groupNames.has(group.name)) {
      throw new Error(`Duplicate route group ${group.name}`);
    }
    groupNames.add(group.name);
    const limitBytes = parseHumanBytes(group.limit);
    if (limitBytes <= 0) {
      throw new Error(`Route group ${group.name} must have a positive limit`);
    }
    if (!Array.isArray(group.patterns) || group.patterns.length === 0) {
      throw new Error(`Route group ${group.name} must define at least one pattern`);
    }
    const patterns = group.patterns.map((pattern, patternIndex) => {
      if (typeof pattern !== 'string' || pattern.length === 0) {
        throw new Error(`Route group ${group.name} pattern ${patternIndex} must be a string`);
      }
      try {
        return new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `Route group ${group.name} pattern ${patternIndex} is invalid: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
    return { name: group.name, limitBytes, patterns };
  });

  const regression = requireRecord(config.regression, '.size-limit.json regression');
  const maxIncreaseBytes = parseHumanBytes(regression.maxIncrease);
  const maxPercent = requireFiniteNumber(regression.maxPercent, 'regression.maxPercent');
  if (maxIncreaseBytes < 0 || maxPercent < 0) {
    throw new Error('Regression thresholds must be non-negative');
  }

  const rawRouteOverrides = requireRecord(
    regression.routeOverrides ?? {},
    'regression.routeOverrides',
  );
  const routeOverrides = new Map();
  for (const [route, rawOverride] of Object.entries(rawRouteOverrides)) {
    if (!route.startsWith('/') || route.trim() !== route) {
      throw new Error(`Regression override route must be an exact normalized route: ${route}`);
    }
    const override = requireRecord(rawOverride, `Regression override ${route}`);
    const overrideMaxIncreaseBytes = parseHumanBytes(override.maxIncrease);
    const overrideMaxPercent = requireFiniteNumber(
      override.maxPercent,
      `Regression override ${route} maxPercent`,
    );
    if (overrideMaxIncreaseBytes < 0 || overrideMaxPercent < 0) {
      throw new Error(`Regression override ${route} thresholds must be non-negative`);
    }
    if (typeof override.reason !== 'string' || override.reason.trim().length < 20) {
      throw new Error(`Regression override ${route} requires a specific reason`);
    }
    routeOverrides.set(route, {
      maxIncreaseBytes: overrideMaxIncreaseBytes,
      maxPercent: overrideMaxPercent,
      reason: override.reason.trim(),
    });
  }

  return {
    schemaVersion: 2,
    metric: config.metric,
    source: config.source,
    routeGroups,
    regression: { maxIncreaseBytes, maxPercent, routeOverrides },
  };
};

export const validateBaselineReport = (rawReport, expectedBaseSha) => {
  const report = requireRecord(rawReport, 'Performance baseline');
  if (report.schemaVersion !== 2) {
    throw new Error('Performance baseline schemaVersion must be 2');
  }
  if (!/^[a-f0-9]{64}$/.test(report.buildDigest || '')) {
    throw new Error('Performance baseline buildDigest must be a SHA-256 digest');
  }
  if (typeof report.commitSha !== 'string' || report.commitSha.length === 0) {
    throw new Error('Performance baseline commitSha is required');
  }
  if (expectedBaseSha && report.commitSha !== expectedBaseSha) {
    throw new Error(
      `Performance baseline commitSha ${report.commitSha} does not match PERF_BASE_SHA ${expectedBaseSha}`,
    );
  }
  if (!Array.isArray(report.entries)) {
    throw new Error('Performance baseline entries must be an array');
  }

  const entries = new Map();
  for (const [index, rawEntry] of report.entries.entries()) {
    const entry = requireRecord(rawEntry, `Performance baseline entry ${index}`);
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      throw new Error(`Performance baseline entry ${index} has no route name`);
    }
    if (entries.has(entry.name)) {
      throw new Error(`Performance baseline contains duplicate route ${entry.name}`);
    }
    const sizeBytes = requireFiniteNumber(entry.sizeBytes, `Baseline ${entry.name} sizeBytes`);
    if (sizeBytes < 0) {
      throw new Error(`Baseline ${entry.name} sizeBytes must be non-negative`);
    }
    entries.set(entry.name, sizeBytes);
  }

  return { report, entries };
};

/**
 * @param {{ rootDir: string, rawConfig: unknown, baselineReport?: unknown }} input
 */
export const evaluateRouteBudgets = ({ rootDir, rawConfig, baselineReport = null }) => {
  const config = validateSizeConfig(rawConfig);
  const statsPath = path.resolve(rootDir, config.source);
  if (!isPathInside(rootDir, statsPath)) {
    throw new Error(`Route bundle stats source escapes the repository: ${config.source}`);
  }
  const rows = readJsonStrict(statsPath, 'Route bundle stats');
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Route bundle stats must be a non-empty array');
  }

  const baselineEntries = baselineReport
    ? validateBaselineReport(baselineReport).entries
    : new Map();
  const seenRoutes = new Set();
  const violations = [];
  const entries = rows.map((rawRow, rowIndex) => {
    const row = requireRecord(rawRow, `Route bundle row ${rowIndex}`);
    if (typeof row.route !== 'string' || !row.route.startsWith('/')) {
      throw new Error(`Route bundle row ${rowIndex} has an invalid route`);
    }
    if (seenRoutes.has(row.route)) {
      throw new Error(`Route bundle stats contain duplicate route ${row.route}`);
    }
    seenRoutes.add(row.route);

    const matchingGroups = config.routeGroups.filter((group) =>
      group.patterns.some((pattern) => pattern.test(row.route)),
    );
    if (matchingGroups.length !== 1) {
      const names = matchingGroups.map((group) => group.name).join(', ') || 'none';
      throw new Error(`Route ${row.route} must match exactly one budget group; matched ${names}`);
    }
    const group = matchingGroups[0];

    if (!Array.isArray(row.firstLoadChunkPaths) || row.firstLoadChunkPaths.length === 0) {
      throw new Error(`Route ${row.route} has no first-load chunk evidence`);
    }
    const uniqueChunkPaths = [...new Set(row.firstLoadChunkPaths)];
    if (
      uniqueChunkPaths.some((chunkPath) => typeof chunkPath !== 'string' || chunkPath.length === 0)
    ) {
      throw new Error(`Route ${row.route} contains an invalid chunk path`);
    }

    const sizeBytes = uniqueChunkPaths.reduce((total, chunkPath) => {
      const absolutePath = path.resolve(rootDir, chunkPath);
      const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));
      if (!isPathInside(rootDir, absolutePath) || !relativePath.startsWith('.next/')) {
        throw new Error(`Route ${row.route} chunk escapes .next: ${chunkPath}`);
      }
      if (!absolutePath.endsWith('.js')) {
        throw new Error(`Route ${row.route} chunk is not JavaScript: ${chunkPath}`);
      }
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        throw new Error(`Route ${row.route} chunk is missing: ${chunkPath}`);
      }
      return total + gzipSize(absolutePath);
    }, 0);

    const baselineSizeBytes = baselineEntries.get(row.route) ?? null;
    const deltaBytes = baselineSizeBytes === null ? null : sizeBytes - baselineSizeBytes;
    const deltaPercent =
      baselineSizeBytes === null
        ? null
        : baselineSizeBytes === 0
          ? deltaBytes > 0
            ? Number.POSITIVE_INFINITY
            : 0
          : (deltaBytes / baselineSizeBytes) * 100;
    const absoluteExceeded = sizeBytes > group.limitBytes;
    const routeOverride = config.regression.routeOverrides.get(row.route) ?? null;
    const regressionThreshold = routeOverride ?? config.regression;
    const regressionExceeded =
      deltaBytes !== null &&
      deltaPercent !== null &&
      deltaBytes > regressionThreshold.maxIncreaseBytes &&
      deltaPercent > regressionThreshold.maxPercent;

    if (absoluteExceeded) {
      violations.push({
        code: 'bundle-absolute-cap',
        route: row.route,
        group: group.name,
        actual: sizeBytes,
        limit: group.limitBytes,
      });
    }
    if (regressionExceeded) {
      violations.push({
        code: 'bundle-regression',
        route: row.route,
        actual: sizeBytes,
        baseline: baselineSizeBytes,
        deltaBytes,
        deltaPercent,
        maxIncreaseBytes: regressionThreshold.maxIncreaseBytes,
        maxPercent: regressionThreshold.maxPercent,
        overrideReason: routeOverride?.reason ?? null,
      });
    }

    return {
      name: row.route,
      group: group.name,
      metric: config.metric,
      chunkCount: uniqueChunkPaths.length,
      sizeBytes,
      limitBytes: group.limitBytes,
      baselineSizeBytes,
      deltaBytes,
      deltaPercent,
      regressionMaxIncreaseBytes: regressionThreshold.maxIncreaseBytes,
      regressionMaxPercent: regressionThreshold.maxPercent,
      regressionOverrideReason: routeOverride?.reason ?? null,
      absoluteExceeded,
      regressionExceeded,
      ok: !absoluteExceeded && !regressionExceeded,
    };
  });

  const staleOverrides = [...config.regression.routeOverrides.keys()].filter(
    (route) => !seenRoutes.has(route),
  );
  if (staleOverrides.length > 0) {
    throw new Error(
      `Regression route overrides do not match build evidence: ${staleOverrides.join(', ')}`,
    );
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  return { config, entries, violations };
};

const canonicalUrl = (value, label) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL: ${JSON.stringify(value)}`);
  }
  parsed.hash = '';
  parsed.search = '';
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString().replace(/\/$/, '');
};

const validatePolicy = (rawPolicy) => {
  const policy = requireRecord(rawPolicy, 'Lighthouse production policy');
  if (policy.schemaVersion !== 1) {
    throw new Error('Lighthouse production policy schemaVersion must be 1');
  }
  if (!['local', 'pr', 'release'].includes(policy.mode)) {
    throw new Error(`Invalid Lighthouse performance mode ${JSON.stringify(policy.mode)}`);
  }
  const expectedRunsByMode = { local: 3, pr: 3, release: 5 };
  if (policy.expectedRuns !== expectedRunsByMode[policy.mode]) {
    throw new Error(
      `Mode ${policy.mode} requires exactly ${expectedRunsByMode[policy.mode]} Lighthouse runs`,
    );
  }
  if (!Array.isArray(policy.urls) || policy.urls.length === 0) {
    throw new Error('Lighthouse policy urls must be a non-empty array');
  }
  const urls = policy.urls.map((url, index) => canonicalUrl(url, `policy.urls[${index}]`));
  if (new Set(urls).size !== urls.length) {
    throw new Error('Lighthouse policy urls must be unique');
  }
  if (!Array.isArray(policy.publicIndexableUrls)) {
    throw new Error('Lighthouse policy publicIndexableUrls must be an array');
  }
  const publicIndexableUrls = policy.publicIndexableUrls.map((url, index) =>
    canonicalUrl(url, `policy.publicIndexableUrls[${index}]`),
  );
  if (publicIndexableUrls.some((url) => !urls.includes(url))) {
    throw new Error('Every public indexable URL must also be a required Lighthouse URL');
  }

  const thresholds = requireRecord(policy.thresholds, 'Lighthouse thresholds');
  for (const [name, value] of Object.entries(thresholds)) {
    requireFiniteNumber(value, `Lighthouse threshold ${name}`);
  }
  for (const allowlistName of ['consoleErrorAllowlist', 'networkFailureAllowlist']) {
    if (!Array.isArray(policy[allowlistName])) {
      throw new Error(`${allowlistName} must be an array of exact SHA-256 fingerprints`);
    }
    for (const fingerprint of policy[allowlistName]) {
      if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
        throw new Error(`${allowlistName} contains an invalid fingerprint`);
      }
    }
  }

  return { ...policy, urls, publicIndexableUrls, thresholds };
};

const alignPolicyToEvidenceUrls = (rawPolicy, rawEvidenceUrls) => {
  const policy = validatePolicy(rawPolicy);
  if (!Array.isArray(rawEvidenceUrls) || rawEvidenceUrls.length !== policy.urls.length) {
    throw new Error('Lighthouse evidence URL count does not match policy');
  }

  const evidenceUrls = rawEvidenceUrls.map((url, index) =>
    canonicalUrl(url, `evidence.expectedUrls[${index}]`),
  );
  const parsedEvidenceUrls = evidenceUrls.map((url) => new URL(url));
  const evidenceOrigins = new Set(parsedEvidenceUrls.map((url) => url.origin));
  if (evidenceOrigins.size !== 1) {
    throw new Error('Lighthouse evidence URLs must share one origin');
  }

  for (const url of parsedEvidenceUrls) {
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port === ''
    ) {
      throw new Error(
        'Lighthouse evidence URLs must use an explicit ephemeral http://127.0.0.1 port',
      );
    }
  }

  const policyPaths = policy.urls.map((url) => new URL(url).pathname);
  const evidencePaths = parsedEvidenceUrls.map((url) => url.pathname);
  if (evidencePaths.some((pathname, index) => pathname !== policyPaths[index])) {
    throw new Error('Lighthouse evidence routes do not match policy');
  }

  const publicIndexablePaths = new Set(
    policy.publicIndexableUrls.map((url) => new URL(url).pathname),
  );
  return {
    ...policy,
    urls: evidenceUrls,
    publicIndexableUrls: evidenceUrls.filter((url) =>
      publicIndexablePaths.has(new URL(url).pathname),
    ),
  };
};

const fingerprint = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const extractLighthouseMetrics = (rawReport, reportIndex) => {
  const report = requireRecord(rawReport, `Lighthouse report ${reportIndex}`);
  const categories = requireRecord(
    report.categories,
    `Lighthouse report ${reportIndex} categories`,
  );
  const audits = requireRecord(report.audits, `Lighthouse report ${reportIndex} audits`);
  const requestedUrl = canonicalUrl(
    report.requestedUrl,
    `Lighthouse report ${reportIndex} requestedUrl`,
  );
  const finalUrl = canonicalUrl(report.finalUrl, `Lighthouse report ${reportIndex} finalUrl`);

  const categoryScore = (category, label) => {
    const value = requireRecord(category, label).score;
    return requireFiniteNumber(value, `${label}.score`);
  };
  const auditNumber = (auditId) => {
    const audit = requireRecord(
      audits[auditId],
      `Lighthouse report ${reportIndex} audit ${auditId}`,
    );
    return requireFiniteNumber(audit.numericValue, `${auditId}.numericValue`);
  };

  const consoleAudit = requireRecord(
    audits['errors-in-console'],
    `Lighthouse report ${reportIndex} errors-in-console`,
  );
  requireFiniteNumber(
    consoleAudit.score,
    `Lighthouse report ${reportIndex} errors-in-console.score`,
  );
  if (!consoleAudit.details || !Array.isArray(consoleAudit.details.items)) {
    throw new Error(`Lighthouse report ${reportIndex} has no console-error detail evidence`);
  }
  const consoleErrors = consoleAudit.details.items.map((item) => {
    const normalized = {
      source: item?.source ?? null,
      description: item?.description ?? null,
      url: item?.url ?? null,
      lineNumber: item?.lineNumber ?? null,
      columnNumber: item?.columnNumber ?? null,
    };
    return { ...normalized, fingerprint: fingerprint(normalized) };
  });

  const networkAudit = requireRecord(
    audits['network-requests'],
    `Lighthouse report ${reportIndex} network-requests`,
  );
  if (!networkAudit.details || !Array.isArray(networkAudit.details.items)) {
    throw new Error(`Lighthouse report ${reportIndex} has no network-request detail evidence`);
  }
  const networkFailures = [];
  for (const [requestIndex, item] of networkAudit.details.items.entries()) {
    if (!item || typeof item !== 'object' || typeof item.url !== 'string') {
      throw new Error(
        `Lighthouse report ${reportIndex} network request ${requestIndex} is malformed`,
      );
    }
    if (typeof item.finished !== 'boolean') {
      throw new Error(
        `Lighthouse report ${reportIndex} network request ${requestIndex} has no finished flag`,
      );
    }
    const numericStatus = item.statusCode === undefined ? null : Number(item.statusCode);
    if (numericStatus !== null && !Number.isFinite(numericStatus)) {
      throw new Error(
        `Lighthouse report ${reportIndex} network request ${requestIndex} has invalid status`,
      );
    }
    const failed =
      item.finished === false ||
      numericStatus === 0 ||
      (numericStatus !== null && numericStatus >= 400);
    if (failed) {
      const normalized = { url: item.url, statusCode: numericStatus, finished: item.finished };
      networkFailures.push({ ...normalized, fingerprint: fingerprint(normalized) });
    }
  }

  return {
    requestedUrl,
    finalUrl,
    performanceScore: categoryScore(
      categories.performance,
      `Lighthouse report ${reportIndex} performance category`,
    ),
    accessibilityScore: categoryScore(
      categories.accessibility,
      `Lighthouse report ${reportIndex} accessibility category`,
    ),
    bestPracticesScore: categoryScore(
      categories['best-practices'],
      `Lighthouse report ${reportIndex} best-practices category`,
    ),
    seoScore: categoryScore(categories.seo, `Lighthouse report ${reportIndex} seo category`),
    lcpMs: auditNumber('largest-contentful-paint'),
    tbtMs: auditNumber('total-blocking-time'),
    cls: auditNumber('cumulative-layout-shift'),
    consoleErrors,
    networkFailures,
  };
};

export const summarizeLighthouseReports = (rawReports, rawPolicy) => {
  const policy = validatePolicy(rawPolicy);
  if (!Array.isArray(rawReports)) {
    throw new Error('Lighthouse reports must be an array');
  }
  const expectedReportCount = policy.urls.length * policy.expectedRuns;
  if (rawReports.length !== expectedReportCount) {
    throw new Error(
      `Expected exactly ${expectedReportCount} Lighthouse reports, received ${rawReports.length}`,
    );
  }

  const reportsByUrl = new Map(policy.urls.map((url) => [url, []]));
  /** @type {Array<{ code: string, [key: string]: unknown }>} */
  const violations = [];
  rawReports.forEach((rawReport, reportIndex) => {
    const metrics = extractLighthouseMetrics(rawReport, reportIndex);
    if (!reportsByUrl.has(metrics.requestedUrl)) {
      throw new Error(`Unexpected Lighthouse requested URL ${metrics.requestedUrl}`);
    }
    if (metrics.finalUrl !== metrics.requestedUrl) {
      throw new Error(
        `Lighthouse URL redirected outside its evidence contract: ${metrics.requestedUrl} -> ${metrics.finalUrl}`,
      );
    }
    reportsByUrl.get(metrics.requestedUrl).push(metrics);

    for (const consoleError of metrics.consoleErrors) {
      if (!policy.consoleErrorAllowlist.includes(consoleError.fingerprint)) {
        violations.push({
          code: 'lighthouse-console-error',
          url: metrics.requestedUrl,
          fingerprint: consoleError.fingerprint,
          source: consoleError.source,
          description: consoleError.description,
        });
      }
    }
    for (const networkFailure of metrics.networkFailures) {
      if (!policy.networkFailureAllowlist.includes(networkFailure.fingerprint)) {
        violations.push({
          code: 'lighthouse-network-failure',
          url: metrics.requestedUrl,
          ...networkFailure,
        });
      }
    }
  });

  const summaries = [];
  for (const [url, reports] of reportsByUrl) {
    if (reports.length !== policy.expectedRuns) {
      throw new Error(
        `Expected exactly ${policy.expectedRuns} Lighthouse reports for ${url}, received ${reports.length}`,
      );
    }
    const summary = {
      url,
      runs: reports.length,
      performanceScore: median(
        reports.map((report) => report.performanceScore),
        `${url} performance`,
      ),
      accessibilityScore: median(
        reports.map((report) => report.accessibilityScore),
        `${url} accessibility`,
      ),
      bestPracticesScore: median(
        reports.map((report) => report.bestPracticesScore),
        `${url} best practices`,
      ),
      seoScore: median(
        reports.map((report) => report.seoScore),
        `${url} SEO`,
      ),
      lcpMs: median(
        reports.map((report) => report.lcpMs),
        `${url} LCP`,
      ),
      tbtMs: median(
        reports.map((report) => report.tbtMs),
        `${url} TBT`,
      ),
      cls: median(
        reports.map((report) => report.cls),
        `${url} CLS`,
      ),
    };
    summaries.push(summary);

    const thresholdChecks = [
      ['lighthouse-lcp', summary.lcpMs, policy.thresholds.lcpMsMax, 'max'],
      ['lighthouse-tbt', summary.tbtMs, policy.thresholds.tbtMsMax, 'max'],
      ['lighthouse-cls', summary.cls, policy.thresholds.clsMax, 'max'],
      [
        'lighthouse-accessibility',
        summary.accessibilityScore,
        policy.thresholds.accessibilityScoreMin,
        'min',
      ],
    ];
    if (policy.mode === 'release') {
      thresholdChecks.push(
        [
          'lighthouse-performance',
          summary.performanceScore,
          policy.thresholds.releasePerformanceScoreMin,
          'min',
        ],
        [
          'lighthouse-best-practices',
          summary.bestPracticesScore,
          policy.thresholds.releaseBestPracticesScoreMin,
          'min',
        ],
      );
      if (policy.publicIndexableUrls.includes(url)) {
        thresholdChecks.push([
          'lighthouse-seo',
          summary.seoScore,
          policy.thresholds.releaseSeoScoreMin,
          'min',
        ]);
      }
    }

    for (const [code, actual, limit, direction] of thresholdChecks) {
      const failed = direction === 'min' ? actual < limit : actual > limit;
      if (failed) {
        violations.push({ code, url, actual, limit });
      }
    }
  }

  summaries.sort((left, right) => left.url.localeCompare(right.url));
  return { policy, summaries, violations };
};

const parseEvidenceTime = (value, label) => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return timestamp;
};

export const validateLighthouseEvidence = ({
  rootDir,
  lighthouseOutputDir,
  rawPolicy,
  now = Date.now(),
  maxAgeMs = DEFAULT_EVIDENCE_MAX_AGE_MS,
  expectedBuildDigest = null,
}) => {
  const evidencePath = path.join(lighthouseOutputDir, 'evidence.json');
  const manifestPath = path.join(lighthouseOutputDir, 'manifest.json');
  const evidence = requireRecord(
    readJsonStrict(evidencePath, 'Lighthouse evidence'),
    'Lighthouse evidence',
  );
  const policy = alignPolicyToEvidenceUrls(rawPolicy, evidence.expectedUrls);
  const manifest = readJsonStrict(manifestPath, 'Lighthouse manifest');

  if (evidence.schemaVersion !== 1) {
    throw new Error('Lighthouse evidence schemaVersion must be 1');
  }
  if (evidence.ok !== true || !Array.isArray(evidence.errors) || evidence.errors.length !== 0) {
    throw new Error('Lighthouse runner did not produce successful evidence');
  }
  if (![0, 1].includes(evidence.lhciExitCode) || evidence.lhciSignal !== null) {
    throw new Error('Lighthouse runner exit evidence is not a completed assertion run');
  }
  if (evidence.mode !== policy.mode || evidence.expectedRuns !== policy.expectedRuns) {
    throw new Error('Lighthouse evidence mode or run count does not match policy');
  }
  if (
    !Array.isArray(evidence.expectedUrls) ||
    evidence.expectedUrls.length !== policy.urls.length ||
    evidence.expectedUrls.some(
      (url, index) => canonicalUrl(url, 'evidence URL') !== policy.urls[index],
    )
  ) {
    throw new Error('Lighthouse evidence URLs do not match policy');
  }

  const startedAt = parseEvidenceTime(evidence.startedAt, 'evidence.startedAt');
  const finishedAt = parseEvidenceTime(evidence.finishedAt, 'evidence.finishedAt');
  if (startedAt > finishedAt || finishedAt > now + CLOCK_SKEW_MS) {
    throw new Error('Lighthouse evidence timestamps are inconsistent');
  }
  if (now - finishedAt > maxAgeMs) {
    throw new Error('Lighthouse evidence is stale');
  }

  const configPath = path.join(rootDir, 'lighthouserc.cjs');
  if (evidence.configSha256 !== sha256File(configPath)) {
    throw new Error('Lighthouse evidence config digest does not match lighthouserc.cjs');
  }
  if (
    !/^[a-f0-9]{64}$/.test(evidence.buildDigestBefore || '') ||
    evidence.buildDigestBefore !== evidence.buildDigestAfter
  ) {
    throw new Error('Lighthouse evidence build digest is missing or changed during the run');
  }
  const currentBuildDigest = computeNextBuildDigest(rootDir);
  if (evidence.buildDigestBefore !== currentBuildDigest) {
    throw new Error('Lighthouse evidence was not generated from the current production build');
  }
  if (expectedBuildDigest && evidence.buildDigestBefore !== expectedBuildDigest) {
    throw new Error('Lighthouse build digest does not match PERF_EXPECTED_BUILD_DIGEST');
  }
  if (evidence.manifestSha256 !== sha256File(manifestPath)) {
    throw new Error('Lighthouse manifest digest does not match evidence');
  }

  const expectedReportCount = policy.urls.length * policy.expectedRuns;
  if (!Array.isArray(manifest) || manifest.length !== expectedReportCount) {
    throw new Error(`Lighthouse manifest must contain exactly ${expectedReportCount} entries`);
  }
  if (!Array.isArray(evidence.rawReports) || evidence.rawReports.length !== expectedReportCount) {
    throw new Error(
      `Lighthouse evidence must contain exactly ${expectedReportCount} raw report descriptors`,
    );
  }

  const descriptorByPath = new Map();
  for (const [index, rawDescriptor] of evidence.rawReports.entries()) {
    const descriptor = requireRecord(rawDescriptor, `Lighthouse report descriptor ${index}`);
    if (typeof descriptor.path !== 'string' || descriptor.path.length === 0) {
      throw new Error(`Lighthouse report descriptor ${index} has no path`);
    }
    if (descriptorByPath.has(descriptor.path)) {
      throw new Error(`Lighthouse evidence contains duplicate report path ${descriptor.path}`);
    }
    if (!/^[a-f0-9]{64}$/.test(descriptor.sha256 || '')) {
      throw new Error(`Lighthouse report descriptor ${index} has no SHA-256 digest`);
    }
    requireFiniteNumber(descriptor.sizeBytes, `Lighthouse descriptor ${index} sizeBytes`);
    requireFiniteNumber(descriptor.mtimeMs, `Lighthouse descriptor ${index} mtimeMs`);
    descriptorByPath.set(descriptor.path, descriptor);
  }

  const seenReportPaths = new Set();
  const reports = manifest.map((rawEntry, index) => {
    const entry = requireRecord(rawEntry, `Lighthouse manifest entry ${index}`);
    if (typeof entry.jsonPath !== 'string' || entry.jsonPath.length === 0) {
      throw new Error(`Lighthouse manifest entry ${index} has no jsonPath`);
    }
    const absolutePath = path.resolve(lighthouseOutputDir, entry.jsonPath);
    if (!isPathInside(lighthouseOutputDir, absolutePath)) {
      throw new Error(`Lighthouse manifest entry ${index} escapes the output directory`);
    }
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));
    if (seenReportPaths.has(relativePath)) {
      throw new Error(`Lighthouse manifest contains duplicate report ${relativePath}`);
    }
    seenReportPaths.add(relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`Lighthouse raw report is missing: ${relativePath}`);
    }
    const descriptor = descriptorByPath.get(relativePath);
    if (!descriptor) {
      throw new Error(`Lighthouse raw report has no evidence descriptor: ${relativePath}`);
    }
    const stat = fs.statSync(absolutePath);
    if (descriptor.sizeBytes !== stat.size || descriptor.sha256 !== sha256File(absolutePath)) {
      throw new Error(`Lighthouse raw report digest or size changed: ${relativePath}`);
    }
    if (Math.abs(descriptor.mtimeMs - stat.mtimeMs) > 1) {
      throw new Error(`Lighthouse raw report timestamp changed: ${relativePath}`);
    }
    if (stat.mtimeMs < startedAt - CLOCK_SKEW_MS || stat.mtimeMs > finishedAt + CLOCK_SKEW_MS) {
      throw new Error(`Lighthouse raw report timestamp is outside the run window: ${relativePath}`);
    }
    const report = readJsonStrict(absolutePath, `Lighthouse raw report ${relativePath}`);
    const fetchTime = parseEvidenceTime(report.fetchTime, `${relativePath} fetchTime`);
    if (fetchTime < startedAt - CLOCK_SKEW_MS || fetchTime > finishedAt + CLOCK_SKEW_MS) {
      throw new Error(`Lighthouse raw report fetchTime is outside the run window: ${relativePath}`);
    }
    return report;
  });

  if (descriptorByPath.size !== seenReportPaths.size) {
    throw new Error('Lighthouse evidence contains descriptors not present in the manifest');
  }
  return {
    evidence,
    manifest,
    reports,
    policy,
    buildDigest: currentBuildDigest,
    assertionsPassed: evidence.lhciExitCode === 0,
  };
};

const loadBaselineForMode = ({ rootDir, mode, environment }) => {
  const baselinePathValue = environment.PERF_BASELINE_SIZE_REPORT;
  const baselineRequired = mode === 'pr' || mode === 'release';
  if (!baselinePathValue) {
    if (baselineRequired) {
      throw new Error(`PERF_BASELINE_SIZE_REPORT is required in ${mode} mode`);
    }
    return null;
  }

  const baselinePath = path.resolve(rootDir, baselinePathValue);
  if (!isPathInside(rootDir, baselinePath)) {
    throw new Error('PERF_BASELINE_SIZE_REPORT must be inside the repository');
  }
  const expectedBaseSha = environment.PERF_BASE_SHA;
  if (baselineRequired && !expectedBaseSha) {
    throw new Error(`PERF_BASE_SHA is required in ${mode} mode`);
  }
  const baselineReport = readJsonStrict(baselinePath, 'Performance baseline');
  validateBaselineReport(baselineReport, expectedBaseSha);
  return {
    path: normalizeRelativePath(path.relative(rootDir, baselinePath)),
    report: baselineReport,
  };
};

export const runPerformanceBudget = ({
  rootDir = defaultRootDir,
  environment = process.env,
  now = Date.now(),
} = {}) => {
  const perfDir = path.join(rootDir, 'perf');
  const lighthouseOutputDir = path.join(perfDir, 'lighthouse');
  const budgetPath = path.join(perfDir, 'fe-budget.json');
  const sizePath = path.join(perfDir, 'fe-size.json');
  const lighthousePath = path.join(perfDir, 'fe-lighthouse.json');
  const generatedAt = new Date(now).toISOString();
  const report = {
    schemaVersion: 2,
    generatedAt,
    mode: environment.PERF_MODE || 'local',
    buildDigest: null,
    sizeLimit: { status: 'invalid', entries: [] },
    lighthouse: { status: 'invalid', entries: [] },
    violations: [],
    ok: false,
  };

  let sizeArtifact = {
    schemaVersion: 2,
    generatedAt,
    status: 'invalid',
    buildDigest: null,
    commitSha: environment.GITHUB_SHA || environment.PERF_COMMIT_SHA || null,
    baseline: null,
    entries: [],
    violations: [],
  };
  let lighthouseArtifact = {
    schemaVersion: 2,
    generatedAt,
    status: 'invalid',
    buildDigest: null,
    mode: report.mode,
    entries: [],
    violations: [],
  };

  try {
    const configPath = path.join(rootDir, 'lighthouserc.cjs');
    delete require.cache[require.resolve(configPath)];
    const lighthouseConfig = require(configPath);
    const configuredPolicy = validatePolicy(lighthouseConfig.productionPolicy);
    if (environment.CI === 'true' && configuredPolicy.mode === 'local') {
      throw new Error('PERF_MODE=local evidence cannot be accepted in CI');
    }
    if (report.mode !== configuredPolicy.mode) {
      throw new Error('PERF_MODE does not match the Lighthouse policy mode');
    }

    const evidenceResult = validateLighthouseEvidence({
      rootDir,
      lighthouseOutputDir,
      rawPolicy: configuredPolicy,
      now,
      expectedBuildDigest: environment.PERF_EXPECTED_BUILD_DIGEST || null,
    });
    const policy = evidenceResult.policy;
    report.buildDigest = evidenceResult.buildDigest;

    const lighthouseResult = summarizeLighthouseReports(evidenceResult.reports, policy);
    if (!evidenceResult.assertionsPassed) {
      lighthouseResult.violations.push({
        code: 'lighthouse-ci-assertion-failed',
        exitCode: evidenceResult.evidence.lhciExitCode,
      });
    }
    lighthouseArtifact = {
      schemaVersion: 2,
      generatedAt,
      status: lighthouseResult.violations.length === 0 ? 'passed' : 'failed',
      buildDigest: evidenceResult.buildDigest,
      mode: policy.mode,
      expectedRuns: policy.expectedRuns,
      entries: lighthouseResult.summaries,
      violations: lighthouseResult.violations,
    };
    report.lighthouse = {
      status: lighthouseArtifact.status,
      entries: lighthouseArtifact.entries,
    };
    report.violations.push(...lighthouseResult.violations);

    const baseline = loadBaselineForMode({ rootDir, mode: policy.mode, environment });
    const rawSizeConfig = readJsonStrict(
      path.join(rootDir, '.size-limit.json'),
      '.size-limit.json',
    );
    const sizeResult = evaluateRouteBudgets({
      rootDir,
      rawConfig: rawSizeConfig,
      baselineReport: baseline?.report || null,
    });
    sizeArtifact = {
      schemaVersion: 2,
      generatedAt,
      status: sizeResult.violations.length === 0 ? 'passed' : 'failed',
      buildDigest: evidenceResult.buildDigest,
      commitSha: environment.GITHUB_SHA || environment.PERF_COMMIT_SHA || null,
      metric: sizeResult.config.metric,
      source: sizeResult.config.source,
      baseline: baseline
        ? {
            path: baseline.path,
            commitSha: baseline.report.commitSha,
            buildDigest: baseline.report.buildDigest,
          }
        : null,
      entries: sizeResult.entries,
      violations: sizeResult.violations,
    };
    report.sizeLimit = { status: sizeArtifact.status, entries: sizeArtifact.entries };
    report.violations.push(...sizeResult.violations);
    report.ok =
      report.violations.length === 0 &&
      report.lighthouse.status === 'passed' &&
      report.sizeLimit.status === 'passed';
  } catch (error) {
    report.violations.push({
      code: 'performance-evidence-invalid',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  writeJsonAtomic(sizePath, sizeArtifact);
  writeJsonAtomic(lighthousePath, lighthouseArtifact);
  writeJsonAtomic(budgetPath, report);

  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
  }
  return report.ok ? 0 : 1;
};

const isMainModule =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  process.exitCode = runPerformanceBudget();
}
