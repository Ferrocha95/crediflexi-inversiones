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
    await page.getByRole("button", { name: "Agregar inversión", exact: true }).click();
    await inversion(page, 2, "400000", "6 meses", "2026-10-09");

    await expect(page.getByText("Desbloqueada", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2.706%", exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByText("$500,000.00 × 2.706% = $13,530.00")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Avance de la meta" })).toHaveAttribute("aria-valuenow", "90");
    // El pago del calendario: la fecha y el monto en el mismo renglón.
    await expect(page.getByRole("listitem").filter({ hasText: "16/10/2026" }).filter({ hasText: "$18,450.00" })).toBeVisible();
    await expect(page.getByText("Sueldo base (propuesta)", { exact: true })).toBeVisible();
    await expect(page.getByText("$15,000", { exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: "Agregar inversión", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Monto, inversión 2")).toBeFocused();
    await page.keyboard.type("300000");
    await page.getByRole("button", { name: "Quitar la inversión 2" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Monto, inversión 2")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Agregar inversión", exact: true })).toBeFocused();
  });

  test("externo: sin rol, sin sueldo base, todo pagable en su quincena", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Externo", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Ejecutivo" })).toHaveCount(0);
    await expect(page.getByText(/red externa/i)).toHaveCount(0);
    await inversion(page, 1, "500,000", "12 meses", "2026-10-20", "Renovación");
    await expect(page.getByText("$6,765.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "01/11/2026", exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText(/Sueldo base/)).toHaveCount(0);
    // Un externo no tiene desbloqueo: ni tarjeta ni insignia de bloqueada.
    await expect(page.getByText("Bloqueada", { exact: true })).toHaveCount(0);
  });

  test("externo: bono por captación nueva aparte de la comisión (1,000,000 -> $15,000.00), sin fecha de pago", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Externo", { exact: true }).click();
    await inversion(page, 1, "1,000,000", "12 meses", "2026-10-20");
    const bono = page.getByRole("region", { name: "Incentivos por captación nueva del mes" });
    await expect(bono).toContainText("$15,000 + comisión");
    await expect(bono).not.toContainText(/fecha|por confirmar/i);
    // La comisión no cambia: 1,000,000 × 2.838% = 28,380.00.
    await expect(page.getByText("$28,380.00", { exact: true }).first()).toBeVisible();
    await sinViolaciones(page);
  });

  test("gerente: inversiones del equipo con el bono de gerente aparte (25,215.00 -> 7,564.50)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Gerente", { exact: true }).click();
    await inversion(page, 1, "500,000", "12 meses", "2026-10-07");
    await expect(page.getByText(/Sueldo base/)).toHaveCount(0);
    for (const [n, monto, plazo, tipo] of [
      [1, "500,000", "12 meses", "Nueva"],
      [2, "400,000", "6 meses", "Nueva"],
      [3, "500,000", "12 meses", "Renovación"],
    ] as const) {
      await page.getByRole("button", { name: "Agregar inversión del equipo" }).click();
      await page.getByLabel(`Monto, inversión del equipo ${n}`).fill(monto);
      await page.getByLabel(`Plazo, inversión del equipo ${n}`).selectOption({ label: plazo });
      await page.getByLabel(`Tipo, inversión del equipo ${n}`).selectOption({ label: tipo });
    }
    const bloque = page.getByRole("region", { name: "Bono de gerente (por confirmar)" });
    await expect(bloque).toContainText("$25,215.00");
    await expect(bloque).toContainText("$7,564.50");
    await expect(bloque).toContainText("30% × $25,215.00 = $7,564.50");
    // La meta sigue sobre su propia captación (500,000 de 2,000,000).
    await expect(page.getByRole("progressbar", { name: "Avance de la meta" })).toHaveAttribute("aria-valuenow", "25");
    await sinViolaciones(page);
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
test.describe("capturas de /comisiones con rol Gerente", () => {
  test.skip(process.env.MUESTRAS_DIR === undefined, "solo con MUESTRAS_DIR");
  for (const ancho of [390, 1280]) {
    test(`gerente a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/comisiones");
      await page.getByText("Gerente", { exact: true }).click();
      await inversion(page, 1, "500,000", "12 meses", "2026-10-07");
      for (const [n, monto, plazo, tipo] of [
        [1, "500,000", "12 meses", "Nueva"],
        [2, "400,000", "6 meses", "Nueva"],
        [3, "500,000", "12 meses", "Renovación"],
      ] as const) {
        await page.getByRole("button", { name: "Agregar inversión del equipo" }).click();
        await page.getByLabel(`Monto, inversión del equipo ${n}`).fill(monto);
        await page.getByLabel(`Plazo, inversión del equipo ${n}`).selectOption({ label: plazo });
        await page.getByLabel(`Tipo, inversión del equipo ${n}`).selectOption({ label: tipo });
      }
      await expect(page.getByText("$7,564.50").first()).toBeVisible();
      await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/comisiones-gerente-${ancho}.png`, fullPage: true });
    });
  }
});

test.describe("capturas de /comisiones", () => {
  test.skip(process.env.MUESTRAS_DIR === undefined, "solo con MUESTRAS_DIR");
  for (const ancho of [390, 1280]) {
    test(`a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/comisiones");
      await inversion(page, 1, "500,000", "12 meses", "2026-10-05");
      await page.getByRole("button", { name: "Agregar inversión", exact: true }).click();
      await inversion(page, 2, "300,000", "12 meses", "2026-10-12");
      await page.getByRole("button", { name: "Agregar inversión", exact: true }).click();
      await inversion(page, 3, "500,000", "12 meses", "2026-10-20", "Renovación");
      await expect(page.getByText("Desbloqueada", { exact: true })).toBeVisible();
      await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/comisiones-${ancho}.png`, fullPage: true });
    });
  }
});

/** Llena la inversión n de "Mis externos" (agrega la fila antes). */
async function deExterno(page: Page, n: number, monto: string, plazo: string, tipo = "Nueva") {
  await page.getByRole("button", { name: "Agregar inversión de tus externos" }).click();
  await page.getByLabel(`Monto, inversión de tus externos ${n}`).fill(monto);
  await page.getByLabel(`Plazo, inversión de tus externos ${n}`).selectOption({ label: plazo });
  await page.getByLabel(`Tipo, inversión de tus externos ${n}`).selectOption({ label: tipo });
}

/** Las tres inversiones de externos de referencia: 13,530.00 + 4,920.00 + 6,765.00 = 25,215.00. */
async function tresDeExternos(page: Page) {
  await deExterno(page, 1, "500,000", "12 meses");
  await deExterno(page, 2, "400,000", "6 meses");
  await deExterno(page, 3, "500,000", "12 meses", "Renovación");
}

// Sprint 6c: tablas de incentivos, externo sin comisión bloqueada y Mis externos (30%; confirmado en el Sprint 6b, sin insignia de supuesto).
test.describe("comisiones, Sprint 6c", () => {
  test("externo: tabla de incentivos con cumplimiento, resalta 100% con 1,000,000 y nunca muestra 'Bloqueada'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Externo", { exact: true }).click();
    await inversion(page, 1, "1,000,000", "12 meses", "2026-10-20");
    const tabla = page.getByRole("region", { name: "Incentivos por captación nueva del mes" });
    await expect(tabla.getByRole("columnheader")).toHaveText(["Cumplimiento", "Desde", "Hasta", "Incentivo"]);
    await expect(tabla.getByRole("row").nth(1)).toContainText("100% de la meta interna");
    await expect(tabla.getByRole("row").nth(1)).toContainText("$15,000 + comisión");
    await expect(tabla.getByRole("row").nth(3)).toContainText("En adelante");
    await expect(tabla.getByRole("row").filter({ hasText: "Con esta captación" })).toContainText("100% de la meta interna");
    await expect(tabla).toContainText("Referencia: la meta interna de un ejecutivo es de $1,000,000 al mes.");
    await expect(page.getByText(/Bloqueada/)).toHaveCount(0);
    await expect(page.getByText(/sin l[ií]mite|estad[ií]a|permanencia/i)).toHaveCount(0);
    // La comisión no cambia: 1,000,000 × 2.838% = 28,380.00.
    await expect(page.getByText("$28,380.00", { exact: true }).first()).toBeVisible();
    await sinViolaciones(page);
  });

  test("ejecutivo: tabla de metas con '+ comisión', resalta 150%, sueldo base y desbloqueo al 80%, sin estadía", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await inversion(page, 1, "1,500,000", "12 meses", "2026-10-07");
    const tabla = page.getByRole("region", { name: "Metas del mes" });
    await expect(tabla.getByRole("columnheader")).toHaveText(["Cumplimiento", "Desde", "Hasta", "Incentivo"]);
    await expect(tabla.getByRole("row").nth(1)).toContainText("$0 + comisión");
    await expect(tabla.getByRole("row").nth(3)).toContainText("$10,000 + comisión");
    await expect(tabla.getByRole("row").filter({ hasText: "Con esta captación" })).toContainText("150% de la meta");
    await expect(tabla).toContainText("Sueldo base (propuesta)");
    await expect(tabla).toContainText("$15,000");
    await expect(tabla).toContainText("Las comisiones se desbloquean desde el 80% de la meta ($800,000).");
    await expect(page.getByText(/sin l[ií]mite|estad[ií]a|permanencia|META/)).toHaveCount(0);
    await sinViolaciones(page);
  });

  test("ejecutivo con Mis externos, desbloqueado (900,000 propios): 30% × $25,215.00 = $7,564.50 pagable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await inversion(page, 1, "900,000", "12 meses", "2026-10-07");
    await tresDeExternos(page);
    const bloque = page.getByRole("region", { name: "Comisión por tus externos (30%)" });
    await expect(bloque).not.toContainText("Supuesto por confirmar");
    await expect(bloque).toContainText("30% × $25,215.00 = $7,564.50");
    await expect(bloque).toContainText("Se paga aparte: no se descuenta a tus externos.");
    await expect(bloque.getByText("Desbloqueada", { exact: true })).toBeVisible();
    await sinViolaciones(page);
  });

  test("ejecutivo con Mis externos, bloqueado (700,000 propios): los $7,564.50 quedan bloqueados y lo pagable es $0.00", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await inversion(page, 1, "700,000", "12 meses", "2026-10-07");
    await tresDeExternos(page);
    const bloque = page.getByRole("region", { name: "Comisión por tus externos (30%)" });
    await expect(bloque.getByText("Bloqueada", { exact: true }).first()).toBeVisible();
    await expect(bloque).toContainText("$7,564.50");
    await expect(bloque).toContainText("Bloqueada: se desbloquea cuando tu captación nueva del mes llegue a $800,000.");
    await expect(bloque).toContainText("se pierde (POR_CONFIRMAR, editable)");
    await sinViolaciones(page);
  });

  test("gerente: 'Inversiones del equipo' y 'Mis externos' van separados, con la nota de la doble captura", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Gerente", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Inversiones del equipo (opcional)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mis externos" })).toBeVisible();
    await expect(
      page.getByText(
        "Captura cada inversión en un solo lugar: las de tu equipo interno, en ‘Inversiones del equipo’; las de tus externos, en ‘Mis externos’.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Metas del mes" })).toHaveCount(0);
  });

  test("externo: no tiene el bloque Mis externos", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comisiones");
    await page.getByText("Externo", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mis externos" })).toHaveCount(0);
  });

  test("celular a 390 px con Mis externos y la tabla de metas: sin desborde y sin violaciones de axe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/comisiones");
    await inversion(page, 1, "700,000", "12 meses", "2026-10-07");
    await tresDeExternos(page);
    await expect(page.getByText("$7,564.50").first()).toBeVisible();
    await sinDesbordeHorizontal(page);
    await sinViolaciones(page);
  });
});

// Capturas del Sprint 6c: solo con MUESTRAS_DIR (fuera del repositorio).
//   PowerShell: $env:MUESTRAS_DIR = "C:\dev\informes\sprint-6c"; npx playwright test comisiones --grep capturas
test.describe("capturas de /comisiones, Sprint 6c", () => {
  test.skip(process.env.MUESTRAS_DIR === undefined, "solo con MUESTRAS_DIR");
  for (const ancho of [390, 1280]) {
    test(`externo a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/comisiones");
      await page.getByText("Externo", { exact: true }).click();
      await inversion(page, 1, "1,000,000", "12 meses", "2026-10-07");
      await expect(page.getByText("Con esta captación").filter({ visible: true })).toBeVisible();
      await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/comisiones-externo-${ancho}.png`, fullPage: true });
    });

    for (const [caso, propio] of [
      ["bloqueado", "700,000"],
      ["desbloqueado", "900,000"],
    ] as const) {
      test(`ejecutivo con Mis externos ${caso} a ${ancho} px`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.goto("/comisiones");
        await inversion(page, 1, propio, "12 meses", "2026-10-07");
        await tresDeExternos(page);
        await expect(page.getByText("$7,564.50").first()).toBeVisible();
        await page.screenshot({ path: `${process.env.MUESTRAS_DIR}/comisiones-ejecutivo-externos-${caso}-${ancho}.png`, fullPage: true });
      });
    }
  }
});
