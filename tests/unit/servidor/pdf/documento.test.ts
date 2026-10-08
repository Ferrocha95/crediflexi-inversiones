import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf, TOPES, type EntradaPdf, type ModeloPdf } from "../../../../src/aplicacion/modelo";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import type { Esquema } from "../../../../src/domain/tasas/semilla.esquema";
import { renderizarPdf } from "../../../../src/servidor/pdf/renderizar";
import { cotizarConAjuste, type Ajuste } from "../../../../src/domain/interes/ajustes";
import { datosPagina2 } from "../../../../src/aplicacion/pagina2";
import { cotizarBien, semillaReal } from "../../oro/ayudas";
import { extraerTexto } from "./extraer";
import { benchmarkReal } from "../../benchmarkReal";

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
  return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, entrada, AHORA, datosPagina2(semillaReal, c.solicitud)));
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

/** Textos fijos que la página 2 lleva siempre (tarjetas, franja y título de la gráfica). */
const TEXTOS_PAGINA2 = [
  P2.titulo,
  P2.modalidad1,
  P2.modalidad2,
  P2.tasaAnual,
  P2.capitalInicial,
  P2.totalCapitalGanancia,
  P2.columnaGananciaPeriodo,
  P2.columnaGananciaAcumulada,
  P2.notaCentavos,
  P2.tituloGrafica1,
  P2.franjaMasCapital,
  P2.franjaGananciaCapital,
];

/** La línea SIPRES exacta (Sprint 5: en el pie de las dos entidades). */
const LINEA_SIPRES =
  "Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R. · Inscrita en el SIPRES de la CONDUSEF con clave de registro 696338 · webapps.condusef.gob.mx/SIPRES";

/** El disclaimer exacto del pie de las dos páginas, para las dos entidades. */
const DISCLAIMER =
  "Crediflexi, fondo de inversión privado, operado por Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R., inscrita en el SIPRES de la CONDUSEF " +
  "y sujeta a las disposiciones aplicables. Por ser un fondo de inversión privado, para invertir se requiere adquirir una acción de " +
  "$1,000.00 MXN. Las tasas están sujetas a cambio.";

const RE_PROHIBIDO =
  /(?<![\p{L}\p{N}])(garantiz\p{L}*|asegur\p{L}*|sin riesgo|libre de impuestos|neta|neto|sin comisiones|supervis\p{L}*|promesa|recib(es|ir[aá]s)|CNBV|CONDUSEF|SIPRES|SHCP)(?![\p{L}\p{N}])/iu;

/**
 * Únicas excepciones exactas a la revisión de lenguaje: la línea SIPRES y el
 * disclaimer (CONDUSEF y SIPRES solo ahí) y las dos negaciones del grupo
 * histórico del comparativo (seed/benchmark.json).
 */
const EXCEPCIONES_EXACTAS = [
  LINEA_SIPRES,
  DISCLAIMER,
  "Rendimiento histórico, no garantizado",
  "Rendimientos pasados no garantizan resultados futuros",
];

/** El texto sin las excepciones exactas: lo que queda debe pasar la revisión de lenguaje. */
const sinLineaSipres = (texto: string) => EXCEPCIONES_EXACTAS.reduce((x, e) => x.split(e).join(" "), texto);

const CASOS = [
  {
    entidad: "CREDIFLEXI",
    razonSocial: "CREDIFLEXI, S.A.P.I. DE C.V.",
    esquema: "mensual" as const,
    cifras: ["$23,750.00", "$285,000.00"],
    etiquetas: ["Ganancia esperada del periodo (1 mes)", "Ganancia esperada del periodo (12 meses)", "Ganancia esperada del periodo (plazo de 12 meses)"],
    lineaPago: "Pago de rendimiento mensual: cada mes, del mes 1 al mes 12",
    esquemaCorto: "Mensual",
  },
  {
    entidad: "RAMI_SISE",
    razonSocial: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R.",
    esquema: "final_del_plazo" as const,
    cifras: ["$26,250.00", "$315,000.00"],
    etiquetas: [
      "Ganancia esperada del periodo (1 mes), se acumula y se paga al final del plazo",
      "Ganancia esperada del periodo (12 meses)",
      "Ganancia esperada del periodo (plazo de 12 meses)",
    ],
    lineaPago: "Pago de rendimiento: al final del plazo (mes 12), junto con el capital",
    esquemaCorto: "Al final del plazo",
  },
];

function modeloAjustado(entidad: string, esquema: Esquema, ajuste: Ajuste, monto: string, moneda: "MXN" | "USD" = "MXN", entrada: EntradaPdf = OPCIONALES, plazoTabla = 12) {
  const plazo = ajuste.tipo === "especial" ? ajuste.plazo : plazoTabla;
  const r = cotizarConAjuste(semillaReal, { entidad, moneda, esquema, monto, plazo }, ajuste);
  if (!r.ok) throw new Error(r.error.mensaje);
  return sinError(modeloPdf(r.valor, { razonesSociales, textos, benchmark: benchmarkReal }, entrada, AHORA, datosPagina2(semillaReal, r.valor.solicitud, ajuste)));
}

describe.each(CASOS)("PDF real: $entidad ($esquema), 1,500,000 pesos a 12 meses", (caso) => {
  it("es un PDF de exactamente dos páginas", { timeout: TIEMPO }, async () => {
    const { bytes, paginas } = await render(modelo(caso.entidad, caso.esquema));
    expect(new TextDecoder("latin1").decode(bytes.subarray(0, 5))).toBe("%PDF-");
    expect(paginas).toBe(2);
  });

  it("la página 1 trae su texto, la línea de cuándo se paga la ganancia y nada de la página 2", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { porPagina } = await render(m);
    for (const t of [caso.razonSocial, "Tu cotización de inversión", m.lineaTasas, m.pie.base, caso.lineaPago, ...caso.cifras]) {
      expect(porPagina[0]).toContain(t);
    }
    for (const t of [P2.modalidad1, P2.tasaAnual, P2.tituloGrafica1, P2.notaCentavos]) {
      expect(porPagina[0]).not.toContain(t);
    }
  });

  it("la página 2 trae las dos modalidades, las líneas de pago, la franja y la gráfica de comparación", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const t of TEXTOS_PAGINA2) expect(porPagina[1]).toContain(t);
    expect(porPagina[1]).toContain(P2.insignia);
  });

  it("las dos páginas llevan su número de página", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina[0]).toContain(`${P2.pagina} 1 ${P2.paginaDe} 2`);
    expect(porPagina[1]).toContain(`${P2.pagina} 2 ${P2.paginaDe} 2`);
  });

  it("el pie de las dos páginas trae la línea SIPRES y el disclaimer exactos, sin 'supervisada por todas las autoridades'", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const p of porPagina) {
      expect(p).toContain(LINEA_SIPRES);
      expect(p).toContain(DISCLAIMER);
      expect(p).not.toMatch(/supervisad|todas las autoridades/i);
      // CONDUSEF y SIPRES solo dentro de esos dos textos.
      expect(sinLineaSipres(p)).not.toMatch(/CONDUSEF|SIPRES/i);
    }
  });

  it("el esquema se escribe corto en la página 1 y nunca 'Rendimientos mensuales'", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina[0]).toContain(`Esquema ${caso.esquemaCorto}`);
    expect(porPagina[0]).not.toContain("Rendimientos mensuales");
    expect(porPagina[0]).not.toMatch(/Pago de la ganancia|Pago mensual|al vencimiento/);
  });

  it("la página 2: resumen de las tarjetas con 'Ganancia esperada del periodo' y la tabla con sus encabezados de siempre", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const t of [
      "Ganancia esperada del periodo (12 meses)",
      "Ganancia esperada del periodo (plazo de 12 meses)",
      "Ganancia del periodo",
      "Ganancia acumulada",
      "Pago de rendimiento mensual: cada mes, del mes 1 al mes 12",
      "Pago de rendimiento: al final del plazo (mes 12), junto con el capital",
    ]) {
      expect(porPagina[1]).toContain(t);
    }
    expect(porPagina[1]).not.toMatch(/Pago de la ganancia|Ganancia anual equivalente|Ganancia del plazo/);
  });

  it("la página 2 no trae restos técnicos ni lenguaje prohibido (fuera de la línea SIPRES)", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const t of ["undefined", "NaN", "{", "}", "null", "Infinity"]) expect(porPagina[1]).not.toContain(t);
    expect(sinLineaSipres(porPagina[1])).not.toMatch(RE_PROHIBIDO);
  });

  it("trae la razón social, el título, las cifras, las etiquetas y la línea de tasas", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { texto } = await render(m);
    expect(texto).toContain(caso.razonSocial);
    expect(texto).toContain("Tu cotización de inversión");
    for (const cifra of caso.cifras) expect(texto).toContain(cifra);
    for (const etiqueta of caso.etiquetas) expect(texto).toContain(etiqueta);
    expect(texto).toContain(`Tasas versión ${semillaJson.version} del ${semillaJson.generado.split("-").reverse().join("/")}`);
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
      caso.esquemaCorto,
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

  it("no usa lenguaje de promesas, urgencia ni de autoridades (fuera de la línea SIPRES)", { timeout: TIEMPO }, async () => {
    const { texto } = await render(modelo(caso.entidad, caso.esquema));
    expect(sinLineaSipres(texto)).not.toMatch(RE_PROHIBIDO);
  });

  it("no menciona la reinversión ni el escenario ilustrativo", { timeout: TIEMPO }, async () => {
    const { texto } = await render(modelo(caso.entidad, caso.esquema));
    expect(texto).not.toMatch(/reinver|escenario/i);
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
    "SIPRES",
    "SHCP",
    "recibes cada mes",
    "recibirás",
  ])("%s", (t) => {
    expect(t).toMatch(RE_PROHIBIDO);
  });

  it.each(["Netflix", "planeta", "Rendimientos mensuales", "Pago de rendimiento mensual: cada mes, del mes 1 al mes 12"])("no confunde %s", (t) => {
    expect(t).not.toMatch(RE_PROHIBIDO);
  });

  it("la excepción es exacta: la línea SIPRES alterada ya no se perdona", () => {
    expect(sinLineaSipres(LINEA_SIPRES)).not.toMatch(RE_PROHIBIDO);
    const alterada = LINEA_SIPRES.replace("696338", "000000");
    expect(sinLineaSipres(alterada)).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(`${LINEA_SIPRES} Supervisada por la CNBV.`)).toMatch(RE_PROHIBIDO);
  });

  it("el disclaimer se perdona solo exacto: alterado, o con CONDUSEF fuera de él, ya no", () => {
    expect(sinLineaSipres(DISCLAIMER)).not.toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(DISCLAIMER.replace("sujeta a las disposiciones aplicables", "supervisada por todas las autoridades"))).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(`${DISCLAIMER} Registrada ante la CONDUSEF.`)).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Inscrita en el SIPRES")).toMatch(RE_PROHIBIDO);
  });

  it("las negaciones del grupo histórico se perdonan solo exactas; \"garantizado\" en cualquier otro lugar sigue prohibido", () => {
    expect(sinLineaSipres("Rendimiento histórico, no garantizado")).not.toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Rendimientos pasados no garantizan resultados futuros.")).not.toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Rendimiento histórico garantizado")).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Rendimiento garantizado")).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Rendimientos futuros no garantizan nada")).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Rendimiento histórico, no garantizado. Tasa garantizada.")).toMatch(RE_PROHIBIDO);
  });
});

describe("PDF real: las líneas de cuándo se paga la ganancia llevan el N correcto", () => {
  const lineas = (n: number) => [
    `Pago de rendimiento mensual: cada mes, del mes 1 al mes ${n}`,
    `Pago de rendimiento: al final del plazo (mes ${n}), junto con el capital`,
    `Capital: al vencimiento (mes ${n})`,
  ];

  it.each([6, 12, 24])("%s meses", { timeout: TIEMPO }, async (plazo) => {
    const { paginas, porPagina } = await render(modelo("CREDIFLEXI", "mensual", OPCIONALES, "1000000", plazo));
    expect(paginas).toBe(2);
    for (const t of lineas(plazo)) expect(porPagina[1]).toContain(t);
  });

  it("plazo especial de 9 meses", { timeout: TIEMPO }, async () => {
    const m = modeloAjustado("CREDIFLEXI", "mensual", { tipo: "especial", plazo: 9, tasas: { mensual: "17", final_del_plazo: "19" } }, "100000");
    const { paginas, porPagina } = await render(m);
    expect(paginas).toBe(2);
    for (const t of lineas(9)) expect(porPagina[1]).toContain(t);
  });
});

describe("PDF real: puntos extra y plazo especial", () => {
  it("+1.0 punto: la página 1 trae el desglose y el pago con 20%", { timeout: TIEMPO }, async () => {
    const m = modeloAjustado("CREDIFLEXI", "mensual", { tipo: "tabla", puntos: "1.0" }, "1500000");
    const { porPagina } = await render(m);
    expect(porPagina[0]).toContain("Tasa de tabla 19.00% + 1.0 puntos extra = 20.00%");
    expect(porPagina[0]).toContain("$25,000.00");
    expect(porPagina[1]).toContain("20.00%");
  });

  it("plazo especial: Plazo especial y Tasa acordada, nunca tasa de tabla", { timeout: TIEMPO }, async () => {
    const m = modeloAjustado("CREDIFLEXI", "mensual", { tipo: "especial", plazo: 9, tasas: { mensual: "17" } }, "100000");
    const { paginas, texto, porPagina } = await render(m);
    expect(paginas).toBe(2);
    expect(porPagina[0]).toContain(textos.pdf.plazoEspecial);
    expect(porPagina[0]).toContain(textos.pdf.tasaAcordada);
    expect(porPagina[1]).toContain(P2.tasaAcordada);
    expect(texto).not.toMatch(/tasa de tabla/i);
    expect(porPagina[1]).toContain(P2.modalidadSinTasa);
    expect(porPagina[1]).toContain(P2.comparacionOmitida);
  });
});

describe("PDF real: comparativo de tasas (seed/benchmark.json)", () => {
  /** CREDIFLEXI mensual 1,500,000 a 12 meses (19.00%) con la fecha del PDF indicada. */
  function conFecha(ahora: Date, moneda: "MXN" | "USD" = "MXN") {
    const c = moneda === "MXN" ? cotizarBien({ monto: "1500000", plazo: 12 }) : cotizarBien({ entidad: "RAMI_SISE", moneda, monto: "10000", plazo: 12 });
    return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, OPCIONALES, ahora, datosPagina2(semillaReal, c.solicitud)));
  }

  it("el 8 de octubre trae los dos grupos, cada barra con su tasa y su fecha, los avisos, los asteriscos y las fuentes", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(conFecha(new Date("2026-10-08T18:00:00Z")));
    expect(paginas).toBe(2);
    const p2 = porPagina[1];
    expect(p2).toContain(P2.benchmarkTitulo);
    expect(p2).toContain(
      "Última tasa publicada de cada instrumento; la fecha de cada uno se indica junto a su barra. Actualizado al 8 de octubre de 2026.",
    );
    expect(p2).toContain("Fuentes: Cetesdirecto, Mercado Pago, Nu México, BBVA, Santander, BlackRock, State Street (S&P 500) y Invesco (Nasdaq-100)");
    expect(p2).toContain("en dólares (USD)");
    for (const t of [
      "Última tasa publicada",
      "Rendimiento histórico, no garantizado",
      "Tu tasa 19.00%",
      "CETES 1 año",
      "7.44%",
      "publicada el 8 de octubre de 2026",
      "Mercado Pago, hasta 12% (1)",
      "Nu · Cajita Turbo (hasta $25,000) (2)",
      "vigente hasta el 7 de octubre de 2026",
      "BBVA · Pagaré 360 días (3)",
      "3.40%",
      "publicada el 1 de octubre de 2026",
      "Santander · Pagaré 360 días (4)",
      "5.75%",
      "publicada el 8 de septiembre de 2026",
      "Nasdaq-100 (10 años anualizado) (5)",
      "21.16%",
      "al corte del 29 de septiembre de 2026",
      "S&P 500 (10 años anualizado)",
      "15.51%",
      "al corte del 30 de junio de 2026",
      "BlackRock · BLKGUB1 (12 meses)",
      "al corte del 31 de diciembre de 2025",
    ]) {
      expect(p2).toContain(t);
    }
    for (const a of [...benchmarkReal.avisos.tasa_vigente, ...benchmarkReal.avisos.rendimiento_historico]) expect(p2).toContain(a);
    for (const n of [
      "(1) Hasta 12% anual",
      "(2) Hasta $25,000",
      "(3) Pagaré Tradicional a 360 días",
      "(4) Pagaré Súper CETE a 360 días",
      "(5) Rendimiento anual con interés compuesto, en dólares; renta variable con riesgo más alto y más volátil.",
    ]) {
      expect(p2).toContain(n);
    }
    for (const fuera of ["CETES 28 días", "Inbursa", "Caja Libertad"]) expect(p2).not.toContain(fuera);
    expect(porPagina[0]).not.toContain(P2.benchmarkTitulo);
  });

  it("con puntos extra, tu tasa del comparativo es la tasa con los puntos (19.00% + 1.0 = 20.00%)", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modeloAjustado("CREDIFLEXI", "mensual", { tipo: "tabla", puntos: "1.0" }, "1500000"));
    expect(porPagina[1]).toContain("Tu tasa 20.00%");
  });

  it("con el archivo tal cual, el 9 de octubre Nu (vigente hasta el 7) se dibuja con su fecha", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(conFecha(new Date("2026-10-09T12:00:00-06:00")));
    expect(porPagina[1]).toContain("Nu · Cajita 24/7");
    expect(porPagina[1]).toContain("vigente hasta el 7 de octubre de 2026");
  });

  it("en dólares lo omite con su nota", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(conFecha(new Date("2026-10-08T18:00:00Z"), "USD"));
    expect(paginas).toBe(2);
    expect(porPagina[1]).toContain(P2.benchmarkSoloPesos);
    expect(porPagina[1]).not.toContain("CETES");
  });
});

describe("PDF real: exactamente dos páginas en los extremos", () => {
  const TOPE: EntradaPdf = {
    preparadoPara: largo("Persona Sintética Uno con un nombre largo", TOPES.preparadoPara),
    ejecutivo: largo("Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test", TOPES.ejecutivo),
    vigencia: largo("15 días naturales", TOPES.vigencia),
    notaAdicional: largo("Nota sintética de prueba con texto largo", TOPES.notaAdicional),
  };

  it.each(CASOS)("$entidad con los cuatro opcionales en su tope y 24 meses sigue en dos páginas y sin cortes", { timeout: TIEMPO }, async (caso) => {
    expect(Array.from(TOPE.preparadoPara ?? "")).toHaveLength(120);
    expect(Array.from(TOPE.ejecutivo ?? "")).toHaveLength(120);
    expect(Array.from(TOPE.vigencia ?? "")).toHaveLength(60);
    expect(Array.from(TOPE.notaAdicional ?? "")).toHaveLength(300);
    const m = modelo(caso.entidad, caso.esquema, TOPE, "99999999.99", 24);
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
    // La página 2 con 24 filas en la modalidad 1, completa, con su pie.
    for (const t of TEXTOS_PAGINA2) expect(porPagina[1]).toContain(t);
    expect(porPagina[1]).toContain("$99,999,999.99");
    expect(porPagina[1]).toContain("Capital: al vencimiento (mes 24)");
    expect(porPagina[1]).toContain(DISCLAIMER);
    expect(porPagina[1]).toContain(LINEA_SIPRES);
  });

  it("USD de Rami Sise a 24 meses con los opcionales al tope: dos páginas", { timeout: TIEMPO }, async () => {
    const c = cotizarBien({ entidad: "RAMI_SISE", moneda: "USD", monto: "500000", plazo: 24 });
    const m = sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, TOPE, AHORA, datosPagina2(semillaReal, c.solicitud)));
    const { paginas, porPagina } = await render(m);
    expect(paginas).toBe(2);
    expect(porPagina[1]).toContain(LINEA_SIPRES);
    expect(porPagina[1]).toContain("Capital: al vencimiento (mes 24)");
  });

  it("plazo especial de 24 meses con las dos tasas, puntos de tabla en cero y opcionales al tope: dos páginas", { timeout: TIEMPO }, async () => {
    const m = modeloAjustado("RAMI_SISE", "final_del_plazo", { tipo: "especial", plazo: 24, tasas: { mensual: "17", final_del_plazo: "19" } }, "99999999.99", "MXN", TOPE);
    const { paginas, porPagina } = await render(m);
    expect(paginas).toBe(2);
    expect(porPagina[1]).toContain("Pago de rendimiento mensual: cada mes, del mes 1 al mes 24");
    expect(porPagina[0]).toContain("Pago de rendimiento: al final del plazo (mes 24), junto con el capital");
    expect(porPagina[0]).toContain("Ganancia esperada del periodo (plazo de 24 meses)");
  });

  // Peor caso de la página 1: SIPRES, desglose de puntos y opcionales al tope.
  it.each([
    { esquema: "mensual", moneda: "MXN", monto: "99999999.99" },
    { esquema: "final_del_plazo", moneda: "MXN", monto: "99999999.99" },
    { esquema: "mensual", moneda: "USD", monto: "500000" },
  ] as const)("Rami Sise $esquema $moneda con +5.0 puntos, opcionales al tope y 24 meses: dos páginas", { timeout: TIEMPO }, async ({ esquema, moneda, monto }) => {
    const m = modeloAjustado("RAMI_SISE", esquema, { tipo: "tabla", puntos: "5.0" }, monto, moneda, TOPE, 24);
    const { paginas, porPagina } = await render(m);
    expect(paginas).toBe(2);
    expect(m.desgloseTasa).not.toBeNull();
    expect(porPagina[0]).toContain(m.desgloseTasa);
    expect(porPagina[0]).toContain(m.pie.notaAdicional);
    expect(porPagina[0]).toContain(LINEA_SIPRES);
    expect(porPagina[0]).toContain(DISCLAIMER);
    expect(porPagina[1]).toContain(LINEA_SIPRES);
    expect(porPagina[1]).toContain(DISCLAIMER);
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
  it("la modalidad 1 con su tabla y la 2 anualizada, sin filas por mes", { timeout: TIEMPO }, async () => {
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
      // Modalidad 2: anual 1,000,000 × 0.20 = 200,000.00; ganancia del plazo 100,000.00.
      "$200,000.00",
      "$100,000.00",
      "$1,100,000.00",
      P2.serieCobrado,
      P2.serieDevengado,
    ]) {
      expect(p2).toContain(t);
    }
    // Ya no van las filas mensuales de la modalidad 2.
    for (const t of ["$16,666.67", "$16,666.66", "$33,333.33", "$83,333.33"]) expect(p2).not.toContain(t);
  });
});
