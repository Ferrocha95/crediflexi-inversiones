import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cargarTextos, type TextosCotizacion } from "../../../src/aplicacion/textos";

const ARCHIVO = "seed/textos_cotizacion.json";

type TextosJson = typeof textosJson;
const copia = (): TextosJson => structuredClone(textosJson);

const CLAVES_PDF_SIN_MARCADORES = [
  "titulo",
  "preparado_para",
  "fecha",
  "resumen_monto",
  "resumen_plazo",
  "resumen_esquema",
  "seccion_resultados",
  "seccion_calculo",
  "plazo_especial",
  "tasa_acordada",
] as const;

function cargarBien(json: unknown): TextosCotizacion {
  const r = cargarTextos(json, ARCHIVO);
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

function errorDe(json: unknown): { mensaje: string; detalles: readonly string[]; todo: string } {
  const r = cargarTextos(json, ARCHIVO);
  if (r.ok) throw new Error("Se esperaba que la carga fallara");
  expect(r.error.codigo).toBe("TEXTOS_INVALIDOS");
  const detalles = r.error.detalles ?? [];
  return { mensaje: r.error.mensaje, detalles, todo: [r.error.mensaje, ...detalles].join("\n") };
}

describe("cargarTextos: el archivo real", () => {
  it("carga seed/textos_cotizacion.json versión 0.9", () => {
    const t = cargarBien(textosJson);
    expect(t.version).toBe("0.19");
    // Sprint 7d, textos 0.17: el texto base de la página 1 ya no existe.
    expect(textosJson).not.toHaveProperty("pie_base");
    expect(t).not.toHaveProperty("pieBase");
    expect(t.lineaPreparadoPor).toBe("Preparado por {ejecutivo}.");
    expect(t.lineaVigencia).toBe("Vigencia: {vigencia}.");
    expect(t.monedaDeshabilitada).toBe("Las tasas en {moneda} están por confirmar.");
  });

  it("textos 0.19 (Sprint 8a): la franja del entorno de prueba, exacta", () => {
    const t = cargarBien(textosJson);
    expect(t.avisoEntornoPrueba).toBe("ENTORNO DE PRUEBA: no captures datos reales de clientes");
  });

  it("aviso_entorno_prueba es obligatorio y no admite marcadores", () => {
    const sin = { ...(textosJson as Record<string, unknown>) };
    delete sin.aviso_entorno_prueba;
    expect(cargarTextos(sin, "textos_cotizacion.json").ok).toBe(false);
    expect(cargarTextos({ ...(textosJson as Record<string, unknown>), aviso_entorno_prueba: "Prueba de {ejecutivo}" }, "textos_cotizacion.json").ok).toBe(false);
  });

  it("trae la explicación de los tres estatus", () => {
    const t = cargarBien(textosJson);
    expect(Object.keys(t.estatusTramo).sort()).toEqual(["CONFIRMADA", "POR_CONFIRMAR", "SEGUN_USUARIO_PPTX"]);
    expect(t.estatusTramo.SEGUN_USUARIO_PPTX).toBe(
      "Tasa según la tabla de rendimientos vigente; aún sin confirmación formal.",
    );
  });

  it("el nombre de los dos esquemas sale del glosario (selector, página 1 y vista previa)", () => {
    const t = cargarBien(textosJson);
    expect(t.nombreEsquema).toEqual({ mensual: "Mensual", final_del_plazo: "Al final del plazo" });
    expect(t.esquemaCorto).toEqual(t.nombreEsquema);
  });
});

/** Los diez términos del glosario único (Sprint 6a). */
const GLOSARIO = {
  rendimiento_mensual: "Rendimiento mensual",
  rendimiento_mensual_promedio: "Rendimiento mensual (promedio)",
  rendimiento_anual: "Rendimiento anual (12 meses)",
  rendimiento_total: "Rendimiento total ({meses} meses)",
  capital_mas_rendimiento: "Capital + rendimiento total",
  pago_rendimiento_mensual: "Pago de rendimiento mensual",
  pago_rendimiento_final: "Pago de rendimiento: al final del plazo (mes {meses}), junto con el capital",
  mensual: "Mensual",
  final_del_plazo: "Al final del plazo",
  rendimiento_acumulado: "Rendimiento acumulado",
  tasa_anual_neta: "Tasa anual neta",
};

/** Pie de la cotización (Sprint 7a, 0.13): reemplaza al disclaimer anterior y a la nota "Tasa neta: ya después de impuestos.". */
const DISCLAIMER =
  "Cotización de CREDIFLEXI, Fondo Privado de Inversión, operado por Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R. Tasas sujetas a cambios. " +
  "Para acceder al fondo privado se requiere la compra de una acción de $1,000.00 MXN. Cotización con tasas netas. La presente cotización " +
  "no representa un contrato ni un documento con valor legal; es solo informativa.";

describe("cargarTextos: glosario único (Sprint 6a, versión 0.8)", () => {
  it("el bloque glosario trae exactamente los once términos (Sprint 6b: más el rendimiento mensual promedio)", () => {
    expect(textosJson.glosario).toEqual(GLOSARIO);
    expect(cargarBien(textosJson).glosario).toEqual(GLOSARIO);
  });

  it("las etiquetas de los resultados salen del glosario: el mensual es el promedio (Sprint 6b); al final del plazo conserva su nota", () => {
    expect(cargarBien(textosJson).etiquetasResultados).toEqual({
      mensual: {
        rendimiento_mensual_pesos: "Rendimiento mensual (promedio)",
        rendimiento_anual_pesos: "Rendimiento anual (12 meses)",
        ganancia_total_plazo: "Rendimiento total ({meses} meses)",
      },
      final_del_plazo: {
        rendimiento_mensual_pesos: "Rendimiento mensual (promedio), se acumula y se paga al final del plazo",
        rendimiento_anual_pesos: "Rendimiento anual (12 meses)",
        ganancia_total_plazo: "Rendimiento total ({meses} meses)",
      },
    });
  });

  it("las líneas de pago salen del glosario (página 1, página 2 y vista previa)", () => {
    const t = cargarBien(textosJson);
    expect(t.lineaPago).toEqual({
      mensual: "Pago de rendimiento mensual: cada mes, del mes 1 al mes {meses}",
      final_del_plazo: "Pago de rendimiento: al final del plazo (mes {meses}), junto con el capital",
    });
    expect([t.pdfPagina2.pagoRendimientoMensual, t.pdfPagina2.pagoRendimientoFinal]).toEqual([t.lineaPago.mensual, t.lineaPago.final_del_plazo]);
  });

  it("la tasa de la cotización es la tasa anual neta, en la página 1 y en la 2", () => {
    const t = cargarBien(textosJson);
    expect(t.pdf.resumenTasa).toBe("Tasa anual neta");
    expect(t.pdfPagina2.tasaAnual).toBe("Tasa anual neta");
    expect(t.pdfPagina2.benchmarkTuTasa).toBe("Tu tasa anual neta");
  });

  it("la nota de pie 'Tasa neta' ya no existe (Sprint 7a: va dentro del pie); la nota neta/bruta del comparativo sigue exacta", () => {
    const t = cargarBien(textosJson);
    expect(textosJson).not.toHaveProperty("pie_nota_neta");
    expect(t).not.toHaveProperty("pieNotaNeta");
    expect(JSON.stringify(textosJson)).not.toContain("Tasa neta: ya después de impuestos.");
    expect(t.pdfPagina2.benchmarkNotaNeta).toBe("La tasa de Crediflexi se muestra neta; las demás, brutas, antes de impuestos.");
  });

  it("pie_nota_neta ahora es una clave desconocida", () => {
    const j = copia() as Record<string, unknown>;
    j.pie_nota_neta = "Tasa neta: ya después de impuestos.";
    expect(errorDe(j).detalles.join("\n")).toContain("pie_nota_neta");
  });

  it("el pie, para las dos entidades: la línea SIPRES y el pie nuevo, exactos, sin 'supervisada' ni la autoridad supervisora", () => {
    const t = cargarBien(textosJson);
    expect(t.pieSipres).toBe(
      "Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R. · Inscrita en el SIPRES de la CONDUSEF con clave de registro 696338 · webapps.condusef.gob.mx/SIPRES",
    );
    expect(t.pieAvisoFondo).toBe(DISCLAIMER);
    expect(JSON.stringify(textosJson)).not.toMatch(/supervisad|todas las autoridades|CNBV|autoridad supervisora/i);
  });

  it("fuera de comisiones (bloque reclutamiento), el archivo ya no dice 'ganancia'", () => {
    expect(JSON.stringify({ ...textosJson, reclutamiento: null })).not.toMatch(/ganancia/i);
  });

  it("las claves viejas ya no existen: son claves desconocidas", () => {
    for (const clave of ["etiquetas_resultados", "linea_pago", "nombre_esquema", "esquema_corto"]) {
      const j: Record<string, unknown> = { ...copia(), [clave]: {} };
      expect(errorDe(j).detalles.join("\n")).toContain(clave);
    }
  });

  it.each(["glosario.rendimiento_total", "glosario.pago_rendimiento_final", "detalle_pago_mensual"])("%s solo admite {meses}", (campo) => {
    const j = copia() as unknown as Record<string, Record<string, unknown>>;
    const ruta = campo.split(".");
    const padre = ruta.slice(0, -1).reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, j as unknown as Record<string, unknown>);
    padre[ruta[ruta.length - 1]] = "Mes {meses}";
    expect(cargarBien(j)).toBeDefined();
    padre[ruta[ruta.length - 1]] = "Mes {meses} de {razon_social}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
    expect(detalle).toContain(campo);
  });

  it("un término del glosario vacío rompe la carga y dice cuál", () => {
    const j = copia();
    j.glosario.rendimiento_acumulado = " ";
    expect(errorDe(j).detalles.join("\n")).toContain("glosario.rendimiento_acumulado");
  });
  it("ningún texto dice recibes ni recibirás", () => {
    expect(JSON.stringify(textosJson)).not.toMatch(/recib(es|ir[aá]s)/i);
  });

  it("el archivo no menciona la reinversión ni el escenario ilustrativo", () => {
    expect(JSON.stringify(textosJson).toLowerCase()).not.toMatch(/reinver/);
    // Los "escenarios" del modo reclutamiento son otra cosa (escenarios de captación).
    expect(JSON.stringify({ ...textosJson, reclutamiento: null }).toLowerCase()).not.toMatch(/escenario/);
  });

  it("pie_sipres rechaza un texto vacío", () => {
    const j = copia();
    (j as { pie_sipres: string }).pie_sipres = " ";
    expect(errorDe(j).detalles.join("\n")).toContain("pie_sipres");
  });
});

describe("cargarTextos: el bloque pdf", () => {
  it("trae los textos del PDF con sus acentos", () => {
    expect(cargarBien(textosJson).pdf).toEqual({
      titulo: "Tu cotización de inversión",
      preparadoPara: "Preparado para",
      fecha: "Fecha",
      resumenMonto: "Monto de inversión",
      resumenPlazo: "Plazo",
      resumenTasa: "Tasa anual neta",
      resumenEsquema: "Esquema",
      seccionResultados: "Rendimientos esperados del periodo",
      seccionCalculo: "Cómo se calculó",
      lineaTasas: "Tasas versión {version_tasas} del {fecha_tasas}.",
      plazoEspecial: "Plazo especial",
      tasaAcordada: "Tasa acordada",
      desglosePuntos: "Tasa de tabla {tasa_tabla} + {puntos} puntos extra = {tasa}",
      fechaInicio: "Fecha de inicio: {fecha}",
      notaDiasNaturales: "Rendimientos calculados a días naturales (días reales ÷ 365).",
    });
  });

  it("pdf.desglose_puntos acepta {tasa_tabla}, {puntos} y {tasa} y rechaza otros", () => {
    const j = copia();
    (j.pdf as Record<string, string>).desglose_puntos = "Base {tasa_tabla}, +{puntos}, final {tasa}";
    expect(cargarBien(j).pdf.desglosePuntos).toBe("Base {tasa_tabla}, +{puntos}, final {tasa}");
    (j.pdf as Record<string, string>).desglose_puntos = "Para {razon_social}";
    expect(errorDe(j).detalles.join("\n")).toContain("pdf.desglose_puntos");
  });

  it.each(CLAVES_PDF_SIN_MARCADORES)("pdf.%s no admite ningún marcador", (clave) => {
    const j = copia();
    j.pdf[clave] = "Texto con {razon_social}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
    expect(detalle).toContain(`pdf.${clave}`);
    expect(detalle).toMatch(/ningún marcador/);
  });

  it.each(CLAVES_PDF_SIN_MARCADORES)("pdf.%s vacío rompe la carga", (clave) => {
    const j = copia();
    j.pdf[clave] = "  ";
    expect(errorDe(j).detalles.join("\n")).toContain(`pdf.${clave}`);
  });

  it("pdf.linea_tasas acepta {version_tasas} y {fecha_tasas} y rechaza otros", () => {
    const j = copia();
    j.pdf.linea_tasas = "Versión {version_tasas} ({fecha_tasas})";
    expect(cargarBien(j).pdf.lineaTasas).toBe("Versión {version_tasas} ({fecha_tasas})");
    j.pdf.linea_tasas = "Tasas de {razon_social}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
    expect(detalle).toContain("pdf.linea_tasas");
    expect(detalle).toContain("{version_tasas} y {fecha_tasas}");
  });

  it("falta una clave del bloque pdf", () => {
    const j: { pdf: Record<string, unknown> } = copia();
    delete j.pdf.seccion_calculo;
    expect(errorDe(j).detalles.join("\n")).toContain("seccion_calculo");
  });

  it("falta el bloque pdf completo", () => {
    const j: Record<string, unknown> = copia();
    delete j.pdf;
    expect(errorDe(j).detalles.join("\n")).toContain("pdf");
  });

  it("una clave desconocida en el bloque pdf rompe la carga", () => {
    const j: { pdf: Record<string, unknown> } = copia();
    j.pdf.titulo_grande = "Otro título";
    expect(errorDe(j).detalles.join("\n")).toContain("titulo_grande");
  });
});

describe("cargarTextos: marcadores permitidos por campo", () => {
  it.each([
    ["linea_preparado_por", "Preparado por {ejecutivo}."],
    ["linea_vigencia", "Vigencia: {vigencia}."],
    ["moneda_deshabilitada", "Sin tasas en {moneda}."],
  ] as const)("%s acepta sus marcadores", (campo, texto) => {
    const j = copia();
    j[campo] = texto;
    expect(cargarBien(j)).toBeDefined();
  });

  it.each([
    ["linea_preparado_por", "{vigencia}", "{ejecutivo}"],
    ["linea_preparado_por", "{razon_social}", "{ejecutivo}"],
    ["linea_vigencia", "{ejecutivo}", "{vigencia}"],
    ["moneda_deshabilitada", "{razon_social}", "{moneda}"],
  ] as const)("%s rechaza %s y dice el campo y los permitidos", (campo, marcador, permitidos) => {
    const j = copia();
    j[campo] = `Texto con ${marcador}.`;
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    const detalle = e.detalles.find((d) => d.includes(marcador));
    expect(detalle).toBeDefined();
    expect(detalle).toContain(campo);
    expect(detalle).toContain(permitidos);
  });

  it.each(["SEGUN_USUARIO_PPTX", "CONFIRMADA", "POR_CONFIRMAR"] as const)(
    "estatus_tramo.%s no admite ningún marcador",
    (estatus) => {
      const j = copia();
      j.estatus_tramo[estatus] = "Tasa de {razon_social}.";
      const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
      expect(detalle).toContain(`estatus_tramo.${estatus}`);
      expect(detalle).toMatch(/ningún marcador/);
    },
  );

  it.each(["mensual", "final_del_plazo"] as const)("glosario.%s no admite ningún marcador", (esquema) => {
    const j = copia();
    j.glosario[esquema] = "Esquema en {moneda}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{moneda}"));
    expect(detalle).toContain(`glosario.${esquema}`);
    expect(detalle).toMatch(/ningún marcador/);
  });

  it("un marcador desconocido rompe la carga y el error dice el archivo, el campo y el marcador", () => {
    const j = copia();
    j.linea_vigencia = "Vigencia para {cliente}.";
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    expect(e.todo).toContain("{cliente}");
    expect(e.todo).toContain("linea_vigencia");
  });

  it("una llave sin cerrar rompe la carga", () => {
    const j = copia();
    j.linea_vigencia = "Vigencia: {vigencia.";
    const e = errorDe(j);
    expect(e.todo).toContain("linea_vigencia");
    expect(e.todo).toMatch(/llave/i);
  });

  it("reporta todos los marcadores no permitidos, no solo el primero", () => {
    const j = copia();
    j.linea_vigencia = "{uno} y {dos}";
    const { detalles } = errorDe(j);
    expect(detalles.some((d) => d.includes("{uno}"))).toBe(true);
    expect(detalles.some((d) => d.includes("{dos}"))).toBe(true);
  });
});

describe("cargarTextos: pie_base retirado (Sprint 7d)", () => {
  it("si alguien vuelve a poner pie_base, la carga lo rechaza como clave desconocida", () => {
    const j: Record<string, unknown> = copia();
    j.pie_base = "Cotización informativa para {razon_social}.";
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    expect(e.todo).toContain('Clave desconocida: "pie_base"');
  });
});

describe("cargarTextos: textos vacíos y estructura", () => {
  it("un texto vacío rompe la carga y dice cuál", () => {
    const j = copia();
    j.linea_preparado_por = "";
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    expect(e.detalles.join("\n")).toContain("linea_preparado_por");
  });

  it("un texto de puros espacios cuenta como vacío", () => {
    const j = copia();
    j.estatus_tramo.POR_CONFIRMAR = "   ";
    expect(errorDe(j).detalles.join("\n")).toContain("estatus_tramo.POR_CONFIRMAR");
  });

  it("un nombre de esquema vacío rompe la carga", () => {
    const j = copia();
    j.glosario.final_del_plazo = "";
    expect(errorDe(j).detalles.join("\n")).toContain("glosario.final_del_plazo");
  });

  it("falta el nombre de un esquema", () => {
    const j: Record<string, unknown> = copia();
    j.glosario = { ...copia().glosario, final_del_plazo: undefined };
    expect(errorDe(j).detalles.join("\n")).toContain("final_del_plazo");
  });

  it("falta el glosario completo", () => {
    const j: Record<string, unknown> = copia();
    delete j.glosario;
    expect(errorDe(j).detalles.join("\n")).toContain("glosario");
  });

  it("falta la explicación de un estatus", () => {
    const j: Record<string, unknown> = copia();
    j.estatus_tramo = { CONFIRMADA: "Tasa confirmada.", POR_CONFIRMAR: "Por confirmar." };
    expect(errorDe(j).detalles.join("\n")).toContain("SEGUN_USUARIO_PPTX");
  });

  it("una clave que no existe (por ejemplo, un error de dedo) rompe la carga", () => {
    const j: Record<string, unknown> = { ...copia(), linea_vigensia: "Vigencia: {vigencia}." };
    expect(errorDe(j).detalles.join("\n")).toContain("linea_vigensia");
  });

  it("falta la versión", () => {
    const j: Record<string, unknown> = copia();
    delete j.version;
    expect(errorDe(j).detalles.join("\n")).toContain("version");
  });

  it("si el JSON no es un objeto, falla con un mensaje en español", () => {
    expect(errorDe("hola").mensaje).toContain(ARCHIVO);
  });
});

/** Claves de pdf_pagina2 sin marcadores (las de cuándo se paga solo admiten {meses}). */
const CLAVES_PAGINA2 = [
  "titulo",
  "modalidad_1",
  "modalidad_2",
  "tasa_acordada",
  "capital_inicial",
  "franja_rendimiento",
  "franja_mas_capital",
  "franja_rendimiento_capital",
  "columna_mes",
  "columna_fecha_pago",
  "columna_dias",
  "nota_dia_inhabil",
  "insignia",
  "nota_centavos",
  "modalidad_no_disponible",
  "modalidad_sin_tasa",
  "titulo_grafica_1",
  "nota_grafica_1",
  "comparacion_omitida",
  "benchmark_titulo",
  "benchmark_tu_tasa",
  "benchmark_desactualizado",
  "benchmark_solo_pesos",
  "benchmark_en_dolares",
  "benchmark_nota_neta",
  "pagina",
  "pagina_de",
] as const;

const CLAVES_PAGINA2_CON_MESES = ["capital_vencimiento"] as const;
/** Claves con su único marcador: las del comparativo y el vencimiento de las tarjetas (Sprint 6b). */
const CLAVES_PAGINA2_BENCHMARK = [
  ["benchmark_actualizado", "fecha"],
  ["benchmark_fuentes", "fuentes"],
  ["vencimiento", "fecha"],
] as const;

describe("cargarTextos: el bloque pdf_pagina2", () => {
  it("trae los textos de la página 2 con los términos del glosario", () => {
    const p = cargarBien(textosJson).pdfPagina2;
    expect(p.titulo).toBe("Calendario de pagos y comparativo");
    expect(p.modalidad1).toBe("MODALIDAD 1 · RENDIMIENTO MENSUAL");
    expect(p.modalidad2).toBe("MODALIDAD 2 · PAGO AL VENCIMIENTO");
    expect(p.tasaAnual).toBe("Tasa anual neta");
    expect(p.tasaAcordada).toBe("Tasa acordada");
    expect(p.capitalInicial).toBe("Capital inicial");
    expect(p.rendimientoTotal).toBe("Rendimiento total ({meses} meses)");
    expect(p.capitalMasRendimiento).toBe("Capital + rendimiento total");
    expect(p.columnaMes).toBe("Mes");
    expect(p.columnaRendimientoMensual).toBe("Rendimiento mensual");
    expect(p.columnaRendimientoAcumulado).toBe("Rendimiento acumulado");
    expect([p.serieMensual, p.serieFinal]).toEqual(["Mensual", "Al final del plazo"]);
    expect(p.capitalVencimiento).toBe("Capital: al vencimiento (mes {meses})");
    expect([p.franjaRendimiento, p.franjaMasCapital, p.franjaRendimientoCapital]).toEqual(["rendimiento", "+ capital", "rendimiento + capital"]);
    expect(p.notaGrafica1).toBe(
      "Rendimiento acumulado mes a mes: en la modalidad 1 se paga cada mes; en la modalidad 2 se acumula y se paga al vencimiento.",
    );
    expect(p).not.toHaveProperty("gananciaAnualEquivalente");
    expect(p.insignia).toBe("Tu cotización");
    expect(p.notaCentavos).toBe("Los centavos se ajustan para que la suma coincida con el total.");
  });

  it("trae los textos del comparativo de tasas", () => {
    const p = cargarBien(textosJson).pdfPagina2;
    expect(p.benchmarkTitulo).toBe("Tu tasa frente a otras opciones");
    expect(p.benchmarkTuTasa).toBe("Tu tasa anual neta");
    expect(p.benchmarkActualizado).toBe(
      "Última tasa publicada de cada instrumento; la fecha de cada uno se indica junto a su barra. Actualizado al {fecha}.",
    );
    expect(p.benchmarkEnDolares).toBe("en dólares (USD)");
    expect(p.benchmarkFuentes).toBe("Fuentes: {fuentes}");
    expect(p.benchmarkDesactualizado).toBe("Comparativo no disponible: datos desactualizados");
    expect(p.benchmarkSoloPesos).toBe("Comparativo no disponible en dólares: las opciones comparadas son en pesos (MXN).");
  });

  it("trae las 40 claves, todas con texto", () => {
    const p = cargarBien(textosJson).pdfPagina2;
    // Más los 9 que salen del glosario: tasa, rendimiento total, capital + rendimiento, dos líneas de pago, dos columnas y dos series.
    expect(Object.keys(p)).toHaveLength(CLAVES_PAGINA2.length + CLAVES_PAGINA2_CON_MESES.length + CLAVES_PAGINA2_BENCHMARK.length + 9);
    for (const v of Object.values(p)) expect(v.trim()).not.toBe("");
  });

  it.each(CLAVES_PAGINA2)("pdf_pagina2.%s no admite ningún marcador", (clave) => {
    const j = copia();
    (j.pdf_pagina2 as Record<string, string>)[clave] = "Texto con {razon_social}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
    expect(detalle).toContain(`pdf_pagina2.${clave}`);
    expect(detalle).toMatch(/ningún marcador/);
  });

  it.each(CLAVES_PAGINA2_CON_MESES)("pdf_pagina2.%s solo admite {meses}", (clave) => {
    const j = copia();
    (j.pdf_pagina2 as Record<string, string>)[clave] = "Mes {meses}";
    expect(cargarBien(j)).toBeDefined();
    (j.pdf_pagina2 as Record<string, string>)[clave] = "Mes {meses} de {razon_social}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
    expect(detalle).toContain(`pdf_pagina2.${clave}`);
    expect(detalle).toContain("{meses}");
  });

  it.each(CLAVES_PAGINA2_BENCHMARK)("pdf_pagina2.%s solo admite {%s}", (clave, marcador) => {
    const j = copia();
    (j.pdf_pagina2 as Record<string, string>)[clave] = `Dato {${marcador}}`;
    expect(cargarBien(j)).toBeDefined();
    (j.pdf_pagina2 as Record<string, string>)[clave] = `Dato {${marcador}} {meses}`;
    const detalle = errorDe(j).detalles.find((d) => d.includes("{meses}"));
    expect(detalle).toContain(`pdf_pagina2.${clave}`);
  });

  it.each([...CLAVES_PAGINA2, ...CLAVES_PAGINA2_CON_MESES, ...CLAVES_PAGINA2_BENCHMARK.map(([c]) => c)])("pdf_pagina2.%s vacío rompe la carga", (clave) => {
    const j = copia();
    (j.pdf_pagina2 as Record<string, string>)[clave] = "  ";
    expect(errorDe(j).detalles.join("\n")).toContain(`pdf_pagina2.${clave}`);
  });

  it("falta una clave del bloque pdf_pagina2", () => {
    const j: { pdf_pagina2: Record<string, unknown> } = copia();
    delete j.pdf_pagina2.capital_vencimiento;
    expect(errorDe(j).detalles.join("\n")).toContain("capital_vencimiento");
  });

  it("una clave desconocida en el bloque pdf_pagina2 rompe la carga", () => {
    const j: { pdf_pagina2: Record<string, unknown> } = copia();
    j.pdf_pagina2.titulo_grafica_3 = "Otra gráfica";
    expect(errorDe(j).detalles.join("\n")).toContain("titulo_grafica_3");
  });

  it("falta el bloque pdf_pagina2 completo", () => {
    const j: Record<string, unknown> = copia();
    delete j.pdf_pagina2;
    expect(errorDe(j).detalles.join("\n")).toContain("pdf_pagina2");
  });
});

/** Lenguaje de promesa del modo reclutamiento (Sprint 5: suma los términos nuevos). */
const RE_PROMESA_RECLUTAMIENTO =
  /(?<![\p{L}\p{N}])(garant\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|recibes|promesa|oferta|ilimitad\p{L}*|sin l[ií]mites?|dinero f[aá]cil|sin esfuerzo|libertad financiera|millonari\p{L}*)(?![\p{L}\p{N}])/iu;

describe("cargarTextos: el bloque reclutamiento (0.7.1)", () => {
  const AVISO =
    "Ejemplo calculado con las tablas vigentes al {fecha}. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos.";

  it("conserva el aviso aprobado por RH y el de inversiones por plazo, y suma el de las tasas y el de incorporación", () => {
    const r = cargarBien(textosJson).reclutamiento;
    expect(r.aviso).toBe(AVISO);
    expect(r.avisoInversionesPorPlazo).toBe(
      "Cálculo con {n} inversión(es) por plazo: si el mismo monto se reparte en más inversiones, la tasa de cada una puede ser menor.",
    );
    expect(r.avisoTasas).toBe("Las tasas están sujetas a cambio.");
    expect(r.avisoIncorporacion).toBe(
      "Al superar $1,000,000 en ingresos, se podrá evaluar la incorporación a la compañía, en caso de que exista interés por parte del colaborador externo.",
    );
  });

  it("un solo dato visible, con montos de ejemplo y 12 meses por omisión", () => {
    const r = cargarBien(textosJson).reclutamiento;
    expect(r.preguntaMonto).toBe("¿Cuánto captarías al mes?");
    expect(r.montosEjemplo).toEqual(["500000", "1000000", "1500000", "2000000", "3000000"]);
    expect(r.montoPorOmision).toBe("1000000");
    expect(r.plazoPorOmision).toBe(12);
    expect(r.cifraDetalle).toBe("{captacion} a {meses} meses: comisión {comision} más bono {bono}");
    expect(r.fraseVeces).toBe("A {meses_mayor} meses se ganaría {veces} veces lo de {meses_menor} meses.");
    expect(r.escalonUltimo).toBe("{desde} en adelante: {bono} más la comisión");
  });

  it("las ocho frases propuestas, aprobadas por RH (Sprint 6b)", () => {
    const r = cargarBien(textosJson).reclutamiento;
    expect(r.frases).toEqual([
      "Tu captación, tu ganancia.",
      "Tú decides cuánto quieres ganar este mes.",
      "Cada inversión que captas suma a tu comisión.",
      "Plazos más largos, comisiones más altas.",
      "Sin meta mensual: tú marcas el ritmo.",
      "Empieza con tu primera inversión de {monto_minimo}.",
      "Imagina cuánto podrías ganar este mes.",
      "Súmate a una marca de inversión que ya opera en el mercado.",
    ]);
    expect(r.frasesAprobadasPorRh).toBe(true);
    expect(r.avisoFrasesRh).toBe("Frases pendientes de aprobación de RH");
  });

  it("ningún texto del bloque usa lenguaje de promesa (la garantía y la oferta solo aparecen negadas en el aviso)", () => {
    const r = cargarBien(textosJson).reclutamiento;
    const todo = JSON.stringify(r).replace(AVISO, "");
    expect(todo).not.toMatch(RE_PROMESA_RECLUTAMIENTO);
  });

  it.each([
    "garantizado",
    "Ingreso asegurado",
    "sin riesgo",
    "ingreso fijo",
    "ganarás",
    "ilimitado",
    "sin límite",
    "dinero fácil",
    "sin esfuerzo",
    "libertad financiera",
    "millonario",
  ])("la revisión de lenguaje detecta %s", (t) => {
    expect(t).toMatch(RE_PROMESA_RECLUTAMIENTO);
  });

  it.each([
    ["aviso", "{fecha}"],
    ["aviso_inversiones_por_plazo", "{n}"],
    ["monto_plazo", "{meses}"],
    ["plazo_meses", "{meses}"],
    ["pdf_presenta", "{presenta}"],
    ["fecha_quincena_1", "{dia_corte} {mes} {fecha_pago}"],
    ["fecha_quincena_2", "{dia_siguiente} {mes} {fecha_pago}"],
    ["cifra_detalle", "{captacion} {meses} {comision} {bono}"],
    ["cifra_detalle_mezcla", "{captacion} {comision} {bono}"],
    ["frase_veces", "{meses_mayor} {veces} {meses_menor}"],
    ["escalon_sin_bono", "{desde}"],
    ["escalon_rango", "{desde} {hasta} {bono}"],
    ["escalon_ultimo", "{desde} {bono}"],
  ])("reclutamiento.%s admite %s y nada más", (clave, marcadores) => {
    const j = copia();
    (j.reclutamiento as Record<string, unknown>)[clave] = `Texto ${marcadores}`;
    expect(cargarBien(j)).toBeDefined();
    (j.reclutamiento as Record<string, unknown>)[clave] = `Texto ${marcadores} {razon_social}`;
    expect(errorDe(j).detalles.join("\n")).toContain(`reclutamiento.${clave}`);
  });

  it("las frases solo admiten {monto_minimo}", () => {
    const j = copia();
    (j.reclutamiento as { frases: string[] }).frases[0] = "Desde {monto_minimo} {razon_social}";
    expect(errorDe(j).detalles.join("\n")).toContain("reclutamiento.frases.0");
  });

  it("un texto sin marcadores no admite ninguno", () => {
    const j = copia();
    (j.reclutamiento as Record<string, unknown>).titulo_resultado = "Lo que se ganaría {fecha}";
    expect(errorDe(j).detalles.join("\n")).toMatch(/reclutamiento\.titulo_resultado[\s\S]*ningún marcador/);
  });

  it("un monto de ejemplo con comas se rechaza con su ubicación", () => {
    const j = copia();
    (j.reclutamiento as { montos_ejemplo: string[] }).montos_ejemplo[0] = "500,000";
    expect(errorDe(j).detalles.join("\n")).toContain("reclutamiento.montos_ejemplo.0");
  });

  it("frases_aprobadas_por_rh debe ser true o false", () => {
    const j = copia();
    (j.reclutamiento as Record<string, unknown>).frases_aprobadas_por_rh = "no";
    expect(errorDe(j).detalles.join("\n")).toContain("reclutamiento.frases_aprobadas_por_rh");
  });

  it("los escenarios de ejemplo ya no existen: son una clave desconocida", () => {
    const j = copia();
    (j.reclutamiento as Record<string, unknown>).escenarios_ejemplo = [];
    expect(errorDe(j).detalles.join("\n")).toContain("escenarios_ejemplo");
  });

  it("una clave desconocida en el bloque se rechaza", () => {
    const j = copia();
    (j.reclutamiento as Record<string, unknown>).ingreso_garantizado = "No";
    expect(errorDe(j).detalles.join("\n")).toContain("ingreso_garantizado");
  });

  it("revision_interna sigue siendo una clave desconocida", () => {
    const j = copia();
    (j.reclutamiento as Record<string, unknown>).revision_interna = "Uso interno";
    expect(errorDe(j).detalles.join("\n")).toContain("revision_interna");
  });
});

describe("cargarTextos: el bloque comisiones (0.9, Sprint 6c)", () => {
  it("trae los textos de las tablas de incentivos con sus columnas y 'En adelante' en el último rango", () => {
    const c = cargarBien(textosJson).comisiones;
    expect([c.columnaCumplimiento, c.columnaDesde, c.columnaHasta, c.columnaIncentivo]).toEqual(["Cumplimiento", "Desde", "Hasta", "Incentivo"]);
    expect(c.enAdelante).toBe("En adelante");
    expect(c.incentivoMasComision).toBe("{bono} + comisión");
  });

  it("las notas exactas: meta interna de referencia, sueldo base y desbloqueo", () => {
    const c = cargarBien(textosJson).comisiones;
    expect(c.notaMetaInterna).toBe("Referencia: la meta interna de un ejecutivo es de {meta} al mes.");
    expect(c.sueldoBase).toBe("Sueldo base (propuesta)");
    expect(c.notaDesbloqueo).toBe("Las comisiones se desbloquean desde el {porcentaje} de la meta ({umbral}).");
  });

  it("Mis externos: confirmado (Sprint 6b, sin insignia de supuesto), se paga aparte y la nota de la doble captura, exacta", () => {
    const c = cargarBien(textosJson).comisiones;
    expect(c.tituloMisExternos).toBe("Mis externos");
    expect(c).not.toHaveProperty("supuestoPorConfirmar");
    expect(c.comisionPorExternos).toBe("Comisión por tus externos ({porcentaje})");
    expect(c.notaAparte).toBe("Se paga aparte: no se descuenta a tus externos.");
    expect(c.notaDobleCaptura).toBe(
      "Captura cada inversión en un solo lugar: las de tu equipo interno, en ‘Inversiones del equipo’; las de tus externos, en ‘Mis externos’.",
    );
  });

  it("el bloque del externo no dice que el externo tenga meta", () => {
    const c = cargarBien(textosJson).comisiones;
    expect(`${c.tituloIncentivosExterno}\n${c.ayudaIncentivosExterno}`).not.toMatch(/tu meta|meta del externo/i);
  });

  it.each([
    ["nota_meta_interna", "{meta}", "{umbral}"],
    ["nota_desbloqueo", "{porcentaje} {umbral}", "{meta}"],
    ["incentivo_mas_comision", "{bono}", "{meta}"],
    ["comision_por_externos", "{porcentaje}", "{bono}"],
    ["red_bloqueada", "{umbral}", "{porcentaje}"],
    ["inversion_externo", "{n}", "{meta}"],
  ] as const)("comisiones.%s acepta %s y rechaza %s", (clave, aceptado, rechazado) => {
    const bien = copia();
    (bien.comisiones as Record<string, string>)[clave] = `Texto ${aceptado}`;
    cargarBien(bien);
    const mal = copia();
    (mal.comisiones as Record<string, string>)[clave] = `Texto ${rechazado}`;
    expect(errorDe(mal).todo).toContain(`comisiones.${clave}`);
  });

  it("un texto sin marcadores no admite ninguno", () => {
    const j = copia();
    j.comisiones.en_adelante = "En adelante {bono}";
    expect(errorDe(j).todo).toContain("comisiones.en_adelante");
  });

  it("falta una clave del bloque o sobra una desconocida", () => {
    const sin = copia();
    delete (sin.comisiones as Record<string, unknown>).en_adelante;
    expect(errorDe(sin).todo).toContain("en_adelante");
    const sobra = copia();
    (sobra.comisiones as Record<string, unknown>).sin_limite = "Sin límite";
    expect(errorDe(sobra).todo).toContain("sin_limite");
  });
});

describe("cargarTextos: PDF de comisiones y Total estimado del mes (0.11, Sprint 7a)", () => {
  it("el aviso fijo del PDF, el total y el botón, exactos", () => {
    const c = cargarBien(textosJson).comisiones;
    expect(c.avisoPdf).toBe("Simulación informativa con las reglas vigentes. No garantiza ingresos. El sueldo base es una propuesta.");
    expect(c.totalEstimadoMes).toBe("Total estimado del mes (simulación)");
    expect(c.descargarPdf).toBe("Descargar PDF");
    expect(c.sueldoBase).toBe("Sueldo base (propuesta)");
  });

  it.each([
    ["pdf_avance", "{porcentaje} {captacion} {meta}", "{falta}"],
    ["pdf_falta_umbral", "{falta} {umbral}", "{meta}"],
    ["pdf_regla_cierre", "{nota}", "{falta}"],
    ["pdf_regla_quincenas", "{dia_corte} {dia_pago} {dia_siguiente} {dia_pago_siguiente}", "{mes}"],
    ["pdf_pago_inversiones", "{lista}", "{n}"],
  ] as const)("comisiones.%s acepta %s y rechaza %s", (clave, aceptado, rechazado) => {
    const bien = copia();
    (bien.comisiones as Record<string, string>)[clave] = `Texto ${aceptado}`;
    cargarBien(bien);
    const mal = copia();
    (mal.comisiones as Record<string, string>)[clave] = `Texto ${rechazado}`;
    expect(errorDe(mal).todo).toContain(`comisiones.${clave}`);
  });

  it("aviso_pdf, total_estimado_mes y descargar_pdf no admiten marcadores", () => {
    for (const clave of ["aviso_pdf", "total_estimado_mes", "descargar_pdf"]) {
      const mal = copia();
      (mal.comisiones as Record<string, string>)[clave] = "Texto {fecha}";
      expect(errorDe(mal).todo).toContain(`comisiones.${clave}`);
    }
  });
});

describe("cargarTextos: reclutamiento para internos (0.12, Sprint 7a)", () => {
  it("la bandera de RH para internos empieza en falso, con su aviso de pantalla exacto", () => {
    const r = cargarBien(textosJson).reclutamiento;
    expect(r.frasesInternasAprobadasPorRh).toBe(false);
    expect(r.avisoFrasesInternasRh).toBe("Texto para internos pendiente de aprobación de RH");
  });

  it("selector, títulos y rótulos del perfil interno, exactos", () => {
    const r = cargarBien(textosJson).reclutamiento;
    expect([r.perfil, r.perfilInterno, r.perfilExterno]).toEqual(["Perfil", "Interno", "Externo"]);
    expect(r.tituloResultadoInterno).toBe("Total estimado del mes (simulación)");
    expect(r.sueldoBaseInterno).toBe("Sueldo base (propuesta)");
    expect(r.notaDesbloqueoInterno).toBe("Las comisiones se desbloquean desde el {porcentaje} de la meta ({umbral}).");
  });

  it("frases_internas_aprobadas_por_rh debe ser true o false", () => {
    const mal = copia();
    (mal.reclutamiento as Record<string, unknown>).frases_internas_aprobadas_por_rh = "no";
    expect(errorDe(mal).todo).toContain("frases_internas_aprobadas_por_rh");
  });

  it.each([
    ["cifra_detalle_interno", "{captacion} {meses} {sueldo} {comision} {bono}", "{falta}"],
    ["cifra_detalle_interno_mezcla", "{captacion} {sueldo} {comision} {bono}", "{meses}"],
    ["interno_bloqueada", "{falta} {umbral}", "{meta}"],
    ["nota_desbloqueo_interno", "{porcentaje} {umbral}", "{sueldo}"],
  ] as const)("reclutamiento.%s acepta %s y rechaza %s", (clave, aceptado, rechazado) => {
    const bien = copia();
    (bien.reclutamiento as Record<string, unknown>)[clave] = `Texto ${aceptado}`;
    cargarBien(bien);
    const mal = copia();
    (mal.reclutamiento as Record<string, unknown>)[clave] = `Texto ${rechazado}`;
    expect(errorDe(mal).todo).toContain(`reclutamiento.${clave}`);
  });
});

describe("cargarTextos: la cotización ya no dice 'ganancia' ni 'tasa esperada' (0.14, Sprint 7a)", () => {
  it("ningún texto de la cotización (todo el archivo salvo los bloques comisiones y reclutamiento) conserva 'ganancia' ni 'tasa esperada'", () => {
    const deLaCotizacion = JSON.stringify({ ...textosJson, comisiones: null, reclutamiento: null });
    expect(deLaCotizacion).not.toMatch(/ganancia|tasa esperada/i);
  });

  it("el bloque de resultados de la página 1 se titula 'Rendimientos esperados del periodo'", () => {
    expect(cargarBien(textosJson).pdf.seccionResultados).toBe("Rendimientos esperados del periodo");
  });

  it("los textos fijos de la pantalla del cotizador no dicen 'ganancia' ni 'tasa esperada'", () => {
    const pantalla = readFileSync(path.join(process.cwd(), "src/app/(app)/cotizador/textosPantalla.ts"), "utf8");
    expect(pantalla).not.toMatch(/ganancia|tasa esperada/i);
  });
});
