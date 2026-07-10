import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const perfDir = path.join(rootDir, 'perf');
const lighthouseDir = path.join(rootDir, '.lighthouseci');
const perfDocPath = path.resolve(rootDir, '..', 'CLAUDE_PERF.md');
const sizeLimitConfigPath = path.join(rootDir, '.size-limit.json');
const enforceBudgets = process.env.PERF_BUDGET_ENFORCE === '1';

const readJson = (targetPath) => JSON.parse(fs.readFileSync(targetPath, 'utf8'));

const walkFiles = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(absolutePath);
    }
    return [absolutePath];
  });
};

const parseHumanBytes = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^([\d.]+)\s*(B|kB|MB)$/i);
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'b') {
    return amount;
  }
  if (unit === 'kb') {
    return amount * 1024;
  }
  if (unit === 'mb') {
    return amount * 1024 * 1024;
  }
  return null;
};

const gzipSize = (filePath) => zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).length;

const buildRouteBundleEntries = (entry) => {
  const statsPath = path.resolve(rootDir, entry.source);
  if (!fs.existsSync(statsPath)) {
    return [];
  }

  const limitBytes = parseHumanBytes(entry.limit);
  const rows = readJson(statsPath);
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    const chunkPaths = Array.isArray(row.firstLoadChunkPaths) ? row.firstLoadChunkPaths : [];
    const sizeBytes = chunkPaths.reduce((total, chunkPath) => {
      const absolutePath = path.resolve(rootDir, chunkPath);
      return fs.existsSync(absolutePath) ? total + gzipSize(absolutePath) : total;
    }, 0);

    return {
      name: row.route,
      metric: entry.type,
      sizeBytes,
      limitBytes,
      ok: typeof limitBytes === 'number' ? sizeBytes <= limitBytes : null,
    };
  });
};

const buildSizeEntriesFromConfig = () => {
  if (!fs.existsSync(sizeLimitConfigPath)) {
    return [];
  }

  const config = readJson(sizeLimitConfigPath);
  if (!Array.isArray(config)) {
    return [];
  }

  return config.flatMap((entry) =>
    entry.type === 'route-first-load-js-gzip' ? buildRouteBundleEntries(entry) : [],
  );
};

const report = {
  source: {
    claudePerfPath: path.relative(rootDir, perfDocPath),
    claudePerfPresent: fs.existsSync(perfDocPath),
  },
  budgets: {
    performanceScoreMin: 0.8,
    lcpMsMax: 2500,
    interactiveMsMax: 3500,
    clsMax: 0.1,
  },
  sizeLimit: {
    status: 'missing',
    entries: [],
  },
  lighthouse: {
    status: 'missing',
  },
  violations: [],
};

const sizeEntries = buildSizeEntriesFromConfig();
fs.writeFileSync(path.join(perfDir, 'fe-size.json'), JSON.stringify(sizeEntries, null, 2));

if (sizeEntries.length > 0) {
  report.sizeLimit = {
    status: 'ok',
    entries: sizeEntries,
  };

  for (const entry of sizeEntries) {
    if (entry.ok === false) {
      report.violations.push({
        type: 'size-limit',
        name: entry.name,
        sizeBytes: entry.sizeBytes,
        limitBytes: entry.limitBytes,
      });
    }
  }
}

const lighthouseManifestPath = path.join(lighthouseDir, 'manifest.json');
const loadLighthouseReports = () => {
  if (fs.existsSync(lighthouseManifestPath)) {
    const manifest = readJson(lighthouseManifestPath);
    const representativeRuns = manifest.filter((entry) => entry.isRepresentativeRun);
    const selectedRuns = representativeRuns.length > 0 ? representativeRuns : manifest.slice(0, 1);
    const reports = selectedRuns
      .filter((entry) => entry.jsonPath)
      .map((entry) => readJson(path.resolve(lighthouseDir, entry.jsonPath)));
    if (reports.length > 0) {
      return reports;
    }
  }

  const fallbackJsonFiles = walkFiles(lighthouseDir)
    .filter((filePath) => path.basename(filePath).startsWith('lhr-') && filePath.endsWith('.json'))
    .sort();

  if (fallbackJsonFiles.length > 0) {
    return fallbackJsonFiles.map(readJson);
  }

  return [];
};

const lighthouseReports = loadLighthouseReports();
if (lighthouseReports.length > 0) {
  const median = (values) => {
    const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
    return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
  };
  const reportsByUrl = Map.groupBy(lighthouseReports, (lhr) => lhr.finalUrl);
  const summaries = Array.from(reportsByUrl, ([url, reports]) => ({
    url,
    runs: reports.length,
    performanceScore: median(reports.map((lhr) => lhr.categories?.performance?.score)),
    lcpMs: median(reports.map((lhr) => lhr.audits?.['largest-contentful-paint']?.numericValue)),
    interactiveMs: median(reports.map((lhr) => lhr.audits?.interactive?.numericValue)),
    cls: median(reports.map((lhr) => lhr.audits?.['cumulative-layout-shift']?.numericValue)),
  }));

  report.lighthouse = {
    status: 'ok',
    entries: summaries,
  };

  fs.writeFileSync(path.join(perfDir, 'fe-lighthouse.json'), JSON.stringify(summaries, null, 2));

  for (const summary of summaries) {
    const checks = [
      ['performanceScore', summary.performanceScore, report.budgets.performanceScoreMin, 'min'],
      ['largest-contentful-paint', summary.lcpMs, report.budgets.lcpMsMax, 'max'],
      ['interactive', summary.interactiveMs, report.budgets.interactiveMsMax, 'max'],
      ['cumulative-layout-shift', summary.cls, report.budgets.clsMax, 'max'],
    ];
    for (const [metric, actual, limit, direction] of checks) {
      if (
        typeof actual === 'number' &&
        ((direction === 'min' && actual < limit) || (direction === 'max' && actual > limit))
      ) {
        report.violations.push({ type: 'lighthouse', url: summary.url, metric, actual, limit });
      }
    }
  }
}

report.ok = report.violations.length === 0;

fs.writeFileSync(path.join(perfDir, 'fe-budget.json'), JSON.stringify(report, null, 2));

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  if (enforceBudgets) {
    process.exit(1);
  }

  console.warn(
    'Performance budget violations found. Advisory mode is enabled; set PERF_BUDGET_ENFORCE=1 to fail on violations.',
  );
}
