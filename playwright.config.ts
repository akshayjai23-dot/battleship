import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// The smoke test runs against the built bundle served by `vite preview`, not the dev
// server: it exists to catch the things unit tests cannot see — a broken build, a bad
// asset path, or a layout that only fits on a large screen.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    // The content area of a 1024x768 laptop screen, the smallest the game must fit.
    viewport: { width: 992, height: 639 },
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
