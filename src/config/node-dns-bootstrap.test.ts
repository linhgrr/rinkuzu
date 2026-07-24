import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('development DNS bootstrap', () => {
  it.runIf(process.platform === 'win32')(
    'runs in both the Next process and inherited worker threads',
    () => {
      const preload = path.join(process.cwd(), 'scripts', 'node-dns-bootstrap.cjs');
      const workerSource = [
        "const { parentPort } = require('node:worker_threads');",
        "parentPort.postMessage(require('node:dns').getServers());",
      ].join('');
      const mainSource = [
        "const dns = require('node:dns');",
        "const { Worker } = require('node:worker_threads');",
        `new Worker(${JSON.stringify(workerSource)}, { eval: true })`,
        ".once('message', worker => console.log(JSON.stringify({ main: dns.getServers(), worker })));",
      ].join('');

      const result = spawnSync(process.execPath, ['--require', preload, '--eval', mainSource], {
        encoding: 'utf8',
      });
      const output = JSON.parse(result.stdout.trim()) as {
        main: string[];
        worker: string[];
      };

      expect(result.status).toBe(0);
      expect(output.main).toContain('1.1.1.1');
      expect(output.worker).toContain('1.1.1.1');
      expect(output.main).not.toContain('127.0.0.1');
      expect(output.worker).not.toContain('127.0.0.1');
    },
  );
});
