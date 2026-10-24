// Playwright config for the TV Home smoke tests. Dev-only.
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.TV_HOME_TEST_PORT || 8799);
const ROOT = path.resolve(__dirname, '..');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js$/,
  outputDir: path.join(ROOT, 'test-results'),
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.join(ROOT, 'playwright-report'), open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }
  ],
  webServer: {
    command: `python3 -c "import http.server; http.server.ThreadingHTTPServer.request_queue_size = 128; http.server.SimpleHTTPRequestHandler.protocol_version = 'HTTP/1.1'; http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}), http.server.SimpleHTTPRequestHandler).serve_forever()"`,
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
