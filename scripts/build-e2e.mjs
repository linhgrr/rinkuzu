import { spawn } from 'node:child_process';

/**
 * The production build the end-to-end suite runs against.
 *
 * One thing separates it from `npm run build`, and it is why the suite could
 * not run at all before this existed: `NEXT_PUBLIC_E2E`.
 *
 * Playwright drives the browser over the Chrome DevTools Protocol, and the
 * devtool detector cannot tell that apart from a person opening DevTools; left
 * on, it blanks the page and every flow fails at its first input. The variable
 * is inlined at build time, so only a bundle built by this script carries the
 * waiver — there is nothing to switch on in a deployed one, which is the whole
 * reason it is a build flag and not a runtime check.
 *
 * Everything else matches `npm run build` exactly, bundler included: a suite
 * that passes against a differently-bundled artifact has not tested what ships.
 *
 * A Node wrapper rather than an inline `NEXT_PUBLIC_E2E=true next build`,
 * because npm runs scripts through cmd.exe on Windows, where that prefix is not
 * a variable assignment but a command name, and the build fails with
 * "'NEXT_PUBLIC_E2E' is not recognized as an internal or external command".
 */
const child = spawn('next', ['build'], {
  env: { ...process.env, NEXT_PUBLIC_E2E: 'true' },
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to start the end-to-end build:', error);
  process.exit(1);
});
