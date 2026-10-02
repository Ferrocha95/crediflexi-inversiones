import path from "node:path";
import { test } from "@playwright/test";
import { ANCHOS, llenarCotizador } from "./ayudas";

// Capturas para revisar el diseño. Se guardan FUERA del repositorio, en
// CAPTURAS_DIR (por omisión C:\dev\informes\sprint-2a), como la bitácora de
// scripts/mutacion.mjs. Solo corren con `npm run capturas` (etiqueta @capturas).

const DIR = process.env.CAPTURAS_DIR ?? path.join("C:", "dev", "informes", "sprint-2a");
const archivo = (nombre: string) => path.join(DIR, `${nombre}.png`);

test.describe("capturas @capturas", () => {
  for (const ancho of ANCHOS) {
    test(`cotizador, menú y catálogo a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });

      await page.goto("/cotizador");
      await page.screenshot({ path: archivo(`cotizador-vacio-${ancho}`), fullPage: true });
      // El menú (lateral o barra inferior) tal como se ve al abrir la pantalla.
      await page.screenshot({ path: archivo(`menu-${ancho}`) });

      await llenarCotizador(page);
      await page.screenshot({ path: archivo(`cotizador-vista-previa-${ancho}`), fullPage: true });

      if (ancho === 1280) {
        await page.getByRole("button", { name: "Plegar el menú" }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: archivo(`menu-plegado-${ancho}`) });
      }
      if (ancho === 768) {
        await page.getByRole("button", { name: "Desplegar el menú" }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: archivo(`menu-desplegado-${ancho}`) });
      }

      await page.goto("/diseno");
      await page.screenshot({ path: archivo(`diseno-${ancho}`), fullPage: true });
    });
  }

  test("foco visible y diálogo abierto (1280 px)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await page.screenshot({ path: archivo("foco-menu-1280") });

    await page.goto("/diseno");
    await page.getByRole("button", { name: "Abrir el diálogo" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: archivo("dialogo-1280") });
  });
});
