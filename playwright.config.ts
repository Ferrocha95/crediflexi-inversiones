import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas en el navegador (accesibilidad) y capturas de pantalla. Corren
 * contra la versión compilada en 127.0.0.1:3200, con la semilla del repo.
 * Vitest no las toma: solo incluye tests/unit y *.test.ts.
 */
const PUERTO = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: "es-MX",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/cotizador`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
