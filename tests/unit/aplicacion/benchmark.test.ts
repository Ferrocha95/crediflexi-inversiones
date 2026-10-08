import { describe, expect, it } from "vitest";
import benchmarkJson from "../../../seed/benchmark.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarBenchmark, LIENZO_BENCHMARK, modeloBenchmark, type Benchmark, type BenchmarkPdf } from "../../../src/aplicacion/benchmark";
import { cargarTextos } from "../../../src/aplicacion/textos";

// Comparativo de tasas (página 2 del PDF). Cifras, fechas y orden de
// referencia escritos a mano sobre seed/benchmark.json 0.4.2 (actualizado al
// 2026-10-08), sin pasar por el modelo. Fuentes oficiales: hoja de GAT de BBVA
// (01/10/2026), página de GAT de Santander (08/09/2026) y página de desempeño
// de Invesco QQQ (Nasdaq-100 al 29/09/2026).

const t = (() => {
  const r = cargarTextos(textosJson, "seed/textos_cotizacion.json");
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor.pdfPagina2;
})();

const bench = (() => {
  const r = cargarBenchmark(benchmarkJson, "seed/benchmark.json");
  if (!r.ok) throw new Error(`${r.error.mensaje} ${r.error.detalles?.join(" | ")}`);
  return r.valor;
})();

/** Instante en la Ciudad de México (UTC-6 todo el año desde 2022). */
const mx = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-06:00`);

const MXN_20 = { tasa: "0.20", moneda: "MXN" } as const;
const HOY = mx("2026-10-08", "12:00");

function grafica(b: BenchmarkPdf) {
  if (b.tipo !== "grafica") throw new Error(`Se esperaba la gráfica y llegó: ${b.texto}`);
  return b;
}

const copia = (): Benchmark => structuredClone(bench);
const nombres = (b: BenchmarkPdf) => grafica(b).grupos.flatMap((g) => g.barras.map((x) => x.nombre));
const instrumento = (b: Benchmark, id: string) => {
  const i = b.instrumentos.find((x) => x.id === id);
  if (i === undefined) throw new Error(`No existe ${id}`);
  return i;
};

const NOTA_MERCADO_PAGO = "Hasta 12% anual, sujeto a condiciones del producto.";
const NOTA_NU_TURBO = "Hasta $25,000 y una compra al mes con tarjeta Nu.";
const NOTA_BBVA = "Pagaré Tradicional a 360 días, para montos de más de $1,000,000.";
const NOTA_SANTANDER = "Pagaré Súper CETE a 360 días: solo para dinero nuevo y desde $50,000; tasa variable ligada a CETES 28.";
const NOTA_NASDAQ = "Rendimiento anual con interés compuesto, en dólares; renta variable con riesgo más alto y más volátil.";

describe("cargarBenchmark (esquema 0.4)", () => {
  it("lee la versión 0.4.2, las reglas, los dos grupos y los avisos por grupo", () => {
    expect(bench.version).toBe("0.4.2");
    expect(bench.actualizado_al).toBe("2026-10-08");
    expect(bench.reglas.dias_maximos_de_antiguedad).toBeNull();
    expect(bench.reglas.omitir_si_vigente_hasta_ya_paso).toBe(false);
    expect(bench.reglas.grupos).toEqual({
      tasa_vigente: "Última tasa publicada",
      rendimiento_historico: "Rendimiento histórico, no garantizado",
    });
    expect(bench.avisos.rendimiento_historico).toEqual([
      "Rendimientos pasados no garantizan resultados futuros.",
      "Renta variable: puede haber pérdida del capital.",
    ]);
  });

  it("acepta tasas y fechas nulas (Caja Libertad, sin dato)", () => {
    expect(instrumento(bench, "caja_libertad").tasa_anual).toBeNull();
    expect(instrumento(bench, "caja_libertad").fecha_dato).toBeNull();
  });

  it("los bancos son BBVA y Santander a un año (decisión del dueño); Inbursa queda fuera del PDF con su motivo", () => {
    expect([instrumento(bench, "bbva_pagare_360").tasa_anual, instrumento(bench, "santander_super_cete_360").tasa_anual]).toEqual(["0.0340", "0.0575"]);
    expect(instrumento(bench, "bancos").incluir_en_pdf).toBe(false);
    expect(instrumento(bench, "bancos").motivo_si_no_se_incluye).toMatch(/BBVA y Santander/);
  });

  it("el NASDAQ es el Nasdaq-100, en dólares, en el grupo histórico, con su nota de interés compuesto y riesgo", () => {
    const n = instrumento(bench, "nasdaq");
    expect([n.tasa_anual, n.moneda, n.tipo_dato, n.periodo, n.fecha_dato, n.incluir_en_pdf]).toEqual([
      "0.2116",
      "USD",
      "rendimiento_historico",
      "10 años",
      "2026-09-29",
      true,
    ]);
    expect(n.nota_asterisco).toBe(NOTA_NASDAQ);
  });

  it("rechaza una clave desconocida, una tasa que no es decimal, un tipo de dato y una fecha mal escritos, con la ubicación", () => {
    const malo = JSON.parse(JSON.stringify(benchmarkJson));
    malo.instrumentos[0].sobrante = 1;
    malo.instrumentos[1].tasa_anual = "6.78%";
    malo.instrumentos[2].tipo_dato = "otra_cosa";
    malo.actualizado_al = "08/10/2026";
    const r = cargarBenchmark(malo, "seed/benchmark.json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe("BENCHMARK_INVALIDO");
    expect(r.error.mensaje).toContain("seed/benchmark.json");
    const detalles = r.error.detalles?.join("\n") ?? "";
    expect(detalles).toContain("instrumentos.0");
    expect(detalles).toContain("instrumentos.1.tasa_anual");
    expect(detalles).toContain("instrumentos.2.tipo_dato");
    expect(detalles).toContain("actualizado_al");
  });

  it("rechaza un instrumento que se publicaría sin su fecha", () => {
    const malo = JSON.parse(JSON.stringify(benchmarkJson));
    malo.instrumentos[0].fecha_dato = null;
    const r = cargarBenchmark(malo, "seed/benchmark.json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.detalles?.join("\n")).toMatch(/instrumentos\.0\.fecha_dato/);
  });
});

describe("modeloBenchmark con el archivo tal cual (interruptores apagados)", () => {
  it("dos grupos: última tasa publicada (con tu tasa) y rendimiento histórico, cada uno de mayor a menor", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, HOY, t));
    expect(g.grupos.map((x) => [x.clave, x.titulo])).toEqual([
      ["tasa_vigente", "Última tasa publicada"],
      ["rendimiento_historico", "Rendimiento histórico, no garantizado"],
    ]);
    expect(g.grupos[0].barras.map((b) => [b.nombre, b.tasa, b.tuya, b.fecha])).toEqual([
      [t.benchmarkTuTasa, "20.00%", true, null],
      ["Nu · Cajita Turbo (hasta $25,000) (2)", "13.00%", false, "vigente hasta el 7 de octubre de 2026"],
      ["Mercado Pago, hasta 12% (1)", "12.00%", false, "publicada el 7 de octubre de 2026"],
      ["CETES 1 año", "7.44%", false, "publicada el 8 de octubre de 2026"],
      ["Nu · Cajita 24/7", "6.50%", false, "vigente hasta el 7 de octubre de 2026"],
      ["Santander · Pagaré 360 días (4)", "5.75%", false, "publicada el 8 de septiembre de 2026"],
      ["BBVA · Pagaré 360 días (3)", "3.40%", false, "publicada el 1 de octubre de 2026"],
    ]);
    expect(g.grupos[1].barras.map((b) => [b.nombre, b.tasa, b.fecha, b.periodo, b.moneda])).toEqual([
      ["Nasdaq-100 (10 años anualizado) (5)", "21.16%", "al corte del 29 de septiembre de 2026", "10 años", "USD"],
      ["S&P 500 (10 años anualizado)", "15.51%", "al corte del 30 de junio de 2026", "10 años", "USD"],
      ["BlackRock · BLKGUB1 (12 meses)", "8.17%", "al corte del 31 de diciembre de 2025", "12 meses", "MXN"],
    ]);
  });

  it("la línea de detalle junta fecha, periodo y, en dólares, la moneda (S&P 500); tu tasa no lleva", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, HOY, t));
    expect(g.grupos[1].barras[0].detalle).toBe("al corte del 29 de septiembre de 2026 · 10 años · en dólares (USD)");
    expect(g.grupos[1].barras[1].detalle).toBe("al corte del 30 de junio de 2026 · 10 años · en dólares (USD)");
    expect(g.grupos[1].barras[2].detalle).toBe("al corte del 31 de diciembre de 2025 · 12 meses");
    expect(g.grupos[0].barras[3].detalle).toBe("publicada el 8 de octubre de 2026");
    expect(g.grupos[0].barras[0].detalle).toBeNull();
  });

  it("cada grupo lleva sus propios avisos", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, HOY, t));
    expect(g.grupos[0].leyendas).toEqual(bench.avisos.tasa_vigente);
    expect(g.grupos[1].leyendas).toEqual(["Rendimientos pasados no garantizan resultados futuros.", "Renta variable: puede haber pérdida del capital."]);
  });

  it("notas numeradas en el orden del archivo, con su nota, y las fuentes por nombre corto", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, HOY, t));
    expect(g.notas).toEqual([
      `(1) ${NOTA_MERCADO_PAGO}`,
      `(2) ${NOTA_NU_TURBO}`,
      `(3) ${NOTA_BBVA}`,
      `(4) ${NOTA_SANTANDER}`,
      `(5) ${NOTA_NASDAQ}`,
    ]);
    expect(g.fuentes).toBe("Fuentes: Cetesdirecto, Mercado Pago, Nu México, BBVA, Santander, BlackRock, State Street (S&P 500) y Invesco (Nasdaq-100)");
  });

  it("una misma escala para los dos grupos: la barra mayor (Nasdaq-100) ocupa todo el ancho", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, HOY, t));
    expect(g.grupos[1].barras[0].ancho).toBe(LIENZO_BENCHMARK.anchoBarra);
    // Tu tasa: 20 / 21.16 del ancho.
    expect(g.grupos[0].barras[0].ancho).toBeCloseTo((LIENZO_BENCHMARK.anchoBarra * 20) / 21.16, 6);
  });

  it("con la vigencia vencida (Nu hasta el 7) SE dibuja, con su fecha", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, mx("2026-10-09", "12:00"), t));
    const nu = g.grupos[0].barras.find((b) => b.nombre === "Nu · Cajita 24/7");
    expect(nu?.fecha).toBe("vigente hasta el 7 de octubre de 2026");
  });

  it("sin tope de antigüedad (nulo): años después sigue dibujando", () => {
    expect(modeloBenchmark(bench, MXN_20, mx("2030-01-01", "12:00"), t).tipo).toBe("grafica");
  });

  it("la verificación no filtra: un instrumento SECUNDARIA con incluir_en_pdf verdadero se dibuja", () => {
    const b = copia();
    Object.assign(instrumento(b, "bancos"), { incluir_en_pdf: true });
    expect(instrumento(b, "bancos").verificacion).toBe("SECUNDARIA");
    expect(nombres(modeloBenchmark(b, MXN_20, HOY, t)).some((x) => x.startsWith("Bancos (pagaré Inbursa)"))).toBe(true);
  });

  it("no dibuja lo que tiene incluir_en_pdf falso ni lo que tiene tasa nula", () => {
    const n = nombres(modeloBenchmark(bench, MXN_20, HOY, t));
    for (const fuera of ["CETES 28 días", "CETES 91 días", "CETES 6 meses", "Caja Libertad"]) expect(n).not.toContain(fuera);
    expect(n.some((x) => x.includes("Inbursa"))).toBe(false);
  });

  it("una tasa nula no se dibuja aunque incluir_en_pdf sea verdadero", () => {
    const b = copia();
    Object.assign(instrumento(b, "caja_libertad"), { incluir_en_pdf: true, fecha_dato: "2026-10-08", fecha_tipo: "publicacion" });
    expect(nombres(modeloBenchmark(b, MXN_20, HOY, t))).not.toContain("Caja Libertad");
  });

  it("un instrumento con tasa y incluir_en_pdf falso no se dibuja", () => {
    const b = copia();
    instrumento(b, "cetes_364").incluir_en_pdf = false;
    expect(nombres(modeloBenchmark(b, MXN_20, HOY, t))).not.toContain("CETES 1 año");
  });

  it("tu tasa con puntos extra entra en su lugar del orden (13.50% va antes de Nu Turbo)", () => {
    const g = grafica(modeloBenchmark(bench, { tasa: "0.135", moneda: "MXN" }, HOY, t));
    expect(g.grupos[0].barras.slice(0, 3).map((b) => b.tasa)).toEqual(["13.50%", "13.00%", "12.00%"]);
    expect(g.grupos[0].barras[0].tuya).toBe(true);
    expect(g.grupos.flatMap((x) => x.barras).filter((b) => b.tuya)).toHaveLength(1);
  });

  it("en dólares no se dibuja: compara contra tasas en pesos", () => {
    const r = modeloBenchmark(bench, { tasa: "0.08", moneda: "USD" }, HOY, t);
    expect(r).toEqual({ tipo: "omitido", titulo: t.benchmarkTitulo, texto: t.benchmarkSoloPesos });
  });

  it("sin instrumentos históricos publicables, no hay grupo histórico ni sus avisos", () => {
    const b = copia();
    for (const id of ["blackrock_blkgub1", "sp500", "nasdaq"]) instrumento(b, id).incluir_en_pdf = false;
    const g = grafica(modeloBenchmark(b, MXN_20, HOY, t));
    expect(g.grupos.map((x) => x.clave)).toEqual(["tasa_vigente"]);
  });

  it("sin ningún instrumento publicable se omite con la nota de datos desactualizados", () => {
    const b = copia();
    b.instrumentos = b.instrumentos.map((i) => ({ ...i, incluir_en_pdf: false }));
    expect(modeloBenchmark(b, MXN_20, HOY, t)).toEqual({ tipo: "omitido", titulo: t.benchmarkTitulo, texto: t.benchmarkDesactualizado });
  });

  it("con mostrar_fecha_por_instrumento falso no se escribe la fecha junto a la barra", () => {
    const b = copia();
    b.reglas.mostrar_fecha_por_instrumento = false;
    const g = grafica(modeloBenchmark(b, MXN_20, HOY, t));
    expect(g.grupos.flatMap((x) => x.barras).every((x) => x.fecha === null)).toBe(true);
  });

  it("las palabras de la fecha salen del archivo (fecha_tipos), no del código", () => {
    const b = copia();
    b.reglas.fecha_tipos.publicacion = "dato del";
    const g = grafica(modeloBenchmark(b, MXN_20, HOY, t));
    expect(g.grupos[0].barras.find((x) => x.nombre === "CETES 1 año")?.fecha).toBe("dato del 8 de octubre de 2026");
  });
});

describe("modeloBenchmark: interruptor omitir_si_vigente_hasta_ya_paso", () => {
  const encendido = () => {
    const b = copia();
    b.reglas.omitir_si_vigente_hasta_ya_paso = true;
    return b;
  };

  it("encendido, el 8 de octubre omite Nu (vigente hasta el 7) y deja lo publicado (CETES, BBVA, Santander)", () => {
    const n = nombres(modeloBenchmark(encendido(), MXN_20, HOY, t));
    expect(n.some((x) => x.startsWith("Nu"))).toBe(false);
    expect(n).toContain("CETES 1 año");
    expect(n.some((x) => x.startsWith("BBVA"))).toBe(true);
    expect(n.some((x) => x.startsWith("Santander"))).toBe(true);
  });

  it("encendido, a las 23:30 del 7 de octubre en la Ciudad de México Nu todavía se dibuja", () => {
    const n = nombres(modeloBenchmark(encendido(), MXN_20, mx("2026-10-07", "23:30"), t));
    expect(n.filter((x) => x.startsWith("Nu"))).toHaveLength(2);
  });

  it("encendido, solo afecta a fecha_tipo vigencia_hasta: CETES (publicada) y S&P 500 (corte) siguen", () => {
    const n = nombres(modeloBenchmark(encendido(), MXN_20, mx("2027-01-01", "12:00"), t));
    expect(n).toContain("CETES 1 año");
    expect(n).toContain("S&P 500 (10 años anualizado)");
  });

  it("encendido, las notas se renumeran con lo que sí se dibuja", () => {
    const g = grafica(modeloBenchmark(encendido(), MXN_20, HOY, t));
    expect(g.notas).toEqual([`(1) ${NOTA_MERCADO_PAGO}`, `(2) ${NOTA_BBVA}`, `(3) ${NOTA_SANTANDER}`, `(4) ${NOTA_NASDAQ}`]);
    expect(g.fuentes).toBe("Fuentes: Cetesdirecto, Mercado Pago, BBVA, Santander, BlackRock, State Street (S&P 500) y Invesco (Nasdaq-100)");
  });
});

describe("modeloBenchmark: interruptor dias_maximos_de_antiguedad", () => {
  it("con 30 días, el 8 de octubre omite lo que tiene fecha de hace más de 30 días (por instrumento; Santander, del 8 de septiembre, entra justo)", () => {
    const b = copia();
    b.reglas.dias_maximos_de_antiguedad = 30;
    const n = nombres(modeloBenchmark(b, MXN_20, HOY, t));
    expect(n).toEqual([
      t.benchmarkTuTasa,
      "Nu · Cajita Turbo (hasta $25,000) (2)",
      "Mercado Pago, hasta 12% (1)",
      "CETES 1 año",
      "Nu · Cajita 24/7",
      "Santander · Pagaré 360 días (4)",
      "BBVA · Pagaré 360 días (3)",
      "Nasdaq-100 (10 años anualizado) (5)",
    ]);
  });

  it("el tope es inclusivo: con 1 día, un dato del 7 vale el 8 y ya no el 9", () => {
    const b = copia();
    b.reglas.dias_maximos_de_antiguedad = 1;
    expect(nombres(modeloBenchmark(b, MXN_20, HOY, t))).toContain("Mercado Pago, hasta 12% (1)");
    expect(nombres(modeloBenchmark(b, MXN_20, mx("2026-10-09", "12:00"), t)).some((x) => x.startsWith("Mercado Pago"))).toBe(false);
  });

  it("si con el tope no queda ningún instrumento, el comparativo se omite como desactualizado", () => {
    const b = copia();
    b.reglas.dias_maximos_de_antiguedad = 0;
    expect(modeloBenchmark(b, MXN_20, mx("2026-12-01", "12:00"), t)).toEqual({
      tipo: "omitido",
      titulo: t.benchmarkTitulo,
      texto: t.benchmarkDesactualizado,
    });
  });
});
