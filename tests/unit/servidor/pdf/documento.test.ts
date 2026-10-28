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
import { extraerTexto, textosConTamano } from "./extraer";
import { benchmarkReal } from "../../benchmarkReal";

/** Fecha de inicio de las cotizaciones de estas pruebas (Sprint 6b: días naturales). */
const INICIO = "2026-10-15";

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
  return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, entrada, AHORA, datosPagina2(semillaReal, c.solicitud, INICIO)));
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
  P2.capitalMasRendimiento,
  P2.columnaRendimientoMensual,
  P2.columnaRendimientoAcumulado,
  P2.notaCentavos,
  P2.tituloGrafica1,
  P2.franjaMasCapital,
  P2.franjaRendimientoCapital,
];

/** La línea SIPRES exacta (Sprint 5: en el pie de las dos entidades). */
const LINEA_SIPRES =
  "Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R. · Inscrita en el SIPRES de la CONDUSEF con clave de registro 696338 · webapps.condusef.gob.mx/SIPRES";

/**
 * El pie exacto de las dos páginas, para las dos entidades (Sprint 7a, textos
 * 0.13): reemplaza al disclaimer anterior y a la nota "Tasa neta: ya después
 * de impuestos.". Junto con la línea SIPRES, es el único lugar del pie donde se
 * permite "netas".
 */
const DISCLAIMER =
  "Cotización de CREDIFLEXI, Fondo Privado de Inversión, operado por Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R. Tasas sujetas a cambios. " +
  "Para acceder al fondo privado se requiere la compra de una acción de $1,000.00 MXN. Cotización con tasas netas. La presente cotización " +
  "no representa un contrato ni un documento con valor legal; es solo informativa.";

/** Lo que el pie ya no lleva (Sprint 7a). */
const NOTA_NETA_ANTERIOR = "Tasa neta: ya después de impuestos.";
const AUTORIDAD_ANTERIOR = "autoridad supervisora indicada en dicho registro";

/** La nota neta/bruta del comparativo (página 2), sin cambios. */
const NOTA_NETA_BENCHMARK = "La tasa de Crediflexi se muestra neta; las demás, brutas, antes de impuestos.";

/** Los diez términos del glosario único; "Rendimiento total" y el pago al final llevan los meses de la inversión. */
const GLOSARIO = (meses: number) => [
  "Rendimiento mensual",
  "Rendimiento anual (12 meses)",
  `Rendimiento total (${meses} meses)`,
  "Capital + rendimiento total",
  "Pago de rendimiento mensual",
  `Pago de rendimiento: al final del plazo (mes ${meses}), junto con el capital`,
  "Mensual",
  "Al final del plazo",
  "Rendimiento acumulado",
  "Tasa anual neta",
];

const RE_PROHIBIDO =
  /(?<![\p{L}\p{N}])(garantiz\p{L}*|asegur\p{L}*|sin riesgo|libre de impuestos|netas?|netos?|sin comisiones|supervis\p{L}*|promesa|recib(es|ir[aá]s)|CNBV|CONDUSEF|SIPRES|SHCP)(?![\p{L}\p{N}])/iu;

/**
 * Únicas excepciones exactas a la revisión de lenguaje: la línea SIPRES
 * (CONDUSEF y SIPRES solo ahí), el pie de la cotización ("netas" solo ahí), la
 * nota neta/bruta del comparativo y las dos negaciones del grupo histórico
 * (seed/benchmark.json).
 */
const EXCEPCIONES_EXACTAS = [
  LINEA_SIPRES,
  DISCLAIMER,
  NOTA_NETA_BENCHMARK,
  "Rendimiento histórico, no garantizado",
  "Rendimientos pasados no garantizan resultados futuros",
];

/**
 * El texto sin las excepciones exactas: lo que queda debe pasar la revisión de
 * lenguaje. "neta" solo se perdona en la etiqueta "Tasa anual neta" (y "Tu tasa
 * anual neta"), en cualquier capitalización, y en las dos notas exactas.
 */
const sinLineaSipres = (texto: string) =>
  EXCEPCIONES_EXACTAS.reduce((x, e) => x.split(e).join(" "), texto).replace(/(?<![\p{L}\p{N}])tasa anual neta(?![\p{L}\p{N}])/giu, " ");

const CASOS = [
  {
    entidad: "CREDIFLEXI",
    razonSocial: "CREDIFLEXI, S.A.P.I. DE C.V.",
    esquema: "mensual" as const,
    cifras: ["$23,750.00", "$285,000.00"],
    etiquetas: ["Rendimiento mensual (promedio)", "Rendimiento anual (12 meses)", "Rendimiento total (12 meses)"],
    lineaPago: "Pago de rendimiento mensual: cada mes, del mes 1 al mes 12",
    esquemaCorto: "Mensual",
  },
  {
    entidad: "RAMI_SISE",
    razonSocial: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R.",
    esquema: "final_del_plazo" as const,
    cifras: ["$26,250.00", "$315,000.00"],
    etiquetas: [
      "Rendimiento mensual (promedio), se acumula y se paga al final del plazo",
      "Rendimiento anual (12 meses)",
      "Rendimiento total (12 meses)",
    ],
    lineaPago: "Pago de rendimiento: al final del plazo (mes 12), junto con el capital",
    esquemaCorto: "Al final del plazo",
  },
];

function modeloAjustado(entidad: string, esquema: Esquema, ajuste: Ajuste, monto: string, moneda: "MXN" | "USD" = "MXN", entrada: EntradaPdf = OPCIONALES, plazoTabla = 12) {
  const plazo = ajuste.tipo === "especial" ? ajuste.plazo : plazoTabla;
  const r = cotizarConAjuste(semillaReal, { entidad, moneda, esquema, monto, plazo }, ajuste);
  if (!r.ok) throw new Error(r.error.mensaje);
  return sinError(modeloPdf(r.valor, { razonesSociales, textos, benchmark: benchmarkReal }, entrada, AHORA, datosPagina2(semillaReal, r.valor.solicitud, INICIO, ajuste)));
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
    for (const t of [caso.razonSocial, "Tu cotización de inversión", m.lineaTasas, caso.lineaPago, ...caso.cifras]) {
      expect(porPagina[0]).toContain(t);
    }
    // "Tasa anual neta" va en las dos páginas (glosario), así que ya no sirve para distinguirlas.
    for (const t of [P2.modalidad1, P2.tituloGrafica1, P2.notaCentavos]) {
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

  it("el pie de las dos páginas trae la línea SIPRES y el pie nuevo exactos, sin el disclaimer anterior ni la nota neta anterior", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina).toHaveLength(2);
    for (const p of porPagina) {
      expect(p).toContain(LINEA_SIPRES);
      expect(p).toContain(DISCLAIMER);
      expect(p).not.toContain(AUTORIDAD_ANTERIOR);
      expect(p).not.toContain(NOTA_NETA_ANTERIOR);
      expect(p).not.toMatch(/supervis|todas las autoridades|CNBV/i);
      // CONDUSEF y SIPRES solo dentro de esos dos textos.
      expect(sinLineaSipres(p)).not.toMatch(/CONDUSEF|SIPRES/i);
    }
  });

  it("la página 1 ya no trae el texto base (Sprint 7d); la línea SIPRES y el pie siguen exactos en las páginas 1 y 2", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina).toHaveLength(2);
    for (const quitado of ["Cotización informativa para", "calculada con interés simple", "las del contrato que se firme"]) {
      expect(porPagina[0]).not.toContain(quitado);
    }
    for (const p of porPagina) {
      expect(p).toContain(LINEA_SIPRES);
      expect(p).toContain(DISCLAIMER);
    }
  });

  it("el esquema se escribe con el glosario en la página 1", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina[0]).toContain(`Esquema ${caso.esquemaCorto}`);
    expect(porPagina[0]).not.toMatch(/Rendimientos mensuales|Pago de la ganancia|Pago mensual|al vencimiento/);
  });

  it("el texto de las dos páginas trae los términos del glosario y ninguna variante de 'ganancia'", { timeout: TIEMPO }, async () => {
    const { texto, porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const termino of GLOSARIO(12)) expect(texto).toContain(termino);
    expect(texto).not.toMatch(/ganancia/i);
    expect(texto).not.toMatch(/Modalidad 1 \(cobrado\)|Modalidad 2 \(acumulado\)/);
    // "Cotización con tasas netas" va en el pie de las dos páginas; la nota del comparativo, sin cambios, en la página 2.
    for (const p of porPagina) expect(p).toContain("Cotización con tasas netas.");
    expect(porPagina[1]).toContain(NOTA_NETA_BENCHMARK);
    expect(porPagina[1]).toContain("Tasas anuales brutas, antes de impuestos.");
  });

  it("la Modalidad 2 ya no lleva el renglón del rendimiento anual en la página 2", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    expect(porPagina[1]).not.toContain("Rendimiento anual (12 meses)");
  });

  it("la página 2: tarjetas, tabla y gráfica con los términos del glosario", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modelo(caso.entidad, caso.esquema));
    for (const t of [
      "Rendimiento total (12 meses)",
      "Capital + rendimiento total",
      "Rendimiento mensual",
      "Rendimiento acumulado",
      "Tasa anual neta",
      "Mensual",
      "Al final del plazo",
      "Pago de rendimiento mensual: cada mes, del mes 1 al mes 12",
      "Pago de rendimiento: al final del plazo (mes 12), junto con el capital",
    ]) {
      expect(porPagina[1]).toContain(t);
    }
    expect(porPagina[1]).not.toMatch(/ganancia/i);
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
      "Tasa anual neta",
      caso.esquema === "mensual" ? "19.00%" : "21.00%",
      "Esquema",
      caso.esquemaCorto,
      "Rendimientos esperados del periodo",
      "Cómo se calculó",
    ]) {
      expect(texto).toContain(t);
    }
  });

  it("trae las líneas opcionales y la nota", { timeout: TIEMPO }, async () => {
    const m = modelo(caso.entidad, caso.esquema);
    const { texto } = await render(m);
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
    "tasas netas",
    "monto neto",
    "montos netos",
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

  it.each(["Netflix", "planeta", "Mensual", "Pago de rendimiento mensual: cada mes, del mes 1 al mes 12"])("no confunde %s", (t) => {
    expect(t).not.toMatch(RE_PROHIBIDO);
  });

  it("la excepción es exacta: la línea SIPRES alterada ya no se perdona", () => {
    expect(sinLineaSipres(LINEA_SIPRES)).not.toMatch(RE_PROHIBIDO);
    const alterada = LINEA_SIPRES.replace("696338", "000000");
    expect(sinLineaSipres(alterada)).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(`${LINEA_SIPRES} Supervisada por la CNBV.`)).toMatch(RE_PROHIBIDO);
  });

  it("el pie se perdona solo exacto: alterado, o con CONDUSEF o SIPRES fuera de la línea SIPRES, ya no", () => {
    expect(sinLineaSipres(DISCLAIMER)).not.toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(DISCLAIMER.replace("es solo informativa", "está supervisada por todas las autoridades"))).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(`${DISCLAIMER} Registrada ante la CONDUSEF.`)).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Inscrita en el SIPRES")).toMatch(RE_PROHIBIDO);
  });

  it("'neta' solo se perdona en 'Tasa anual neta', en el pie exacto y en la nota exacta del comparativo; la nota neta anterior ya no", () => {
    expect(sinLineaSipres(`Tasa anual neta TASA ANUAL NETA Tu tasa anual neta ${DISCLAIMER} ${NOTA_NETA_BENCHMARK}`)).not.toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Rendimiento neto")).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Tasa neta anual")).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres("Cotización con tasas netas.")).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(DISCLAIMER.replace("Cotización con tasas netas.", "Cotización con tasas netas y sin comisiones."))).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(NOTA_NETA_ANTERIOR)).toMatch(RE_PROHIBIDO);
  });

  it("con el pie nuevo, 'supervisada' y 'CNBV' siguen prohibidas", () => {
    expect(sinLineaSipres(DISCLAIMER)).not.toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(DISCLAIMER.replace("Tasas sujetas a cambios.", "Supervisada por la CNBV."))).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(`${DISCLAIMER} Supervisada por la CNBV.`)).toMatch(RE_PROHIBIDO);
    expect(sinLineaSipres(`${LINEA_SIPRES} supervisada`)).toMatch(RE_PROHIBIDO);
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
    return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, OPCIONALES, ahora, datosPagina2(semillaReal, c.solicitud, INICIO)));
  }

  it("el 28 de octubre trae los seis instrumentos en dos grupos, cada barra con su tasa y su fecha, los avisos, las notas y las fuentes", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(conFecha(new Date("2026-10-28T18:00:00Z")));
    expect(paginas).toBe(2);
    const p2 = porPagina[1];
    expect(p2).toContain(P2.benchmarkTitulo);
    expect(p2).toContain(
      "Última tasa publicada de cada instrumento; la fecha de cada uno se indica junto a su barra. Actualizado al 28 de octubre de 2026.",
    );
    expect(p2).toContain("Fuentes: Banamex, BlackRock, Cetesdirecto, Mercado Pago, Nu y S&P 500 (cálculo propio)");
    expect(p2).toContain("en dólares (USD)");
    for (const t of [
      "Última tasa publicada",
      "Rendimiento histórico, no garantizado",
      "Tu tasa anual neta 19.00%",
      "CETES 1 año",
      "7.44%",
      "publicada el 8 de octubre de 2026",
      "Mercado Pago · Apartados Meli+ (2)",
      "15.00%",
      "publicada el 28 de octubre de 2026",
      "Nu · Cajita Turbo (3)",
      "13.00%",
      "vigente hasta el 18 de noviembre de 2026",
      "Banamex · Pagaré 60 días (1)",
      "6.28%",
      "vigente hasta el 30 de octubre de 2026",
      "S&P 500 (2 años anualizado) (4)",
      "21.40%",
      "al corte del 31 de diciembre de 2025",
      "2 años al 31/12/2025",
      "BlackRock · BLKGUB1 (12 meses)",
      "6.53%",
      "al corte del 30 de septiembre de 2026",
    ]) {
      expect(p2).toContain(t);
    }
    // El S&P 500 va en el grupo histórico: después del título de ese grupo.
    expect(p2.indexOf("S&P 500 (2 años anualizado)")).toBeGreaterThan(p2.indexOf("Rendimiento histórico, no garantizado"));
    expect(p2.indexOf("Banamex · Pagaré 60 días")).toBeLessThan(p2.indexOf("Rendimiento histórico, no garantizado"));
    for (const a of [...benchmarkReal.avisos.tasa_vigente, ...benchmarkReal.avisos.rendimiento_historico]) expect(p2).toContain(a);
    for (const n of [
      "(1) Pagaré Banamex a 60 días, desde $2,500; no es a un año.",
      "(2) Hasta 15% solo en Apartados, con suscripción activa a Meli+ (tiene costo) y hasta $25,000; sin suscripción, hasta 12% con condiciones.",
      "(3) Máximo $25,000 y una compra al mes con tarjeta Nu; vigente del 8 de octubre al 18 de noviembre de 2026.",
      "(4) Cálculo propio con rendimientos anuales de fuentes secundarias.",
    ]) {
      expect(p2).toContain(n);
    }
    // Nu Cajita 24/7 (la cuenta de "Nu México") no va: solo la Cajita Turbo.
    for (const fuera of ["CETES 28 días", "Inbursa", "Caja Libertad", "BBVA", "Santander", "Nasdaq", "Cajita 24/7", "Nu México", "10 años"]) expect(p2).not.toContain(fuera);
    expect(porPagina[0]).not.toContain(P2.benchmarkTitulo);
  });

  it("con puntos extra, tu tasa del comparativo es la tasa con los puntos (19.00% + 1.0 = 20.00%)", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(modeloAjustado("CREDIFLEXI", "mensual", { tipo: "tabla", puntos: "1.0" }, "1500000"));
    expect(porPagina[1]).toContain("Tu tasa anual neta 20.00%");
  });

  it("con el archivo tal cual, el 31 de octubre Banamex (vigente hasta el 30) se dibuja con su fecha", { timeout: TIEMPO }, async () => {
    const { porPagina } = await render(conFecha(new Date("2026-10-31T12:00:00-06:00")));
    expect(porPagina[1]).toContain("Banamex · Pagaré 60 días (1)");
    expect(porPagina[1]).toContain("vigente hasta el 30 de octubre de 2026");
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
    const m = sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, TOPE, AHORA, datosPagina2(semillaReal, c.solicitud, INICIO)));
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
    expect(porPagina[0]).toContain("Rendimiento total (24 meses)");
  });

  // Peor caso de la página 1: SIPRES, desglose de puntos y opcionales al tope.
  it.each([
    { esquema: "mensual", moneda: "MXN", monto: "99999999.99" },
    { esquema: "final_del_plazo", moneda: "MXN", monto: "99999999.99" },
    { esquema: "mensual", moneda: "USD", monto: "500000" },
  ] as const)("Rami Sise $esquema $moneda con +4.0 puntos (el máximo), opcionales al tope y 24 meses: dos páginas", { timeout: TIEMPO }, async ({ esquema, moneda, monto }) => {
    const m = modeloAjustado("RAMI_SISE", esquema, { tipo: "tabla", puntos: "4.0" }, monto, moneda, TOPE, 24);
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
      // Días naturales desde el 15/10/2026 (casos A y D del Sprint 6b).
      "15/11/2026",
      "$15,287.67",
      "$14,794.52",
      "$30,082.19",
      "$13,808.22",
      "$74,465.75",
      "$89,753.42",
      "$1,089,753.42",
      // Modalidad 2: rendimiento total 1,000,000 × 0.20 × 182 ÷ 365 = 99,726.03.
      "$99,726.03",
      "$1,099,726.03",
      "Vencimiento: 15/04/2027",
      P2.serieMensual,
      P2.serieFinal,
    ]) {
      expect(p2).toContain(t);
    }
    // La Modalidad 2 ya no lleva el rendimiento anual (1,000,000 × 0.20 = 200,000.00).
    expect(p2).not.toContain("$200,000.00");
    // Ya no van las filas mensuales de la modalidad 2.
    for (const t of ["$16,666.67", "$16,666.66", "$33,333.33", "$83,333.33"]) expect(p2).not.toContain(t);
  });
});

describe("PDF real: plazo especial de más de 24 meses (Sprint 6a)", () => {
  const ESPECIAL = (meses: number) => ({ tipo: "especial", plazo: meses, tasas: { mensual: "17.00", final_del_plazo: "19.00" } }) as const;

  // Días naturales desde el 15/10/2026 (Sprint 6b): 36 meses es el caso F (1,096 días); 60 meses son 1,826 días.
  it.each([
    [36, "$1,397.18", "$51,046.58", "15/10/2029"],
    [60, "$1,397.12", "$85,046.58", "15/10/2031"],
  ] as const)("%i meses: EXACTAMENTE 3 páginas; el calendario mensual completo va en la tercera", { timeout: TIEMPO }, async (meses, ultimo, total, vencimiento) => {
    const { paginas, porPagina } = await render(modeloAjustado("CREDIFLEXI", "mensual", ESPECIAL(meses), "100000", "MXN", OPCIONALES));
    expect(paginas).toBe(3);
    for (let n = 1; n <= 3; n++) expect(porPagina[n - 1]).toContain(`${P2.pagina} ${n} ${P2.paginaDe} 3`);
    // La página 2 conserva tarjetas, gráfica y comparativo, sin las filas del calendario.
    expect(porPagina[1]).toContain(P2.modalidad1);
    expect(porPagina[1]).toContain(P2.benchmarkTitulo);
    expect(porPagina[1]).not.toContain(ultimo);
    // La tercera lleva el calendario con sus encabezados, el último pago que ajusta los centavos y el total.
    for (const t of [P2.columnaFechaPago, P2.columnaDias, P2.columnaRendimientoMensual, P2.columnaRendimientoAcumulado, "$1,443.84", ultimo, total, vencimiento]) {
      expect(porPagina[2]).toContain(t);
    }
    expect(porPagina[2]).toContain(P2.notaDiaInhabil);
    expect(porPagina[2]).toContain(DISCLAIMER);
  });

  it("36 meses: toda la letra de la tercera página mide 7.5 pt o más", { timeout: TIEMPO }, async () => {
    const { bytes } = await render(modeloAjustado("CREDIFLEXI", "mensual", ESPECIAL(36), "100000", "MXN", OPCIONALES));
    const items = await textosConTamano(bytes, 3);
    expect(items.length).toBeGreaterThan(36 * 3);
    for (const i of items) expect(i.tamano, i.texto).toBeGreaterThanOrEqual(7.5 - 1e-6);
  });

  it("24 meses: sigue en EXACTAMENTE 2 páginas", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(modeloAjustado("CREDIFLEXI", "mensual", ESPECIAL(24), "100000", "MXN", OPCIONALES));
    expect(paginas).toBe(2);
    expect(porPagina[1]).toContain(`${P2.pagina} 2 ${P2.paginaDe} 2`);
  });

  it("al final del plazo a 36 meses (USD de Rami Sise) también lleva la tercera página con el calendario mensual", { timeout: TIEMPO }, async () => {
    const { paginas, porPagina } = await render(modeloAjustado("RAMI_SISE", "final_del_plazo", { tipo: "especial", plazo: 36, tasas: { mensual: "8.00", final_del_plazo: "9.00" } }, "50000", "USD", OPCIONALES));
    expect(paginas).toBe(3);
    expect(porPagina[2]).toContain("USD");
  });
});
