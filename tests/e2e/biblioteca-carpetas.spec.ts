import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  borrarCarpetasBibliotecaE2E,
  borrarElementosBibliotecaE2E,
  correoUnico,
  crearUsuarioE2E,
  entrar,
  idsConNombreE2E,
  restosBibliotecaE2E,
  restosCarpetasE2E,
} from "./usuarios";

// Subcarpetas de la Biblioteca de punta a punta, con usuarios y bytes
// sintéticos: el gerente crea una subcarpeta en Capacitación y sube un PDF
// dentro; el ejecutivo de su organización ve la carpeta, la abre y descarga el
// archivo, y no ve "Nueva carpeta" ni los demás botones de Director y Gerente.
// Al final se borran, con el administrador de las pruebas, el elemento, su
// objeto del bucket y la carpeta, y se comprueba que no queda nada.

test.use({ storageState: { cookies: [], origins: [] } });

const PDF_SINTETICO = Buffer.from("%PDF-1.4\n% Guía sintética E2E en carpeta\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "utf8");
const SECCION = "Capacitación (manuales y guías)";

const grupo = (pagina: Page, nombre: string) => pagina.locator("details").filter({ has: pagina.locator("summary", { hasText: nombre }) });

test.describe("biblioteca: subcarpetas", () => {
  const sello = Date.now();
  const carpeta = `Guías sintéticas ${sello}`;
  const nombre = `Guía en carpeta ${sello}`;

  test.afterEach(async () => {
    const elementos = await idsConNombreE2E("biblioteca", nombre);
    const carpetas = await idsConNombreE2E("biblioteca_carpetas", carpeta);
    // Primero los elementos y sus objetos; luego las carpetas.
    const rutas = await borrarElementosBibliotecaE2E(elementos);
    await borrarCarpetasBibliotecaE2E(carpetas);
    expect(await restosBibliotecaE2E(elementos, rutas)).toEqual({ filas: 0, objetos: 0 });
    expect(await restosCarpetasE2E(carpetas)).toBe(0);
  });

  test("el gerente crea una subcarpeta y sube un PDF dentro; el ejecutivo la ve, baja el archivo y no ve Nueva carpeta", async ({ browser }) => {
    // Dos inicios de sesión, la subida y la descarga: el mismo tope de 90 s que la e2e de la Biblioteca.
    test.setTimeout(90_000);
    const gerente = await crearUsuarioE2E({ correo: correoUnico("gerente.carpetas"), nombre: "Gerente Sintético Carpetas", rol: "GERENTE" });
    const ejecutivo = await crearUsuarioE2E({
      correo: correoUnico("ejecutivo.carpetas"),
      nombre: "Ejecutivo Sintético Carpetas",
      rol: "EJECUTIVO",
      jefeId: gerente.usuarioId,
    });

    // Gerente: crea la carpeta en Capacitación.
    const contextoGerente = await browser.newContext();
    const paginaGerente = await contextoGerente.newPage();
    await entrar(paginaGerente, gerente.correo, gerente.contrasena);
    await paginaGerente.goto("/biblioteca");
    const seccionGerente = paginaGerente.getByRole("region", { name: SECCION });
    await seccionGerente.getByRole("button", { name: `Nueva carpeta ${SECCION}` }).click();
    const dialogoCarpeta = paginaGerente.getByRole("dialog", { name: "Nueva carpeta" });
    await expect(dialogoCarpeta).toContainText(SECCION);
    await dialogoCarpeta.getByLabel("Nombre de la carpeta").fill(carpeta);
    await dialogoCarpeta.getByRole("button", { name: "Crear" }).click();
    await expect(paginaGerente.getByText("Carpeta creada")).toBeVisible({ timeout: 15_000 });
    await expect(grupo(paginaGerente, carpeta)).toBeVisible();

    // Gerente: sube el PDF dentro de la carpeta.
    await paginaGerente.getByRole("button", { name: "Subir archivo" }).click();
    const dialogo = paginaGerente.getByRole("dialog", { name: "Subir archivo" });
    await dialogo.getByLabel("Archivo", { exact: true }).setInputFiles({ name: "guia.pdf", mimeType: "application/pdf", buffer: PDF_SINTETICO });
    await dialogo.getByLabel("Nombre", { exact: true }).fill(nombre);
    await dialogo.getByLabel("Categoría").selectOption({ label: SECCION });
    await dialogo.getByLabel("Carpeta", { exact: true }).selectOption({ label: carpeta });
    await dialogo.getByLabel("Confirmo que el archivo no contiene datos personales de clientes ni datos bancarios").check();
    await dialogo.getByRole("button", { name: "Subir", exact: true }).click();
    await expect(paginaGerente.getByText("Archivo subido")).toBeVisible({ timeout: 15_000 });

    // La carpeta tiene 1 elemento y ya no se puede archivar (con su explicación).
    const carpetaGerente = grupo(paginaGerente, carpeta);
    await expect(carpetaGerente.locator("summary")).toContainText("Número de elementos: 1");
    await carpetaGerente.locator("summary").click();
    await expect(carpetaGerente.getByRole("heading", { name: nombre })).toBeVisible();
    const archivarCarpeta = carpetaGerente.getByRole("button", { name: `Archivar carpeta ${carpeta}` });
    await expect(archivarCarpeta).toBeDisabled();
    await expect(archivarCarpeta).toHaveAccessibleDescription(/Solo se archiva una carpeta vacía/);
    await expect(carpetaGerente.getByRole("button", { name: `Mover a… ${nombre}` })).toBeVisible();
    await contextoGerente.close();

    // Ejecutivo: ve la carpeta en Capacitación, la abre con el teclado y descarga el archivo.
    const contextoEjecutivo = await browser.newContext();
    const pagina = await contextoEjecutivo.newPage();
    await entrar(pagina, ejecutivo.correo, ejecutivo.contrasena);
    await pagina.goto("/biblioteca");
    const seccion = pagina.getByRole("region", { name: SECCION });
    const carpetaEjecutivo = grupo(pagina, carpeta);
    await expect(seccion.locator("summary", { hasText: carpeta })).toContainText("Número de elementos: 1");
    await expect(carpetaEjecutivo).not.toHaveAttribute("open", "");
    await carpetaEjecutivo.locator("summary").focus();
    await pagina.keyboard.press("Enter");
    const tarjeta = carpetaEjecutivo.getByRole("article").filter({ has: pagina.getByRole("heading", { name: nombre }) });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Gerente Sintético Carpetas");

    await expect(pagina.getByRole("button", { name: /^Nueva carpeta/ })).toHaveCount(0);
    await expect(pagina.getByRole("button", { name: /^Archivar carpeta/ })).toHaveCount(0);
    await expect(pagina.getByRole("button", { name: /^Mover a/ })).toHaveCount(0);
    await expect(pagina.getByRole("button", { name: "Subir archivo" })).toHaveCount(0);

    // La búsqueda encuentra el elemento dentro de la carpeta y abre el grupo.
    await carpetaEjecutivo.locator("summary").click();
    await pagina.getByLabel("Buscar por nombre").fill("GUIA EN CARPETA");
    await expect(tarjeta).toBeVisible();
    await pagina.getByLabel("Buscar por nombre").fill("");

    // Descarga: los mismos bytes.
    await carpetaEjecutivo.locator("summary").click();
    const [descarga] = await Promise.all([pagina.waitForEvent("download"), tarjeta.getByRole("link", { name: `Descargar ${nombre}` }).click()]);
    expect(descarga.suggestedFilename()).toBe(`${nombre}.pdf`);
    expect(Buffer.compare(await readFile((await descarga.path())!), PDF_SINTETICO)).toBe(0);
    await contextoEjecutivo.close();
  });
});
