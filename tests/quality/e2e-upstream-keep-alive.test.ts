import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS } from '../e2e/support/connection-timeouts.mjs';

/**
 * A regression guard for a failure that cost a full CI run to attribute. The
 * fake upstream ran on Node's defaults, so it closed pooled connections after
 * five idle seconds. A test that spent longer than that filling a form had its
 * next write land on a socket the server was closing: ECONNRESET, the write
 * lost, and the symptom appearing much later as a page that reloaded without
 * the data it had just saved.
 *
 * So this boots the real server and holds a real connection idle past the
 * default, rather than asserting that the source still contains an assignment.
 */

const IDLE_PROBE_MS = 6_000;
const NODE_DEFAULT_KEEP_ALIVE_MS = new http.Server().keepAliveTimeout;

const findFreePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Could not reserve a port'));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });

/** Resolves with the socket the request used, so reuse can be asserted. */
const get = (port: number, agent: http.Agent): Promise<{ status: number; socket: net.Socket }> =>
  new Promise((resolve, reject) => {
    const request = http.get(
      { host: '127.0.0.1', port, path: '/__e2e/health', agent },
      (response) => {
        response.resume();
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, socket: request.socket as net.Socket }),
        );
      },
    );
    request.on('error', reject);
  });

const waitForReady = async (port: number) => {
  const agent = new http.Agent({ keepAlive: false });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const { status } = await get(port, agent);
      if (status === 200) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('The fake adaptive server never became ready');
};

describe('fake upstream connection lifetime', () => {
  let server: ChildProcess;
  let port: number;

  beforeAll(async () => {
    port = await findFreePort();
    server = spawn(
      process.execPath,
      [path.join('tests', 'e2e', 'support', 'fake-adaptive-server.mjs')],
      {
        env: { ...process.env, FAKE_ADAPTIVE_PORT: String(port) },
        stdio: 'ignore',
      },
    );
    await waitForReady(port);
  }, 40_000);

  afterAll(() => {
    server?.kill();
  });

  it('holds an idle pooled connection open past the Node default', async () => {
    // The probe is only meaningful while it outlasts the default it guards against.
    expect(IDLE_PROBE_MS).toBeGreaterThan(NODE_DEFAULT_KEEP_ALIVE_MS);
    expect(KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(IDLE_PROBE_MS);

    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      const first = await get(port, agent);
      expect(first.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, IDLE_PROBE_MS));

      const second = await get(port, agent);
      expect(second.status).toBe(200);
      // Same socket, so the server kept it rather than closing it underneath a
      // pool that would then have reconnected and hidden the problem.
      expect(second.socket, 'the server closed the idle connection').toBe(first.socket);
      expect(second.socket.destroyed).toBe(false);
    } finally {
      agent.destroy();
    }
  }, 30_000);

  it('does not let the headers deadline expire before the keep-alive', () => {
    expect(HEADERS_TIMEOUT_MS).toBeGreaterThan(KEEP_ALIVE_TIMEOUT_MS);
  });
});
