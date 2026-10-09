import { expect, test } from "@playwright/test";

// USD en la calculadora: solo Rami Sise lo ofrece (aplica_a_entidades de la
// semilla 0.7). Datos sintéticos; usa la sesión del proyecto "setup".

test.describe("cotizador en USD", () => {
  test("CREDIFLEXI no ofrece USD y lo explica; RAMI_SISE sí, con las cifras en USD; al volver a CREDIFLEXI regresa a MXN", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    const entidad = page.getByLabel("Entidad", { exact: true });
    const moneda = page.getByLabel("Moneda", { exact: true });

    await entidad.selectOption({ label: "CREDIFLEXI, S.A.P.I. DE C.V." });
    await expect(moneda.locator("option")).toHaveText(["MXN"]);
    await expect(page.getByText("USD solo está disponible para RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R.")).toBeVisible();

    await entidad.selectOption({ label: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R." });
    await expect(moneda.locator("option")).toHaveText(["MXN", "USD"]);
    await moneda.selectOption("USD");
    await page.getByLabel("Monto", { exact: true }).fill("10,000");
    const plazo = page.getByLabel("Plazo", { exact: true });
    await expect(plazo).toBeEnabled();
    await plazo.selectOption({ label: "12 meses" });
    await expect(page.getByRole("heading", { name: "Datos capturados" })).toBeVisible();
    // Sprint 6a: el monto capturado, sí; el rendimiento calculado, no.
    await expect(page.locator("dd").filter({ hasText: /^\$10,000\.00 USD$/ })).toBeVisible();
    await expect(page.getByText("$70.83 USD", { exact: true })).toHaveCount(0);

    await entidad.selectOption({ label: "CREDIFLEXI, S.A.P.I. DE C.V." });
    await expect(moneda).toHaveValue("MXN");
  });
});
