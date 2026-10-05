import { Decimal } from "../domain/comun/decimal";
import { formatearCantidad, formatearPesos, formatearPorcentaje } from "../domain/comun/formato";
import type { Resultado } from "../domain/comun/resultado";
import { calendarios, type CalendarioModalidad } from "../domain/interes/calendario";
import type { Cotizacion } from "../domain/interes/cotizar";
import { escenarioReinversion, type EscenarioReinversion } from "../domain/interes/escenario";
import type { SolicitudTasa } from "../domain/tasas/resolver";
import type { Esquema, Semilla } from "../domain/tasas/semilla.esquema";
import { escalaLineal, marcasMeses, marcasValor, separarEtiquetas, trazado } from "./graficas";
import type { TextosPagina2 } from "./textos";

// Página 2 del PDF: este módulo no calcula cifras, solo les da forma de texto y
// convierte a coordenadas (números) lo que se dibuja.

/** Lo que el dominio calcula para la página 2. */
export interface DatosPagina2 {
  readonly calendarios: {
    readonly mensual: Resultado<CalendarioModalidad>;
    readonly finalDelPlazo: Resultado<CalendarioModalidad>;
  };
  readonly escenario: EscenarioReinversion;
}

/** Calendarios de las dos modalidades y escenario de reinversión para la misma solicitud. */
export function datosPagina2(semilla: Semilla, solicitud: SolicitudTasa): DatosPagina2 {
  return { calendarios: calendarios(semilla, solicitud), escenario: escenarioReinversion(semilla, solicitud) };
}

export interface TarjetaPdf {
  readonly esquema: Esquema;
  readonly titulo: string;
  /** La modalidad de la cotización: lleva la insignia. */
  readonly elegida: boolean;
  /** null si la modalidad no se puede cotizar. */
  readonly detalle: {
    readonly tasa: string;
    readonly renglones: readonly { readonly etiqueta: string; readonly cifra: string }[];
    readonly filas: readonly { readonly mes: string; readonly rendimiento: string; readonly acumulado: string }[];
  } | null;
  /** Reemplaza al detalle cuando la modalidad no se puede cotizar. */
  readonly nota: string | null;
}

export type ColorSerie = "marino" | "verde" | "gris";
export type TrazoSerie = "continuo" | "rayado" | "punteado";

export interface SerieGrafica {
  readonly nombre: string;
  readonly color: ColorSerie;
  readonly trazo: TrazoSerie;
  /** Ruta SVG en coordenadas del lienzo. */
  readonly ruta: string;
  /** Etiqueta directa al final de la línea, con su valor. */
  readonly final: { readonly x: number; readonly y: number; readonly texto: string };
}

export interface GraficaPdf {
  readonly titulo: string;
  readonly rotulo: string | null;
  /** Nota debajo de la gráfica; null si la gráfica se omite (queda solo la nota de omisión). */
  readonly nota: string | null;
  /** null si la gráfica se omite. */
  readonly dibujo: {
    readonly ejeX: readonly { readonly x: number; readonly texto: string }[];
    readonly ejeY: readonly { readonly y: number; readonly texto: string }[];
    readonly tituloEjeX: string;
    readonly series: readonly SerieGrafica[];
    readonly lineaVertical: { readonly x: number; readonly texto: string } | null;
  } | null;
  /** Nota que reemplaza a la gráfica cuando se omite. */
  readonly omision: string | null;
}

export interface ModeloPagina2 {
  readonly textos: TextosPagina2;
  readonly tarjetas: readonly [TarjetaPdf, TarjetaPdf];
  readonly graficas: readonly [GraficaPdf, GraficaPdf];
}

/**
 * Lienzo de cada gráfica, en puntos: dos gráficas lado a lado en el ancho útil
 * de la hoja carta (540 pt). A la izquierda van las marcas del eje de valores y
 * a la derecha las etiquetas finales de las líneas.
 */
export const LIENZO_GRAFICA = {
  ancho: 264,
  alto: 150,
  area: { izquierda: 50, derecha: 198, arriba: 10, abajo: 126 },
  /** Distancia mínima entre las etiquetas finales (alto de una línea de 7 pt). */
  separacionEtiquetas: 9,
} as const;

const pesos = (texto: string) => formatearPesos(new Decimal(texto));
/** Marca del eje de valores: pesos sin centavos si son cero ("$1,800,000"). */
const marcaPesos = (v: number) => `$${formatearCantidad(new Decimal(v)).replace(/\.00$/, "")}`;

function tarjeta(
  esquema: Esquema,
  titulo: string,
  elegida: boolean,
  r: Resultado<CalendarioModalidad>,
  t: TextosPagina2,
): TarjetaPdf {
  if (!r.ok) return { esquema, titulo, elegida, detalle: null, nota: t.modalidadNoDisponible };
  const c = r.valor;
  return {
    esquema,
    titulo,
    elegida,
    detalle: {
      tasa: formatearPorcentaje(new Decimal(c.tasa)),
      renglones: [
        { etiqueta: t.capitalInicial, cifra: pesos(c.capitalInicial) },
        { etiqueta: t.rendimientoEstimado, cifra: pesos(c.rendimientoEstimado) },
        { etiqueta: t.total, cifra: pesos(c.total) },
      ],
      filas: c.filas.map((f) => ({ mes: String(f.mes), rendimiento: pesos(f.rendimiento), acumulado: pesos(f.acumulado) })),
    },
    nota: null,
  };
}

interface SerieDatos {
  readonly nombre: string;
  readonly color: ColorSerie;
  readonly trazo: TrazoSerie;
  /** Valor por mes, desde el mes 0, como texto decimal. */
  readonly valores: readonly string[];
}

/** Ejes, rutas y etiquetas finales de una gráfica de líneas de 0 a `totalMeses`. */
function dibujo(
  series: readonly SerieDatos[],
  totalMeses: number,
  minimo: number,
  tituloEjeX: string,
  lineaVertical: { readonly mes: number; readonly texto: string } | null,
): NonNullable<GraficaPdf["dibujo"]> {
  const { area, separacionEtiquetas } = LIENZO_GRAFICA;
  const maximo = Math.max(...series.flatMap((s) => s.valores.map(Number)));
  const marcasY = marcasValor(minimo, maximo);
  const x = escalaLineal([0, totalMeses], [area.izquierda, area.derecha]);
  const y = escalaLineal([marcasY[0], marcasY.at(-1)!], [area.abajo, area.arriba]);

  const finales = separarEtiquetas(
    series.map((s) => y(Number(s.valores.at(-1)))),
    separacionEtiquetas,
    [area.arriba, area.abajo],
  );

  return {
    ejeX: marcasMeses(totalMeses).map((m) => ({ x: x(m), texto: String(m) })),
    ejeY: marcasY.map((v) => ({ y: y(v), texto: marcaPesos(v) })),
    tituloEjeX,
    series: series.map((s, i) => ({
      nombre: s.nombre,
      color: s.color,
      trazo: s.trazo,
      ruta: trazado(s.valores.map((v, mes) => ({ x: x(mes), y: y(Number(v)) }))),
      final: { x: area.derecha + 4, y: finales[i], texto: pesos(s.valores.at(-1)!) },
    })),
    lineaVertical: lineaVertical === null ? null : { x: x(lineaVertical.mes), texto: lineaVertical.texto },
  };
}

function graficaComparacion(
  m1: Resultado<CalendarioModalidad>,
  m2: Resultado<CalendarioModalidad>,
  plazo: number,
  t: TextosPagina2,
): GraficaPdf {
  const series: SerieDatos[] = [];
  for (const [r, nombre, color, trazo] of [
    [m1, t.serieCobrado, "marino", "continuo"],
    [m2, t.serieDevengado, "verde", "rayado"],
  ] as const) {
    if (r.ok) series.push({ nombre, color, trazo, valores: ["0", ...r.valor.filas.map((f) => f.acumulado)] });
  }
  return {
    titulo: t.tituloGrafica1,
    rotulo: null,
    nota: t.notaGrafica1,
    dibujo: series.length === 0 ? null : dibujo(series, plazo, 0, t.columnaMes, null),
    omision: series.length === 0 ? t.modalidadNoDisponible : null,
  };
}

function graficaEscenario(e: EscenarioReinversion, t: TextosPagina2): GraficaPdf {
  const base = { titulo: t.tituloGrafica2, rotulo: t.rotuloEscenario, nota: t.notaEscenario };
  if (e.tipo === "omitido") {
    return {
      ...base,
      nota: null,
      dibujo: null,
      omision: e.motivo === "INCREMENTO_MINIMO" ? t.escenarioIncrementoMinimo : t.escenarioTasaNoDisponible,
    };
  }
  const series: SerieDatos[] = [
    {
      nombre: t.serieConReinversion,
      color: "verde",
      trazo: "continuo",
      valores: [e.capitalInicial, ...e.puntos.map((p) => p.valor)],
    },
    {
      nombre: t.serieSinReinvertir,
      color: "gris",
      trazo: "punteado",
      valores: [e.capitalInicial, ...e.puntos.map((p) => p.sinReinvertir)],
    },
  ];
  return {
    ...base,
    dibujo: dibujo(series, e.meses, Number(e.capitalInicial), t.columnaMes, {
      mes: e.finPrimerPlazo,
      texto: t.finPrimerPlazo,
    }),
    omision: null,
  };
}

/** Tarjetas y gráficas de la página 2 para una cotización ya hecha. */
export function modeloPagina2(c: Cotizacion, datos: DatosPagina2, textos: TextosPagina2): ModeloPagina2 {
  const { mensual, finalDelPlazo } = datos.calendarios;
  const elegido = c.solicitud.esquema;
  return {
    textos,
    tarjetas: [
      tarjeta("mensual", textos.modalidad1, elegido === "mensual", mensual, textos),
      tarjeta("final_del_plazo", textos.modalidad2, elegido === "final_del_plazo", finalDelPlazo, textos),
    ],
    graficas: [graficaComparacion(mensual, finalDelPlazo, c.solicitud.plazo, textos), graficaEscenario(datos.escenario, textos)],
  };
}
