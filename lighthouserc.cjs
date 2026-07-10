const port = process.env.LIGHTHOUSE_PORT || '3000';
const baseUrl = `http://127.0.0.1:${port}`;

module.exports = {
  ci: {
    collect: {
      url: [`${baseUrl}/en`, `${baseUrl}/en/login`],
      numberOfRuns: 3,
      startServerCommand: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 120000,
      settings: {
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        interactive: ['warn', { maxNumericValue: 3500 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './perf/lighthouse',
    },
  },
};
