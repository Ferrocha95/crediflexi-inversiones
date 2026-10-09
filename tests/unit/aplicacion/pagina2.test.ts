// Modelo de la página 2 del PDF: tarjetas de las dos modalidades (la 1 con su
// tabla mensual; la 2 anualizada, sin filas), las líneas de cuándo se paga la
// ganancia y el capital, la franja de tiempo y la gráfica de comparación. Las
// cifras esperadas son las de referencia (calculadas fuera del motor).

import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import {
  LIENZO_FRANJA,
  LIENZO_GRAFICA,
  datosPagina2,
  modeloPagina2,
  type DatosPagina2,
  type GraficaPdf,
} from "../../../src/aplicacion/pagina2";
import { cargarTextos, type TextosPagina2 } from "../../../src/aplicacion/textos";
import { cotizarConAjuste, type Ajuste } from "../../../src/domain/interes/ajustes";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { cotizarBien, semillaReal } from "../oro/ayudas";

const textosCarga = cargarTextos(textosJson, "seed/textos_cotizacion.json");
if (!textosCarga.ok) throw new Error(textosCarga.error.mensaje);
const T = textosCarga.valor.pdfPagina2;

function modelo(monto: string, plazo: number, esquema: Esquema, textos: TextosPagina2 = T) {
  const c = cotizarBien({ monto, plazo, esquema });
  return modeloPagina2(c, datosPagina2(semillaReal, c.solicitud), textos);
}

function modeloAjustado(monto: string, esquema: Esquema, ajuste: Ajuste) {
  const plazo = ajuste.tipo === "especial" ? ajuste.plazo : 12;
  const r = cotizarConAjuste(semillaReal, { entidad: "CREDIFLEXI", moneda: "MXN", esquema, monto, plazo }, ajuste);
  if (!r.ok) throw new Error(r.error.mensaje);
  return modeloPagina2(r.valor, datosPagina2(semillaReal, r.valor.solicitud, ajuste), T);
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
  it("1,000,000 pesos a 6 meses, cotizado mensual: la modalidad 1 con su tabla y la 2 anualizada", () => {
    const m = modelo("1000000", 6, "mensual");
    const [m1, m2] = m.tarjetas;

    expect(m1.titulo).toBe("MODALIDAD 1 · RENDIMIENTO MENSUAL");
    expect(m1.elegida).toBe(true);
    expect(m1.nota).toBeNull();
    expect(m1.detalle?.tasa).toBe("18.00%");
    expect(m1.detalle?.etiquetaTasa).toBe("Tasa anual neta");
    expect(m1.detalle?.renglones).toEqual([
      { etiqueta: "Capital inicial", cifra: "$1,000,000.00" },
      { etiqueta: "Rendimiento total (6 meses)", cifra: "$90,000.00" },
      { etiqueta: "Capital + rendimiento total", cifra: "$1,090,000.00" },
    ]);
    expect(m1.detalle?.filas).toHaveLength(6);
    expect(m1.detalle?.filas[0]).toEqual({ mes: "1", rendimiento: "$15,000.00", acumulado: "$15,000.00" });
    expect(m1.detalle?.filas[5]).toEqual({ mes: "6", rendimiento: "$15,000.00", acumulado: "$90,000.00" });

    expect(m2.titulo).toBe("MODALIDAD 2 · PAGO AL VENCIMIENTO");
    expect(m2.elegida).toBe(false);
    expect(m2.detalle?.tasa).toBe("20.00%");
    // Sin el renglón del rendimiento anual (Sprint 6a); rendimiento total 1,000,000 × 0.20 × 6 ÷ 12 = 100,000.00.
    expect(m2.detalle?.renglones).toEqual([
      { etiqueta: "Capital inicial", cifra: "$1,000,000.00" },
      { etiqueta: "Rendimiento total (6 meses)", cifra: "$100,000.00" },
      { etiqueta: "Capital + rendimiento total", cifra: "$1,100,000.00" },
    ]);
    expect(m2.detalle?.filas).toEqual([]);
  });

  it.each([6, 12, 24])("las líneas de cuándo se paga la ganancia y el capital llevan el mes %s", (plazo) => {
    const [m1, m2] = modelo("1000000", plazo, "mensual").tarjetas;
    expect(m1.detalle?.lineas).toEqual([
      `Pago de rendimiento mensual: cada mes, del mes 1 al mes ${plazo}`,
      `Capital: al vencimiento (mes ${plazo})`,
    ]);
    expect(m2.detalle?.lineas).toEqual([
      `Pago de rendimiento: al final del plazo (mes ${plazo}), junto con el capital`,
      `Capital: al vencimiento (mes ${plazo})`,
    ]);
  });

  it("franja de tiempo: la modalidad 1 tiene un punto por mes y + capital en el último; la 2, un solo punto en el mes N", () => {
    const [m1, m2] = modelo("1000000", 6, "mensual").tarjetas;
    const f1 = m1.detalle!.franja;
    expect(f1.puntos.map((p) => p.mes)).toEqual([1, 2, 3, 4, 5, 6]);
    expect([f1.etiquetaPuntos, f1.etiquetaFinal]).toEqual([T.franjaRendimiento, T.franjaMasCapital]);
    const f2 = m2.detalle!.franja;
    expect(f2.puntos.map((p) => p.mes)).toEqual([6]);
    expect([f2.etiquetaPuntos, f2.etiquetaFinal]).toEqual([null, T.franjaRendimientoCapital]);
  });

  it.each([6, 9, 24, 36, 60])("la franja de %s meses queda dentro de su lienzo y en orden", (plazo) => {
    const r = cotizarConAjuste(semillaReal, { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "100000", plazo }, {
      tipo: "especial",
      plazo,
      tasas: { mensual: "17", final_del_plazo: "19" },
    });
    if (!r.ok) throw new Error(r.error.mensaje);
    const m = modeloPagina2(r.valor, datosPagina2(semillaReal, r.valor.solicitud, { tipo: "especial", plazo, tasas: { mensual: "17", final_del_plazo: "19" } }), T);
    for (const t of m.tarjetas) {
      const xs = t.detalle!.franja.puntos.map((p) => p.x);
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(LIENZO_FRANJA.izquierda);
        expect(x).toBeLessThanOrEqual(LIENZO_FRANJA.derecha);
      }
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
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

describe("modeloPagina2: plazo especial", () => {
  const ESPECIAL_9: Ajuste = { tipo: "especial", plazo: 9, tasas: { mensual: "17" } };

  it("la tarjeta dice Tasa acordada y las líneas llevan el mes 9", () => {
    const [m1] = modeloAjustado("100000", "mensual", ESPECIAL_9).tarjetas;
    expect(m1.detalle?.etiquetaTasa).toBe(T.tasaAcordada);
    expect(m1.detalle?.lineas).toEqual(["Pago de rendimiento mensual: cada mes, del mes 1 al mes 9", "Capital: al vencimiento (mes 9)"]);
  });

  it("la modalidad sin tasa acordada lleva su nota y la comparación se omite con su nota", () => {
    const m = modeloAjustado("100000", "mensual", ESPECIAL_9);
    expect(m.tarjetas[1].detalle).toBeNull();
    expect(m.tarjetas[1].nota).toBe(T.modalidadSinTasa);
    expect(m.graficas[0].dibujo).toBeNull();
    expect(m.graficas[0].omision).toBe(T.comparacionOmitida);
  });
});

describe("modeloPagina2: comparación de modalidades (la única gráfica: ya no hay escenario de reinversión)", () => {
  it("una sola gráfica", () => {
    expect(modelo("1500000", 12, "mensual").graficas).toHaveLength(1);
  });

  it("dos series con los acumulados de las dos modalidades, de 0 al plazo, con el total al final", () => {
    const g = modelo("1000000", 6, "mensual").graficas[0];
    expect(g.titulo).toBe(T.tituloGrafica1);
    expect(g.nota).toBe(T.notaGrafica1);
    expect(g.rotulo).toBeNull();
    const d = g.dibujo!;
    expect(d.series.map((s) => s.nombre)).toEqual([T.serieMensual, T.serieFinal]);
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
    expect(modeloPagina2(c, sinFinal, T).graficas[0].dibujo!.series.map((s) => s.nombre)).toEqual([T.serieMensual]);
  });

  it("el modelo de la página 2 no menciona la reinversión ni el escenario", () => {
    const texto = JSON.stringify(modelo("1500000", 12, "mensual")).toLowerCase();
    expect(texto).not.toMatch(/reinver|escenario/);
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
    // Los textos traen las plantillas tal cual ({meses}); lo rellenado está en el resto del modelo.
    const texto = JSON.stringify({ ...modelo("1500000", 12, "mensual"), textos: null });
    expect(texto).not.toMatch(/undefined|NaN|Infinity|\{[a-z_]+\}/);
  });
});
