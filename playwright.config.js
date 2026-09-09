import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.(js|mjs|ts)/,
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://aws-file-analyzer.pages.dev',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
