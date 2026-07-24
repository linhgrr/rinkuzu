const dns = require('node:dns');

if (process.platform === 'win32') {
  const currentServers = dns.getServers();
  const hasLoopback = currentServers.some(
    (server) =>
      server === '127.0.0.1' ||
      server.startsWith('127.0.0.1:') ||
      server === '::1' ||
      server.startsWith('[::1]:'),
  );

  if (hasLoopback) {
    const configuredServers = (process.env.RINKUZU_DEV_DNS_SERVERS || '1.1.1.1,8.8.8.8')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    dns.setServers(configuredServers);
  }
}
