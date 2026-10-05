// Modelo de la página 2 del PDF: tarjetas de las dos modalidades y las dos
// gráficas, ya formateadas y con coordenadas. Las cifras esperadas son las de
// referencia (calculadas fuera del motor).

import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { LIENZO_GRAFICA, datosPagina2, modeloPagina2, type DatosPagina2, type GraficaPdf } from "../../../src/aplicacion/pagina2";
import { cargarTextos, type TextosPagina2 } from "../../../src/aplicacion/textos";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { cotizarBien, semillaReal } from "../oro/ayudas";

const textosCarga = cargarTextos(textosJson, "seed/textos_cotizacion.json");
if (!textosCarga.ok) throw new Error(textosCarga.error.mensaje);
const T = textosCarga.valor.pdfPagina2;

function modelo(monto: string, plazo: number, esquema: Esquema, textos: TextosPagina2 = T) {
  const c = cotizarBien({ monto, plazo, esquema });
  return modeloPagina2(c, datosPagina2(semillaReal, c.solicitud), textos);
}

/** Todas las coordenadas de una gráfica, para revisar que sean finitas y caigan en el lienzo. */
function coordenadas(g: GraficaPdf): number[] {
  if (g.dibujo === null) return [];
  const d = g.dibujo;
  const deRutas = d.series.flatMap((s) => [...s.ruta.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0])));
  return [
    ...deRutas,
    ...d.series.flatMap((s) => [s.final.x, s.final.y]),
    ...d.ejeX.map((m) => m.x),
    ...d.ejeY.map((m) => m.y),
    ...(d.lineaVertical ? [d.lineaVertical.x] : []),
  ];
}

describe("modeloPagina2: tarjetas de las dos modalidades", () => {
  it("1,000,000 pesos a 6 meses, cotizado mensual: las dos tarjetas con las cifras del Excel", () => {
    const m = modelo("1000000", 6, "mensual");
    const [m1, m2] = m.tarjetas;

    expect(m1.titulo).toBe("MODALIDAD 1 · RENDIMIENTO MENSUAL");
    expect(m1.elegida).toBe(true);
    expect(m1.nota).toBeNull();
    expect(m1.detalle?.tasa).toBe("18.00%");
    expect(m1.detalle?.renglones).toEqual([
      { etiqueta: "Capital inicial", cifra: "$1,000,000.00" },
      { etiqueta: "Rendimiento estimado", cifra: "$90,000.00" },
      { etiqueta: "Total capital + rendimiento", cifra: "$1,090,000.00" },
    ]);
    expect(m1.detalle?.filas).toHaveLength(6);
    expect(m1.detalle?.filas[0]).toEqual({ mes: "1", rendimiento: "$15,000.00", acumulado: "$15,000.00" });
    expect(m1.detalle?.filas[5]).toEqual({ mes: "6", rendimiento: "$15,000.00", acumulado: "$90,000.00" });

    expect(m2.titulo).toBe("MODALIDAD 2 · PAGO AL VENCIMIENTO");
    expect(m2.elegida).toBe(false);
    expect(m2.detalle?.tasa).toBe("20.00%");
    expect(m2.detalle?.renglones.map((r) => r.cifra)).toEqual(["$1,000,000.00", "$100,000.00", "$1,100,000.00"]);
    expect(m2.detalle?.filas.map((f) => f.rendimiento)).toEqual([
      "$16,666.67",
      "$16,666.66",
      "$16,666.67",
      "$16,666.67",
      "$16,666.66",
      "$16,666.67",
    ]);
    expect(m2.detalle?.filas.map((f) => f.acumulado)).toEqual([
      "$16,666.67",
      "$33,333.33",
      "$50,000.00",
      "$66,666.67",
      "$83,333.33",
      "$100,000.00",
    ]);
  });

  it("cotizado al final del plazo, la insignia va en la modalidad 2", () => {
    const m = modelo("1000000", 6, "final_del_plazo");
    expect(m.tarjetas.map((t) => t.elegida)).toEqual([false, true]);
  });

  it("una modalidad que no se puede cotizar se reemplaza por la nota del archivo de textos", () => {
    const c = cotizarBien({ monto: "1000000", plazo: 6 });
    const datos = datosPagina2(semillaReal, c.solicitud);
    const sinFinal: DatosPagina2 = {
      ...datos,
      calendarios: { ...datos.calendarios, finalDelPlazo: { ok: false, error: { codigo: "TRAMO_POR_CONFIRMAR", mensaje: "x" } } },
    };
    const [m1, m2] = modeloPagina2(c, sinFinal, T).tarjetas;
    expect(m1.detalle).not.toBeNull();
    expect(m2.detalle).toBeNull();
    expect(m2.titulo).toBe("MODALIDAD 2 · PAGO AL VENCIMIENTO");
    expect(m2.nota).toBe(T.modalidadNoDisponible);
  });

  it("los títulos y etiquetas salen del archivo de textos, no del código", () => {
    const otros: TextosPagina2 = { ...T, modalidad1: "Título sintético A", capitalInicial: "Capital sintético" };
    const m = modelo("1000000", 6, "mensual", otros);
    expect(m.tarjetas[0].titulo).toBe("Título sintético A");
    expect(m.tarjetas[0].detalle?.renglones[0].etiqueta).toBe("Capital sintético");
  });
});

describe("modeloPagina2: gráfica 1, comparación de modalidades", () => {
  it("dos series con los acumulados de las tarjetas, de 0 al plazo, con el total al final", () => {
    const g = modelo("1000000", 6, "mensual").graficas[0];
    expect(g.titulo).toBe(T.tituloGrafica1);
    expect(g.nota).toBe(T.notaGrafica1);
    expect(g.rotulo).toBeNull();
    const d = g.dibujo!;
    expect(d.series.map((s) => s.nombre)).toEqual([T.serieCobrado, T.serieDevengado]);
    expect(d.series.map((s) => s.final.texto)).toEqual(["$90,000.00", "$100,000.00"]);
    expect(d.series.map((s) => s.trazo)).toEqual(["continuo", "rayado"]);
    for (const s of d.series) expect(s.ruta.split("L")).toHaveLength(7);
    expect(d.ejeX.map((m) => m.texto)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    expect(d.lineaVertical).toBeNull();
  });

  it("con una sola modalidad cotizable, dibuja solo esa serie", () => {
    const c = cotizarBien({ monto: "1000000", plazo: 6 });
    const datos = datosPagina2(semillaReal, c.solicitud);
    const sinFinal: DatosPagina2 = {
      ...datos,
      calendarios: { ...datos.calendarios, finalDelPlazo: { ok: false, error: { codigo: "TRAMO_POR_CONFIRMAR", mensaje: "x" } } },
    };
    expect(modeloPagina2(c, sinFinal, T).graficas[0].dibujo!.series.map((s) => s.nombre)).toEqual([T.serieCobrado]);
  });
});

describe("modeloPagina2: gráfica 2, escenario ilustrativo de reinversión", () => {
  it("1,500,000 pesos a 12 meses mensual: dos series a 24 meses, línea al fin del primer plazo y nota", () => {
    const g = modelo("1500000", 12, "mensual").graficas[1];
    expect(g.titulo).toBe(T.tituloGrafica2);
    expect(g.rotulo).toBe("Escenario ilustrativo");
    expect(g.nota).toBe(T.notaEscenario);
    const d = g.dibujo!;
    expect(d.series.map((s) => s.nombre)).toEqual([T.serieConReinversion, T.serieSinReinvertir]);
    expect(d.series.map((s) => s.trazo)).toEqual(["continuo", "punteado"]);
    expect(d.series.map((s) => s.final.texto)).toEqual(["$2,186,906.87", "$2,070,000.00"]);
    for (const s of d.series) expect(s.ruta.split("L")).toHaveLength(25);
    expect(d.ejeX.at(-1)?.texto).toBe("24");
    expect(d.lineaVertical?.texto).toBe(T.finPrimerPlazo);
    const mitad = (LIENZO_GRAFICA.area.izquierda + LIENZO_GRAFICA.area.derecha) / 2;
    expect(d.lineaVertical?.x).toBeCloseTo(mitad, 6);
  });

  it("55,000 pesos a 6 meses mensual: el escenario se omite y queda la nota del incremento mínimo", () => {
    const g = modelo("55000", 6, "mensual").graficas[1];
    expect(g.dibujo).toBeNull();
    expect(g.omision).toBe(T.escenarioIncrementoMinimo);
    expect(g.titulo).toBe(T.tituloGrafica2);
  });

  it("si falta una tasa, la nota dice que alguna tasa está por confirmar", () => {
    const c = cotizarBien({ monto: "1000000", plazo: 6 });
    const datos: DatosPagina2 = {
      ...datosPagina2(semillaReal, c.solicitud),
      escenario: { tipo: "omitido", motivo: "TASA_NO_DISPONIBLE" },
    };
    expect(modeloPagina2(c, datos, T).graficas[1].omision).toBe(T.escenarioTasaNoDisponible);
  });

  it("al final del plazo, 580,000 pesos a 12 meses: el valor final y sin reinvertir al final de cada línea", () => {
    const d = modelo("580000", 12, "final_del_plazo").graficas[1].dibujo!;
    expect(d.series.map((s) => s.final.texto)).toEqual(["$831,720.00", "$806,200.00"]);
  });
});

describe("modeloPagina2: coordenadas", () => {
  it.each([
    ["1000000", 6, "mensual"],
    ["1500000", 12, "mensual"],
    ["950000", 12, "mensual"],
    ["500000", 24, "final_del_plazo"],
    ["580000", 12, "final_del_plazo"],
    ["55000", 6, "mensual"],
    ["99999999.99", 24, "mensual"],
  ] as const)("%s pesos a %s meses (%s): todas finitas y dentro del lienzo", (monto, plazo, esquema) => {
    for (const g of modelo(monto, plazo, esquema).graficas) {
      for (const v of coordenadas(g)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(LIENZO_GRAFICA.ancho);
      }
    }
  });

  it("las etiquetas finales no se enciman", () => {
    for (const g of modelo("1000000", 6, "mensual").graficas) {
      const ys = g.dibujo!.series.map((s) => s.final.y);
      expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(LIENZO_GRAFICA.separacionEtiquetas);
    }
  });

  it("el modelo no trae undefined, NaN ni llaves sin rellenar", () => {
    const texto = JSON.stringify(modelo("1500000", 12, "mensual"));
    expect(texto).not.toMatch(/undefined|NaN|Infinity|\{[a-z_]+\}/);
  });
});

describe("modeloPagina2: forma del lienzo", () => {
  it("el área de dibujo cabe en el lienzo", () => {
    const { ancho, alto, area } = LIENZO_GRAFICA;
    expect(area.izquierda).toBeGreaterThan(0);
    expect(area.derecha).toBeLessThan(ancho);
    expect(area.arriba).toBeGreaterThanOrEqual(0);
    expect(area.abajo).toBeLessThan(alto);
  });
});
