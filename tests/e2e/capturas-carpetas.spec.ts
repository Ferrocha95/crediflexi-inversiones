import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  borrarCarpetasBibliotecaE2E,
  borrarElementosBibliotecaE2E,
  correoUnico,
  crearCarpetaBibliotecaE2E,
  crearElementoBibliotecaE2E,
  crearUsuarioE2E,
  entrar,
  restosBibliotecaE2E,
  restosCarpetasE2E,
  type UsuarioE2E,
} from "./usuarios";

// Dos capturas de la sección Capacitación con subcarpetas, con datos
// sintéticos: como gerente (1280 px) y como ejecutivo a 390 px. Se guardan
// FUERA del repositorio, en CAPTURAS_DIR (por omisión
// C:\dev\informes\capturas-7c). Solo corren con la etiqueta @capturas.
//
// En serie: las carpetas y los elementos se crean una sola vez y al final se
// borran con el administrador de las pruebas, primero los elementos y sus
// objetos del bucket y luego las carpetas, comprobando que no queda nada.

const DIR = process.env.CAPTURAS_DIR ?? path.join("C:", "dev", "informes", "capturas-7c");
const archivo = (nombre: string) => path.join(DIR, `${nombre}.png`);
const SECCION = "Capacitación (manuales y guías)";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

let gerente: UsuarioE2E;
let ejecutivo: UsuarioE2E;
const elementos: string[] = [];
const carpetas: string[] = [];

/** Espera a que no quede ninguna animación ni transición en curso (diálogos, notificaciones). */
async function sinAnimaciones(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
}

async function abrir(page: Page, usuario: UsuarioE2E, ancho: number) {
  await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await entrar(page, usuario.correo, usuario.contrasena);
  await page.goto("/biblioteca");
  await expect(page.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
  const seccion = page.getByRole("region", { name: SECCION });
  // Abre la carpeta de manuales para que se vean sus tarjetas.
  const manuales = seccion.locator("details").filter({ has: page.locator("summary", { hasText: "Manuales de producto" }) });
  await manuales.locator("summary").click();
  await expect(manuales.getByRole("heading", { name: "Manual de captación" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await sinAnimaciones(page);
  return seccion;
}

test.describe("capturas de las subcarpetas @capturas", () => {
  test.beforeAll(async () => {
    gerente = await crearUsuarioE2E({ correo: correoUnico("gerente.capturas.carpetas"), nombre: "Gerente Sintética Capturas", rol: "GERENTE" });
    ejecutivo = await crearUsuarioE2E({
      correo: correoUnico("ejecutivo.capturas.carpetas"),
      nombre: "Ejecutivo Sintético Capturas",
      rol: "EJECUTIVO",
      jefeId: gerente.usuarioId,
    });
    const manuales = await crearCarpetaBibliotecaE2E({ creadoPor: gerente.usuarioId, categoria: "CAPACITACION", nombre: "Manuales de producto" });
    const videos = await crearCarpetaBibliotecaE2E({ creadoPor: gerente.usuarioId, categoria: "CAPACITACION", nombre: "Videos de inducción" });
    const vacia = await crearCarpetaBibliotecaE2E({ creadoPor: gerente.usuarioId, categoria: "CAPACITACION", nombre: "Formatos internos" });
    carpetas.push(manuales, videos, vacia);
    const base = { subidoPor: gerente.usuarioId, categoria: "CAPACITACION" } as const;
    elementos.push(
      await crearElementoBibliotecaE2E({ ...base, nombre: "Manual de captación", descripcion: "Pasos del alta de un cliente, sin datos reales.", carpetaId: manuales }),
      await crearElementoBibliotecaE2E({ ...base, nombre: "Guía rápida del cotizador", descripcion: "Cómo armar una cotización en 5 pasos.", carpetaId: manuales }),
      await crearElementoBibliotecaE2E({ ...base, nombre: "Bienvenida al equipo", enlace: "https://videos.ejemplo.test/bienvenida", carpetaId: videos }),
      await crearElementoBibliotecaE2E({ ...base, nombre: "Calendario de capacitación 2026", descripcion: "Fechas sintéticas." }),
    );
  });

  test.afterAll(async () => {
    const rutas = await borrarElementosBibliotecaE2E(elementos);
    await borrarCarpetasBibliotecaE2E(carpetas);
    expect(rutas.length).toBeGreaterThan(0);
    expect(await restosBibliotecaE2E(elementos, rutas)).toEqual({ filas: 0, objetos: 0 });
    expect(await restosCarpetasE2E(carpetas)).toBe(0);
  });

  test("sección con subcarpetas como gerente a 1280 px", async ({ page }) => {
    const seccion = await abrir(page, gerente, 1280);
    await expect(seccion.getByRole("button", { name: `Nueva carpeta ${SECCION}` })).toBeVisible();
    await seccion.screenshot({ path: archivo("carpetas-gerente-1280") });
  });

  test("sección con subcarpetas como ejecutivo a 390 px", async ({ page }) => {
    const seccion = await abrir(page, ejecutivo, 390);
    await expect(page.getByRole("button", { name: /^Nueva carpeta/ })).toHaveCount(0);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBe(0);
    await seccion.screenshot({ path: archivo("carpetas-ejecutivo-390") });
  });
});
