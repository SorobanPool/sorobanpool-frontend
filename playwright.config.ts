import { defineConfig, devices } from '@playwright/test';

const API = process.env.E2E_API ?? 'http://localhost:3100';
const WEB = process.env.E2E_WEB ?? 'http://localhost:3101';

/**
 * Needs a funded testnet key: SPONSOR_SECRET=S... (it sponsors fees and acts as attestor and faucet).
 * Build the app against the dev API first:  NEXT_PUBLIC_API_URL=http://localhost:3100 pnpm build
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15 * 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: WEB, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }],
  webServer: [
    {
      command: 'node dist/dev/dev-server.js',
      cwd: '../sorobanpool-backend',
      url: `${API}/v1/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { PORT: '3100', PUBLIC_APP_URL: WEB, SPONSOR_SECRET: process.env.SPONSOR_SECRET ?? '' },
    },
    { command: 'pnpm exec next start -p 3101', url: WEB, reuseExistingServer: true, timeout: 120_000 },
  ],
});
