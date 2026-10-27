import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Regla de B2: cada punto de entrada bajo src/app/(app) revisa al usuario por
// su cuenta. El layout no basta: según la guía de autenticación de Next
// (Partial Rendering), los layouts no se vuelven a ejecutar al navegar.

const RAIZ = path.join(process.cwd(), "src", "app", "(app)");
const relativo = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/");

const archivos = readdirSync(RAIZ, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && /\.(ts|tsx)$/.test(d.name))
  .map((d) => path.join(d.parentPath, d.name));

const leer = (f: string) => readFileSync(f, "utf8").replace(/\r/g, "");
const paginas = archivos.filter((f) => path.basename(f) === "page.tsx");
const rutas = archivos.filter((f) => path.basename(f) === "route.ts");
const acciones = archivos.filter((f) => /^["']use server["'];/.test(leer(f)));

/** Cuerpo de cada función exportada (de su declaración a la siguiente exportación). */
function funcionesExportadas(codigo: string): { nombre: string; cuerpo: string }[] {
  const partes = codigo.split(/^export\s+/m).slice(1);
  return partes
    .map((p) => ({ nombre: /^(?:async\s+)?function\s+(\w+)/.exec(p)?.[1], cuerpo: p }))
    .filter((p): p is { nombre: string; cuerpo: string } => p.nombre !== undefined);
}

describe("cada punto de entrada bajo src/app/(app) comprueba al usuario", () => {
  it("encuentra las páginas, rutas y acciones esperadas", () => {
    expect(paginas.map(relativo).sort()).toEqual([
      "src/app/(app)/biblioteca/page.tsx",
      "src/app/(app)/comisiones/page.tsx",
      "src/app/(app)/comisiones/reclutamiento/page.tsx",
      "src/app/(app)/cotizador/page.tsx",
      "src/app/(app)/diseno/page.tsx",
      "src/app/(app)/page.tsx",
      "src/app/(app)/pipeline/page.tsx",
    ]);
    expect(rutas.map(relativo).sort()).toEqual([
      "src/app/(app)/biblioteca/[id]/archivo/route.ts",
      "src/app/(app)/biblioteca/subir/route.ts",
      "src/app/(app)/comisiones/pdf/route.ts",
      "src/app/(app)/comisiones/reclutamiento/pdf/route.ts",
      "src/app/(app)/cotizador/pdf/route.ts",
      "src/app/(app)/pipeline/excel/route.ts",
      "src/app/(app)/pipeline/importar/route.ts",
    ]);
    expect(acciones.map(relativo).sort()).toEqual([
      "src/app/(app)/biblioteca/acciones.ts",
      "src/app/(app)/comisiones/acciones.ts",
      "src/app/(app)/comisiones/reclutamiento/acciones.ts",
      "src/app/(app)/cotizador/acciones.ts",
      "src/app/(app)/pipeline/acciones.ts",
    ]);
  });

  it.each(paginas.map(relativo))("%s llama a exigirUsuario()", (f) => {
    expect(leer(path.join(process.cwd(), f))).toMatch(/await exigirUsuario\(\)/);
  });

  it.each(rutas.map(relativo))("%s repite el guardia de host en cada método", (f) => {
    const funciones = funcionesExportadas(leer(path.join(process.cwd(), f)));
    for (const { nombre, cuerpo } of funciones) expect(cuerpo, nombre).toMatch(/rechazoPorHost\(/);
  });

  it.each(rutas.map(relativo))("%s llama a usuarioActual() en cada método", (f) => {
    const funciones = funcionesExportadas(leer(path.join(process.cwd(), f)));
    expect(funciones.length).toBeGreaterThan(0);
    for (const { nombre, cuerpo } of funciones) expect(cuerpo, nombre).toMatch(/await usuarioActual\(\)/);
  });

  it.each(acciones.map(relativo))("%s llama a usuarioActual() en cada acción", (f) => {
    const funciones = funcionesExportadas(leer(path.join(process.cwd(), f)));
    expect(funciones.length).toBeGreaterThan(0);
    for (const { nombre, cuerpo } of funciones) expect(cuerpo, nombre).toMatch(/await usuarioActual\(\)/);
  });

  it.each(acciones.map(relativo))("%s repite el guardia de host en cada acción", (f) => {
    const funciones = funcionesExportadas(leer(path.join(process.cwd(), f)));
    for (const { nombre, cuerpo } of funciones) expect(cuerpo, nombre).toMatch(/hostAutorizado\(/);
  });

  // esHostLocal solo conoce los hosts locales: usarlo directo en un punto de
  // entrada se saltaría HOSTS_PERMITIDOS. Todos pasan por src/servidor/guardiaHost.ts.
  it("ningún archivo de src fuera de aplicacion/host.ts usa esHostLocal ni esHostPermitido", () => {
    const SRC = path.join(process.cwd(), "src");
    const usan = readdirSync(SRC, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && /\.(ts|tsx)$/.test(d.name))
      .map((d) => path.join(d.parentPath, d.name))
      .filter((f) => !["src/aplicacion/host.ts", "src/servidor/guardiaHost.ts"].includes(relativo(f)))
      .filter((f) => /\besHost(Local|Permitido)\b/.test(leer(f)))
      .map(relativo);
    expect(usan).toEqual([]);
  });

  // Las 5 acciones de la Biblioteca (Sprint 7c suma las de carpetas): cada una
  // repite host y usuario activo (pruebas de arriba) y además el rol.
  it("src/app/(app)/biblioteca/acciones.ts exporta exactamente sus 5 acciones y cada una exige Director o Gerente", () => {
    const funciones = funcionesExportadas(leer(path.join(RAIZ, "biblioteca", "acciones.ts")));
    expect(funciones.map((f) => f.nombre).sort()).toEqual(["agregarEnlace", "archivar", "archivarCarpeta", "crearCarpeta", "moverElemento"]);
    for (const { nombre, cuerpo } of funciones) {
      const host = cuerpo.indexOf("hostAutorizado(");
      const usuario = cuerpo.indexOf("await usuarioActual()");
      const rol = cuerpo.indexOf("puedeAdministrar(");
      const cliente = cuerpo.indexOf("crearClienteServidor()");
      expect(rol, nombre).toBeGreaterThan(usuario);
      expect(usuario, nombre).toBeGreaterThan(host);
      expect(cliente, nombre).toBeGreaterThan(rol);
    }
  });

  // /biblioteca/subir pasa por el proxy desde el Sprint 8a, pero conserva sus guardias:
  // en este orden y todos antes de leer el cuerpo.
  it("src/app/(app)/biblioteca/subir/route.ts revisa host, Origin, sesión, rol, tipo y tamaño antes de leer el cuerpo", () => {
    const codigo = leer(path.join(RAIZ, "biblioteca", "subir", "route.ts"));
    const cuerpo = funcionesExportadas(codigo).find((f) => f.nombre === "POST")!.cuerpo;
    const orden = [
      "rechazoPorHost(",
      "origenCoincide(",
      "await usuarioActual()",
      "puedeAdministrar(",
      "esMultipart(",
      'headers.get("content-length")',
      "leerConTope(",
    ].map((marca) => ({ marca, en: cuerpo.indexOf(marca) }));
    for (const { marca, en } of orden) expect(en, marca).toBeGreaterThanOrEqual(0);
    expect(orden.map((o) => o.en)).toEqual([...orden.map((o) => o.en)].sort((a, b) => a - b));
    // Ninguna otra lectura del cuerpo antes del tope (ni después: solo leerConTope).
    expect(cuerpo).not.toMatch(/request\.(arrayBuffer|formData|text|json|blob)\(/);
  });

  it("ningún otro archivo de src/app/(app) queda fuera de la revisión por ser .js o .jsx", () => {
    const otros = readdirSync(RAIZ, { recursive: true, withFileTypes: true }).filter((d) => d.isFile() && /\.(js|jsx|mjs)$/.test(d.name));
    expect(otros).toEqual([]);
  });
});
