import { beforeEach, describe, expect, it, vi } from "vitest";

// POST /biblioteca/subir con dobles de la sesión y de las consultas. Lo que
// pasa por RLS y por el bucket de verdad se prueba en tests/rls y en las e2e.
// Bytes sintéticos.

const sesion = vi.hoisted(() => ({
  usuario: null as null | { id: string; nombre: string; rol: string },
}));
vi.mock("../../../src/servidor/sesion", () => ({ usuarioActual: async () => sesion.usuario }));
vi.mock("../../../src/servidor/supabase/servidor", () => ({ crearClienteServidor: async () => ({}) }));

const base = vi.hoisted(() => ({
  organizacion: "11111111-2222-4333-8444-555555555555" as string | null,
  subidas: [] as { ruta: string; bytes: number; mime: string }[],
  filas: [] as Record<string, unknown>[],
  errorSubir: null as string | null,
  errorInsertar: null as { code?: string; message: string } | null,
  carpetas: {} as Record<string, { categoria: string; archivada: boolean }>,
}));
vi.mock("../../../src/servidor/biblioteca/consultas", () => ({
  organizacionDelUsuario: async () => base.organizacion,
  subirObjeto: async (_c: unknown, ruta: string, bytes: Uint8Array, mime: string) => {
    base.subidas.push({ ruta, bytes: bytes.length, mime });
    return base.errorSubir;
  },
  insertarElemento: async (_c: unknown, fila: Record<string, unknown>) => {
    base.filas.push(fila);
    return base.errorInsertar === null ? { ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" } : { ok: false, error: base.errorInsertar };
  },
  leerCarpeta: async (_c: unknown, id: string) => base.carpetas[id] ?? null,
}));

import { MENSAJES_BIBLIOTECA, TOPE_BYTES, TOPE_CUERPO } from "../../../src/aplicacion/biblioteca/reglas";
import { POST } from "../../../src/app/(app)/biblioteca/subir/route";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";

const HOST = "127.0.0.1:3000";
const GERENTE = { id: "g-1", nombre: "Gerente Sintético", rol: "GERENTE" };
const DIRECTOR = { id: "d-1", nombre: "Director Sintético", rol: "DIRECTOR_REGIONAL" };
const EJECUTIVO = { id: "e-1", nombre: "Ejecutiva Sintética", rol: "EJECUTIVO" };
const RUTA_GENERADA = /^11111111-2222-4333-8444-555555555555\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|docx|png)$/;

const ascii = (t: string) => new TextEncoder().encode(t);
function pdf(largo = 64): Uint8Array {
  const b = new Uint8Array(largo).fill(0x20);
  b.set(ascii("%PDF-1.7\n"));
  return b;
}

beforeEach(() => {
  sesion.usuario = GERENTE;
  base.organizacion = "11111111-2222-4333-8444-555555555555";
  base.subidas = [];
  base.filas = [];
  base.errorSubir = null;
  base.errorInsertar = null;
  base.carpetas = {
    [CARPETA_CAPACITACION]: { categoria: "CAPACITACION", archivada: false },
    [CARPETA_EMPRESA]: { categoria: "EMPRESA", archivada: false },
    [CARPETA_ARCHIVADA]: { categoria: "CAPACITACION", archivada: true },
  };
});

const CARPETA_CAPACITACION = "1a1a1a1a-0000-4000-8000-000000000001";
const CARPETA_EMPRESA = "3c3c3c3c-0000-4000-8000-000000000003";
const CARPETA_ARCHIVADA = "4d4d4d4d-0000-4000-8000-000000000004";

interface Campos {
  archivo?: { bytes: Uint8Array; nombre: string; tipo?: string } | null;
  nombre?: string;
  descripcion?: string;
  categoria?: string;
  confirmacion?: string | null;
  carpeta?: string;
}

/** Cuerpo multipart real (lo arma undici) y su content-type con boundary. */
async function formulario(campos: Campos = {}): Promise<{ cuerpo: Uint8Array; tipo: string }> {
  const datos = new FormData();
  const archivo = campos.archivo === undefined ? { bytes: pdf(), nombre: "manual.pdf", tipo: "application/pdf" } : campos.archivo;
  if (archivo !== null) {
    datos.set("archivo", new File([archivo.bytes as BlobPart], archivo.nombre, { type: archivo.tipo ?? "application/octet-stream" }));
  }
  datos.set("nombre", campos.nombre ?? "Manual sintético de ventas");
  datos.set("descripcion", campos.descripcion ?? "Guía de prueba.");
  datos.set("categoria", campos.categoria ?? "CAPACITACION");
  if (campos.confirmacion !== null) datos.set("confirmacion", campos.confirmacion ?? "si");
  if (campos.carpeta !== undefined) datos.set("carpeta", campos.carpeta);
  const r = new Response(datos);
  return { cuerpo: new Uint8Array(await r.arrayBuffer()), tipo: r.headers.get("content-type")! };
}

/** Cuerpo en stream que cuenta cuántos bytes se le pidieron. */
function enStream(bytes: Uint8Array, trozo = 64 * 1024) {
  const estado = { leidos: 0 };
  let i = 0;
  // highWaterMark 0: el stream no pide nada por adelantado; solo cuenta lo que
  // la ruta lee de verdad.
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(control) {
        if (i >= bytes.length) {
          control.close();
          return;
        }
        const parte = bytes.subarray(i, Math.min(i + trozo, bytes.length));
        i += parte.length;
        estado.leidos += parte.length;
        control.enqueue(parte);
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, estado };
}

function peticion(
  cuerpo: Uint8Array | ReadableStream<Uint8Array>,
  opciones: { tipo?: string | null; host?: string; origin?: string | null; largo?: string | null } = {},
): Request {
  const host = opciones.host ?? HOST;
  const encabezados = new Headers({ host });
  const origin = opciones.origin === undefined ? `http://${host}` : opciones.origin;
  if (origin !== null) encabezados.set("origin", origin);
  if (opciones.tipo !== null) encabezados.set("content-type", opciones.tipo ?? "multipart/form-data; boundary=x");
  const largo = opciones.largo === undefined ? (cuerpo instanceof Uint8Array ? String(cuerpo.length) : null) : opciones.largo;
  if (largo !== null) encabezados.set("content-length", largo);
  return new Request(`http://${host}/biblioteca/subir`, {
    method: "POST",
    headers: encabezados,
    body: cuerpo as BodyInit,
    duplex: "half",
  } as RequestInit);
}

async function subir(campos: Campos = {}, opciones: Parameters<typeof peticion>[1] = {}) {
  const { cuerpo, tipo } = await formulario(campos);
  return POST(peticion(cuerpo, { tipo, ...opciones }));
}

const cuerpoDe = async (r: Response) => (await r.json()) as { ok?: boolean; id?: string; error?: string; errores?: Record<string, string> };

describe("POST /biblioteca/subir: guardias en orden y sin leer el cuerpo", () => {
  it("1. con Host no local responde 403 sin leer el cuerpo", async () => {
    const { stream, estado } = enStream(pdf(1000));
    const r = await POST(peticion(stream, { host: "crediflexi.example" }));
    expect(r.status).toBe(403);
    expect(await r.text()).toBe(MENSAJE_HOST_NO_LOCAL);
    expect(estado.leidos).toBe(0);
  });

  it("2. sin Origin, o con un Origin de otro sitio, responde 403 sin leer el cuerpo", async () => {
    for (const origin of [null, "http://otro.example", "no es url"]) {
      const { stream, estado } = enStream(pdf(1000));
      const r = await POST(peticion(stream, { origin }));
      expect(r.status).toBe(403);
      expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.origenAjeno);
      expect(estado.leidos).toBe(0);
    }
  });

  it("3. sin usuario activo responde 401 en JSON con el mensaje de sesión expirada, sin leer el cuerpo", async () => {
    sesion.usuario = null;
    const { stream, estado } = enStream(pdf(1000));
    const r = await POST(peticion(stream));
    expect(r.status).toBe(401);
    expect(r.headers.get("content-type")).toMatch(/^application\/json/);
    expect((await cuerpoDe(r)).error).toBe(MENSAJE_SESION_EXPIRADA);
    expect(estado.leidos).toBe(0);
  });

  it("4. un ejecutivo recibe 403 sin leer el cuerpo", async () => {
    sesion.usuario = EJECUTIVO;
    const { stream, estado } = enStream(pdf(1000));
    const r = await POST(peticion(stream));
    expect(r.status).toBe(403);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.soloDirectorOGerente);
    expect(estado.leidos).toBe(0);
    expect(base.subidas).toEqual([]);
  });

  it("5. un cuerpo que no es multipart/form-data responde 415 sin leerlo", async () => {
    for (const tipo of [null, "application/pdf", "application/octet-stream", "multipart/form-data", "text/plain; boundary=x"]) {
      const { stream, estado } = enStream(pdf(1000));
      const r = await POST(peticion(stream, { tipo }));
      expect(r.status, String(tipo)).toBe(415);
      expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.noEsFormulario);
      expect(estado.leidos).toBe(0);
    }
  });

  it("6. un content-length mayor al tope del cuerpo responde 413 sin leerlo", async () => {
    const { stream, estado } = enStream(pdf(1000));
    const r = await POST(peticion(stream, { largo: String(TOPE_CUERPO + 1) }));
    expect(r.status).toBe(413);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.muyGrande);
    expect(estado.leidos).toBe(0);
  });

  it("6. un content-length que no es un número responde 400 sin leerlo", async () => {
    const { stream, estado } = enStream(pdf(1000));
    const r = await POST(peticion(stream, { largo: "-5" }));
    expect(r.status).toBe(400);
    expect(estado.leidos).toBe(0);
  });

  it("7. sin content-length, la lectura corta al pasar el tope y responde 413", async () => {
    const { stream, estado } = enStream(new Uint8Array(TOPE_CUERPO + 5 * 1024 * 1024), 64 * 1024);
    const r = await POST(peticion(stream, { largo: null }));
    expect(r.status).toBe(413);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.muyGrande);
    // Dejó de pedir bytes en cuanto pasó el tope (a lo más un trozo después).
    expect(estado.leidos).toBeGreaterThan(TOPE_CUERPO);
    expect(estado.leidos).toBeLessThanOrEqual(TOPE_CUERPO + 64 * 1024);
    expect(base.subidas).toEqual([]);
  });

  it("7. si el content-length dice menos de lo que llega, corta y no guarda nada", async () => {
    const { cuerpo, tipo } = await formulario();
    const { stream } = enStream(cuerpo);
    const r = await POST(peticion(stream, { tipo, largo: String(cuerpo.length - 10) }));
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.incompleto);
    expect(base.subidas).toEqual([]);
  });

  it("7. si el content-length dice más de lo que llega (cuerpo recortado), responde 400 y no guarda nada", async () => {
    const { cuerpo, tipo } = await formulario();
    const { stream } = enStream(cuerpo);
    const r = await POST(peticion(stream, { tipo, largo: String(cuerpo.length + 10) }));
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.incompleto);
    expect(base.subidas).toEqual([]);
  });

  it("el tope del cuerpo es el del archivo más un margen para los campos del formulario", () => {
    expect(TOPE_BYTES).toBe(26_214_400);
    expect(TOPE_CUERPO).toBe(TOPE_BYTES + 64 * 1024);
  });
});

describe("POST /biblioteca/subir: validación del archivo y del formulario", () => {
  it("sin la casilla de confirmación responde 400 y no guarda nada", async () => {
    for (const confirmacion of [null, "no", ""]) {
      const r = await subir({ confirmacion });
      expect(r.status).toBe(400);
      expect((await cuerpoDe(r)).errores?.confirmacion).toBe(MENSAJES_BIBLIOTECA.sinConfirmacion);
    }
    expect(base.subidas).toEqual([]);
  });

  it("sin archivo responde 400", async () => {
    const r = await subir({ archivo: null });
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).errores?.archivo).toBe(MENSAJES_BIBLIOTECA.sinArchivo);
  });

  it("un tipo bloqueado (.html) responde 400 sin subir nada", async () => {
    const r = await subir({ archivo: { bytes: ascii("<p>hola</p>"), nombre: "pagina.html", tipo: "text/html" } });
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).errores?.archivo).toMatch(/\.html/);
    expect(base.subidas).toEqual([]);
  });

  it("un ejecutable llamado .pdf (firma falsa) responde 400 aunque el navegador diga application/pdf", async () => {
    const bytes = new Uint8Array(64);
    bytes.set(ascii("MZ"));
    const r = await subir({ archivo: { bytes, nombre: "manual.pdf", tipo: "application/pdf" } });
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).errores?.archivo).toBe(MENSAJES_BIBLIOTECA.firmaNoCoincide("pdf"));
    expect(base.subidas).toEqual([]);
  });

  it("26,214,401 bytes reales responden 413 sin subir nada", async () => {
    const r = await subir({ archivo: { bytes: pdf(TOPE_BYTES + 1), nombre: "grande.pdf" } });
    expect(r.status).toBe(413);
    expect((await cuerpoDe(r)).errores?.archivo).toBe(MENSAJES_BIBLIOTECA.muyGrande);
    expect(base.subidas).toEqual([]);
  });

  it("dato sensible en el nombre o en la descripción responde 400 sin subir nada", async () => {
    const r1 = await subir({ nombre: "Cuenta 012180001234567891" });
    expect(r1.status).toBe(400);
    expect((await cuerpoDe(r1)).errores?.nombre).toMatch(/CLABE/);
    const r2 = await subir({ descripcion: "RFC GODE561231GR8" });
    expect(r2.status).toBe(400);
    expect((await cuerpoDe(r2)).errores?.descripcion).toBeDefined();
    expect(base.subidas).toEqual([]);
  });

  it("un .docx con macros responde 400 sin subir nada", async () => {
    const { armarZip } = await import("../excel/zipManual");
    const docx = armarZip([
      { nombre: "[Content_Types].xml", contenido: ascii("<Types/>") },
      { nombre: "word/document.xml", contenido: ascii("<d/>") },
      { nombre: "word/vbaProject.bin", contenido: ascii("macro") },
    ]);
    const r = await subir({ archivo: { bytes: docx, nombre: "guia.docx" } });
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).errores?.archivo).toBe(MENSAJES_BIBLIOTECA.officeConMacros);
    expect(base.subidas).toEqual([]);
  });
});

describe("POST /biblioteca/subir: guardar", () => {
  it("el gerente sube 26,214,400 bytes: 201, ruta generada con uuid y tipo detectado, no el del navegador", async () => {
    const r = await subir({ archivo: { bytes: pdf(TOPE_BYTES), nombre: "manual.pdf", tipo: "text/html" } });
    expect(r.status).toBe(201);
    expect(await cuerpoDe(r)).toEqual({ ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    expect(base.subidas).toHaveLength(1);
    expect(base.subidas[0].ruta).toMatch(RUTA_GENERADA);
    expect(base.subidas[0].bytes).toBe(TOPE_BYTES);
    expect(base.subidas[0].mime).toBe("application/pdf");
    expect(base.filas).toEqual([
      {
        categoria: "CAPACITACION",
        nombre: "Manual sintético de ventas",
        descripcion: "Guía de prueba.",
        tipo: "ARCHIVO",
        ruta: base.subidas[0].ruta,
        tipo_mime: "application/pdf",
        tamano_bytes: TOPE_BYTES,
      },
    ]);
  });

  it("el director también sube", async () => {
    sesion.usuario = DIRECTOR;
    const r = await subir();
    expect(r.status).toBe(201);
  });

  it("la fila nunca lleva organizacion_id ni subido_por (los pone la base)", async () => {
    await subir();
    expect(Object.keys(base.filas[0])).not.toContain("organizacion_id");
    expect(Object.keys(base.filas[0])).not.toContain("subido_por");
  });

  it("el nombre original con carpetas e invisibles no llega a la ruta; sin nombre, se usa el original limpio", async () => {
    const r = await subir({ archivo: { bytes: pdf(), nombre: "..\\..\\carpeta/Guía\u200B de ventas.PDF" }, nombre: "" });
    expect(r.status).toBe(201);
    expect(base.subidas[0].ruta).toMatch(RUTA_GENERADA);
    expect(base.filas[0].nombre).toBe("Guía de ventas");
  });

  it("dos subidas del mismo archivo generan rutas distintas", async () => {
    await subir();
    await subir();
    expect(base.subidas[0].ruta).not.toBe(base.subidas[1].ruta);
  });

  it("sin organización (no debería pasar con un usuario activo) responde 500 sin subir", async () => {
    base.organizacion = null;
    const r = await subir();
    expect(r.status).toBe(500);
    expect(base.subidas).toEqual([]);
  });

  it("si el almacenamiento falla responde 500 con un mensaje claro y no inserta la fila", async () => {
    base.errorSubir = "falló";
    const r = await subir();
    expect(r.status).toBe(500);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.fallaAlmacenamiento);
    expect(base.filas).toEqual([]);
  });

  it("si la base rechaza la fila por dato sensible, el mensaje lo dice", async () => {
    base.errorInsertar = { code: "23514", message: 'new row violates check constraint "biblioteca_sin_datos_sensibles"' };
    const r = await subir();
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.datoSensibleBase);
  });

  it("si la base rechaza la fila por permisos, responde 403", async () => {
    base.errorInsertar = { code: "42501", message: "new row violates row-level security policy" };
    const r = await subir();
    expect(r.status).toBe(403);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.soloDirectorOGerente);
  });

  it("las respuestas no se guardan en caché", async () => {
    const r = await subir();
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /biblioteca/subir: carpeta opcional", () => {
  it("sin carpeta, o con el campo vacío, el archivo queda Sin carpeta", async () => {
    expect((await subir()).status).toBe(201);
    expect((await subir({ carpeta: "" })).status).toBe(201);
    expect(base.filas.map((f) => f.carpeta_id ?? null)).toEqual([null, null]);
  });

  it("con una carpeta activa de la misma sección, la fila lleva carpeta_id", async () => {
    const r = await subir({ carpeta: CARPETA_CAPACITACION });
    expect(r.status).toBe(201);
    expect(base.filas[0]).toMatchObject({ carpeta_id: CARPETA_CAPACITACION, categoria: "CAPACITACION" });
  });

  it.each([
    ["que no es uuid", "carpeta"],
    ["de otra sección", CARPETA_EMPRESA],
    ["que no existe o no es visible", "9f9f9f9f-0000-4000-8000-00000000009f"],
  ])("una carpeta %s responde 400 sin subir el archivo ni insertar", async (_n, carpeta) => {
    const r = await subir({ carpeta });
    expect(r.status).toBe(400);
    const cuerpo = await cuerpoDe(r);
    expect(cuerpo.error).toBe(MENSAJES_BIBLIOTECA.carpetaInvalida);
    expect(cuerpo.errores?.carpeta).toBe(MENSAJES_BIBLIOTECA.carpetaInvalida);
    expect(base.subidas).toEqual([]);
    expect(base.filas).toEqual([]);
  });

  it("una carpeta archivada responde 400 sin subir el archivo ni insertar", async () => {
    const r = await subir({ carpeta: CARPETA_ARCHIVADA });
    expect(r.status).toBe(400);
    expect((await cuerpoDe(r)).error).toBe(MENSAJES_BIBLIOTECA.carpetaArchivada);
    expect(base.subidas).toEqual([]);
    expect(base.filas).toEqual([]);
  });
});
