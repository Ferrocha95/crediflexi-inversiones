import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Fuera de Next no hay ruta actual ni acciones del servidor: el menú del Marco las necesita.
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), usePathname: () => "/" }));
vi.mock("../../../src/app/acceso/acciones", () => ({ cerrarSesion: async () => undefined }));

const { AvisoEntorno } = await import("../../../src/componentes/estructura/AvisoEntorno");
const { Marco } = await import("../../../src/componentes/estructura/Marco");
const { leerAvisoEntorno, RUTA_TEXTOS } = await import("../../../src/servidor/parametros");

const TEXTO = "ENTORNO DE PRUEBA: no captures datos reales de clientes";
// children va como tercer argumento de createElement (regla react/no-children-prop).
type PropsMarco = ComponentProps<typeof Marco>;
const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const USUARIO = { nombre: "Ejecutivo Sintético", rol: "EJECUTIVO", sucursal: "Sucursal Ficticia" } as const;

beforeEach(() => {
  vi.stubEnv("ENTORNO", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("leerAvisoEntorno", () => {
  it("sin ENTORNO (prueba por omisión) devuelve el texto del archivo de textos", async () => {
    expect(await leerAvisoEntorno()).toBe(TEXTO);
  });

  it('con ENTORNO="prueba" devuelve el texto', async () => {
    vi.stubEnv("ENTORNO", "prueba");
    expect(await leerAvisoEntorno()).toBe(TEXTO);
  });

  it('con ENTORNO="produccion" devuelve null: no sale la franja', async () => {
    vi.stubEnv("ENTORNO", "produccion");
    expect(await leerAvisoEntorno()).toBeNull();
  });

  it("si el archivo de textos no se puede leer, la franja muestra el error en vez de desaparecer", async () => {
    const r = await leerAvisoEntorno(path.join(path.dirname(RUTA_TEXTOS), "no-existe.json"));
    expect(r).not.toBeNull();
    expect(r).toMatch(/No se pudo leer el archivo/);
  });

  it("con ENTORNO desconocido también muestra un aviso (nunca la oculta)", async () => {
    vi.stubEnv("ENTORNO", "production");
    expect(await leerAvisoEntorno()).toMatch(/ENTORNO/);
  });
});

describe("AvisoEntorno", () => {
  it("con texto pinta una franja fija, arriba, con el texto y role=note", () => {
    const html = renderToStaticMarkup(createElement(AvisoEntorno, { texto: TEXTO }));
    expect(html).toContain(TEXTO);
    expect(html).toMatch(/role="note"/);
    expect(html).toMatch(/\bsticky\b/);
    expect(html).toMatch(/\btop-0\b/);
  });

  it("sin texto no pinta nada", () => {
    expect(renderToStaticMarkup(createElement(AvisoEntorno, { texto: null }))).toBe("");
  });
});

describe("Marco con y sin la franja", () => {
  it("con aviso la muestra antes del contenido", () => {
    const html = renderToStaticMarkup(createElement(Marco, { usuario: USUARIO, aviso: TEXTO } as PropsMarco, createElement("p", null, "marcador-del-contenido")));
    expect(html).toContain(TEXTO);
    expect(html.indexOf(TEXTO)).toBeLessThan(html.indexOf("marcador-del-contenido"));
  });

  it("con aviso null (producción) no la muestra", () => {
    const html = renderToStaticMarkup(createElement(Marco, { usuario: USUARIO, aviso: null } as PropsMarco, createElement("p", null, "marcador-del-contenido")));
    expect(html).not.toContain(TEXTO);
    expect(html).not.toMatch(/role="note"/);
  });
});

describe("quién muestra la franja", () => {
  it("el layout de (app) la lee y se la pasa al Marco", () => {
    const codigo = leer("src/app/(app)/layout.tsx");
    expect(codigo).toMatch(/await leerAvisoEntorno\(\)/);
    expect(codigo).toMatch(/<Marco [^>]*aviso=\{aviso\}/);
  });

  it("/acceso la lee y la pinta", () => {
    const codigo = leer("src/app/acceso/page.tsx");
    expect(codigo).toMatch(/await leerAvisoEntorno\(\)/);
    expect(codigo).toMatch(/<AvisoEntorno texto=\{avisoEntorno\} \/>/);
  });

  it("los PDF no cambian: nada de src/servidor/pdf usa el aviso del entorno", () => {
    const dir = path.join(process.cwd(), "src", "servidor", "pdf");
    const usan = readdirSync(dir)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /AvisoEntorno|leerAvisoEntorno|avisoEntornoPrueba|aviso_entorno_prueba/.test(readFileSync(path.join(dir, f), "utf8")));
    expect(usan).toEqual([]);
  });
});
