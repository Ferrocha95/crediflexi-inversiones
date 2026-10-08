import { beforeEach, describe, expect, it, vi } from "vitest";

// La acción lee el encabezado Host con headers() de next/headers; aquí se simula.
const encabezados = vi.hoisted(() => ({ host: "localhost:3000" as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(encabezados.host === null ? {} : { host: encabezados.host }),
}));

const sesion = vi.hoisted(() => ({ activo: true, llamadas: 0 }));
vi.mock("../../../src/servidor/sesion", () => ({
  usuarioActual: async () => {
    sesion.llamadas += 1;
    return sesion.activo ? { id: "u-1", nombre: "Ejecutivo Sintético", rol: "EJECUTIVO" } : null;
  },
}));

import textosJson from "../../../seed/textos_cotizacion.json";
import { simularReclutamiento } from "../../../src/app/(app)/comisiones/reclutamiento/acciones";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";
import { leerParametrosReclutamiento } from "../../../src/servidor/parametros";
import { manejarPdfReclutamiento, MENSAJES_PDF_RECLUTAMIENTO } from "../../../src/servidor/pdf/manejadorReclutamiento";
import { renderizarReclutamiento } from "../../../src/servidor/pdf/renderizar";
import { MENSAJE_FORMA_RECLUTAMIENTO, type RespuestaReclutamiento } from "../../../src/servidor/reclutamiento";
import { extraerTexto, imagenesPorPagina } from "../servidor/pdf/extraer";

const ESCENARIOS = textosJson.reclutamiento.escenarios_ejemplo;
const base = { peticion: 4, presenta: "Persona Sintética Uno", escenarios: ESCENARIOS };
const AHORA = new Date("2026-10-08T12:00:00-06:00");
const TIEMPO = 60_000;

const AVISO_EXACTO =
  "Ejemplo calculado con las tablas vigentes al 7 de octubre de 2026. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos.";

/** Lenguaje de promesa. "garantía" y "oferta" solo valen dentro del aviso exacto, que se quita antes de revisar. */
const RE_PROHIBIDO_RECLUTAMIENTO =
  /(?<![\p{L}\p{N}])(garant\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|recibes|promesa|oferta)(?![\p{L}\p{N}])/iu;

function modelo(r: RespuestaReclutamiento) {
  if (r.resultado.tipo !== "modelo") throw new Error(`Se esperaba el modelo: ${JSON.stringify(r.resultado)}`);
  return r.resultado.modelo;
}

function error(r: RespuestaReclutamiento) {
  if (r.resultado.tipo !== "error") throw new Error(`Se esperaba un error: ${JSON.stringify(r.resultado)}`);
  return r.resultado;
}

beforeEach(() => {
  encabezados.host = "localhost:3000";
  sesion.activo = true;
  sesion.llamadas = 0;
});

describe("acción simularReclutamiento", () => {
  it("calcula los tres escenarios de ejemplo con la semilla y los textos reales", async () => {
    const m = modelo(await simularReclutamiento(base));
    expect(m.escenarios.map((e) => e.total)).toEqual(["$7,920.00", "$15,930.00", "$45,420.00"]);
  });

  it("sin usuario activo responde el aviso de sesión expirada", async () => {
    sesion.activo = false;
    expect(error(await simularReclutamiento(base)).mensaje).toBe(MENSAJE_SESION_EXPIRADA);
  });

  it("con Host no local responde el mensaje del guardia sin leer la sesión", async () => {
    encabezados.host = "crediflexi.example.com";
    expect(error(await simularReclutamiento(base)).mensaje).toBe(MENSAJE_HOST_NO_LOCAL);
    expect(sesion.llamadas).toBe(0);
  });

  it.each([
    ["dos escenarios", { escenarios: ESCENARIOS.slice(0, 2) }],
    ["clave de más", { extra: true }],
    ["presenta demasiado largo", { presenta: "P".repeat(201) }],
    ["monto que no es texto", { escenarios: [{ nombre: "A", montos: { "12": 300000 } }, ...ESCENARIOS.slice(1)] }],
  ])("forma inválida (%s)", async (_, cambio) => {
    expect(error(await simularReclutamiento({ ...base, ...cambio })).mensaje).toBe(MENSAJE_FORMA_RECLUTAMIENTO);
  });
});

/** PDF real con los ejemplos (o los escenarios dados). */
async function pdf(cambio: Record<string, unknown> = {}) {
  const r = await manejarPdfReclutamiento(
    new Request("http://localhost:3000/comisiones/reclutamiento/pdf", {
      method: "POST",
      headers: { host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ presenta: base.presenta, escenarios: ESCENARIOS, ...cambio }),
    }),
    { leer: () => leerParametrosReclutamiento(), renderizar: renderizarReclutamiento, ahora: () => AHORA },
  );
  return r;
}

describe("PDF de reclutamiento (manejador)", () => {
  it("responde un PDF con nombre de archivo sin datos de personas", { timeout: TIEMPO }, async () => {
    const r = await pdf();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="propuesta-de-ingresos-2026-10-08.pdf"');
  });

  it("Host no local: 403 con el mensaje del guardia", async () => {
    const r = await manejarPdfReclutamiento(
      new Request("http://x/comisiones/reclutamiento/pdf", { method: "POST", headers: { host: "crediflexi.example.com" }, body: "{}" }),
      { leer: () => leerParametrosReclutamiento(), renderizar: renderizarReclutamiento, ahora: () => AHORA },
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe(MENSAJE_HOST_NO_LOCAL);
  });

  it("Origin ajeno: 403", async () => {
    const r = await manejarPdfReclutamiento(
      new Request("http://localhost:3000/comisiones/reclutamiento/pdf", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "https://otro.example.com" },
        body: JSON.stringify({ presenta: "", escenarios: ESCENARIOS }),
      }),
      { leer: () => leerParametrosReclutamiento(), renderizar: renderizarReclutamiento, ahora: () => AHORA },
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe(MENSAJES_PDF_RECLUTAMIENTO.origenAjeno);
  });

  it("forma inválida: 422", async () => {
    const r = await pdf({ escenarios: [] });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toBe(MENSAJE_FORMA_RECLUTAMIENTO);
  });

  it("un monto menor al mínimo: 422 con el mensaje en español", async () => {
    const r = await pdf({ escenarios: [{ nombre: "A", montos: { "12": "20000" } }, ...ESCENARIOS.slice(1)] });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/^A, 12 meses: .*\$30,000\.00/);
  });
});

describe("PDF de reclutamiento (documento real)", () => {
  async function texto(cambio: Record<string, unknown> = {}) {
    const r = await pdf(cambio);
    expect(r.status).toBe(200);
    return extraerTexto(new Uint8Array(await r.arrayBuffer()));
  }

  it("tiene exactamente 1 página con título, presenta, totales, desglose, fechas, gráfica y el aviso exacto", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await texto();
    expect(paginas).toBe(1);
    for (const esperado of [
      "Propuesta de ingresos",
      "Presenta: Persona Sintética Uno",
      "08/10/2026",
      "Lo que se ganaría en un mes",
      "$7,920.00",
      "$15,930.00",
      "$45,420.00",
      "$500,000.00 × 5.658% = $28,290.00",
      "Lo captado del 1 al 15 de octubre se pagaría el 16/10/2026.",
      "Lo captado del 16 al fin de octubre se pagaría el 01/11/2026.",
      "Comparación de escenarios",
      AVISO_EXACTO,
    ]) {
      expect(t).toContain(esperado);
    }
  });

  it("pasa la revisión de lenguaje prohibido (fuera del aviso exacto)", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto();
    expect(t.split(AVISO_EXACTO).join(" ")).not.toMatch(RE_PROHIBIDO_RECLUTAMIENTO);
  });

  it("la revisión de lenguaje detecta una variante con promesa (la regla sí muerde)", () => {
    expect(`Presenta: Ingreso fijo garantizado ${AVISO_EXACTO}`.split(AVISO_EXACTO).join(" ")).toMatch(RE_PROHIBIDO_RECLUTAMIENTO);
  });

  it("una promesa en el nombre de quien presenta no llega al PDF: 422 con el mensaje en español", async () => {
    const r = await pdf({ presenta: "Ingreso fijo garantizado" });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/quien presenta/);
  });

  it("nunca muestra el sueldo base: el texto no trae \"sueldo base\" ni \"15,000\"", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto();
    expect(t.toLowerCase()).not.toContain("sueldo base");
    expect(t).not.toContain("15,000");
  });

  it("con 3 inversiones por plazo: 1 página, el aviso con el número y el reparto en el desglose", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await texto({ inversionesPorPlazo: 3 });
    expect(paginas).toBe(1);
    expect(t).toContain("Cálculo con 3 inversión(es) por plazo: si el mismo monto se reparte en más inversiones, la tasa de cada una puede ser menor.");
    // Escenario 3, 24 meses: 500,000 en 3 -> 166,666.68 y 2 de 166,666.66, a 5.52% (primer tramo).
    expect(t).toContain("1 × ($166,666.68 × 5.52% = $9,200.00) + 2 × ($166,666.66 × 5.52% = $9,200.00) = $27,600.00");
  });

  it("con 20 inversiones por plazo y los textos al tope sigue en 1 página", { timeout: TIEMPO }, async () => {
    const largo = (n: number) => "Nombre largo sintético ".repeat(10).slice(0, n);
    const escenarios = ESCENARIOS.map(() => ({ nombre: largo(40), montos: { "6": "1000000.19", "12": "1000000.19", "18": "1000000.19", "24": "1000000.19" } }));
    const { paginas, texto: t } = await texto({ presenta: largo(60), escenarios, inversionesPorPlazo: 20 });
    expect(paginas).toBe(1);
    expect(t).toContain("Cálculo con 20 inversión(es) por plazo");
  });

  it("con nombres de escenario y quien presenta al tope sigue en 1 página", { timeout: TIEMPO }, async () => {
    const largo = (n: number) => "Nombre largo sintético ".repeat(10).slice(0, n);
    const escenarios = ESCENARIOS.map(() => ({ nombre: largo(40), montos: { "6": "300000", "12": "500000", "18": "700000", "24": "1500001" } }));
    const { paginas } = await texto({ presenta: largo(80), escenarios });
    expect(paginas).toBe(1);
  });

  it("sin quien presenta no lleva esa línea", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto({ presenta: "" });
    expect(t).not.toContain("Presenta:");
  });
});

describe("PDF de reclutamiento: los dos logos juntos", () => {
  it("lleva una sola imagen en el encabezado: la combinada de 601 × 145 (public/logos-crediflexi-rami-sise.png)", { timeout: TIEMPO }, async () => {
    const p = await leerParametrosReclutamiento();
    if (!p.ok) throw new Error(p.error.mensaje);
    const { modeloReclutamiento } = await import("../../../src/aplicacion/reclutamiento");
    const m = modeloReclutamiento(p.valor.semilla, p.valor.textos, { presenta: "", escenarios: ESCENARIOS }, AHORA);
    if (!m.ok) throw new Error(m.error.mensaje);
    const bytes = await renderizarReclutamiento(m.valor);
    expect(await imagenesPorPagina(bytes)).toEqual([[{ ancho: 601, alto: 145 }]]);
  });
});
