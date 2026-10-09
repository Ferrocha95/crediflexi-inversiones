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

// Modo reclutamiento del Sprint 5: un solo dato (la captación del mes), el
// comparativo por plazos y la escalera de bonos. Cifras de referencia
// independientes (punto C): 1,000,000 a 12 meses = 28,380.00 + bono 15,000.00.
// Datos sintéticos.

const AVISO = /Ejemplo calculado con las tablas vigentes al 7 de octubre de 2026\. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos\./;
const INCORPORACION =
  "Al superar $1,000,000 en ingresos, se podrá evaluar la incorporación a la compañía, en caso de que exista interés por parte del colaborador externo.";

const cifraGrande = (page: Page) => page.getByTestId("cifra-grande");

test.describe("modo reclutamiento", () => {
  test("desde /comisiones: un solo dato, cifra grande a 12 meses, comparativo, escalera y avisos", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByRole("link", { name: "Modo reclutamiento" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Propuesta de ingresos para externos" })).toBeVisible();
    await expect(page.getByLabel("¿Cuánto captarías al mes?")).toHaveValue("1,000,000");
    await expect(cifraGrande(page)).toHaveText("$43,380.00");
    await expect(page.getByText("$1,000,000 a 12 meses: comisión $28,380.00 más bono $15,000.00")).toBeVisible();
    for (const linea of ["$1,000,000 × 1.29% = $12,900.00", "$1,000,000 × 5.934% = $59,340.00"]) {
      await expect(page.getByText(linea)).toBeVisible();
    }
    await expect(page.getByText("A 24 meses se ganaría 4.60 veces lo de 6 meses.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Con esta captación" })).toContainText("De $1,000,000 a $1,499,999: $15,000 más la comisión");
    await expect(page.getByText(INCORPORACION)).toBeVisible();
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page.getByText("Las tasas están sujetas a cambio.")).toBeVisible();
    // RH aprobó las frases (Sprint 6b): ya no hay aviso interno.
    await expect(page.getByText("Frases pendientes de aprobación de RH")).toHaveCount(0);
    await expect(page.getByText(/sueldo base/i)).toHaveCount(0);
    // "Personalizar" empieza cerrado.
    await expect(page.getByLabel("Inversiones por plazo")).toBeHidden();
    await sinViolaciones(page);
  });

  test("un toque en un monto de ejemplo y en un plazo cambia la cifra grande", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await page.getByRole("button", { name: "$3,000,000", exact: true }).click();
    await expect(page.getByRole("button", { name: "$3,000,000", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(cifraGrande(page)).toHaveText("$114,100.00");
    await expect(page.getByRole("listitem").filter({ hasText: "Con esta captación" })).toContainText("$2,000,000 en adelante");
    const plazo24 = page.getByRole("button", { name: /^24 meses/ });
    await plazo24.click();
    await expect(plazo24).toHaveAttribute("aria-pressed", "true");
    // 3,000,000 a 24 meses: 186,300.00 + 25,000.00.
    await expect(cifraGrande(page)).toHaveText("$211,300.00");
    await page.getByLabel("¿Cuánto captarías al mes?").fill("500,000");
    await expect(cifraGrande(page)).toHaveText("$28,290.00");
    await expect(page.getByRole("listitem").filter({ hasText: "Con esta captación" })).toContainText("Menos de $1,000,000: sin bono");
  });

  test("con el teclado: monto de ejemplo, plazo y Personalizar con la mezcla de plazos", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await page.getByRole("button", { name: "$1,500,000", exact: true }).focus();
    await page.keyboard.press("Enter");
    // 1,500,000 a 12 meses: 1,500,000 × 2.904% = 43,560.00 + bono 20,000.00.
    await expect(cifraGrande(page)).toHaveText("$63,560.00");
    await page.getByLabel("¿Cuánto captarías al mes?").fill("1,000,000");
    const resumen = page.getByText("Personalizar", { exact: true });
    await resumen.focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Captación a 6 meses").fill("500,000");
    await page.getByLabel("Captación a 24 meses").fill("500,000");
    await expect(cifraGrande(page)).toHaveText("$49,440.00");
    await expect(page.getByText("$1,000,000 repartidos entre plazos: comisión $34,440.00 más bono $15,000.00")).toBeVisible();
    await sinViolaciones(page);
  });

  test("si la mezcla no suma la captación, lo dice", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await page.getByText("Personalizar", { exact: true }).click();
    await page.getByLabel("Captación a 6 meses").fill("400,000");
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo calcular la propuesta" })).toContainText("La mezcla de plazos suma $400,000.00");
  });

  test("3 inversiones por plazo: aviso con el número y el reparto en la línea", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await expect(page.getByText(/^Cálculo con 1 inversión\(es\) por plazo:/)).toBeVisible();
    await page.getByText("Personalizar", { exact: true }).click();
    await page.getByLabel("Inversiones por plazo").fill("3");
    await expect(page.getByText(/^Cálculo con 3 inversión\(es\) por plazo:/)).toBeVisible();
    await expect(page.getByText("1 × ($333,333.34 × 2.706% = $9,020.00) + 2 × ($333,333.33 × 2.706% = $9,020.00) = $27,060.00")).toBeVisible();
  });

  test("un nombre con promesa no se acepta", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones/reclutamiento");
    await page.getByText("Personalizar", { exact: true }).click();
    await page.getByLabel("Quién presenta").fill("Dinero fácil");
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

  test("celular a 390 px: el dato y la cifra arriba, sin desborde y sin violaciones de axe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/comisiones/reclutamiento");
    await expect(cifraGrande(page)).toHaveText("$43,380.00");
    await expect(page.getByText(AVISO)).toBeVisible();
    const entrada = await page.getByLabel("¿Cuánto captarías al mes?").boundingBox();
    const comparativo = await page.getByText("La misma captación en cada plazo").boundingBox();
    expect(entrada!.y).toBeLessThan(comparativo!.y);
    // Botones de un toque de al menos 44 px de alto.
    for (const b of await page.getByRole("button", { name: /^\$[\d,]+$/ }).all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
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
      await expect(cifraGrande(page)).toHaveText("$43,380.00");
      await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/reclutamiento-${ancho}.png`, fullPage: true });
    });
  }
});
