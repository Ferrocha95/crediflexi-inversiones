import { describe, expect, it } from "vitest";
import { MENSAJE_HOST_NO_AUTORIZADO } from "../../../src/servidor/guardiaHost";
import { MENSAJE_FORMA_COMISIONES } from "../../../src/servidor/comisiones";
import { leerParametrosComisiones } from "../../../src/servidor/parametros";
import { manejarPdfComisiones, MENSAJES_PDF_COMISIONES } from "../../../src/servidor/pdf/manejadorComisiones";
import { renderizarComisiones } from "../../../src/servidor/pdf/renderizar";
import { extraerTexto, imagenesPorPagina, textosConTamano } from "../servidor/pdf/extraer";

// PDF de comisiones (Sprint 7a): perfiles Gerente y Ejecutivo; el externo
// queda fuera. Contiene todo lo de la pantalla de simulación más el "Total
// estimado del mes (simulación)" y el aviso fijo. Máximo 2 páginas. Datos
// sintéticos; cifras de referencia calculadas fuera del motor (tabla N1).

const AHORA = new Date("2026-10-08T12:00:00-06:00");
const TIEMPO = 60_000;

const AVISO_EXACTO = "Simulación informativa con las reglas vigentes. No garantiza ingresos. El sueldo base es una propuesta.";

/** Lenguaje de promesa (mismo criterio que reclutamiento); "garantiza" solo vale dentro del aviso exacto. */
const RE_PROHIBIDO =
  /(?<![\p{L}\p{N}])(garant\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|recibes|promesa|oferta|ilimitad\p{L}*|sin l[ií]mites?|dinero f[aá]cil|sin esfuerzo|libertad financiera|millonari\p{L}*)(?![\p{L}\p{N}])/iu;

type Tipo = "nueva" | "renovacion";
const inv = (monto: string, plazo: number, fecha = "2026-10-07", tipo: Tipo = "nueva") => ({ tipo, monto, plazo, fecha });
const sinFecha = (monto: string, plazo: number, tipo: Tipo = "nueva") => ({ tipo, monto, plazo });

const EJECUTIVO = { perfil: "interno", rol: "EJECUTIVO", inversiones: [inv("1,000,000", 12)], equipo: [], externos: [] };

const deps = { leer: () => leerParametrosComisiones(), renderizar: renderizarComisiones, ahora: () => AHORA };

function peticion(cuerpo: unknown, encabezados: Record<string, string> = {}) {
  return new Request("http://localhost:3000/comisiones/pdf", {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json", ...encabezados },
    body: JSON.stringify(cuerpo),
  });
}

const pdf = (cambio: Record<string, unknown> = {}) => manejarPdfComisiones(peticion({ ...EJECUTIVO, ...cambio }), deps);

async function documento(cambio: Record<string, unknown> = {}) {
  const r = await pdf(cambio);
  if (r.status !== 200) throw new Error(`Se esperaba el PDF: ${r.status} ${await r.text()}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  return { bytes, ...(await extraerTexto(bytes)) };
}

describe("PDF de comisiones (manejador)", () => {
  it("responde un PDF con nombre de archivo sin datos de personas", { timeout: TIEMPO }, async () => {
    const r = await pdf();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="simulacion-de-comisiones-2026-10-08.pdf"');
  });

  it("Host no local: 403 con el mensaje del guardia", async () => {
    const r = await manejarPdfComisiones(peticion(EJECUTIVO, { host: "crediflexi.example.com" }), deps);
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe(MENSAJE_HOST_NO_AUTORIZADO);
  });

  it("Origin ajeno: 403", async () => {
    const r = await manejarPdfComisiones(peticion(EJECUTIVO, { origin: "https://otro.example.com" }), deps);
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe(MENSAJES_PDF_COMISIONES.origenAjeno);
  });

  it.each([
    ["clave de más", { extra: true }],
    ["monto que no es texto", { inversiones: [{ tipo: "nueva", monto: 1000000, plazo: 12, fecha: "2026-10-07" }] }],
    ["perfil desconocido", { perfil: "otro" }],
  ])("forma inválida (%s): 422", async (_, cambio) => {
    const r = await pdf(cambio);
    expect(r.status).toBe(422);
    expect((await r.json()).error).toBe(MENSAJE_FORMA_COMISIONES);
  });

  it("el perfil externo queda fuera: 422 con el mensaje en español", async () => {
    const r = await pdf({ perfil: "externo", rol: null });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toBe(MENSAJES_PDF_COMISIONES.soloInternos);
  });

  it("sin inversiones: 422 con el mensaje en español", async () => {
    const r = await pdf({ inversiones: [] });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toBe(MENSAJES_PDF_COMISIONES.sinInversiones);
  });

  it("un error del motor llega como 422 con su mensaje (monto menor al mínimo)", async () => {
    const r = await pdf({ inversiones: [inv("20000", 12)] });
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/\$30,000\.00/);
  });
});

describe("PDF de comisiones: Ejecutivo desbloqueado (1,000,000 a 12 meses)", () => {
  it("lleva perfil y rol, la tabla con tasa completa, totales, avance, metas, sueldo base, bono, calendario, total y aviso", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await documento();
    expect(paginas).toBeLessThanOrEqual(2);
    for (const esperado of [
      "Simulación de comisiones del mes",
      "08/10/2026",
      "Perfil",
      "Interno",
      "Rol",
      "Ejecutivo",
      "Comisión por inversión",
      "$1,000,000.00",
      "12 meses",
      "2.838%",
      "$28,380.00",
      "16/10/2026",
      "Comisión calculada del mes",
      "Pagable",
      "Captación para la meta",
      "Avance de la meta",
      "Desbloqueada",
      "100% de la meta: $1,000,000.00 de $1,000,000.00",
      "Desbloqueo (80%): $800,000.00",
      "Meta (100%): $1,000,000.00",
      "Se desbloquea el 07/10/2026.",
      "Meta del mes cumplida.",
      "Metas del mes",
      "Con esta captación",
      "Las comisiones se desbloquean desde el 80% de la meta ($800,000).",
      "Sueldo base (propuesta)",
      "Bono por captación",
      "Calendario de pagos",
      "Total estimado del mes (simulación)",
      "$43,380.00",
      "$15,000.00 + $28,380.00 + $0.00 = $43,380.00",
      AVISO_EXACTO,
    ]) {
      expect(t).toContain(esperado);
    }
    expect(t).not.toContain("Bono de gerente");
  });

  it("los dos logos juntos en la primera página y nada baja de 8 pt", { timeout: TIEMPO }, async () => {
    const { bytes } = await documento();
    expect((await imagenesPorPagina(bytes))[0]).toEqual([{ ancho: 601, alto: 145 }]);
    const tamanos = (await textosConTamano(bytes, 1)).map((x) => x.tamano);
    expect(Math.min(...tamanos)).toBeGreaterThanOrEqual(8 - 1e-6);
  });

  it("pasa la revisión de lenguaje prohibido (fuera del aviso exacto); la regla sí muerde", { timeout: TIEMPO }, async () => {
    const { texto: t } = await documento();
    expect(t.split(AVISO_EXACTO)).toHaveLength(2);
    expect(t.split(AVISO_EXACTO).join(" ")).not.toMatch(RE_PROHIBIDO);
    expect(`Ingreso fijo ${AVISO_EXACTO}`.split(AVISO_EXACTO).join(" ")).toMatch(RE_PROHIBIDO);
  });

  it("1,500,000 a 12 meses: tasa 2.904%, comisión 43,560.00, bono 5,000 y total 63,560.00", { timeout: TIEMPO }, async () => {
    const { texto: t } = await documento({ inversiones: [inv("1500000", 12)] });
    for (const esperado of ["2.904%", "$43,560.00", "$15,000.00 + $43,560.00 + $5,000.00 = $63,560.00", "150% de la meta"]) {
      expect(t).toContain(esperado);
    }
  });

  it("con Mis externos: la comisión por tus externos (30%) va aparte y no entra al total", { timeout: TIEMPO }, async () => {
    const { texto: t } = await documento({ externos: [sinFecha("500,000", 12), sinFecha("400000", 6), sinFecha("500000", 12, "renovacion")] });
    expect(t).toContain("Comisión por tus externos (30%)");
    expect(t).toContain("Se paga aparte: no se descuenta a tus externos.");
    expect(t).toContain("$15,000.00 + $28,380.00 + $0.00 = $43,380.00");
  });
});

describe("PDF de comisiones: Ejecutivo bloqueado (799,999.99)", () => {
  it("dice Bloqueada, cuánto falta para el 80% y el 100%, sin pagos; el total es el sueldo base", { timeout: TIEMPO }, async () => {
    const { texto: t } = await documento({ inversiones: [inv("799,999.99", 12)] });
    for (const esperado of [
      "Bloqueada",
      "Faltan $0.01 para desbloquear (umbral de $800,000.00).",
      "Faltan $200,000.01 para el 100% de la meta.",
      "Sin pagos: la comisión del mes sigue bloqueada.",
      "Si el mes cierra sin desbloquear, la comisión bloqueada:",
      "$15,000.00 + $0.00 + $0.00 = $15,000.00",
    ]) {
      expect(t).toContain(esperado);
    }
    expect(t).not.toContain("Desbloqueada");
  });

  it("800,000 sí desbloquea", { timeout: TIEMPO }, async () => {
    const { texto: t } = await documento({ inversiones: [inv("800,000", 12)] });
    expect(t).toContain("Desbloqueada");
    expect(t).not.toContain("Sin pagos");
  });
});

describe("PDF de comisiones: Gerente", () => {
  it("sin sueldo base ni tabla de metas; bono de gerente y externos aparte; el total es la comisión pagable", { timeout: TIEMPO }, async () => {
    const { texto: t } = await documento({
      rol: "GERENTE",
      inversiones: [inv("2,000,000", 12)],
      equipo: [sinFecha("500000", 12)],
      externos: [sinFecha("400000", 6)],
    });
    for (const esperado of [
      "Gerente",
      "Desbloqueo (80%): $1,600,000.00",
      "El bono por captación del gerente aún no está definido.",
      "Bono de gerente (por confirmar)",
      "Comisión N1 del equipo",
      "Comisión por tus externos (30%)",
      "Total estimado del mes (simulación)",
      AVISO_EXACTO,
    ]) {
      expect(t).toContain(esperado);
    }
    expect(t).not.toContain("Sueldo base (propuesta)");
    expect(t).not.toContain("Metas del mes");
  });
});

describe("PDF de comisiones: nunca pasa de 2 páginas", () => {
  const cincuenta = Array.from({ length: 50 }, (_, i) => inv("1,234,567.89", [6, 12, 18, 24][i % 4], `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, i % 3 === 0 ? "renovacion" : "nueva"));
  const cincuentaSinFecha = Array.from({ length: 50 }, (_, i) => sinFecha("987,654.32", [6, 12, 18, 24][i % 4]));

  it("Gerente con 50 inversiones, 50 del equipo y 50 de sus externos", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await documento({ rol: "GERENTE", inversiones: cincuenta, equipo: cincuentaSinFecha, externos: cincuentaSinFecha });
    expect(paginas).toBeLessThanOrEqual(2);
    expect(t).toContain(AVISO_EXACTO);
    expect(t).toContain("Calendario de pagos");
  });

  it("Ejecutivo con 50 inversiones y 50 de sus externos", { timeout: TIEMPO }, async () => {
    const { paginas, texto: t } = await documento({ inversiones: cincuenta, externos: cincuentaSinFecha });
    expect(paginas).toBeLessThanOrEqual(2);
    expect(t).toContain(AVISO_EXACTO);
    expect(t).toContain("Total estimado del mes (simulación)");
  });
});
