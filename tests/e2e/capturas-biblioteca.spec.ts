import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  borrarElementosBibliotecaE2E,
  correoUnico,
  crearElementoBibliotecaE2E,
  crearUsuarioE2E,
  entrar,
  restosBibliotecaE2E,
  type UsuarioE2E,
} from "./usuarios";

// Tres capturas de la Biblioteca con datos sintéticos, para revisar el diseño:
// la pantalla como gerente, como ejecutivo a 390 px y el diálogo de subir. Se
// guardan FUERA del repositorio, en CAPTURAS_DIR (por omisión
// C:\dev\informes\capturas-7b). Solo corren con la etiqueta @capturas.
//
// En serie: los elementos se crean una sola vez (si cada prueba los creara, la
// página vería copias) y al final se borran, con el administrador de las
// pruebas, las filas y los objetos del bucket que se crearon aquí.

const DIR = process.env.CAPTURAS_DIR ?? path.join("C:", "dev", "informes", "capturas-7b");
const archivo = (nombre: string) => path.join(DIR, `${nombre}.png`);

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const ELEMENTOS = [
  { categoria: "HERRAMIENTAS", nombre: "Calculadora de plazos (sintética)", descripcion: "Hoja para comparar plazos con el cliente.", enlace: "https://herramientas.ejemplo.test/plazos" },
  { categoria: "HERRAMIENTAS", nombre: "Guion de primera llamada", descripcion: "Preguntas para la primera llamada." },
  { categoria: "MULTIMEDIA", nombre: "Video de bienvenida", descripcion: "Video de 12 minutos para el primer día.", enlace: "https://videos.ejemplo.test/bienvenida" },
  { categoria: "EMPRESA", nombre: "Organigrama sintético 2026", descripcion: "" },
  { categoria: "CAPACITACION", nombre: "Manual de captación", descripcion: "Pasos del alta de un cliente, sin datos reales." },
  { categoria: "CAPACITACION", nombre: "Guía rápida del cotizador", descripcion: "Cómo armar una cotización en 5 pasos." },
] as const;

let gerente: UsuarioE2E;
let ejecutivo: UsuarioE2E;
const creados: string[] = [];

async function abrir(page: Page, usuario: UsuarioE2E, ancho: number) {
  await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await entrar(page, usuario.correo, usuario.contrasena);
  await page.goto("/biblioteca");
  await expect(page.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manual de captación" })).toBeVisible();
}

test.describe("capturas de la Biblioteca @capturas", () => {
  test.beforeAll(async () => {
    gerente = await crearUsuarioE2E({ correo: correoUnico("gerente.capturas"), nombre: "Gerente Sintética Capturas", rol: "GERENTE" });
    ejecutivo = await crearUsuarioE2E({
      correo: correoUnico("ejecutivo.capturas"),
      nombre: "Ejecutivo Sintético Capturas",
      rol: "EJECUTIVO",
      jefeId: gerente.usuarioId,
    });
    for (const e of ELEMENTOS) creados.push(await crearElementoBibliotecaE2E({ subidoPor: gerente.usuarioId, ...e }));
    creados.push(await crearElementoBibliotecaE2E({ subidoPor: gerente.usuarioId, categoria: "EMPRESA", nombre: "Política anterior (archivada)", archivado: true }));
  });

  test.afterAll(async () => {
    const rutas = await borrarElementosBibliotecaE2E(creados);
    expect(rutas.length).toBeGreaterThan(0);
    expect(await restosBibliotecaE2E(creados, rutas)).toEqual({ filas: 0, objetos: 0 });
  });

  test("gerente a 1280 px", async ({ page }) => {
    await abrir(page, gerente, 1280);
    await page.screenshot({ path: archivo("biblioteca-gerente-1280"), fullPage: true });
  });

  test("ejecutivo a 390 px", async ({ page }) => {
    await abrir(page, ejecutivo, 390);
    await expect(page.getByRole("button", { name: "Subir archivo" })).toHaveCount(0);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBe(0);
    await page.screenshot({ path: archivo("biblioteca-ejecutivo-390"), fullPage: true });
  });

  test("diálogo de subir a 1280 px", async ({ page }) => {
    await abrir(page, gerente, 1280);
    await page.getByRole("button", { name: "Subir archivo" }).click();
    await expect(page.getByRole("dialog", { name: "Subir archivo" })).toBeVisible();
    await page.screenshot({ path: archivo("biblioteca-dialogo-subir") });
  });
});
