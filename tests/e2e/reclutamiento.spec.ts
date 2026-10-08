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

// Modo reclutamiento con los escenarios de ejemplo de los textos 0.6. Cifras
// calculadas a mano (tabla N1): 7,920.00; 15,930.00; 45,420.00. Datos sintéticos.

const AVISO = /Ejemplo calculado con las tablas vigentes al 7 de octubre de 2026\. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos\./;

test.describe("modo reclutamiento", () => {
  test("desde /comisiones: escenarios de ejemplo, aviso visible y recálculo al editar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByRole("link", { name: "Modo reclutamiento" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Propuesta de ingresos para externos" })).toBeVisible();
    await expect(page.getByText(AVISO)).toBeVisible();
    // RH ya aprobó el texto: sin el aviso interno de revisión.
    await expect(page.getByText(/Uso interno/)).toHaveCount(0);
    for (const total of ["$7,920.00", "$15,930.00", "$45,420.00"]) {
      await expect(page.getByRole("listitem").filter({ hasText: "Comisión total que se ganaría" }).getByText(total, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Lo que se ganaría en un mes", { exact: true })).toBeVisible();

    // 100,000 a 6 meses en el escenario 1: + 1,200.00 = 9,120.00.
    await page.getByRole("group", { name: "Escenario 1" }).getByLabel("Captación a 6 meses").fill("100,000");
    await expect(page.getByText("$9,120.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("$100,000.00 × 1.20% = $1,200.00")).toBeVisible();
    await sinViolaciones(page);
  });

  test("3 inversiones por plazo: aviso visible con el número y el reparto en el desglose", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await expect(page.getByText(/^Cálculo con 1 inversión\(es\) por plazo:/)).toBeVisible();
    await page.getByLabel("Inversiones por plazo").fill("3");
    await expect(page.getByText(/^Cálculo con 3 inversión\(es\) por plazo:/)).toBeVisible();
    await expect(page.getByText("1 × ($166,666.68 × 5.52% = $9,200.00) + 2 × ($166,666.66 × 5.52% = $9,200.00) = $27,600.00")).toBeVisible();
    await expect(page.getByText(/sueldo base/i)).toHaveCount(0);
    await sinViolaciones(page);
  });

  test("un nombre con promesa no se acepta", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await page.getByLabel("Quién presenta").fill("Ingreso fijo garantizado");
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo calcular la propuesta" })).toContainText("quien presenta");
  });

  test("descarga la Propuesta de ingresos en PDF con el teclado", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    const boton = page.getByRole("button", { name: "Descargar PDF" });
    await boton.focus();
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(descarga.suggestedFilename()).toMatch(/^propuesta-de-ingresos-\d{4}-\d{2}-\d{2}\.pdf$/);
    await expect(page.getByRole("status")).toHaveText("Listo: el PDF se descargó.");
  });

  test("un monto menor al mínimo muestra el error con el escenario y el plazo", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await page.getByRole("group", { name: "Escenario 2" }).getByLabel("Captación a 18 meses").fill("20,000");
    const aviso = page.getByRole("alert").filter({ hasText: "No se pudo calcular la propuesta" });
    await expect(aviso).toContainText("Escenario 2, 18 meses:");
    await expect(aviso).toContainText("$30,000.00");
  });

  test("celular a 390 px: sin desborde y sin violaciones de axe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/comisiones/reclutamiento");
    await expect(page.getByText(AVISO)).toBeVisible();
    await sinDesbordeHorizontal(page);
    await sinViolaciones(page);
  });
});

// Capturas para revisión visual: solo con la variable MUESTRAS_DIR (fuera del repositorio).
test.describe("capturas de /comisiones/reclutamiento", () => {
  test.skip(process.env.MUESTRAS_DIR === undefined, "solo con MUESTRAS_DIR");
  for (const ancho of [390, 1280]) {
    test(`a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/comisiones/reclutamiento");
      await expect(page.getByText(AVISO)).toBeVisible();
      await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/reclutamiento-${ancho}.png`, fullPage: true });
    });
  }
});
