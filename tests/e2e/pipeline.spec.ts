import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { correoUnico, crearProspectoE2E, crearUsuarioE2E, entrar, type UsuarioE2E } from "./usuarios";

// Pipeline en el navegador. Cada prueba crea su propio usuario (@e2e.test) e
// inicia sesión, para no mezclar prospectos con las pruebas que corren en
// paralelo. Todo es sintético; el proyecto "limpieza" lo borra al final.

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SIN_SESION = { cookies: [], origins: [] };

test.use({ storageState: SIN_SESION });

async function sinViolaciones(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  const resumen = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
  expect(resumen, "violaciones de axe").toEqual([]);
}

/** Hoy en la Ciudad de México más `dias`, en AAAA-MM-DD. */
function diaEnMexico(dias = 0): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const f = new Date(`${hoy}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

async function entrarComo(page: Page, nombre: string, rol = "EJECUTIVO", jefeId?: string): Promise<UsuarioE2E> {
  const u = await crearUsuarioE2E({ correo: correoUnico("pipeline"), nombre, rol, jefeId });
  await entrar(page, u.correo, u.contrasena);
  return u;
}

const filasTabla = (page: Page) => page.getByRole("table", { name: "Lista de prospectos" }).locator("tbody tr");

test.describe("pipeline", () => {
  test("alta en el diálogo: valida, guarda y el prospecto aparece en la lista y en la barra", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarComo(page, "Ejecutiva E2E Alta");
    await page.goto("/pipeline");
    await expect(page.getByText("Aún no tienes prospectos")).toBeVisible();

    await page.getByRole("button", { name: "Nuevo prospecto" }).first().click();
    const dialogo = page.getByRole("dialog", { name: "Nuevo prospecto" });
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel("Nombre").fill("Prospecto Sintético Alta");
    await dialogo.getByLabel("Contacto").fill("+52 (55) 1234-5678");
    await dialogo.getByText("INTERMITENTE", { exact: true }).click();
    await dialogo.getByLabel("Seguimiento").fill(diaEnMexico(7));

    // Un dato sensible se marca antes de guardar y la base nunca lo recibe.
    await dialogo.getByLabel("Comentarios").fill("CLABE 002180701234567891");
    await expect(dialogo.getByText("Los comentarios parecen incluir una CLABE.", { exact: false })).toBeVisible();
    await dialogo.getByRole("button", { name: "Guardar prospecto" }).click();
    await expect(dialogo.getByRole("alert")).toContainText("Revisa los campos marcados.");
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel("Comentarios").fill("Le interesa el plazo de 12 meses");
    await dialogo.getByRole("button", { name: "Guardar prospecto" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText("Prospecto guardado", { exact: true })).toBeVisible();

    await expect(filasTabla(page)).toHaveCount(1);
    await expect(filasTabla(page).first()).toContainText("Prospecto Sintético Alta");
    await expect(filasTabla(page).first()).toContainText("55 1234 5678");
    await expect(page.getByRole("link", { name: "INTERMITENTE: 1. Mostrar solo este estatus" })).toBeVisible();
  });

  test("filtros: estatus, búsqueda sin acentos ni mayúsculas, vencidos y semana del Excel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const u = await entrarComo(page, "Ejecutivo E2E Filtros");
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "José Sintético Uno", contacto: "5500000201", estatus: "INTERESADO", seguimiento: diaEnMexico(-1) });
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Ana Sintética Dos", contacto: "5500000202", estatus: "INTERMITENTE", seguimiento: diaEnMexico(3) });
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Luis Sintético Tres", contacto: "5500000203", estatus: "NO_INTERESADO" });
    await page.goto("/pipeline");
    await expect(filasTabla(page)).toHaveCount(3);

    await page.getByLabel("Buscar por nombre").fill("JOSE");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/q=JOSE/);
    await expect(filasTabla(page)).toHaveCount(1);
    await expect(filasTabla(page).first()).toContainText("José Sintético Uno");

    await page.getByRole("link", { name: "Quitar filtros" }).first().click();
    await expect(filasTabla(page)).toHaveCount(3);

    await page.getByRole("link", { name: "INTERMITENTE: 1. Mostrar solo este estatus" }).click();
    await expect(page).toHaveURL(/estatus=INTERMITENTE/);
    await expect(filasTabla(page)).toHaveCount(1);
    await expect(filasTabla(page).first()).toContainText("Ana Sintética Dos");
    await page.getByRole("link", { name: "INTERMITENTE: 1. Filtro activo; quitarlo" }).click();
    await expect(filasTabla(page)).toHaveCount(3);

    await page.getByLabel("Solo seguimientos vencidos").check();
    await expect(page).toHaveURL(/vencido=1/);
    await expect(filasTabla(page)).toHaveCount(1);
    await expect(filasTabla(page).first()).toContainText("José Sintético Uno");
    await expect(filasTabla(page).first()).toContainText("Vencido");
    await page.getByLabel("Solo seguimientos vencidos").uncheck();
    await expect(filasTabla(page)).toHaveCount(3);

    // La semana solo cambia el encabezado del Excel: la lista sigue completa.
    const semana = page.getByLabel("Semana del Excel");
    await semana.selectOption({ index: 1 });
    await expect(page).toHaveURL(/semana=\d{4}-\d{2}-\d{2}/);
    await expect(semana.locator("option:checked")).toHaveText(/^\d{1,2} DE [A-Z]+( \d{4})? A \d{1,2} DE [A-Z]+ \d{4}$/);
    await expect(filasTabla(page)).toHaveCount(3);
  });

  test("archivar y restaurar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const u = await entrarComo(page, "Ejecutivo E2E Archivo");
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Prospecto Sintético Archivo", contacto: "5500000301", estatus: "INTERESADO" });
    await page.goto("/pipeline");

    await page.getByRole("button", { name: "Archivar Prospecto Sintético Archivo" }).click();
    await expect(page.getByText("Prospecto archivado", { exact: true })).toBeVisible();
    await expect(filasTabla(page)).toHaveCount(0);
    // Sin activos pero con archivados: no dice "Aún no tienes prospectos" y ofrece ver los archivados.
    await expect(page.getByText("No tienes prospectos activos")).toBeVisible();
    await expect(page.getByText("Aún no tienes prospectos")).toHaveCount(0);

    await page.getByRole("link", { name: "Ver los archivados" }).click();
    await expect(page).toHaveURL(/archivados=1/);
    const archivados = page.getByRole("table", { name: "Prospectos archivados" }).locator("tbody tr");
    await expect(archivados).toHaveCount(1);
    await page.getByRole("button", { name: "Restaurar Prospecto Sintético Archivo" }).click();
    await expect(page.getByText("Prospecto restaurado", { exact: true })).toBeVisible();
    await expect(archivados).toHaveCount(0);

    await page.getByRole("link", { name: "Activos" }).click();
    await expect(filasTabla(page)).toHaveCount(1);
  });

  test("editar desde la fila conserva los datos y guarda el cambio", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const u = await entrarComo(page, "Ejecutivo E2E Edición");
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Prospecto Sintético Edición", contacto: "5500000401", estatus: "INTERESADO" });
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Editar Prospecto Sintético Edición" }).click();
    const dialogo = page.getByRole("dialog", { name: "Editar prospecto" });
    await expect(dialogo.getByLabel("Nombre")).toHaveValue("Prospecto Sintético Edición");
    await dialogo.getByText("NO INTERESADO", { exact: true }).click();
    await dialogo.getByRole("button", { name: "Guardar prospecto" }).click();
    await expect(dialogo).toBeHidden();
    await expect(filasTabla(page).first()).toContainText("NO INTERESADO");
  });

  test("Descargar e Importar Excel se ven pero están deshabilitados (Próximamente)", async ({ page }) => {
    await entrarComo(page, "Ejecutivo E2E Excel");
    await page.goto("/pipeline");
    for (const nombre of ["Descargar Excel, Próximamente", "Importar Excel, Próximamente"]) {
      await expect(page.getByRole("button", { name: nombre })).toHaveAttribute("aria-disabled", "true");
    }
  });

  test("un gerente ve a su equipo en lectura, con columna y filtro de ejecutivo", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const gerente = await crearUsuarioE2E({ correo: correoUnico("gerente"), nombre: "Gerente E2E Equipo", rol: "GERENTE" });
    const ejecutivo = await crearUsuarioE2E({ correo: correoUnico("equipo"), nombre: "Ejecutivo E2E Equipo", rol: "EJECUTIVO", jefeId: gerente.usuarioId });
    await crearProspectoE2E({ ejecutivoId: ejecutivo.usuarioId, nombre: "Prospecto Sintético Equipo", contacto: "5500000501", estatus: "INTERESADO" });
    await entrar(page, gerente.correo, gerente.contrasena);
    await page.goto("/pipeline");

    const tabla = page.getByRole("table", { name: "Lista de prospectos" });
    await expect(tabla.getByRole("columnheader", { name: "Ejecutivo" })).toBeVisible();
    await expect(filasTabla(page).first()).toContainText("Ejecutivo E2E Equipo");
    await expect(filasTabla(page).first()).toContainText("Solo lectura");
    await expect(page.getByRole("button", { name: /Editar Prospecto Sintético Equipo|Archivar Prospecto Sintético Equipo/ })).toHaveCount(0);

    await page.getByLabel("Ejecutivo", { exact: true }).selectOption({ label: "Ejecutivo E2E Equipo" });
    await expect(page).toHaveURL(new RegExp(`ejecutivo=${ejecutivo.usuarioId}`));
    await expect(filasTabla(page)).toHaveCount(1);
  });

  test("celular a 390 px: tarjetas en lugar de tabla, y axe sin violaciones con el diálogo abierto", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const u = await entrarComo(page, "Ejecutiva E2E Celular");
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Prospecto Sintético Celular Uno", contacto: "5500000601", estatus: "INTERESADO", seguimiento: diaEnMexico(-2) });
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Prospecto Sintético Celular Dos", contacto: "5500000602", estatus: "NO_INTERESADO" });
    await page.goto("/pipeline");

    await expect(page.getByRole("table", { name: "Lista de prospectos" })).toBeHidden();
    const tarjetas = page.getByRole("list", { name: "Lista de prospectos" }).getByRole("listitem");
    await expect(tarjetas).toHaveCount(2);
    await expect(tarjetas.first()).toContainText("Prospecto Sintético Celular Uno");
    await expect(page.getByRole("button", { name: "Editar Prospecto Sintético Celular Uno" })).toBeVisible();
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, "sin desplazamiento horizontal").toBeLessThanOrEqual(390);
    await sinViolaciones(page);

    await page.getByRole("button", { name: "Nuevo prospecto" }).first().click();
    await expect(page.getByRole("dialog", { name: "Nuevo prospecto" })).toBeVisible();
    await sinViolaciones(page);
  });

  test("axe sin violaciones a 1280 px con datos, filtros y archivados", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const u = await entrarComo(page, "Ejecutivo E2E Axe");
    await crearProspectoE2E({ ejecutivoId: u.usuarioId, nombre: "Prospecto Sintético Axe", contacto: "5500000701", estatus: "INTERMITENTE", seguimiento: diaEnMexico(-1) });
    await page.goto("/pipeline");
    await sinViolaciones(page);
    await page.goto("/pipeline?estatus=INTERMITENTE&vencido=1");
    await sinViolaciones(page);
    await page.goto("/pipeline?archivados=1");
    await sinViolaciones(page);
    await page.goto("/pipeline?nuevo=1");
    await expect(page.getByRole("dialog", { name: "Nuevo prospecto" })).toBeVisible();
    await sinViolaciones(page);
  });
});
