import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { correoUnico, crearUsuarioE2E, entrar } from "./usuarios";

// Biblioteca de punta a punta, con usuarios y bytes sintéticos: el gerente
// sube un PDF desde la pantalla y el ejecutivo de su organización lo ve y lo
// descarga, sin ver los botones de Director y Gerente.

test.use({ storageState: { cookies: [], origins: [] } });

const PDF_SINTETICO = Buffer.from("%PDF-1.4\n% Manual sintético E2E\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "utf8");

test.describe("biblioteca", () => {
  test("el gerente sube un PDF; el ejecutivo lo ve y lo descarga, y no ve Subir archivo", async ({ browser }) => {
    const gerente = await crearUsuarioE2E({ correo: correoUnico("gerente.biblioteca"), nombre: "Gerente Sintético Biblioteca", rol: "GERENTE" });
    const ejecutivo = await crearUsuarioE2E({
      correo: correoUnico("ejecutivo.biblioteca"),
      nombre: "Ejecutivo Sintético Biblioteca",
      rol: "EJECUTIVO",
      jefeId: gerente.usuarioId,
    });
    const nombre = `Manual sintético ${Date.now()}`;

    // Gerente: sube el PDF desde el diálogo.
    const contextoGerente = await browser.newContext();
    const paginaGerente = await contextoGerente.newPage();
    await entrar(paginaGerente, gerente.correo, gerente.contrasena);
    await paginaGerente.goto("/biblioteca");
    await expect(paginaGerente.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
    await paginaGerente.getByRole("button", { name: "Subir archivo" }).click();
    const dialogo = paginaGerente.getByRole("dialog", { name: "Subir archivo" });
    await expect(dialogo.getByText("No subas las cuentas bancarias de la empresa")).toBeVisible();
    await dialogo.getByLabel("Archivo").setInputFiles({ name: "manual.pdf", mimeType: "application/pdf", buffer: PDF_SINTETICO });
    await dialogo.getByLabel("Nombre").fill(nombre);
    await dialogo.getByLabel("Categoría").selectOption({ label: "Capacitación (manuales y guías)" });

    // Sin la casilla no se sube.
    await dialogo.getByRole("button", { name: "Subir", exact: true }).click();
    await expect(dialogo.getByText("Marca la casilla para confirmar")).toBeVisible();
    await dialogo.getByLabel("Confirmo que el archivo no contiene datos personales de clientes ni datos bancarios").check();
    await dialogo.getByRole("button", { name: "Subir", exact: true }).click();
    await expect(paginaGerente.getByText("Archivo subido")).toBeVisible({ timeout: 15_000 });
    const tarjetaGerente = paginaGerente.getByRole("article").filter({ has: paginaGerente.getByRole("heading", { name: nombre }) });
    await expect(tarjetaGerente).toContainText("Gerente Sintético Biblioteca");
    await expect(tarjetaGerente).toContainText("PDF");
    await expect(tarjetaGerente.getByRole("button", { name: `Archivar ${nombre}` })).toBeVisible();
    await contextoGerente.close();

    // Ejecutivo: lo ve en Capacitación, con quién lo subió, y no ve los botones de Director y Gerente.
    const contextoEjecutivo = await browser.newContext();
    const pagina = await contextoEjecutivo.newPage();
    await entrar(pagina, ejecutivo.correo, ejecutivo.contrasena);
    await pagina.goto("/biblioteca");
    const seccion = pagina.getByRole("region", { name: "Capacitación (manuales y guías)" });
    const tarjeta = seccion.getByRole("article").filter({ has: pagina.getByRole("heading", { name: nombre }) });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Gerente Sintético Biblioteca");
    await expect(pagina.getByRole("button", { name: "Subir archivo" })).toHaveCount(0);
    await expect(pagina.getByRole("button", { name: "Agregar enlace" })).toHaveCount(0);
    await expect(pagina.getByRole("button", { name: /^Archivar/ })).toHaveCount(0);
    await expect(pagina.getByRole("button", { name: "Ver archivados" })).toHaveCount(0);

    // La búsqueda no distingue mayúsculas ni acentos.
    await pagina.getByLabel("Buscar por nombre").fill("MANUAL SINTETICO");
    await expect(tarjeta).toBeVisible();
    await pagina.getByLabel("Buscar por nombre").fill("no existe nada así");
    await expect(pagina.getByText("Ningún elemento coincide con la búsqueda.")).toBeVisible();
    await pagina.getByLabel("Buscar por nombre").fill("");

    // Descarga: adjunto con el nombre del elemento y los mismos bytes.
    const [descarga] = await Promise.all([pagina.waitForEvent("download"), tarjeta.getByRole("link", { name: `Descargar ${nombre}` }).click()]);
    expect(descarga.suggestedFilename()).toBe(`${nombre}.pdf`);
    expect(Buffer.compare(await readFile((await descarga.path())!), PDF_SINTETICO)).toBe(0);

    // Encabezados de la descarga y de la vista en línea (?modo=ver).
    const href = await tarjeta.getByRole("link", { name: `Descargar ${nombre}` }).getAttribute("href");
    const adjunto = await pagina.request.get(href!);
    expect(adjunto.status()).toBe(200);
    expect(adjunto.headers()["content-disposition"]).toMatch(/^attachment; /);
    expect(adjunto.headers()["x-content-type-options"]).toBe("nosniff");
    expect(adjunto.headers()["cache-control"]).toBe("private, no-store");
    const enLinea = await pagina.request.get(`${href}?modo=ver`);
    expect(enLinea.headers()["content-disposition"]).toMatch(/^inline; /);
    expect(enLinea.headers()["content-type"]).toBe("application/pdf");
    for (const valor of Object.values(enLinea.headers())) expect(valor).not.toContain("token=");
    await contextoEjecutivo.close();
  });
});
