import { defineConfig, devices } from '@playwright/test'

// Browser tests run against the production build, served the way GitHub Pages serves it.
export default defineConfig({
  testDir: 'e2e',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173/forge-fast/', ...devices['Pixel 7'], serviceWorkers: 'block' },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/forge-fast/', reuseExistingServer: !process.env.CI },
})
