import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// E2E_BASE_URL permite correr las pruebas contra la app publicada (p. ej. https://matiasviillalba.github.io/c2-recall/).
const LIVE = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: LIVE ?? `http://localhost:${PORT}/c2-recall/`,
    trace: 'retain-on-failure',
    // Para capturas de pantalla se desactivan las animaciones de entrada.
    reducedMotion: process.env.SHOTS_DIR ? 'reduce' : 'no-preference',
  },
  webServer: LIVE ? undefined : {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/c2-recall/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'iphone', use: { ...devices['iPhone 15 Pro'], browserName: 'chromium' } },
  ],
});
