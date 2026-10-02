import { expect, type Page } from "@playwright/test";

/** Anchos de revisión: celular, tableta y escritorio. */
export const ANCHOS = [390, 768, 1280] as const;

/** Monto sintético para ver la vista previa con la semilla del repo. */
export const MONTO_DE_EJEMPLO = "250,000";

/** Escribe un monto, elige el primer plazo disponible y espera la vista previa. */
export async function llenarCotizador(page: Page): Promise<void> {
  await page.getByLabel("Monto", { exact: true }).fill(MONTO_DE_EJEMPLO);
  const plazo = page.getByLabel("Plazo", { exact: true });
  await expect(plazo).toBeEnabled();
  await plazo.selectOption({ index: 1 });
  await expect(page.getByRole("heading", { name: "Resultados" })).toBeVisible();
}
