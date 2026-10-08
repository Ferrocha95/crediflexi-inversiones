import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
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
  "resumen_tasa",
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
  it("carga seed/textos_cotizacion.json versión 0.7.1", () => {
    const t = cargarBien(textosJson);
    expect(t.version).toBe("0.7.1");
    expect(t.pieBase).toBe(
      "Cotización informativa para {razon_social}, calculada con interés simple sobre la tasa anual indicada " +
        "y con las tasas de la versión {version_tasas} del {fecha_tasas}. La ganancia anual es un equivalente " +
        "a 12 meses; la ganancia del plazo corresponde al plazo elegido. Esta cotización no es un contrato: las " +
        "condiciones aplicables son las del contrato que se firme.",
    );
    expect(t.lineaPreparadoPor).toBe("Preparado por {ejecutivo}.");
    expect(t.lineaVigencia).toBe("Vigencia: {vigencia}.");
    expect(t.monedaDeshabilitada).toBe("Las tasas en {moneda} están por confirmar.");
  });

  it("trae la explicación de los tres estatus", () => {
    const t = cargarBien(textosJson);
    expect(Object.keys(t.estatusTramo).sort()).toEqual(["CONFIRMADA", "POR_CONFIRMAR", "SEGUN_USUARIO_PPTX"]);
    expect(t.estatusTramo.SEGUN_USUARIO_PPTX).toBe(
      "Tasa según la tabla de rendimientos vigente; aún sin confirmación formal.",
    );
  });

  it("trae el nombre de los dos esquemas", () => {
    expect(cargarBien(textosJson).nombreEsquema).toEqual({
      mensual: "Rendimientos mensuales",
      final_del_plazo: "Al final del plazo",
    });
  });
});

describe("cargarTextos: textos del dueño (Sprint 5, versión 0.7)", () => {
  it("las etiquetas de los resultados: 'Ganancia esperada del periodo' (1 mes, 12 meses y plazo de {meses} meses)", () => {
    expect(cargarBien(textosJson).etiquetasResultados).toEqual({
      mensual: {
        rendimiento_mensual_pesos: "Ganancia esperada del periodo (1 mes)",
        rendimiento_anual_pesos: "Ganancia esperada del periodo (12 meses)",
        ganancia_total_plazo: "Ganancia esperada del periodo (plazo de {meses} meses)",
      },
      final_del_plazo: {
        rendimiento_mensual_pesos: "Ganancia esperada del periodo (1 mes), se acumula y se paga al final del plazo",
        rendimiento_anual_pesos: "Ganancia esperada del periodo (12 meses)",
        ganancia_total_plazo: "Ganancia esperada del periodo (plazo de {meses} meses)",
      },
    });
  });

  it("la línea de pago (página 1 y vista previa): 'Pago de rendimiento…' con {meses}", () => {
    expect(cargarBien(textosJson).lineaPago).toEqual({
      mensual: "Pago de rendimiento mensual: cada mes, del mes 1 al mes {meses}",
      final_del_plazo: "Pago de rendimiento: al final del plazo (mes {meses}), junto con el capital",
    });
  });

  it("el esquema corto: 'Mensual' o 'Al final del plazo' (página 1 y vista previa)", () => {
    expect(cargarBien(textosJson).esquemaCorto).toEqual({ mensual: "Mensual", final_del_plazo: "Al final del plazo" });
  });

  it("el pie, para las dos entidades: la línea SIPRES y el disclaimer exactos, sin 'supervisada'", () => {
    const t = cargarBien(textosJson);
    expect(t.pieSipres).toBe(
      "Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R. · Inscrita en el SIPRES de la CONDUSEF con clave de registro 696338 · webapps.condusef.gob.mx/SIPRES",
    );
    expect(t.pieAvisoFondo).toBe(
      "Crediflexi, fondo de inversión privado, operado por Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R., inscrita en el SIPRES de la CONDUSEF " +
        "y sujeta a las disposiciones aplicables. Por ser un fondo de inversión privado, para invertir se requiere adquirir una acción de " +
        "$1,000.00 MXN. Las tasas están sujetas a cambio.",
    );
    expect(JSON.stringify(textosJson)).not.toMatch(/supervisad|todas las autoridades|CNBV/i);
  });

  it.each(["linea_pago.mensual", "etiquetas_resultados.final_del_plazo.ganancia_total_plazo"])("%s solo admite {meses}", (campo) => {
    const j = copia() as unknown as Record<string, Record<string, unknown>>;
    const ruta = campo.split(".");
    const padre = ruta.slice(0, -1).reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, j);
    padre[ruta[ruta.length - 1]] = "Mes {meses}";
    expect(cargarBien(j)).toBeDefined();
    padre[ruta[ruta.length - 1]] = "Mes {meses} de {razon_social}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{razon_social}"));
    expect(detalle).toContain(campo);
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
      resumenTasa: "Tasa anual",
      resumenEsquema: "Esquema",
      seccionResultados: "Tus resultados",
      seccionCalculo: "Cómo se calculó",
      lineaTasas: "Tasas versión {version_tasas} del {fecha_tasas}.",
      plazoEspecial: "Plazo especial",
      tasaAcordada: "Tasa acordada",
      desglosePuntos: "Tasa de tabla {tasa_tabla} + {puntos} puntos extra = {tasa}",
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
    ["pie_base", "{razon_social} {version_tasas} {fecha_tasas}"],
    ["linea_preparado_por", "Preparado por {ejecutivo}."],
    ["linea_vigencia", "Vigencia: {vigencia}."],
    ["moneda_deshabilitada", "Sin tasas en {moneda}."],
  ] as const)("%s acepta sus marcadores", (campo, texto) => {
    const j = copia();
    j[campo] = texto;
    expect(cargarBien(j)).toBeDefined();
  });

  it.each([
    ["pie_base", "{ejecutivo}", "{razon_social}, {version_tasas} y {fecha_tasas}"],
    ["pie_base", "{vigencia}", "{razon_social}, {version_tasas} y {fecha_tasas}"],
    ["pie_base", "{moneda}", "{razon_social}, {version_tasas} y {fecha_tasas}"],
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

  it.each(["mensual", "final_del_plazo"] as const)("nombre_esquema.%s no admite ningún marcador", (esquema) => {
    const j = copia();
    j.nombre_esquema[esquema] = "Esquema en {moneda}";
    const detalle = errorDe(j).detalles.find((d) => d.includes("{moneda}"));
    expect(detalle).toContain(`nombre_esquema.${esquema}`);
    expect(detalle).toMatch(/ningún marcador/);
  });

  it("un marcador desconocido rompe la carga y el error dice el archivo, el campo y el marcador", () => {
    const j = copia();
    j.pie_base = "Cotización para {cliente}.";
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    expect(e.todo).toContain("{cliente}");
    expect(e.todo).toContain("pie_base");
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
    j.pie_base = "{uno} y {dos}";
    const { detalles } = errorDe(j);
    expect(detalles.some((d) => d.includes("{uno}"))).toBe(true);
    expect(detalles.some((d) => d.includes("{dos}"))).toBe(true);
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
    j.nombre_esquema.final_del_plazo = "";
    expect(errorDe(j).detalles.join("\n")).toContain("nombre_esquema.final_del_plazo");
  });

  it("falta el nombre de un esquema", () => {
    const j: Record<string, unknown> = copia();
    j.nombre_esquema = { mensual: "Rendimientos mensuales" };
    expect(errorDe(j).detalles.join("\n")).toContain("final_del_plazo");
  });

  it("falta nombre_esquema completo", () => {
    const j: Record<string, unknown> = copia();
    delete j.nombre_esquema;
    expect(errorDe(j).detalles.join("\n")).toContain("nombre_esquema");
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
  "tasa_anual",
  "tasa_acordada",
  "capital_inicial",
  "ganancia_anual_equivalente",
  "total_capital_ganancia",
  "franja_ganancia",
  "franja_mas_capital",
  "franja_ganancia_capital",
  "columna_mes",
  "columna_ganancia_periodo",
  "columna_ganancia_acumulada",
  "insignia",
  "nota_centavos",
  "modalidad_no_disponible",
  "modalidad_sin_tasa",
  "titulo_grafica_1",
  "nota_grafica_1",
  "serie_cobrado",
  "serie_devengado",
  "comparacion_omitida",
  "benchmark_titulo",
  "benchmark_tu_tasa",
  "benchmark_desactualizado",
  "benchmark_solo_pesos",
  "benchmark_en_dolares",
  "pagina",
  "pagina_de",
] as const;

const CLAVES_PAGINA2_CON_MESES = ["ganancia_plazo", "pago_ganancia_mensual", "pago_ganancia_vencimiento", "capital_vencimiento"] as const;
/** Claves del comparativo con su único marcador. */
const CLAVES_PAGINA2_BENCHMARK = [
  ["benchmark_actualizado", "fecha"],
  ["benchmark_fuentes", "fuentes"],
] as const;

describe("cargarTextos: el bloque pdf_pagina2", () => {
  it("trae los textos de la página 2 con la terminología de 'ganancia'", () => {
    const p = cargarBien(textosJson).pdfPagina2;
    expect(p.titulo).toBe("Calendario de pagos y comparativo");
    expect(p.modalidad1).toBe("MODALIDAD 1 · RENDIMIENTO MENSUAL");
    expect(p.modalidad2).toBe("MODALIDAD 2 · PAGO AL VENCIMIENTO");
    expect(p.tasaAnual).toBe("TASA ANUAL");
    expect(p.tasaAcordada).toBe("TASA ACORDADA");
    expect(p.capitalInicial).toBe("Capital inicial");
    expect(p.gananciaAnualEquivalente).toBe("Ganancia esperada del periodo (12 meses)");
    expect(p.gananciaPlazo).toBe("Ganancia esperada del periodo (plazo de {meses} meses)");
    expect(p.totalCapitalGanancia).toBe("Total capital + ganancia");
    expect(p.columnaMes).toBe("Mes");
    expect(p.columnaGananciaPeriodo).toBe("Ganancia del periodo");
    expect(p.columnaGananciaAcumulada).toBe("Ganancia acumulada");
    expect(p.pagoGananciaMensual).toBe("Pago de rendimiento mensual: cada mes, del mes 1 al mes {meses}");
    expect(p.pagoGananciaVencimiento).toBe("Pago de rendimiento: al final del plazo (mes {meses}), junto con el capital");
    expect(p.capitalVencimiento).toBe("Capital: al vencimiento (mes {meses})");
    expect([p.franjaGanancia, p.franjaMasCapital, p.franjaGananciaCapital]).toEqual(["ganancia", "+ capital", "ganancia + capital"]);
    expect(p.insignia).toBe("Tu cotización");
    expect(p.notaCentavos).toBe("Los centavos se ajustan para que la suma coincida con el total.");
  });

  it("trae los textos del comparativo de tasas", () => {
    const p = cargarBien(textosJson).pdfPagina2;
    expect(p.benchmarkTitulo).toBe("Tu tasa frente a otras opciones");
    expect(p.benchmarkTuTasa).toBe("Tu tasa");
    expect(p.benchmarkActualizado).toBe(
      "Última tasa publicada de cada instrumento; la fecha de cada uno se indica junto a su barra. Actualizado al {fecha}.",
    );
    expect(p.benchmarkEnDolares).toBe("en dólares (USD)");
    expect(p.benchmarkFuentes).toBe("Fuentes: {fuentes}");
    expect(p.benchmarkDesactualizado).toBe("Comparativo no disponible: datos desactualizados");
    expect(p.benchmarkSoloPesos).toBe("Comparativo no disponible en dólares: las opciones comparadas son en pesos (MXN).");
  });

  it("trae las 36 claves, todas con texto", () => {
    const p = cargarBien(textosJson).pdfPagina2;
    expect(Object.keys(p)).toHaveLength(CLAVES_PAGINA2.length + CLAVES_PAGINA2_CON_MESES.length + CLAVES_PAGINA2_BENCHMARK.length);
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

  it("las ocho frases propuestas, pendientes de RH", () => {
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
    expect(r.frasesAprobadasPorRh).toBe(false);
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
