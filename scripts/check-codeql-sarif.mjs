import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIGH_SECURITY_SEVERITY = 7;

function sarifFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...sarifFiles(absolute));
    } else if (entry.endsWith('.sarif')) {
      files.push(absolute);
    }
  }
  return files.sort();
}

function ruleForResult(run, result) {
  const rules = run?.tool?.driver?.rules;
  if (!Array.isArray(rules)) return null;
  if (Number.isInteger(result?.ruleIndex)) return rules[result.ruleIndex] ?? null;
  return rules.find((rule) => rule?.id === result?.ruleId) ?? null;
}

function securitySeverity(result, rule) {
  const raw = result?.properties?.['security-severity'] ?? rule?.properties?.['security-severity'];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateCodeqlSarif(document) {
  if (document?.version !== '2.1.0' || !Array.isArray(document?.runs)) {
    throw new Error('CodeQL SARIF must be a SARIF 2.1.0 document with runs.');
  }
  const findings = [];
  let resultCount = 0;
  for (const run of document.runs) {
    for (const result of run?.results ?? []) {
      resultCount += 1;
      const rule = ruleForResult(run, result);
      const level = result?.level ?? rule?.defaultConfiguration?.level ?? 'warning';
      const severity = securitySeverity(result, rule);
      if (level !== 'error' && (severity === null || severity < HIGH_SECURITY_SEVERITY)) {
        continue;
      }
      findings.push({
        ruleId: result?.ruleId ?? rule?.id ?? 'unknown-rule',
        level,
        securitySeverity: severity,
        message: result?.message?.text ?? 'CodeQL finding',
      });
    }
  }
  return { resultCount, findings };
}

export function checkCodeqlSarifDirectory(directory) {
  const files = sarifFiles(directory);
  if (files.length === 0) throw new Error(`No CodeQL SARIF files found in ${directory}.`);
  let resultCount = 0;
  const findings = [];
  for (const file of files) {
    const evaluated = evaluateCodeqlSarif(JSON.parse(readFileSync(file, 'utf8')));
    resultCount += evaluated.resultCount;
    findings.push(...evaluated.findings.map((finding) => ({ file, ...finding })));
  }
  return { fileCount: files.length, resultCount, findings };
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const directory = path.resolve(process.argv[2] ?? '');
  try {
    const result = checkCodeqlSarifDirectory(directory);
    if (result.findings.length > 0) {
      process.stderr.write(`${JSON.stringify({ ok: false, ...result }, null, 2)}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(
      `CodeQL SARIF gate failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
