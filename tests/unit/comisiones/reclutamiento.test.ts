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

import { simularReclutamiento } from "../../../src/app/(app)/comisiones/reclutamiento/acciones";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_AUTORIZADO } from "../../../src/servidor/guardiaHost";
import { leerParametrosReclutamiento } from "../../../src/servidor/parametros";
import { manejarPdfReclutamiento, MENSAJES_PDF_RECLUTAMIENTO } from "../../../src/servidor/pdf/manejadorReclutamiento";
import { renderizarReclutamiento } from "../../../src/servidor/pdf/renderizar";
import { MENSAJE_FORMA_RECLUTAMIENTO, type RespuestaReclutamiento } from "../../../src/servidor/reclutamiento";
import { extraerTexto, imagenesPorPagina } from "../servidor/pdf/extraer";

const base = { peticion: 4, presenta: "Persona Sintética Uno", monto: "1000000" };
const AHORA = new Date("2026-10-08T12:00:00-06:00");
const TIEMPO = 60_000;

const AVISO_EXACTO =
  "Ejemplo calculado con las tablas vigentes al 7 de octubre de 2026. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos.";
const AVISO_INCORPORACION =
  "Al superar $1,000,000 en ingresos, se podrá evaluar la incorporación a la compañía, en caso de que exista interés por parte del colaborador externo.";

/** Lenguaje de promesa (Sprint 5). "garantía" y "oferta" solo valen dentro del aviso exacto, que se quita antes de revisar. */
const RE_PROHIBIDO_RECLUTAMIENTO =
  /(?<![\p{L}\p{N}])(garant\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|recibes|promesa|oferta|ilimitad\p{L}*|sin l[ií]mites?|dinero f[aá]cil|sin esfuerzo|libertad financiera|millonari\p{L}*)(?![\p{L}\p{N}])/iu;

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
  it("calcula con la semilla y los textos reales: 1,000,000 a 12 meses -> 28,380.00 más bono 15,000.00", async () => {
    const m = modelo(await simularReclutamiento(base));
    expect(m.cifra.total).toBe("$43,380.00");
    expect(m.comparativo.map((c) => c.comision)).toEqual(["$12,900.00", "$28,380.00", "$43,860.00", "$59,340.00"]);
  });

  it("con plazo y mezcla", async () => {
    expect(modelo(await simularReclutamiento({ ...base, plazo: 24 })).cifra.total).toBe("$74,340.00");
    const mezcla = { "6": "500000", "12": "", "18": "", "24": "500000" };
    expect(modelo(await simularReclutamiento({ ...base, mezcla })).cifra.total).toBe("$49,440.00");
  });

  it("sin usuario activo responde el aviso de sesión expirada", async () => {
    sesion.activo = false;
    expect(error(await simularReclutamiento(base)).mensaje).toBe(MENSAJE_SESION_EXPIRADA);
  });

  it("con Host no local responde el mensaje del guardia sin leer la sesión", async () => {
    encabezados.host = "crediflexi.example.com";
    expect(error(await simularReclutamiento(base)).mensaje).toBe(MENSAJE_HOST_NO_AUTORIZADO);
    expect(sesion.llamadas).toBe(0);
  });

  it.each([
    ["sin monto", { monto: undefined }],
    ["clave de más", { extra: true }],
    ["los escenarios viejos", { escenarios: [] }],
    ["presenta demasiado largo", { presenta: "P".repeat(201) }],
    ["monto que no es texto", { monto: 1000000 }],
    ["plazo que no es entero", { plazo: 12.5 }],
    ["mezcla con un monto que no es texto", { mezcla: { "12": 300000 } }],
    ["perfil desconocido", { perfil: "gerente" }],
  ])("forma inválida (%s)", async (_, cambio) => {
    expect(error(await simularReclutamiento({ ...base, ...cambio })).mensaje).toBe(MENSAJE_FORMA_RECLUTAMIENTO);
  });
});

/** PDF real con 1,000,000 (o lo indicado). */
async function pdf(cambio: Record<string, unknown> = {}) {
  return manejarPdfReclutamiento(
    new Request("http://localhost:3000/comisiones/reclutamiento/pdf", {
      method: "POST",
      headers: { host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ presenta: base.presenta, monto: base.monto, ...cambio }),
    }),
    { leer: () => leerParametrosReclutamiento(), renderizar: renderizarReclutamiento, ahora: () => AHORA },
  );
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
    expect((await r.json()).error).toBe(MENSAJE_HOST_NO_AUTORIZADO);
  });

  it("Origin ajeno: 403", async () => {
    const r = await manejarPdfReclutamiento(
      new Request("http://localhost:3000/comisiones/reclutamiento/pdf", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "https://otro.example.com" },
        body: JSON.stringify({ presenta: "", monto: "1000000" }),
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

  it("una captación menor al mínimo: 422 con el mensaje en español", async () => {
    const r = await pdf({ monto: "20000" });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/\$30,000\.00/);
  });
});

describe("PDF de reclutamiento (documento real, una página)", () => {
  async function texto(cambio: Record<string, unknown> = {}) {
    const r = await pdf(cambio);
    expect(r.status).toBe(200);
    return extraerTexto(new Uint8Array(await r.arrayBuffer()));
  }

  it("con 1,000,000: EXACTAMENTE 1 página con la cifra grande, el comparativo por plazos, la escalera y los avisos", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await texto();
    expect(paginas).toBe(1);
    for (const esperado of [
      "Propuesta de ingresos",
      "Presenta: Persona Sintética Uno",
      "08/10/2026",
      "Tu captación, tu ganancia.",
      "Lo que se ganaría en un mes",
      "$43,380.00",
      "$1,000,000 a 12 meses: comisión $28,380.00 más bono $15,000.00",
      "$1,000,000 × 1.29% = $12,900.00",
      "$1,000,000 × 2.838% = $28,380.00",
      "$1,000,000 × 4.386% = $43,860.00",
      "$1,000,000 × 5.934% = $59,340.00",
      "A 24 meses se ganaría 4.60 veces lo de 6 meses.",
      "Bono por captación nueva del mes",
      "Menos de $1,000,000: sin bono",
      "De $1,000,000 a $1,499,999: $15,000 más la comisión",
      "De $1,500,000 a $1,999,999: $20,000 más la comisión",
      "$2,000,000 en adelante: $25,000 más la comisión",
      "Con esta captación",
      AVISO_INCORPORACION,
      "Cálculo con 1 inversión(es) por plazo: si el mismo monto se reparte en más inversiones, la tasa de cada una puede ser menor.",
      AVISO_EXACTO,
      "Las tasas están sujetas a cambio.",
    ]) {
      expect(t).toContain(esperado);
    }
  });

  it("el aviso de incorporación va una sola vez, justo debajo de la escalera de bonos", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto();
    expect(t.split(AVISO_INCORPORACION)).toHaveLength(2);
    const fin = t.indexOf("$2,000,000 en adelante: $25,000 más la comisión");
    const aviso = t.indexOf(AVISO_INCORPORACION);
    expect(aviso).toBeGreaterThan(fin);
    expect(aviso).toBeLessThan(t.indexOf(AVISO_EXACTO));
  });

  it("PDF de externo: sin el aviso interno de las frases ni sueldo base", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto();
    expect(t).not.toContain("Frases pendientes de aprobación de RH");
    expect(t.toLowerCase()).not.toContain("sueldo base");
  });

  it("pasa la revisión de lenguaje prohibido (fuera del aviso exacto)", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto();
    expect(t.split(AVISO_EXACTO).join(" ")).not.toMatch(RE_PROHIBIDO_RECLUTAMIENTO);
  });

  it("la revisión de lenguaje detecta una variante con promesa (la regla sí muerde)", () => {
    expect(`Presenta: Dinero fácil y sin límite ${AVISO_EXACTO}`.split(AVISO_EXACTO).join(" ")).toMatch(RE_PROHIBIDO_RECLUTAMIENTO);
  });

  it("una promesa en el nombre de quien presenta no llega al PDF: 422 con el mensaje en español", async () => {
    const r = await pdf({ presenta: "Libertad financiera" });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/quien presenta/);
  });

  it("con la mezcla de plazos: la cifra lo dice y cada plazo lleva su línea", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await texto({ mezcla: { "6": "500000", "12": "", "18": "", "24": "500000" } });
    expect(paginas).toBe(1);
    expect(t).toContain("$1,000,000 repartidos entre plazos: comisión $34,440.00 más bono $15,000.00");
    expect(t).toContain("$500,000 × 5.658% = $28,290.00");
  });

  it("con 3 inversiones por plazo: 1 página, el aviso con el número y el reparto en la línea", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await texto({ inversionesPorPlazo: 3 });
    expect(paginas).toBe(1);
    expect(t).toContain("Cálculo con 3 inversión(es) por plazo");
    expect(t).toContain("1 × ($333,333.34 × 2.706% = $9,020.00) + 2 × ($333,333.33 × 2.706% = $9,020.00) = $27,060.00");
  });

  it("al tope: 24 meses, captación enorme, mezcla en los cuatro plazos, 20 inversiones por plazo y quien presenta de 60 caracteres: 1 página", { timeout: TIEMPO }, async () => {
    const largo = "Nombre largo sintético ".repeat(5).slice(0, 60);
    const mezcla = { "6": "24999999.99", "12": "25000000", "18": "25000000", "24": "25000000" };
    const { paginas, texto: t } = await texto({ presenta: largo, monto: "99999999.99", plazo: 24, mezcla, inversionesPorPlazo: 20 });
    expect(paginas).toBe(1);
    expect(t).toContain("Cálculo con 20 inversión(es) por plazo");
    expect(t).toContain(AVISO_INCORPORACION);
  });

  it("sin quien presenta no lleva esa línea", { timeout: TIEMPO }, async () => {
    const { texto: t } = await texto({ presenta: "" });
    expect(t).not.toContain("Presenta:");
  });
});

describe("PDF de reclutamiento: los dos logos juntos", () => {
  it("lleva una sola imagen en el encabezado: la combinada de 601 × 145 (public/logos-crediflexi-rami-sise.png)", { timeout: TIEMPO }, async () => {
    const r = await pdf();
    expect(await imagenesPorPagina(new Uint8Array(await r.arrayBuffer()))).toEqual([[{ ancho: 601, alto: 145 }]]);
  });
});

describe("PDF de reclutamiento interno (documento real, una página)", () => {
  async function interno(cambio: Record<string, unknown> = {}) {
    const r = await pdf({ perfil: "interno", ...cambio });
    expect(r.status).toBe(200);
    return extraerTexto(new Uint8Array(await r.arrayBuffer()));
  }

  it("con 1,000,000: EXACTAMENTE 1 página con el total, el sueldo base (propuesta), el desbloqueo, el comparativo, la tabla de bonos y los avisos", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await interno();
    expect(paginas).toBe(1);
    for (const esperado of [
      "Propuesta de ingresos",
      "Presenta: Persona Sintética Uno",
      "08/10/2026",
      "Total estimado del mes (simulación)",
      "$43,380.00",
      "$1,000,000 a 12 meses: sueldo base $15,000.00 (propuesta) más comisión $28,380.00 más bono $0.00",
      "Sueldo base (propuesta)",
      "$15,000.00 + $28,380.00 + $0.00 = $43,380.00",
      "Las comisiones se desbloquean desde el 80% de la meta ($800,000).",
      "Con esta captación las comisiones quedan desbloqueadas.",
      "$1,000,000 × 1.29% = $12,900.00",
      "$1,000,000 × 5.934% = $59,340.00",
      "A 24 meses se ganaría 4.60 veces lo de 6 meses.",
      "100% de la meta",
      "$1,499,999",
      "200% de la meta",
      "En adelante",
      "Con esta captación",
      AVISO_EXACTO,
      "Las tasas están sujetas a cambio.",
    ]) {
      expect(t).toContain(esperado);
    }
  });

  it("sin aviso de incorporación, sin escalera de externos y sin el aviso de RH para internos (el PDF sale limpio)", { timeout: TIEMPO }, async () => {
    const { texto: t } = await interno();
    expect(t).not.toContain(AVISO_INCORPORACION);
    expect(t).not.toContain("más la comisión");
    expect(t).not.toContain("Texto para internos pendiente de aprobación de RH");
    expect(t).not.toContain("Sin meta mensual");
  });

  it("1,500,000: tasa 2.904%, bono 5,000 y total 63,560.00; 799,999.99: bloqueada y total 15,000.00", { timeout: TIEMPO }, async () => {
    const alto = (await interno({ monto: "1500000" })).texto;
    for (const esperado of ["$1,500,000 × 2.904% = $43,560.00", "$63,560.00", "$15,000.00 + $43,560.00 + $5,000.00 = $63,560.00"]) expect(alto).toContain(esperado);
    const bajo = (await interno({ monto: "799999.99" })).texto;
    expect(bajo).toContain("Con esta captación las comisiones quedan bloqueadas: faltan $0.01 para llegar a $800,000.");
    expect(bajo).toContain("$15,000.00 + $0.00 + $0.00 = $15,000.00");
  });

  it("con 3 inversiones por plazo y la mezcla sigue en una página", { timeout: TIEMPO }, async () => {
    const { paginas } = await interno({ inversionesPorPlazo: 3, mezcla: { "6": "250000", "12": "250000", "18": "250000", "24": "250000" } });
    expect(paginas).toBe(1);
  });

  it("pasa la revisión de lenguaje prohibido (fuera del aviso exacto)", { timeout: TIEMPO }, async () => {
    const { texto: t } = await interno();
    expect(t.split(AVISO_EXACTO).join(" ")).not.toMatch(RE_PROHIBIDO_RECLUTAMIENTO);
  });

  it("los dos logos juntos", { timeout: TIEMPO }, async () => {
    const r = await pdf({ perfil: "interno" });
    expect(await imagenesPorPagina(new Uint8Array(await r.arrayBuffer()))).toEqual([[{ ancho: 601, alto: 145 }]]);
  });
});
