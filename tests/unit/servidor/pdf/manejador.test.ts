import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf, TOPES, type EntradaPdf, type ModeloPdf } from "../../../../src/aplicacion/modelo";
import { error, type ResultadoApp } from "../../../../src/aplicacion/resultado";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import { cotizar } from "../../../../src/domain/interes/cotizar";
import type { SolicitudTasa } from "../../../../src/domain/tasas/resolver";
import { MENSAJE_HOST_NO_LOCAL } from "../../../../src/servidor/guardiaHost";
import type { ParametrosCotizacion } from "../../../../src/servidor/parametros";
import { manejarPdf, MENSAJES_PDF, type DependenciasPdf } from "../../../../src/servidor/pdf/manejador";
import { semillaReal } from "../../oro/ayudas";

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const parametros: ParametrosCotizacion = {
  semilla: semillaReal,
  razonesSociales: sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json")),
  textos: sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json")),
};

/** 1 de octubre de 2026, 12:00 en la Ciudad de México. */
const AHORA = new Date("2026-10-01T18:00:00Z");

const BYTES_FALSOS = new TextEncoder().encode("%PDF-espia");

/** Dependencias con un renderizador espía que guarda cada modelo recibido. */
function espia(leer: () => Promise<ResultadoApp<ParametrosCotizacion>> = async () => ({ ok: true, valor: parametros })) {
  const modelos: ModeloPdf[] = [];
  const deps: DependenciasPdf = {
    leer,
    renderizar: async (m) => {
      modelos.push(m);
      return BYTES_FALSOS;
    },
    ahora: () => AHORA,
  };
  return { deps, modelos };
}

const VALIDO = {
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "1,500,000",
  plazo: 12,
  confirmado: true,
  versionTasas: "0.5",
};

/** VALIDO sin una de sus claves. */
const sin = (clave: keyof typeof VALIDO) => Object.fromEntries(Object.entries(VALIDO).filter(([k]) => k !== clave));

const OPCIONALES: EntradaPdf = {
  preparadoPara: "Persona Sintética Uno",
  ejecutivo: "Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test",
  vigencia: "15 días naturales",
  notaAdicional: "Nota sintética de prueba.",
};

function peticion(cuerpo: unknown, encabezados: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/cotizador/pdf", {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json", ...encabezados },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

/** Lo que el modelo debe ser: modeloPdf(cotizar(...)) con la semilla y los textos reales. */
function esperado(solicitud: Partial<SolicitudTasa>, entrada: EntradaPdf = {}): ModeloPdf {
  const c = cotizar(semillaReal, {
    entidad: "CREDIFLEXI",
    moneda: "MXN",
    esquema: "mensual",
    monto: "1500000",
    plazo: 12,
    ...solicitud,
  });
  if (!c.ok) throw new Error(c.error.mensaje);
  const ctx = { razonesSociales: parametros.razonesSociales, textos: parametros.textos };
  return sinError(modeloPdf(c.valor, ctx, entrada, AHORA));
}

async function errorJson(r: Response): Promise<{ error: string; detalles?: string[] }> {
  expect(r.headers.get("content-type")).toBe("application/json; charset=utf-8");
  expect(r.headers.get("cache-control")).toBe("no-store");
  return (await r.json()) as { error: string; detalles?: string[] };
}

describe.each(["CREDIFLEXI", "RAMI_SISE"] as const)("manejarPdf: petición válida (%s)", (entidad) => {
  it.each(["mensual", "final_del_plazo"] as const)("esquema %s: el modelo es modeloPdf(cotizar(...))", async (esquema) => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, entidad, esquema, ...OPCIONALES }), deps);
    expect(r.status).toBe(200);
    expect(modelos).toHaveLength(1);
    expect(modelos[0]).toEqual(esperado({ entidad, esquema }, OPCIONALES));
  });

  it("responde el PDF con su tipo, sin caché y con el nombre de archivo por fecha", async () => {
    const { deps } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, entidad }), deps);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cotizacion-2026-10-01.pdf"');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(BYTES_FALSOS);
  });
});

describe("manejarPdf: lo que manda el navegador no se usa para calcular", () => {
  it("ignora una tasa, cifras y un pie inventados", async () => {
    const { deps, modelos } = espia();
    const falso = {
      ...VALIDO,
      tasa: "0.99",
      cifras: [{ clave: "rendimiento_mensual_pesos", etiqueta: "Pago mensual", cifra: "$999,999.99" }],
      salidas: [{ redondeado: "999999.99" }],
      cifraPrincipal: { cifra: "$999,999.99" },
      pie: { base: "Pie inventado por el navegador." },
      lineaTasas: "Tasas inventadas.",
      razonSocial: "Razón inventada",
    };
    const r = await manejarPdf(peticion(falso), deps);
    expect(r.status).toBe(200);
    expect(modelos[0]).toEqual(esperado({}));
    const texto = JSON.stringify(modelos[0]);
    expect(texto).not.toContain("99.00%");
    expect(texto).not.toContain("999,999.99");
    expect(texto).not.toContain("inventad");
    expect(modelos[0].tasa).toBe("19.00%");
  });

  it("la fecha sale del reloj del servidor", async () => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, fecha: "31/12/2099" }), {
      ...deps,
      ahora: () => new Date("2026-10-02T05:00:00Z"),
    });
    expect(r.status).toBe(200);
    expect(modelos[0].fecha).toBe("01/10/2026");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cotizacion-2026-10-01.pdf"');
  });
});

describe("manejarPdf: el nombre del archivo no lleva datos de personas", () => {
  it("con todos los opcionales, el nombre es solo la fecha", async () => {
    const { deps } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, ...OPCIONALES }), deps);
    const disposicion = r.headers.get("content-disposition") ?? "";
    expect(disposicion).toBe('attachment; filename="cotizacion-2026-10-01.pdf"');
    for (const dato of ["Persona", "Sintética", "Ejecutivo", "ejemplo.test", "CREDIFLEXI", "1500000", "1,500,000"]) {
      expect(disposicion).not.toContain(dato);
    }
  });
});

describe("manejarPdf: confirmación", () => {
  it.each([
    ["sin confirmado", sin("confirmado")],
    ["confirmado false", { ...VALIDO, confirmado: false }],
    ["confirmado como texto", { ...VALIDO, confirmado: "true" }],
  ])("%s da 422 y no genera el PDF", async (_, cuerpo) => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion(cuerpo), deps);
    expect(r.status).toBe(422);
    expect((await errorJson(r)).error).toBe(MENSAJES_PDF.sinConfirmar);
    expect(modelos).toHaveLength(0);
  });

  it("el mensaje de falta de confirmación dice qué hacer", () => {
    expect(MENSAJES_PDF.sinConfirmar).toMatch(/Confirmo que los números son correctos/);
  });
});

describe("manejarPdf: host y origen", () => {
  it.each([
    ["Host ajeno", { host: "ejemplo.com" }],
    ["Host ajeno con puerto", { host: "ejemplo.com:3000" }],
    ["Origin ajeno", { origin: "https://ejemplo.com" }],
    ["Origin local con otro puerto", { origin: "http://localhost:4000" }],
    ["Origin null", { origin: "null" }],
    ["Origin ilegible", { origin: "no es una url" }],
  ])("%s da 403 y no genera el PDF", async (_, encabezados) => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion(VALIDO, encabezados), deps);
    expect(r.status).toBe(403);
    const e = await errorJson(r);
    expect(e.error).toBe("host" in encabezados ? MENSAJE_HOST_NO_LOCAL : MENSAJES_PDF.origenAjeno);
    expect(modelos).toHaveLength(0);
  });

  it("sin Host da 403", async () => {
    const { deps } = espia();
    const r = await manejarPdf(
      new Request("http://localhost:3000/cotizador/pdf", { method: "POST", body: JSON.stringify(VALIDO) }),
      deps,
    );
    // El Request de Node no agrega Host por su cuenta.
    expect(r.status).toBe(403);
  });

  it.each(["http://localhost:3000", "http://LOCALHOST:3000"])("Origin %s, igual al Host, se acepta", async (origin) => {
    const { deps } = espia();
    const r = await manejarPdf(peticion(VALIDO, { origin }), deps);
    expect(r.status).toBe(200);
  });

  it("127.0.0.1 con su Origin se acepta", async () => {
    const { deps } = espia();
    const r = await manejarPdf(peticion(VALIDO, { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" }), deps);
    expect(r.status).toBe(200);
  });
});

describe("manejarPdf: forma del cuerpo", () => {
  it.each([
    ["cuerpo que no es JSON", "esto no es json"],
    ["arreglo", "[]"],
    ["falta la entidad", sin("entidad")],
    ["falta versionTasas", sin("versionTasas")],
    ["plazo como texto", { ...VALIDO, plazo: "12" }],
    ["plazo con decimales", { ...VALIDO, plazo: 12.5 }],
    ["monto como número", { ...VALIDO, monto: 1500000 }],
    ["moneda desconocida", { ...VALIDO, moneda: "EUR" }],
    ["esquema desconocido", { ...VALIDO, esquema: "semanal" }],
    ["preparadoPara como número", { ...VALIDO, preparadoPara: 5 }],
    ["preparadoPara sobre su tope", { ...VALIDO, preparadoPara: "p".repeat(TOPES.preparadoPara + 1) }],
    ["ejecutivo sobre su tope", { ...VALIDO, ejecutivo: "e".repeat(TOPES.ejecutivo + 1) }],
    ["vigencia sobre su tope", { ...VALIDO, vigencia: "v".repeat(TOPES.vigencia + 1) }],
    ["notaAdicional sobre su tope", { ...VALIDO, notaAdicional: "n".repeat(TOPES.notaAdicional + 1) }],
  ])("%s da 422", async (_, cuerpo) => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion(cuerpo), deps);
    expect(r.status).toBe(422);
    expect((await errorJson(r)).error).toBe(MENSAJES_PDF.formaInvalida);
    expect(modelos).toHaveLength(0);
  });

  it("los opcionales en su tope exacto se aceptan", async () => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(
      peticion({
        ...VALIDO,
        preparadoPara: "p".repeat(TOPES.preparadoPara),
        ejecutivo: "e".repeat(TOPES.ejecutivo),
        vigencia: "v".repeat(TOPES.vigencia),
        notaAdicional: "ñ".repeat(TOPES.notaAdicional),
      }),
      deps,
    );
    expect(r.status).toBe(200);
    expect(modelos[0].pie.notaAdicional).toBe("ñ".repeat(TOPES.notaAdicional));
  });

  it("un monto que no se puede leer da 422 con el mensaje de la app", async () => {
    const { deps } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, monto: "mil" }), deps);
    expect(r.status).toBe(422);
    expect((await errorJson(r)).error).toMatch(/monto/i);
  });
});

describe("manejarPdf: errores del dominio", () => {
  it("USD da 422 con el mensaje del dominio", async () => {
    const dominio = cotizar(semillaReal, { entidad: "CREDIFLEXI", moneda: "USD", esquema: "mensual", monto: "1500000", plazo: 12 });
    if (dominio.ok) throw new Error("Se esperaba que USD no cotizara");
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, moneda: "USD" }), deps);
    expect(r.status).toBe(422);
    expect((await errorJson(r)).error).toBe(dominio.error.mensaje);
    expect(modelos).toHaveLength(0);
  });

  it("36 meses da 422 con el mensaje del dominio", async () => {
    const dominio = cotizar(semillaReal, { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1500000", plazo: 36 });
    if (dominio.ok) throw new Error("Se esperaba que 36 meses no cotizara");
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, plazo: 36 }), deps);
    expect(r.status).toBe(422);
    expect((await errorJson(r)).error).toBe(dominio.error.mensaje);
    expect(modelos).toHaveLength(0);
  });

  it("una entidad desconocida da 422", async () => {
    const { deps } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, entidad: "OTRA" }), deps);
    expect(r.status).toBe(422);
  });
});

describe("manejarPdf: versión de las tasas", () => {
  it("si la versión no coincide con la vigente da 409 y no genera el PDF", async () => {
    const { deps, modelos } = espia();
    const r = await manejarPdf(peticion({ ...VALIDO, versionTasas: "0.4" }), deps);
    expect(r.status).toBe(409);
    expect((await errorJson(r)).error).toBe("Las tasas cambiaron desde tu vista previa; vuelve a revisarla.");
    expect(modelos).toHaveLength(0);
  });
});

describe("manejarPdf: fallas del servidor", () => {
  it("si no se pueden leer los parámetros da 500 con su mensaje", async () => {
    const { deps } = espia(async () => error("ARCHIVO_ILEGIBLE", "No se pudo leer el archivo seed/x.json: no existe."));
    const r = await manejarPdf(peticion(VALIDO), deps);
    expect(r.status).toBe(500);
    expect((await errorJson(r)).error).toBe("No se pudo leer el archivo seed/x.json: no existe.");
  });

  it("si el renderizador falla da 500 con un mensaje en español", async () => {
    const { deps } = espia();
    const r = await manejarPdf(peticion(VALIDO), {
      ...deps,
      renderizar: async () => {
        throw new Error("falla sintética");
      },
    });
    expect(r.status).toBe(500);
    const e = await errorJson(r);
    expect(e.error).toBe(MENSAJES_PDF.fallaRender);
    expect(e.error).not.toContain("falla sintética");
  });
});

describe("manejador y ruta: no registran nada", () => {
  it.each(["src/servidor/pdf/manejador.ts", "src/servidor/pdf/renderizar.ts", "src/app/cotizador/pdf/route.ts"])(
    "%s no escribe en la consola",
    (f) => {
      expect(readFileSync(path.join(process.cwd(), f), "utf8")).not.toMatch(/console\./);
    },
  );

  it("la ruta solo exporta POST y usa el manejador", () => {
    const codigo = readFileSync(path.join(process.cwd(), "src/app/cotizador/pdf/route.ts"), "utf8");
    expect(codigo).toMatch(/export async function POST/);
    expect(codigo).not.toMatch(/export (async )?function (GET|PUT|PATCH|DELETE)/);
    expect(codigo).toMatch(/manejarPdf/);
  });
});
