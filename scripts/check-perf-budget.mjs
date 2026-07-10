import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const perfDir = path.join(rootDir, 'perf');
const lighthouseDir = path.join(rootDir, '.lighthouseci');
const perfDocPath = path.resolve(rootDir, '..', 'CLAUDE_PERF.md');
const sizeLimitConfigPath = path.join(rootDir, '.size-limit.json');
const enforceBudgets = process.env.PERF_BUDGET_ENFORCE === '1';

const readJson = (targetPath) => JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const readText = (targetPath) => fs.readFileSync(targetPath, 'utf8');

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

const parseSizeEntry = (entry) => {
  const sizeBytes =
    entry.sizeBytes ??
    parseHumanBytes(entry.size) ??
    parseHumanBytes(entry.gzip) ??
    entry.size ??
    null;
  const limitBytes = entry.limitBytes ?? parseHumanBytes(entry.limit) ?? entry.limit ?? null;
  const name = entry.name ?? entry.path ?? 'unknown';
  const ok =
    typeof entry.passed === 'boolean'
      ? entry.passed
      : typeof sizeBytes === 'number' && typeof limitBytes === 'number'
        ? sizeBytes <= limitBytes
        : null;

  return {
    name,
    sizeBytes,
    limitBytes,
    ok,
  };
};

const collectWildcardSize = (pattern) => {
  if (pattern === '.next/static/**/*.js') {
    return walkFiles(path.join(rootDir, '.next', 'static'))
      .filter((filePath) => filePath.endsWith('.js'))
      .reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  }

  if (pattern === '.next/static/css/**/*.css') {
    return walkFiles(path.join(rootDir, '.next', 'static', 'css'))
      .filter((filePath) => filePath.endsWith('.css'))
      .reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  }

  return 0;
};

const buildSizeEntriesFromConfig = () => {
  if (!fs.existsSync(sizeLimitConfigPath)) {
    return [];
  }

  const config = readJson(sizeLimitConfigPath);
  if (!Array.isArray(config)) {
    return [];
  }

  return config.map((entry) => {
    const sizeBytes = collectWildcardSize(entry.path);
    const limitBytes = parseHumanBytes(entry.limit);
    return {
      name: entry.path,
      sizeBytes,
      limitBytes,
      ok: typeof limitBytes === 'number' ? sizeBytes <= limitBytes : null,
    };
  });
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

const sizeReportPath = path.join(perfDir, 'fe-size.json');
let sizeEntries = [];

if (fs.existsSync(sizeReportPath)) {
  try {
    const rawContent = readText(sizeReportPath).trim();
    if (rawContent) {
      const rawSizeReport = JSON.parse(rawContent);
      sizeEntries = Array.isArray(rawSizeReport)
        ? rawSizeReport.map(parseSizeEntry)
        : Array.isArray(rawSizeReport.results)
          ? rawSizeReport.results.map(parseSizeEntry)
          : [];
    }
  } catch (_error) {
    sizeEntries = [];
  }
}

if (sizeEntries.length === 0) {
  sizeEntries = buildSizeEntriesFromConfig();
  fs.writeFileSync(path.join(perfDir, 'fe-size.json'), JSON.stringify(sizeEntries, null, 2));
}

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
const loadLighthouseSummary = () => {
  if (fs.existsSync(lighthouseManifestPath)) {
    const manifest = readJson(lighthouseManifestPath);
    const representativeRun = manifest.find((entry) => entry.isRepresentativeRun) ?? manifest[0];
    if (representativeRun?.jsonPath) {
      return readJson(path.resolve(lighthouseDir, representativeRun.jsonPath));
    }
  }

  const fallbackJsonFiles = walkFiles(lighthouseDir)
    .filter((filePath) => path.basename(filePath).startsWith('lhr-') && filePath.endsWith('.json'))
    .sort();

  if (fallbackJsonFiles.length > 0) {
    return readJson(fallbackJsonFiles.at(-1));
  }

  return null;
};

const lhr = loadLighthouseSummary();
if (lhr) {
  const summary = {
    url: lhr.finalUrl,
    performanceScore: lhr.categories?.performance?.score ?? null,
    lcpMs: lhr.audits?.['largest-contentful-paint']?.numericValue ?? null,
    interactiveMs: lhr.audits?.interactive?.numericValue ?? null,
    cls: lhr.audits?.['cumulative-layout-shift']?.numericValue ?? null,
  };

  report.lighthouse = {
    status: 'ok',
    ...summary,
  };

  fs.writeFileSync(path.join(perfDir, 'fe-lighthouse.json'), JSON.stringify(summary, null, 2));

  if (
    typeof summary.performanceScore === 'number' &&
    summary.performanceScore < report.budgets.performanceScoreMin
  ) {
    report.violations.push({
      type: 'lighthouse',
      metric: 'performanceScore',
      actual: summary.performanceScore,
      limit: report.budgets.performanceScoreMin,
    });
  }

  if (typeof summary.lcpMs === 'number' && summary.lcpMs > report.budgets.lcpMsMax) {
    report.violations.push({
      type: 'lighthouse',
      metric: 'largest-contentful-paint',
      actual: summary.lcpMs,
      limit: report.budgets.lcpMsMax,
    });
  }

  if (
    typeof summary.interactiveMs === 'number' &&
    summary.interactiveMs > report.budgets.interactiveMsMax
  ) {
    report.violations.push({
      type: 'lighthouse',
      metric: 'interactive',
      actual: summary.interactiveMs,
      limit: report.budgets.interactiveMsMax,
    });
  }

  if (typeof summary.cls === 'number' && summary.cls > report.budgets.clsMax) {
    report.violations.push({
      type: 'lighthouse',
      metric: 'cumulative-layout-shift',
      actual: summary.cls,
      limit: report.budgets.clsMax,
    });
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
