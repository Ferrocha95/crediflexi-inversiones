import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /biblioteca/[id]/archivo con dobles de la sesión, de las consultas y de
// fetch. La URL firmada se crea en el servidor y nunca llega al navegador: la
// ruta reenvía los bytes en stream con sus propios encabezados.

const sesion = vi.hoisted(() => ({
  usuario: null as null | { id: string; nombre: string; rol: string },
}));
vi.mock("../../../src/servidor/sesion", () => ({ usuarioActual: async () => sesion.usuario }));
vi.mock("../../../src/servidor/supabase/servidor", () => ({ crearClienteServidor: async () => ({}) }));

const FIRMADA = "http://127.0.0.1:54321/storage/v1/object/sign/biblioteca/ruta.pdf?token=firma-sintetica";

const base = vi.hoisted(() => ({
  elemento: null as null | { nombre: string; tipo: string; ruta: string | null; tipo_mime: string | null },
  errorLeer: false,
  firmadas: [] as string[],
  firma: "" as string | null,
}));
vi.mock("../../../src/servidor/biblioteca/consultas", () => ({
  leerElemento: async () => {
    if (base.errorLeer) throw new Error("falla sintética");
    return base.elemento;
  },
  firmarDescarga: async (_c: unknown, ruta: string) => {
    base.firmadas.push(ruta);
    return base.firma;
  },
}));

import { MENSAJES_BIBLIOTECA } from "../../../src/aplicacion/biblioteca/reglas";
import { GET } from "../../../src/app/(app)/biblioteca/[id]/archivo/route";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_AUTORIZADO } from "../../../src/servidor/guardiaHost";

const HOST = "127.0.0.1:3000";
const ID = "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f";
const ORG = "11111111-2222-4333-8444-555555555555";
const EJECUTIVO = { id: "e-1", nombre: "Ejecutiva Sintética", rol: "EJECUTIVO" };

const llamadasFetch: { url: string; encabezados: Headers }[] = [];
let respuestaFetch: () => Response;

beforeEach(() => {
  sesion.usuario = EJECUTIVO;
  base.elemento = { nombre: "Manual de ventas", tipo: "ARCHIVO", ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf`, tipo_mime: "application/pdf" };
  base.errorLeer = false;
  base.firmadas = [];
  base.firma = FIRMADA;
  llamadasFetch.length = 0;
  respuestaFetch = () =>
    new Response(new TextEncoder().encode("%PDF-1.7 sintético"), {
      status: 200,
      headers: { "content-type": "text/html", "content-length": "18", "accept-ranges": "bytes", "x-sintetico": "no-pasar" },
    });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    llamadasFetch.push({ url: String(url), encabezados: new Headers(init?.headers) });
    return respuestaFetch();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function pedir(opciones: { id?: string; consulta?: string; host?: string; range?: string } = {}) {
  const host = opciones.host ?? HOST;
  const id = opciones.id ?? ID;
  const encabezados = new Headers({ host });
  if (opciones.range) encabezados.set("range", opciones.range);
  return GET(new Request(`http://${host}/biblioteca/${id}/archivo${opciones.consulta ?? ""}`, { headers: encabezados }), {
    params: Promise.resolve({ id }),
  });
}

const mismoElemento = (cambios: Partial<NonNullable<typeof base.elemento>>) => {
  base.elemento = { ...base.elemento!, ...cambios };
};

describe("GET /biblioteca/[id]/archivo: guardias", () => {
  it("con Host no local responde 403 sin leer nada", async () => {
    const r = await pedir({ host: "crediflexi.example" });
    expect(r.status).toBe(403);
    expect(await r.text()).toBe(MENSAJE_HOST_NO_AUTORIZADO);
    expect(base.firmadas).toEqual([]);
  });

  it("sin usuario activo responde 401 en JSON con el mensaje de sesión expirada", async () => {
    sesion.usuario = null;
    const r = await pedir();
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe(MENSAJE_SESION_EXPIRADA);
    expect(base.firmadas).toEqual([]);
  });

  it("un id que no es uuid responde 404 sin consultar", async () => {
    const r = await pedir({ id: "../../otra" });
    expect(r.status).toBe(404);
    expect(base.firmadas).toEqual([]);
  });

  it("si RLS no devuelve la fila (otra organización, archivado para un ejecutivo) responde 404", async () => {
    base.elemento = null;
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: string }).error).toBe(MENSAJES_BIBLIOTECA.noEncontrado);
    expect(base.firmadas).toEqual([]);
  });

  it("un enlace no tiene archivo: 404", async () => {
    mismoElemento({ tipo: "ENLACE", ruta: null, tipo_mime: null });
    expect((await pedir()).status).toBe(404);
  });

  it("si la lectura falla responde 500 con un mensaje claro", async () => {
    base.errorLeer = true;
    const r = await pedir();
    expect(r.status).toBe(500);
    expect(((await r.json()) as { error: string }).error).toBe(MENSAJES_BIBLIOTECA.fallaLectura);
  });

  it("si no se puede firmar o el almacenamiento no lo tiene, responde 404 sin exponer la URL", async () => {
    base.firma = null;
    expect((await pedir()).status).toBe(404);
    base.firma = FIRMADA;
    respuestaFetch = () => new Response("no existe", { status: 400 });
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("token");
  });
});

describe("GET /biblioteca/[id]/archivo: descarga", () => {
  it("firma en el servidor la ruta de la fila y reenvía los bytes en stream", async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(base.firmadas).toEqual([base.elemento!.ruta]);
    expect(llamadasFetch.map((l) => l.url)).toEqual([FIRMADA]);
    expect(r.body).toBeInstanceOf(ReadableStream);
    expect(await r.text()).toBe("%PDF-1.7 sintético");
  });

  it("la URL firmada no aparece en ningún encabezado de la respuesta", async () => {
    const r = await pedir();
    for (const [, valor] of r.headers) expect(valor).not.toContain("token");
    expect(r.headers.get("location")).toBeNull();
  });

  it("por omisión es adjunto, con el tipo exacto de la fila, nosniff y sin caché", async () => {
    const r = await pedir();
    expect(r.headers.get("content-disposition")).toBe(
      `attachment; filename="Manual de ventas.pdf"; filename*=UTF-8''Manual%20de%20ventas.pdf`,
    );
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("content-length")).toBe("18");
    expect(r.headers.get("x-sintetico")).toBeNull();
  });

  it("los acentos van en filename* y el nombre simple no lleva comillas, diagonales ni acentos", async () => {
    mismoElemento({ nombre: 'Guía "rápida" a/b\\c' });
    const r = await pedir();
    expect(r.headers.get("content-disposition")).toBe(
      `attachment; filename="Gu_a _r_pida_ a_b_c.pdf"; filename*=UTF-8''Gu%C3%ADa%20%22r%C3%A1pida%22%20a%2Fb%5Cc.pdf`,
    );
  });

  it.each([
    ["application/pdf", "pdf"],
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["video/mp4", "mp4"],
    ["video/webm", "webm"],
  ])("con ?modo=ver, %s se muestra en línea", async (mime, ext) => {
    mismoElemento({ tipo_mime: mime, ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.${ext}` });
    const r = await pedir({ consulta: "?modo=ver" });
    expect(r.headers.get("content-disposition")).toMatch(/^inline; /);
    expect(r.headers.get("content-type")).toBe(mime);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it.each([
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
    ["text/plain", "txt"],
    ["text/csv", "csv"],
  ])("con ?modo=ver, %s sigue como adjunto", async (mime, ext) => {
    mismoElemento({ tipo_mime: mime, ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.${ext}` });
    const r = await pedir({ consulta: "?modo=ver" });
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; /);
  });

  it("las imágenes y los videos en línea van con CSP sandbox", async () => {
    mismoElemento({ tipo_mime: "image/png", ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png` });
    const r = await pedir({ consulta: "?modo=ver" });
    expect(r.headers.get("content-security-policy")).toMatch(/^sandbox;/);
    expect(r.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  // Verificado el 15/10/2026 con Chromium de Playwright, Edge y Chrome: el
  // visor de PDF abre bien con esta política, así que el PDF no se exceptúa.
  it("un PDF en línea también va con CSP sandbox, nosniff y el tipo exacto", async () => {
    const r = await pedir({ consulta: "?modo=ver" });
    expect(r.headers.get("content-disposition")).toMatch(/^inline; /);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toMatch(/^sandbox;/);
  });

  it("los adjuntos también van con CSP sandbox", async () => {
    const r = await pedir();
    expect(r.headers.get("content-security-policy")).toMatch(/^sandbox;/);
  });

  it("reenvía un Range simple (video) y devuelve 206 con Content-Range", async () => {
    mismoElemento({ tipo_mime: "video/mp4", ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4` });
    respuestaFetch = () =>
      new Response(new Uint8Array(100), {
        status: 206,
        headers: { "content-range": "bytes 0-99/5000", "content-length": "100", "accept-ranges": "bytes" },
      });
    const r = await pedir({ consulta: "?modo=ver", range: "bytes=0-99" });
    expect(llamadasFetch[0].encabezados.get("range")).toBe("bytes=0-99");
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 0-99/5000");
    expect(r.headers.get("accept-ranges")).toBe("bytes");
    expect(r.headers.get("content-type")).toBe("video/mp4");
  });

  it("un Range con varios tramos o mal formado no se reenvía", async () => {
    for (const range of ["bytes=0-1,5-9", "bytes=abc", "items=0-5"]) {
      llamadasFetch.length = 0;
      await pedir({ range });
      expect(llamadasFetch[0].encabezados.get("range")).toBeNull();
    }
  });

  it("un Range fuera del archivo responde 416", async () => {
    respuestaFetch = () => new Response(null, { status: 416, headers: { "content-range": "bytes */18" } });
    const r = await pedir({ range: "bytes=999-" });
    expect(r.status).toBe(416);
  });
});
