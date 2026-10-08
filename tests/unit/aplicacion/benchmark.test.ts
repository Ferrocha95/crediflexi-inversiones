import { describe, expect, it } from "vitest";
import benchmarkJson from "../../../seed/benchmark.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarBenchmark, LIENZO_BENCHMARK, modeloBenchmark, type Benchmark, type BenchmarkPdf } from "../../../src/aplicacion/benchmark";
import { cargarTextos } from "../../../src/aplicacion/textos";

// Comparativo de tasas (página 2 del PDF). Cifras y fechas de referencia
// calculadas a mano sobre seed/benchmark.json 0.2 (actualizado al 2026-10-07).

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

function grafica(b: BenchmarkPdf) {
  if (b.tipo !== "grafica") throw new Error(`Se esperaba la gráfica y llegó: ${b.texto}`);
  return b;
}

const copia = (): Benchmark => structuredClone(bench);

describe("cargarBenchmark", () => {
  it("lee la versión 0.2 con nombre corto de cada fuente y la nota del asterisco", () => {
    expect(bench.version).toBe("0.2");
    expect(bench.instrumentos.map((i) => i.fuente.nombre_corto)).toEqual([
      "Banco de México",
      "Banco de México",
      "Banco de México",
      "Nu México",
      "Nu México",
      "Nu México",
      "Mercado Pago",
      "BlackRock",
    ]);
    const conNota = bench.instrumentos.filter((i) => i.nota_asterisco !== undefined).map((i) => i.id);
    expect(conNota).toEqual(["nu_turbo", "mercado_pago"]);
    for (const i of bench.instrumentos.filter((x) => x.nota_asterisco !== undefined)) expect(i.nota_asterisco).toBe(i.condiciones);
  });

  it("rechaza una clave desconocida, una tasa que no es decimal y una fecha mal escrita, con la ubicación", () => {
    const malo = JSON.parse(JSON.stringify(benchmarkJson));
    malo.instrumentos[0].sobrante = 1;
    malo.instrumentos[1].tasa_anual = "6.78%";
    malo.actualizado_al = "07/10/2026";
    const r = cargarBenchmark(malo, "seed/benchmark.json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe("BENCHMARK_INVALIDO");
    expect(r.error.mensaje).toContain("seed/benchmark.json");
    const detalles = r.error.detalles?.join("\n") ?? "";
    expect(detalles).toContain("instrumentos.0");
    expect(detalles).toContain("instrumentos.1.tasa_anual");
    expect(detalles).toContain("actualizado_al");
  });
});

describe("modeloBenchmark", () => {
  it("el 7 de octubre: barras de mayor a menor, con tu tasa, asteriscos y sin BlackRock", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, mx("2026-10-07", "12:00"), t));
    expect(g.barras.map((b) => [b.nombre, b.tasa, b.tuya])).toEqual([
      [t.benchmarkTuTasa, "20.00%", true],
      ["Nu · Cajita Turbo (hasta $25,000)*", "13.00%", false],
      ["Mercado Pago · hasta 12%**", "12.00%", false],
      ["CETES a 175 días (aprox. 6 meses)", "6.91%", false],
      ["Nu · Ahorro congelado 180 días", "6.80%", false],
      ["CETES 91 días", "6.78%", false],
      ["Nu · Cajita 24/7", "6.50%", false],
      ["CETES 28 días", "6.09%", false],
    ]);
    expect(g.barras.some((b) => b.nombre.includes("BlackRock"))).toBe(false);
    // La barra más larga es la mayor; las demás, proporcionales (13/20 del ancho).
    expect(g.barras[0].ancho).toBe(LIENZO_BENCHMARK.anchoBarra);
    expect(g.barras[1].ancho).toBeCloseTo(LIENZO_BENCHMARK.anchoBarra * 0.65, 6);
    expect(g.titulo).toBe(t.benchmarkTitulo);
    expect(g.actualizado).toBe("Actualizado al 7 de octubre de 2026");
    expect(g.fuentes).toBe("Fuentes: Banco de México, Nu México y Mercado Pago");
    expect(g.notas).toEqual([
      ...bench.avisos,
      `* ${bench.instrumentos[5].nota_asterisco}`,
      `** ${bench.instrumentos[6].nota_asterisco}`,
    ]);
  });

  it("tu tasa con puntos extra entra en su lugar del orden (13.50% va antes de Nu Turbo)", () => {
    const g = grafica(modeloBenchmark(bench, { tasa: "0.135", moneda: "MXN" }, mx("2026-10-07", "12:00"), t));
    expect(g.barras.slice(0, 3).map((b) => b.tasa)).toEqual(["13.50%", "13.00%", "12.00%"]);
    expect(g.barras[0].tuya).toBe(true);
    expect(g.barras.filter((b) => b.tuya)).toHaveLength(1);
  });

  it("23:30 del 7 de octubre en la Ciudad de México todavía incluye Nu", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, mx("2026-10-07", "23:30"), t));
    expect(g.barras.filter((b) => b.nombre.startsWith("Nu"))).toHaveLength(3);
  });

  it("00:30 del 8 de octubre en la Ciudad de México omite los tres de Nu (vigentes hasta el 7)", () => {
    const g = grafica(modeloBenchmark(bench, MXN_20, mx("2026-10-08", "00:30"), t));
    expect(g.barras.map((b) => b.nombre)).toEqual([
      t.benchmarkTuTasa,
      "Mercado Pago · hasta 12%*",
      "CETES a 175 días (aprox. 6 meses)",
      "CETES 91 días",
      "CETES 28 días",
    ]);
    expect(g.notas).toEqual([...bench.avisos, `* ${bench.instrumentos[6].nota_asterisco}`]);
    expect(g.fuentes).toBe("Fuentes: Banco de México y Mercado Pago");
  });

  it("con 30 días de antigüedad dibuja; con 31 omite todo el comparativo", () => {
    expect(modeloBenchmark(bench, MXN_20, mx("2026-11-06", "23:59"), t).tipo).toBe("grafica");
    const omitido = modeloBenchmark(bench, MXN_20, mx("2026-11-07", "00:01"), t);
    expect(omitido).toEqual({ tipo: "omitido", titulo: t.benchmarkTitulo, texto: t.benchmarkDesactualizado });
    expect(t.benchmarkDesactualizado).toBe("Comparativo no disponible: datos desactualizados");
  });

  it("la antigüedad máxima sale del archivo, no del código", () => {
    const b = copia();
    b.reglas.dias_maximos_de_antiguedad = 5;
    expect(modeloBenchmark(b, MXN_20, mx("2026-10-12", "12:00"), t).tipo).toBe("grafica");
    expect(modeloBenchmark(b, MXN_20, mx("2026-10-13", "12:00"), t).tipo).toBe("omitido");
  });

  it("en dólares no se dibuja: los instrumentos son en pesos", () => {
    const r = modeloBenchmark(bench, { tasa: "0.08", moneda: "USD" }, mx("2026-10-07", "12:00"), t);
    expect(r).toEqual({ tipo: "omitido", titulo: t.benchmarkTitulo, texto: t.benchmarkSoloPesos });
  });

  it("solo publica lo verificado en fuente OFICIAL y lo marcado incluir_en_pdf", () => {
    const b = copia();
    b.instrumentos[0] = { ...b.instrumentos[0], verificacion: "SIN_VERIFICAR" };
    b.instrumentos[1] = { ...b.instrumentos[1], incluir_en_pdf: false };
    const g = grafica(modeloBenchmark(b, MXN_20, mx("2026-10-08", "12:00"), t));
    expect(g.barras.map((x) => x.nombre)).toEqual([t.benchmarkTuTasa, "Mercado Pago · hasta 12%*", "CETES a 175 días (aprox. 6 meses)"]);
  });

  it("si la regla de vigencia está apagada en el archivo, no omite por vigente_hasta", () => {
    const b = copia();
    b.reglas.omitir_si_vigente_hasta_ya_paso = false;
    const g = grafica(modeloBenchmark(b, MXN_20, mx("2026-10-08", "12:00"), t));
    expect(g.barras.filter((x) => x.nombre.startsWith("Nu"))).toHaveLength(3);
  });

  it("sin ningún instrumento publicable se omite con la nota de datos desactualizados", () => {
    const b = copia();
    b.instrumentos = b.instrumentos.map((i) => ({ ...i, incluir_en_pdf: false }));
    expect(modeloBenchmark(b, MXN_20, mx("2026-10-07", "12:00"), t).tipo).toBe("omitido");
  });
});
