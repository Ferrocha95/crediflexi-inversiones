import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { correoUnico, crearElementoBibliotecaE2E, crearUsuarioE2E, entrar } from "./usuarios";

// Tres capturas de la Biblioteca con datos sintéticos, para revisar el diseño:
// la pantalla como gerente, como ejecutivo a 390 px y el diálogo de subir. Se
// guardan FUERA del repositorio, en CAPTURAS_DIR (por omisión
// C:\dev\informes\capturas-7b). Solo corren con la etiqueta @capturas.

const DIR = process.env.CAPTURAS_DIR ?? path.join("C:", "dev", "informes", "capturas-7b");
const archivo = (nombre: string) => path.join(DIR, `${nombre}.png`);

test.use({ storageState: { cookies: [], origins: [] } });

async function preparar(page: Page, rol: "GERENTE" | "EJECUTIVO", ancho: number) {
  const gerente = await crearUsuarioE2E({ correo: correoUnico("gerente.capturas"), nombre: "Gerente Sintética Capturas", rol: "GERENTE" });
  const elementos = [
    { categoria: "HERRAMIENTAS", nombre: "Calculadora de plazos (sintética)", descripcion: "Hoja para comparar plazos con el cliente.", enlace: "https://herramientas.ejemplo.test/plazos" },
    { categoria: "HERRAMIENTAS", nombre: "Guion de primera llamada", descripcion: "Preguntas para la primera llamada." },
    { categoria: "MULTIMEDIA", nombre: "Video de bienvenida", descripcion: "Video de 12 minutos para el primer día.", enlace: "https://videos.ejemplo.test/bienvenida" },
    { categoria: "EMPRESA", nombre: "Organigrama sintético 2026", descripcion: "" },
    { categoria: "CAPACITACION", nombre: "Manual de captación", descripcion: "Pasos del alta de un cliente, sin datos reales." },
    { categoria: "CAPACITACION", nombre: "Guía rápida del cotizador", descripcion: "Cómo armar una cotización en 5 pasos." },
  ] as const;
  for (const e of elementos) await crearElementoBibliotecaE2E({ subidoPor: gerente.usuarioId, ...e });
  await crearElementoBibliotecaE2E({ subidoPor: gerente.usuarioId, categoria: "EMPRESA", nombre: "Política anterior (archivada)", archivado: true });

  const usuario =
    rol === "GERENTE"
      ? gerente
      : await crearUsuarioE2E({ correo: correoUnico("ejecutivo.capturas"), nombre: "Ejecutivo Sintético Capturas", rol: "EJECUTIVO", jefeId: gerente.usuarioId });
  await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await entrar(page, usuario.correo, usuario.contrasena);
  await page.goto("/biblioteca");
  await expect(page.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manual de captación" })).toBeVisible();
}

test.describe("capturas de la Biblioteca @capturas", () => {
  test("gerente a 1280 px", async ({ page }) => {
    await preparar(page, "GERENTE", 1280);
    await page.screenshot({ path: archivo("biblioteca-gerente-1280"), fullPage: true });
  });

  test("ejecutivo a 390 px", async ({ page }) => {
    await preparar(page, "EJECUTIVO", 390);
    await expect(page.getByRole("button", { name: "Subir archivo" })).toHaveCount(0);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBe(0);
    await page.screenshot({ path: archivo("biblioteca-ejecutivo-390"), fullPage: true });
  });

  test("diálogo de subir a 1280 px", async ({ page }) => {
    await preparar(page, "GERENTE", 1280);
    await page.getByRole("button", { name: "Subir archivo" }).click();
    await expect(page.getByRole("dialog", { name: "Subir archivo" })).toBeVisible();
    await page.screenshot({ path: archivo("biblioteca-dialogo-subir") });
  });
});
