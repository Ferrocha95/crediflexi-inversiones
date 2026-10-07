import { defineConfig, devices } from "@playwright/test";
import { RUTA_SESION } from "./tests/e2e/usuarios";

/**
 * Pruebas en el navegador (accesibilidad, sesión) y capturas de pantalla.
 * Corren contra la versión compilada en 127.0.0.1:3200, con la semilla del
 * repo y Supabase local (npm run start pasa por scripts/con-entorno.mjs).
 * Vitest no las toma: solo incluye tests/unit y *.test.ts.
 *
 * El proyecto "setup" crea un usuario @e2e.test e inicia sesión; las pruebas
 * usan esa sesión (guardada fuera del repositorio) y el proyecto "limpieza"
 * borra los usuarios al final. Playwright corre siempre las dependencias,
 * aunque se filtre con --grep.
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
  projects: [
    { name: "setup", testMatch: /sesion\.setup\.ts/, teardown: "limpieza" },
    { name: "limpieza", testMatch: /limpieza\.teardown\.ts/ },
    {
      name: "chromium",
      testIgnore: /\.(setup|teardown)\.ts$/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: RUTA_SESION },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/acceso`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
