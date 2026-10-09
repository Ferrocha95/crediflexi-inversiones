import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function sinViolaciones(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`), "violaciones de axe").toEqual([]);
}

// Puntos extra y plazo especial en la calculadora. Cifras de referencia
// calculadas fuera del motor; datos sintéticos; usa la sesión del proyecto "setup".

test.describe("cotizador: puntos extra y plazo especial", () => {
  test("+1.0 punto sobre 1,500,000 a 12 meses: datos capturados y desglose de la tasa, sin importes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    await page.getByLabel("Monto", { exact: true }).fill("1,500,000");
    const plazo = page.getByLabel("Plazo", { exact: true });
    await expect(plazo).toBeEnabled();
    await plazo.selectOption({ label: "12 meses" });
    await expect(page.getByRole("heading", { name: "Datos capturados" })).toBeVisible();

    await page.getByLabel("Puntos extra", { exact: true }).selectOption({ label: "+1.0 puntos" });
    await expect(page.getByText("Tasa de tabla 19.00% + 1.0 puntos extra = 20.00%")).toBeVisible();
    // Sprint 6a: la pantalla muestra lo capturado y la tasa, pero ningún importe ni tabla de rendimientos.
    await expect(page.locator("dd").filter({ hasText: /^\$1,500,000\.00 MXN$/ })).toBeVisible();
    await expect(page.locator("dd").filter({ hasText: /^12 meses$/ })).toBeVisible();
    await expect(page.getByText("$25,000.00", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Rendimiento (mensual|anual|total)/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Resultados" })).toHaveCount(0);
    // La vista previa dice el esquema y la tasa con los términos del glosario.
    await expect(page.locator("dd").filter({ hasText: /^Mensual$/ })).toBeVisible();
    await expect(page.getByText("Tasa anual neta", { exact: true })).toBeVisible();
    await expect(page.getByText(/recib/i)).toHaveCount(0);
    await sinViolaciones(page);
  });

  test("plazo especial de 9 meses al 17%: sin selector de plazo ni puntos, con la tasa acordada", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    await page.getByLabel("Monto", { exact: true }).fill("100,000");
    await page.getByLabel("Plazo especial", { exact: true }).check();
    await expect(page.getByLabel("Plazo", { exact: true })).toBeHidden();
    await expect(page.getByLabel("Puntos extra", { exact: true })).toBeHidden();

    await page.getByLabel("Meses (6 a 60)").fill("9");
    await page.getByLabel("Tasa acordada, Mensual (% anual)").fill("17");
    await expect(page.getByRole("heading", { name: "Datos capturados" })).toBeVisible();
    await expect(page.getByText("$1,416.67", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Tasa acordada", { exact: true })).toBeVisible();
    await sinViolaciones(page);

    // Una tasa muy por encima de la tabla avisa, pero no bloquea.
    await page.getByLabel("Tasa acordada, Mensual (% anual)").fill("99");
    await expect(page.getByText(/La tasa acordada \(99\.00%\) pasa de la máxima de la tabla \(.+\) más 4 puntos/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Datos capturados" })).toBeVisible();
  });

  test("la casilla de confirmación dice que los datos capturados son correctos y habilita el PDF", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    await page.getByLabel("Monto", { exact: true }).fill("1,500,000");
    await page.getByLabel("Plazo", { exact: true }).selectOption({ label: "12 meses" });
    await expect(page.getByRole("heading", { name: "Datos capturados" })).toBeVisible();
    const casilla = page.getByLabel("Confirmo que los datos capturados son correctos");
    await expect(casilla).toBeVisible();
    await expect(page.getByText(/números son correctos/)).toHaveCount(0);
    await casilla.check();
    await expect(page.getByRole("button", { name: /PDF/ })).toBeEnabled();
  });
});
