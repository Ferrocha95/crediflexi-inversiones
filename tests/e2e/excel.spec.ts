import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { correoUnico, crearProspectoE2E, crearUsuarioE2E, entrar, type UsuarioE2E } from "./usuarios";

// Descargar e importar el Excel del pipeline en el navegador. Cada prueba crea
// su propio usuario (@e2e.test). El .xlsx para importar se genera aquí, en
// memoria, con datos sintéticos: no se versiona ningún archivo.

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.use({ storageState: { cookies: [], origins: [] } });

async function sinViolaciones(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  const resumen = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
  expect(resumen, "violaciones de axe").toEqual([]);
}

async function entrarComo(page: Page, nombre: string, rol = "EJECUTIVO", jefeId?: string): Promise<UsuarioE2E> {
  const u = await crearUsuarioE2E({ correo: correoUnico("excel"), nombre, rol, jefeId });
  await entrar(page, u.correo, u.contrasena);
  return u;
}

async function libroParaImportar(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("PROSPECTOS SUCURSAL");
  hoja.getRow(3).values = ["NOMBRE", "CONTACTO", "COMENTARIOS", "ESTATUS", "SEGUIMIENTO", "EJECUTIVO"];
  hoja.getRow(4).values = ["Prospecto Sintético Importado Uno", 5500000901, "Llamar el lunes", "INTERMITENTE ", new Date("2026-10-20T00:00:00Z"), ""];
  hoja.getRow(5).values = ["Prospecto Sintético Importado Dos", "55-0000-0902", "", "interesado", "", "Otro Ejecutivo"];
  hoja.getRow(6).values = ["Prospecto Sintético Rechazado", "5500000903", "CLABE 002180701234567891", "INTERESADO", "", ""];
  return Buffer.from(await libro.xlsx.writeBuffer());
}

test.describe("Excel del pipeline", () => {
  test("descargar: el archivo PIPELINE_{MES}.xlsx abre y trae los prospectos del ejecutivo", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const u = await entrarComo(page, "Ejecutiva E2E Descarga");
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Prospecto Sintético Descarga", contacto: "5500000801", estatus: "INTERMITENTE" });
    await page.goto("/pipeline");

    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar Excel", exact: true }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^PIPELINE_[A-Z]+\.xlsx$/);

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(readFileSync(await archivo.path()) as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet("PROSPECTOS SUCURSAL")!;
    expect(hoja.getCell("C1").value).toBe(" PIPELINE INVERSIONES");
    expect(hoja.getCell("C2").value).toBe("EJECUTIVA E2E DESCARGA");
    expect(hoja.getCell("A4").value).toBe("PROSPECTO SINTÉTICO DESCARGA");
    expect(hoja.getCell("B4").value).toBe(5500000801);
    expect(hoja.getCell("D4").value).toBe("INTERMITENTE");
  });

  test("un superior debe elegir un ejecutivo para descargar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const gerente = await entrarComo(page, "Gerente E2E Descarga", "GERENTE");
    await crearUsuarioE2E({ correo: correoUnico("equipo-excel"), nombre: "Ejecutivo E2E Equipo Excel", rol: "EJECUTIVO", jefeId: gerente.usuarioId });
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Descargar Excel", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo descargar el Excel" })).toContainText("Elige un ejecutivo");

    await page.getByLabel("Ejecutivo", { exact: true }).selectOption({ label: "Ejecutivo E2E Equipo Excel" });
    await expect(page).toHaveURL(/ejecutivo=/);
    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar Excel", exact: true }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^PIPELINE_[A-Z]+\.xlsx$/);
  });

  test("importar: vista previa con correcciones y rechazos, y al confirmar aparecen en la lista", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarComo(page, "Ejecutiva E2E Importa");
    await page.goto("/pipeline");

    await page.getByRole("button", { name: "Importar Excel", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: "Importar Excel" });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel("Archivo de Excel (.xlsx)").setInputFiles({
      name: "pipeline-sintetico.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await libroParaImportar(),
    });
    await dialogo.getByRole("button", { name: "Revisar archivo" }).click();

    await expect(dialogo.getByText("3 filas: 2 se importan y 1 no se importa.")).toBeVisible();
    await expect(dialogo).toContainText('El estatus "INTERMITENTE " se corrigió a INTERMITENTE.');
    await expect(dialogo).toContainText("Los comentarios parecen incluir una CLABE.");
    await sinViolaciones(page);

    await dialogo.getByRole("button", { name: "Importar 2 prospectos" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText("Se importaron 2 prospectos", { exact: true })).toBeVisible();
    const filas = page.getByRole("table", { name: "Lista de prospectos" }).locator("tbody tr");
    await expect(filas).toHaveCount(2);
    await expect(page.getByRole("table", { name: "Lista de prospectos" })).toContainText("Prospecto Sintético Importado Uno");
    await expect(page.getByRole("table", { name: "Lista de prospectos" })).not.toContainText("Prospecto Sintético Rechazado");
  });

  test("importar un archivo que no es .xlsx muestra el motivo sin vista previa", async ({ page }) => {
    await entrarComo(page, "Ejecutivo E2E Importa Mal");
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Importar Excel", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: "Importar Excel" });
    await dialogo.getByLabel("Archivo de Excel (.xlsx)").setInputFiles({ name: "pipeline.csv", mimeType: "text/csv", buffer: Buffer.from("NOMBRE,CONTACTO\n") });
    await dialogo.getByRole("button", { name: "Revisar archivo" }).click();
    await expect(dialogo.getByRole("alert")).toContainText("El archivo debe ser un Excel .xlsx");
    await expect(dialogo.getByRole("button", { name: /^Importar \d+ prospecto/ })).toHaveCount(0);
  });
});
