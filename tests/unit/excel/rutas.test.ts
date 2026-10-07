import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProspectoFila } from "../../../src/aplicacion/pipeline/filtros";

// Las dos rutas del Excel con dobles de la sesión y de las consultas. Lo que
// pasa por RLS de verdad se prueba en tests/rls y en las e2e.

const sesion = vi.hoisted(() => ({
  usuario: null as null | { id: string; nombre: string; rol: string },
}));
vi.mock("../../../src/servidor/sesion", () => ({ usuarioActual: async () => sesion.usuario }));
vi.mock("../../../src/servidor/supabase/servidor", () => ({ crearClienteServidor: async () => ({}) }));

const datos = vi.hoisted(() => ({
  prospectos: [] as ProspectoFila[],
  ejecutivos: [] as { id: string; nombre: string }[],
  llamadas: 0,
}));
vi.mock("../../../src/servidor/pipeline/consultas", () => ({
  listarProspectos: async () => {
    datos.llamadas += 1;
    return datos.prospectos;
  },
  ejecutivosVisibles: async () => datos.ejecutivos,
}));

import { MENSAJES_ARCHIVO, MENSAJES_EXCEL, TOPES_IMPORTACION } from "../../../src/aplicacion/excel/archivo";
import { GET } from "../../../src/app/(app)/pipeline/excel/route";
import { POST } from "../../../src/app/(app)/pipeline/importar/route";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";
import { leerLibro, libroSintetico, prospecto } from "./ayudas";

const EJECUTIVO = { id: "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e51", nombre: "Ejecutiva Sintética", rol: "EJECUTIVO" };
const GERENTE = { id: "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e52", nombre: "Gerente Sintético", rol: "GERENTE" };
const OTRO = { id: "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e53", nombre: "Ejecutivo Sintético Dos" };
const HOST = "127.0.0.1:3000";

beforeEach(() => {
  sesion.usuario = EJECUTIVO;
  datos.prospectos = [
    prospecto({ id: "1", ejecutivoId: EJECUTIVO.id, nombre: "Prospecto Sintético Propio" }),
    prospecto({ id: "2", ejecutivoId: OTRO.id, nombre: "Prospecto Sintético Ajeno" }),
  ];
  datos.ejecutivos = [GERENTE, EJECUTIVO, OTRO].map(({ id, nombre }) => ({ id, nombre }));
  datos.llamadas = 0;
});

const pedirExcel = (consulta = "", host = HOST) => GET(new Request(`http://${host}/pipeline/excel${consulta}`, { headers: { host } }));
const error = async (r: Response) => ((await r.json()) as { error: string }).error;

describe("GET /pipeline/excel", () => {
  it("con Host no local responde 403 sin leer nada", async () => {
    const r = await pedirExcel("", "crediflexi.example");
    expect(r.status).toBe(403);
    expect(await r.text()).toBe(MENSAJE_HOST_NO_LOCAL);
    expect(datos.llamadas).toBe(0);
  });

  it("sin usuario activo responde 401 con el mensaje de sesión expirada", async () => {
    sesion.usuario = null;
    const r = await pedirExcel();
    expect(r.status).toBe(401);
    expect(await error(r)).toBe(MENSAJE_SESION_EXPIRADA);
  });

  it("un ejecutivo descarga lo suyo: adjunto PIPELINE_{MES}.xlsx, sin caché, solo sus filas", async () => {
    const r = await pedirExcel("?semana=2026-10-01");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="PIPELINE_OCTUBRE.xlsx"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    const hoja = (await leerLibro(await r.arrayBuffer())).worksheets[0];
    expect(hoja.getCell("C2").value).toBe("EJECUTIVA SINTÉTICA");
    expect(hoja.getCell("D1").value).toBe("28 DE SEPTIEMBRE A 2 DE OCTUBRE 2026");
    expect(hoja.getCell("A4").value).toBe("PROSPECTO SINTÉTICO PROPIO");
    expect(hoja.getCell("A5").value).toBeNull();
  });

  it("un ejecutivo no puede pedir el pipeline de otro", async () => {
    const r = await pedirExcel(`?ejecutivo=${OTRO.id}`);
    expect(r.status).toBe(403);
    expect(await error(r)).toBe(MENSAJES_EXCEL.soloElPropio);
  });

  it("un superior debe elegir un ejecutivo", async () => {
    sesion.usuario = GERENTE;
    const r = await pedirExcel();
    expect(r.status).toBe(400);
    expect(await error(r)).toBe(MENSAJES_EXCEL.eligeEjecutivo);
  });

  it("un superior exporta un ejecutivo a la vez, con su nombre en C2", async () => {
    sesion.usuario = GERENTE;
    const r = await pedirExcel(`?ejecutivo=${OTRO.id}`);
    expect(r.status).toBe(200);
    const hoja = (await leerLibro(await r.arrayBuffer())).worksheets[0];
    expect(hoja.getCell("C2").value).toBe("EJECUTIVO SINTÉTICO DOS");
    expect(hoja.getCell("A4").value).toBe("PROSPECTO SINTÉTICO AJENO");
    expect(hoja.getCell("A5").value).toBeNull();
  });

  it("un ejecutivo que el superior no puede ver responde 404", async () => {
    sesion.usuario = GERENTE;
    const r = await pedirExcel("?ejecutivo=0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e59");
    expect(r.status).toBe(404);
    expect(await error(r)).toBe(MENSAJES_EXCEL.ejecutivoNoVisible);
  });
});

async function pedirImportacion(
  cuerpo: BodyInit | Uint8Array,
  opciones: { host?: string; origin?: string | null; contentLength?: string | null; nombre?: string } = {},
) {
  const host = opciones.host ?? HOST;
  const headers = new Headers({ host, "x-nombre-archivo": encodeURIComponent(opciones.nombre ?? "pipeline.xlsx") });
  const origin = opciones.origin === undefined ? `http://${host}` : opciones.origin;
  if (origin !== null) headers.set("origin", origin);
  if (opciones.contentLength !== undefined && opciones.contentLength !== null) headers.set("content-length", opciones.contentLength);
  return POST(new Request(`http://${host}/pipeline/importar`, { method: "POST", headers, body: cuerpo as BodyInit, duplex: "half" } as RequestInit));
}

/** Un cuerpo que llega como flujo: la petición no trae content-length. */
function flujo(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
}

describe("POST /pipeline/importar", () => {
  it("con Host no local responde 403", async () => {
    const r = await pedirImportacion(await libroSintetico([]), { host: "crediflexi.example" });
    expect(r.status).toBe(403);
  });

  it.each([
    ["sin Origin", null],
    ["con Origin de otro sitio", "http://otro.example"],
    ["con Origin de otro puerto", "http://127.0.0.1:4000"],
  ])("%s responde 403", async (_n, origin) => {
    const r = await pedirImportacion(await libroSintetico([]), { origin });
    expect(r.status).toBe(403);
    expect(await error(r)).toBe(MENSAJES_EXCEL.origenAjeno);
  });

  it("sin usuario activo responde 401", async () => {
    sesion.usuario = null;
    const r = await pedirImportacion(await libroSintetico([]));
    expect(r.status).toBe(401);
    expect(await error(r)).toBe(MENSAJE_SESION_EXPIRADA);
  });

  it("rechaza si content-length pasa de 5 MB, sin leer el cuerpo", async () => {
    const r = await pedirImportacion(flujo(new Uint8Array(10)), { contentLength: String(TOPES_IMPORTACION.bytes + 1) });
    expect(r.status).toBe(413);
    expect(await error(r)).toBe(MENSAJES_ARCHIVO.muyGrande);
  });

  it("rechaza si los bytes reales pasan de 5 MB aunque no haya content-length", async () => {
    const grande = new Uint8Array(TOPES_IMPORTACION.bytes + 1);
    grande.set([0x50, 0x4b, 0x03, 0x04]);
    const r = await pedirImportacion(flujo(grande), { contentLength: null });
    expect(r.status).toBe(413);
    expect(await error(r)).toBe(MENSAJES_ARCHIVO.muyGrande);
  });

  it("rechaza si content-length no coincide con los bytes leídos (el proxy recorta lo que pasa del límite)", async () => {
    const bytes = await libroSintetico([]);
    const r = await pedirImportacion(flujo(bytes), { contentLength: String(bytes.length + 100) });
    expect(r.status).toBe(400);
    expect(await error(r)).toBe(MENSAJES_EXCEL.incompleto);
  });

  it("un archivo válido responde la vista previa en JSON, sin caché", async () => {
    // Un teléfono que no está en los activos simulados (5512345678 sí está: daría aviso).
    const bytes = await libroSintetico([["Prospecto Sintético", "5599999999", "", "INTERESADO", "", ""]]);
    const r = await pedirImportacion(flujo(bytes), { contentLength: String(bytes.length) });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const cuerpo = (await r.json()) as { ok: boolean; filas: { estado: string }[] };
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.filas.map((f) => f.estado)).toEqual(["importable"]);
  });

  it("un archivo que no es .xlsx responde 422 con el motivo", async () => {
    const r = await pedirImportacion(new TextEncoder().encode("hola"), { nombre: "pipeline.csv" });
    expect(r.status).toBe(422);
    expect(await error(r)).toBe(MENSAJES_ARCHIVO.noXlsx);
  });
});
