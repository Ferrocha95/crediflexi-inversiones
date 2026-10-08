import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function sinViolaciones(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`), "violaciones de axe").toEqual([]);
}

async function sinDesbordeHorizontal(page: Page) {
  const anchos = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, ventana: window.innerWidth }));
  expect(anchos.documento, "la página no se desplaza a lo ancho").toBeLessThanOrEqual(anchos.ventana);
}

/** Llena la inversión n (ya visible). */
async function inversion(page: Page, n: number, monto: string, plazo: string, fecha: string, tipo = "Nueva") {
  await page.getByLabel(`Monto, inversión ${n}`).fill(monto);
  await page.getByLabel(`Plazo, inversión ${n}`).selectOption({ label: plazo });
  await page.getByLabel(`Tipo, inversión ${n}`).selectOption({ label: tipo });
  await page.getByLabel(`Fecha de captación, inversión ${n}`).fill(fecha);
}

// Simulador de comisiones. Cifras de referencia calculadas fuera del motor
// (tabla N1, tasas completas); datos sintéticos; usa la sesión del proyecto "setup".

test.describe("comisiones", () => {
  test("desde el menú: mes desbloqueado (500,000 a 12 + 400,000 a 6) paga $18,450.00 el 16/10/2026", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "Comisiones" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Comisiones" })).toBeVisible();

    await inversion(page, 1, "500,000", "12 meses", "2026-10-07");
    await page.getByRole("button", { name: "Agregar inversión" }).click();
    await inversion(page, 2, "400000", "6 meses", "2026-10-09");

    await expect(page.getByText("Desbloqueada", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2.706%", exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByText("$500,000.00 × 2.706% = $13,530.00")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Avance de la meta" })).toHaveAttribute("aria-valuenow", "90");
    // El pago del calendario: la fecha y el monto en el mismo renglón.
    await expect(page.getByRole("listitem").filter({ hasText: "16/10/2026" }).filter({ hasText: "$18,450.00" })).toBeVisible();
    await expect(page.getByText("$15,000.00", { exact: true })).toBeVisible();
    await sinViolaciones(page);
  });

  test("mes bloqueado: 700,000 a 12 meses deja $19,404.00 bloqueada y sin pagos", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await inversion(page, 1, "700,000", "12 meses", "2026-10-07");
    await expect(page.getByText("Bloqueada", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sin pagos: la comisión del mes sigue bloqueada.")).toBeVisible();
    await expect(page.getByText("Faltan $100,000.00 para desbloquear (umbral de $800,000.00).")).toBeVisible();
    await sinViolaciones(page);
  });

  test("con el teclado: agregar enfoca el monto nuevo y quitar regresa el foco a Agregar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByRole("button", { name: "Agregar inversión" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Monto, inversión 2")).toBeFocused();
    await page.keyboard.type("300000");
    await page.getByRole("button", { name: "Quitar la inversión 2" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Monto, inversión 2")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Agregar inversión" })).toBeFocused();
  });

  test("externo: sin rol ni red, todo pagable en su quincena", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Externo", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Ejecutivo" })).toHaveCount(0);
    await expect(page.getByLabel("Captación de tu red externa (opcional)")).toHaveCount(0);
    await inversion(page, 1, "500,000", "12 meses", "2026-10-20", "Renovación");
    await expect(page.getByText("$6,765.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "01/11/2026", exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  });

  test("un monto menor al mínimo muestra el error en español", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await inversion(page, 1, "20,000", "12 meses", "2026-10-07");
    // Next agrega su propio anunciador de rutas con role="alert": se busca el aviso del simulador.
    const aviso = page.getByRole("alert").filter({ hasText: "No se pudo calcular la comisión" });
    await expect(aviso).toContainText("Inversión 1:");
    await expect(aviso).toContainText("$30,000.00");
  });

  test("celular a 390 px: tarjetas en lugar de tabla, sin desborde y sin violaciones de axe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/comisiones");
    await inversion(page, 1, "1,500,000", "12 meses", "2026-10-07");
    await expect(page.getByText("$43,560.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    await sinDesbordeHorizontal(page);
    await sinViolaciones(page);
  });
});

// Capturas para revisión visual: solo con la variable MUESTRAS_DIR (fuera del repositorio).
//   PowerShell: $env:MUESTRAS_DIR = "C:\dev\informes\sprint-4"; npx playwright test comisiones
test.describe("capturas de /comisiones", () => {
  test.skip(process.env.MUESTRAS_DIR === undefined, "solo con MUESTRAS_DIR");
  for (const ancho of [390, 1280]) {
    test(`a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/comisiones");
      await inversion(page, 1, "500,000", "12 meses", "2026-10-05");
      await page.getByRole("button", { name: "Agregar inversión" }).click();
      await inversion(page, 2, "300,000", "12 meses", "2026-10-12");
      await page.getByRole("button", { name: "Agregar inversión" }).click();
      await inversion(page, 3, "500,000", "12 meses", "2026-10-20", "Renovación");
      await expect(page.getByText("Desbloqueada", { exact: true })).toBeVisible();
      await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/comisiones-${ancho}.png`, fullPage: true });
    });
  }
});
