import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { llenarCotizador } from "./ayudas";
import { correoUnico, crearUsuarioE2E, desactivarUsuario, entrar, USUARIO_PRINCIPAL } from "./usuarios";

// Inicio de sesión, menú con el usuario, salida y sesión expirada.

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SIN_SESION = { cookies: [], origins: [] };
const SESION_EXPIRADA = "Tu sesión expiró; vuelve a iniciar sesión.";

async function sinViolaciones(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  const resumen = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
  expect(resumen, "violaciones de axe").toEqual([]);
}

test.describe("sin sesión", () => {
  test.use({ storageState: SIN_SESION });

  test("/cotizador lleva a /acceso?siguiente=%2Fcotizador", async ({ page }) => {
    await page.goto("/cotizador");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Fcotizador$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("credenciales malas dan el mensaje, sin decir si el correo existe", async ({ page }) => {
    await page.goto("/acceso");
    await page.getByLabel("Correo").fill(`no.existe${Date.now()}@e2e.test`);
    await page.getByLabel("Contraseña").fill("ContrasenaMala123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("region", { name: "Entrar" }).getByRole("alert")).toHaveText("Correo o contraseña incorrectos.");
    await expect(page).toHaveURL(/\/acceso/);
  });

  for (const ancho of [390, 1280]) {
    test(`axe en /acceso a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/acceso");
      await sinViolaciones(page);
    });
  }

  test("entrar y salir funciona, y salir se puede hacer con el teclado", async ({ page }) => {
    const u = await crearUsuarioE2E({ correo: correoUnico("salir"), nombre: "Ejecutivo E2E Salida", rol: "EJECUTIVO" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrar(page, u.correo, u.contrasena, "/acceso?siguiente=%2Fcotizador");
    await expect(page).toHaveURL(/\/cotizador$/);

    const salir = page.getByRole("button", { name: "Cerrar sesión" });
    await salir.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/acceso$/);

    await page.goto("/cotizador");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Fcotizador$/);
  });

  test("un usuario desactivado a media sesión recibe 401 al pedir el PDF", async ({ page }) => {
    const u = await crearUsuarioE2E({ correo: correoUnico("inactivo"), nombre: "Ejecutivo E2E Inactivo", rol: "EJECUTIVO" });
    await entrar(page, u.correo, u.contrasena);
    await desactivarUsuario(u.usuarioId);

    const r = await page.request.post("/cotizador/pdf", { data: {} });
    expect(r.status()).toBe(401);
    expect(await r.json()).toEqual({ error: SESION_EXPIRADA });
  });
});

test.describe("con sesión", () => {
  test("el menú muestra nombre, rol y sucursal, en escritorio y en el celular", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const lateral = page.locator("aside");
    await expect(lateral.getByText(USUARIO_PRINCIPAL.nombre)).toBeVisible();
    await expect(lateral.getByText(USUARIO_PRINCIPAL.rolLegible, { exact: true })).toBeVisible();
    await expect(lateral.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const encabezado = page.locator("header").first();
    await expect(encabezado.getByText(USUARIO_PRINCIPAL.nombre)).toBeVisible();
    await expect(encabezado.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    await page.getByRole("button", { name: "Más" }).click();
    const dialogo = page.getByRole("dialog", { name: "Más secciones" });
    await expect(dialogo.getByText(USUARIO_PRINCIPAL.nombre)).toBeVisible();
    await expect(dialogo.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("con la sesión expirada, la vista previa muestra el aviso con enlace a /acceso", async ({ page, context }) => {
    await page.goto("/cotizador");
    await context.clearCookies();
    await llenarCotizadorSinEsperar(page);
    const aviso = page.getByRole("alert").filter({ hasText: SESION_EXPIRADA });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole("link", { name: "Iniciar sesión otra vez" })).toHaveAttribute("href", "/acceso?siguiente=%2Fcotizador");
  });

  test("con la sesión vigente el cotizador sigue funcionando", async ({ page }) => {
    await page.goto("/cotizador");
    await llenarCotizador(page);
    await expect(page.getByText(SESION_EXPIRADA)).toHaveCount(0);
  });
});

/** Escribe un monto sin esperar la vista previa (que no llegará sin sesión). */
async function llenarCotizadorSinEsperar(page: Page) {
  await page.getByLabel("Monto", { exact: true }).fill("250,000");
}
