import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf, TOPES, type EntradaPdf, type ModeloPdf } from "../../../../src/aplicacion/modelo";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import type { Esquema } from "../../../../src/domain/tasas/semilla.esquema";
import { renderizarPdf } from "../../../../src/servidor/pdf/renderizar";
import { datosPagina2 } from "../../../../src/aplicacion/pagina2";
import { cotizarBien, semillaReal } from "../../oro/ayudas";
import { extraerTexto } from "./extraer";

// Renderizado real con react-pdf y lectura del texto con pdfjs-dist. Todo con datos sintéticos.

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const AHORA = new Date("2026-10-01T18:00:00Z");
const TIEMPO = 60_000;

const OPCIONALES: EntradaPdf = {
  preparadoPara: "Persona Sintética Uno",
  ejecutivo: "Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test",
  vigencia: "15 días naturales",
  notaAdicional: "Nota sintética de prueba.",
};

function modelo(entidad: string, esquema: Esquema, entrada: EntradaPdf = OPCIONALES, monto = "1500000", plazo = 12) {
  const c = cotizarBien({ entidad, esquema, monto, plazo });
  return sinError(modeloPdf(c, { razonesSociales, textos }, entrada, AHORA, datosPagina2(semillaReal, c.solicitud)));
}

async function render(m: ModeloPdf) {
  const bytes = await renderizarPdf(m);
  return { bytes, ...(await extraerTexto(bytes)) };
}

/** Texto de largo exacto `n` (en caracteres), con espacios, como lo escribiría una persona. */
function largo(base: string, n: number): string {
  let t = "";
  while (Array.from(t).length < n) t += `${base} `;
  return Array.from(t).slice(0, n).join("").replace(/ $/, "x");
}

const P2 = textos.pdfPagina2;

/** Textos fijos que la página 2 lleva siempre (tarjetas y títulos de las gráficas). */
const TEXTOS_PAGINA2 = [
  P2.titulo,
  P2.modalidad1,
  P2.modalidad2,
  P2.tasaAnual,
  P2.capitalInicial,
  P2.rendimientoEstimado,
  P2.total,
  P2.columnaRendimientoMes,
  P2.columnaRendimientoAcumulado,
  P2.notaCentavos,
  P2.tituloGrafica1,
  P2.tituloGrafica2,
];

const RE_PROHIBIDO =
  /(?<![\p{L}\p{N}])(garantiz\p{L}*|asegur\p{L}*|sin riesgo|libre de impuestos|neta|neto|sin comisiones|supervis\p{L}*|CNBV|CONDUSEF|SHCP)(?![\p{L}\p{N}])/iu;

const CASOS = [
  {
    entidad: "CREDIFLEXI",
    razonSocial: "CREDIFLEXI, S.A.P.I. DE C.V.",
    esquema: "mensual" as const,
    cifras: ["$23,750.00", "$285,000.00"],
    etiquetas: ["Pago mensual", "Rendimiento anual equivalente (12 meses)", "Ganancia total en el plazo"],
  },
  {
    entidad: "RAMI_SISE",
    razonSocial: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R.",
    esquema: "final_del_plazo" as const,
    cifras: ["$26,250.00", "$315,000.00"],
    etiquetas: [
      "Rendimiento mensual equivalente (se paga al final del plazo)",
      "Rendimiento anual equivalente (12 meses)",
      "Ganancia total al final del plazo",
    ],
  },
];

describe.each(CASOS)("PDF real: $entidad ($esquema), 1,500,000 pesos a 12 meses", (caso) => {
  it("es un PDF de exactamente dos páginas", { timeout: TIEMPO }, async () => {
    const { bytes, paginas } = await render(modelo(caso.entidad, caso.esquema));
    expect(new TextDecoder("latin1").decode(bytes.subarray(0, 5))).toBe("%PDF-");
    expect(paginas).toBe(2);
  });

  it("la página 1 trae su texto de siempre y nada de la página 2", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { porPagina } = await render(m);
    for (const t of [caso.razonSocial, "Tu cotización de inversión", m.lineaTasas, m.pie.base, ...caso.cifras]) {
      expect(porPagina[0]).toContain(t);
    }
    for (const t of [P2.modalidad1, P2.tasaAnual, P2.tituloGrafica1, P2.notaCentavos]) {
      expect(porPagina[0]).not.toContain(t);
    }
  });

  it("la página 2 trae las dos modalidades, las gráficas y la nota del escenario", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const t of TEXTOS_PAGINA2) expect(porPagina[1]).toContain(t);
    expect(porPagina[1]).toContain(P2.notaEscenario);
    expect(porPagina[1]).toContain(P2.insignia);
  });

  it("las dos páginas llevan su número de página", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina[0]).toContain(`${P2.pagina} 1 ${P2.paginaDe} 2`);
    expect(porPagina[1]).toContain(`${P2.pagina} 2 ${P2.paginaDe} 2`);
  });

  it("la página 2 no trae restos técnicos ni lenguaje prohibido", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const t of ["undefined", "NaN", "{", "}", "null", "Infinity"]) expect(porPagina[1]).not.toContain(t);
    expect(porPagina[1]).not.toMatch(RE_PROHIBIDO);
  });

  it("trae la razón social, el título, las cifras, las etiquetas y la línea de tasas", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { texto } = await render(m);
    expect(texto).toContain(caso.razonSocial);
    expect(texto).toContain("Tu cotización de inversión");
    for (const cifra of caso.cifras) expect(texto).toContain(cifra);
    for (const etiqueta of caso.etiquetas) expect(texto).toContain(etiqueta);
    expect(texto).toContain(`Tasas versión ${semillaJson.version} del 02/10/2026`);
    for (const t of [
      "Preparado para",
      "Fecha",
      "01/10/2026",
      "Monto de inversión",
      "$1,500,000.00 MXN",
      "Plazo",
      "12 meses",
      "Tasa anual",
      caso.esquema === "mensual" ? "19.00%" : "21.00%",
      "Esquema",
      m.solicitud.esquema,
      "Tus resultados",
      "Cómo se calculó",
    ]) {
      expect(texto).toContain(t);
    }
  });

  it("trae el pie base completo, las líneas opcionales y la nota", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { texto } = await render(m);
    expect(texto).toContain(m.pie.base);
    expect(texto).toContain("Preparado para Persona Sintética Uno");
    expect(texto).toContain("Preparado por Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test.");
    expect(texto).toContain("Vigencia: 15 días naturales.");
    expect(texto).toContain("Nota sintética de prueba.");
  });

  it("trae la fórmula y la operación de cada cifra", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { texto } = await render(m);
    expect(m.cifras).toHaveLength(3);
    for (const c of m.cifras) {
      expect(texto).toContain(c.formula);
      expect(texto).toContain(c.operacion);
    }
  });

  it("no trae estatus, ni marcadores, ni valores rotos", { timeout: TIEMPO }, async () => {
    const { texto } = await render(modelo(caso.entidad, caso.esquema));
    for (const prohibido of ["CONFIRMADA", "Tasa confirmada", "undefined", "NaN", "{", "}", "null"]) {
      expect(texto).not.toContain(prohibido);
    }
  });

  it("no imprime un aviso aunque venga en el modelo (aviso fabricado a mano)", { timeout: TIEMPO }, async () => {
    const conAviso = {
      ...modelo(caso.entidad, caso.esquema),
      avisos: [{ codigo: "TASA_MAYOR_QUE_TRAMO_SIGUIENTE", mensaje: "Aviso sintético que no debe imprimirse." }],
    } as ModeloPdf;
    const { texto } = await render(conAviso);
    expect(texto).not.toContain("Aviso sintético");
    expect(texto).not.toContain("TASA_MAYOR_QUE_TRAMO_SIGUIENTE");
  });

  it("no usa lenguaje de promesas, urgencia ni de autoridades", { timeout: TIEMPO }, async () => {
    const { texto } = await render(modelo(caso.entidad, caso.esquema));
    expect(texto).not.toMatch(RE_PROHIBIDO);
  });
});

describe("PDF real: la revisión de lenguaje detecta lo prohibido", () => {
  it.each([
    "Rendimiento garantizado",
    "te ASEGURAMOS",
    "Sin riesgo",
    "libre de impuestos",
    "ganancia neta",
    "monto neto",
    "sin comisiones",
    "supervisada",
    "CNBV",
    "Condusef",
    "SHCP",
  ])("%s", (t) => {
    expect(t).toMatch(RE_PROHIBIDO);
  });

  it.each(["Netflix", "planeta", "Rendimientos mensuales"])("no confunde %s", (t) => {
    expect(t).not.toMatch(RE_PROHIBIDO);
  });
});

describe("PDF real: exactamente dos páginas en los extremos", () => {
  it.each(CASOS)("$entidad con los cuatro opcionales en su tope y 24 meses sigue en dos páginas y sin cortes", { timeout: TIEMPO }, async (caso) => {
    const entrada: EntradaPdf = {
      preparadoPara: largo("Persona Sintética Uno con un nombre largo", TOPES.preparadoPara),
      ejecutivo: largo("Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test", TOPES.ejecutivo),
      vigencia: largo("15 días naturales", TOPES.vigencia),
      notaAdicional: largo("Nota sintética de prueba con texto largo", TOPES.notaAdicional),
    };
    expect(Array.from(entrada.preparadoPara ?? "")).toHaveLength(120);
    expect(Array.from(entrada.ejecutivo ?? "")).toHaveLength(120);
    expect(Array.from(entrada.vigencia ?? "")).toHaveLength(60);
    expect(Array.from(entrada.notaAdicional ?? "")).toHaveLength(300);
    const m = modelo(caso.entidad, caso.esquema, entrada, "99999999.99", 24);
    const { paginas, porPagina } = await render(m);
    expect(paginas).toBe(2);
    const texto = porPagina[0];
    expect(texto).toContain(m.pie.base);
    expect(texto).toContain(`Preparado para ${m.preparadoPara}`);
    expect(texto).toContain(m.pie.preparadoPor);
    expect(texto).toContain(m.pie.vigencia);
    expect(texto).toContain(m.pie.notaAdicional);
    expect(texto).toContain(m.lineaTasas);
    for (const c of m.cifras) expect(texto).toContain(c.operacion);
    // La página 2 con 24 filas por modalidad, completa.
    for (const t of TEXTOS_PAGINA2) expect(porPagina[1]).toContain(t);
    expect(porPagina[1]).toContain("$99,999,999.99");
  });

  it.each(CASOS)("$entidad con todos los opcionales vacíos sigue en dos páginas y sin líneas opcionales", { timeout: TIEMPO }, async (caso) => {
    const m = modelo(caso.entidad, caso.esquema, {});
    const { paginas, texto } = await render(m);
    expect(paginas).toBe(2);
    expect(texto).not.toContain("Preparado para");
    expect(texto).not.toContain("Preparado por");
    expect(texto).not.toContain("Vigencia");
    expect(texto).toContain(m.pie.base);
  });
});

describe("PDF real: acentos y signos con la fuente embebida", () => {
  it("¿ ¡ ñ y las vocales acentuadas salen bien en el texto extraído", { timeout: TIEMPO }, async () => {
    const m = modelo("CREDIFLEXI", "mensual", {
      preparadoPara: "Señora Sintética Muñoz",
      ejecutivo: "Ejecutivo Pérez · ejecutivo.prueba@ejemplo.test",
      vigencia: "30 días",
      notaAdicional: "¿Dudas? ¡Escríbenos! Año, niño, acción, pingüino, ÁÉÍÓÚ Ñ Ü.",
    });
    const { bytes, texto } = await render(m);
    for (const t of [
      "Señora Sintética Muñoz",
      "Ejecutivo Pérez",
      "¿Dudas? ¡Escríbenos! Año, niño, acción, pingüino, ÁÉÍÓÚ Ñ Ü.",
      "Cómo se calculó",
      "Monto de inversión",
      "Tu cotización de inversión",
    ]) {
      expect(texto).toContain(t);
    }
    expect(new TextDecoder("latin1").decode(bytes)).toMatch(/\/BaseFont \/[A-Z]{6}\+Nunito/);
  });
});

describe("PDF real: metadatos", () => {
  it("título, autor e idioma", { timeout: TIEMPO }, async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const bytes = await renderizarPdf(modelo("RAMI_SISE", "mensual", {}));
    const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
    const pdf = await tarea.promise;
    const info = (await pdf.getMetadata()).info as Record<string, unknown>;
    await tarea.destroy();
    expect(info.Title).toBe("Tu cotización de inversión");
    expect(info.Author).toBe("RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R.");
    expect(info.Language).toBe("es-MX");
  });
});

describe("PDF real: página 2 del ejemplo del Excel, 1,000,000 pesos a 6 meses", () => {
  it("las cifras de las dos modalidades, como en el Excel", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(modelo("CREDIFLEXI", "mensual", OPCIONALES, "1000000", 6));
    expect(paginas).toBe(2);
    const p2 = porPagina[1];
    for (const t of [
      "18.00%",
      "20.00%",
      "$1,000,000.00",
      "$15,000.00",
      "$30,000.00",
      "$45,000.00",
      "$60,000.00",
      "$75,000.00",
      "$90,000.00",
      "$1,090,000.00",
      "$16,666.67",
      "$16,666.66",
      "$33,333.33",
      "$50,000.00",
      "$66,666.67",
      "$83,333.33",
      "$100,000.00",
      "$1,100,000.00",
      P2.serieCobrado,
      P2.serieDevengado,
      P2.rotuloEscenario,
      P2.serieConReinversion,
      P2.serieSinReinvertir,
      P2.finPrimerPlazo,
      P2.notaEscenario,
    ]) {
      expect(p2).toContain(t);
    }
  });
});

describe("PDF real: escenario omitido", () => {
  it("55,000 pesos a 6 meses mensual: dos páginas, tarjetas completas y la nota en lugar de la gráfica 2", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(modelo("CREDIFLEXI", "mensual", OPCIONALES, "55000", 6));
    expect(paginas).toBe(2);
    for (const t of TEXTOS_PAGINA2) expect(porPagina[1]).toContain(t);
    expect(porPagina[1]).toContain(P2.escenarioIncrementoMinimo);
    expect(porPagina[1]).not.toContain(P2.serieConReinversion);
    expect(porPagina[1]).toContain("$733.35");
  });
});
