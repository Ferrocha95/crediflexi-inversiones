import { Decimal } from "../domain/comun/decimal";
import { formatearCantidad, formatearPorcentaje } from "../domain/comun/formato";
import { exito, fallo, type Resultado } from "../domain/comun/resultado";
import { calendariosAjustados, type Ajuste, type CotizacionAjustada, type ModalidadAjustada } from "../domain/interes/ajustes";
import { calendarios, type CalendarioModalidad } from "../domain/interes/calendario";
import type { Cotizacion } from "../domain/interes/cotizar";
import type { SolicitudTasa } from "../domain/tasas/resolver";
import type { Esquema, Moneda, Semilla } from "../domain/tasas/semilla.esquema";
import { formatearDinero } from "./dinero";
import { escalaLineal, marcasMeses, marcasValor, separarEtiquetas, trazado } from "./graficas";
import { rellenar } from "./rellenar";
import type { TextosPagina2 } from "./textos";

// Página 2 del PDF: este módulo no calcula cifras, solo les da forma de texto y
// convierte a coordenadas (números) lo que se dibuja. Los rótulos salen del
// glosario único del archivo de textos (Sprint 6a).

/** Lo que el dominio calcula para la página 2. Una modalidad en null no tiene tasa acordada (plazo especial). */
export interface DatosPagina2 {
  readonly calendarios: {
    readonly mensual: Resultado<CalendarioModalidad> | null;
    readonly finalDelPlazo: Resultado<CalendarioModalidad> | null;
  };
}

const SIN_AJUSTE: Ajuste = { tipo: "tabla", puntos: "0" };

/** Puntos en cero ("0", "0.0"). Solo decide el camino; la validación de los puntos es del dominio. */
const sinPuntos = (a: Ajuste) => a.tipo === "tabla" && a.puntos.trim() !== "" && Number(a.puntos) === 0;

function comoResultado(m: ModalidadAjustada): Resultado<CalendarioModalidad> | null {
  if (m.tipo === "sin_tasa") return null;
  return m.tipo === "calendario" ? exito(m.calendario) : fallo(m.error);
}

/**
 * Calendarios de las dos modalidades para la misma solicitud. Con puntos extra
 * o plazo especial, usan la tasa ajustada (calendariosAjustados). El escenario
 * de reinversión ya no va en el PDF (src/domain/interes/escenario.ts queda sin
 * usar; ver PENDIENTES_TECNICOS.md).
 */
export function datosPagina2(semilla: Semilla, solicitud: SolicitudTasa, ajuste: Ajuste = SIN_AJUSTE): DatosPagina2 {
  if (sinPuntos(ajuste)) return { calendarios: calendarios(semilla, solicitud) };
  const a = calendariosAjustados(semilla, solicitud, ajuste);
  return { calendarios: { mensual: comoResultado(a.mensual), finalDelPlazo: comoResultado(a.finalDelPlazo) } };
}

/** Franja de tiempo de una tarjeta: de dónde a dónde va y en qué meses hay un pago. */
export interface FranjaPdf {
  readonly meses: number;
  /** x del mes 0 y del mes N en el lienzo de la franja. */
  readonly inicio: number;
  readonly fin: number;
  /** Un punto por pago: cada mes en la modalidad 1; solo el mes N en la 2. */
  readonly puntos: readonly { readonly mes: number; readonly x: number }[];
  /** Rótulo de los pagos mensuales ("rendimiento"); null si solo hay un pago. */
  readonly etiquetaPuntos: string | null;
  /** Rótulo del último punto ("+ capital" o "rendimiento + capital"). */
  readonly etiquetaFinal: string;
}

export interface TarjetaPdf {
  readonly esquema: Esquema;
  readonly titulo: string;
  /** La modalidad de la cotización: lleva la insignia. */
  readonly elegida: boolean;
  /** null si la modalidad no se puede cotizar o no tiene tasa acordada. */
  readonly detalle: {
    readonly tasa: string;
    /** "Tasa anual neta" (glosario), o "Tasa acordada" en un plazo especial. */
    readonly etiquetaTasa: string;
    readonly renglones: readonly { readonly etiqueta: string; readonly cifra: string }[];
    /** Cuándo se paga el rendimiento y cuándo el capital (con el mes N). */
    readonly lineas: readonly [string, string];
    readonly franja: FranjaPdf;
    /** Tabla mes por mes: solo la modalidad 1; la 2 va anualizada, sin filas. */
    readonly filas: readonly { readonly mes: string; readonly rendimiento: string; readonly acumulado: string }[];
  } | null;
  /** Reemplaza al detalle cuando la modalidad no se puede cotizar o no tiene tasa acordada. */
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
  /** Solo la comparación de modalidades. */
  readonly graficas: readonly [GraficaPdf];
}

/**
 * Lienzo de la gráfica, en puntos: media hoja carta (540 pt de ancho útil). A la
 * izquierda van las marcas del eje de valores y a la derecha las etiquetas
 * finales de las líneas.
 */
export const LIENZO_GRAFICA = {
  ancho: 264,
  alto: 120,
  area: { izquierda: 50, derecha: 198, arriba: 10, abajo: 96 },
  /** Distancia mínima entre las etiquetas finales (alto de una línea de 7 pt). */
  separacionEtiquetas: 9,
} as const;

/** Lienzo de la franja de tiempo de cada tarjeta (dentro del cuerpo de la tarjeta). */
export const LIENZO_FRANJA = { ancho: 246, alto: 26, izquierda: 6, derecha: 210, y: 7 } as const;

const dinero = (texto: string, moneda: Moneda) => formatearDinero(new Decimal(texto), moneda);
/** Marca del eje de valores: sin centavos si son cero ("$1,800,000"). */
const marcaPesos = (v: number) => `$${formatearCantidad(new Decimal(v)).replace(/\.00$/, "")}`;

function franja(esquema: Esquema, meses: number, t: TextosPagina2): FranjaPdf {
  const { izquierda, derecha } = LIENZO_FRANJA;
  const x = (mes: number) => izquierda + ((derecha - izquierda) * mes) / meses;
  const pagos = esquema === "mensual" ? Array.from({ length: meses }, (_, i) => i + 1) : [meses];
  return {
    meses,
    inicio: x(0),
    fin: x(meses),
    puntos: pagos.map((mes) => ({ mes, x: x(mes) })),
    etiquetaPuntos: esquema === "mensual" ? t.franjaRendimiento : null,
    etiquetaFinal: esquema === "mensual" ? t.franjaMasCapital : t.franjaRendimientoCapital,
  };
}

function tarjeta(
  esquema: Esquema,
  titulo: string,
  elegida: boolean,
  r: Resultado<CalendarioModalidad> | null,
  t: TextosPagina2,
  moneda: Moneda,
  especial: boolean,
): TarjetaPdf {
  const pesos = (texto: string) => dinero(texto, moneda);
  if (r === null) return { esquema, titulo, elegida, detalle: null, nota: t.modalidadSinTasa };
  if (!r.ok) return { esquema, titulo, elegida, detalle: null, nota: t.modalidadNoDisponible };
  const c = r.valor;
  const meses = c.filas.length;
  const n = { meses: String(meses) };
  const capital = { etiqueta: t.capitalInicial, cifra: pesos(c.capitalInicial) };
  const plazo = { etiqueta: rellenar(t.rendimientoTotal, n), cifra: pesos(c.rendimientoEstimado) };
  const total = { etiqueta: t.capitalMasRendimiento, cifra: pesos(c.total) };
  const comun = { tasa: formatearPorcentaje(new Decimal(c.tasa)), etiquetaTasa: especial ? t.tasaAcordada : t.tasaAnual, franja: franja(esquema, meses, t) };

  if (esquema === "mensual") {
    return {
      esquema,
      titulo,
      elegida,
      detalle: {
        ...comun,
        renglones: [capital, plazo, total],
        lineas: [rellenar(t.pagoRendimientoMensual, n), rellenar(t.capitalVencimiento, n)],
        filas: c.filas.map((f) => ({ mes: String(f.mes), rendimiento: pesos(f.rendimiento), acumulado: pesos(f.acumulado) })),
      },
      nota: null,
    };
  }
  // Modalidad 2: sin filas por mes y, desde el Sprint 6a, sin el renglón del rendimiento anual.
  return {
    esquema,
    titulo,
    elegida,
    detalle: {
      ...comun,
      renglones: [capital, plazo, total],
      lineas: [rellenar(t.pagoRendimientoFinal, n), rellenar(t.capitalVencimiento, n)],
      filas: [],
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
  moneda: Moneda,
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
      final: { x: area.derecha + 4, y: finales[i], texto: dinero(s.valores.at(-1)!, moneda) },
    })),
    lineaVertical: lineaVertical === null ? null : { x: x(lineaVertical.mes), texto: lineaVertical.texto },
  };
}

function graficaComparacion(
  m1: Resultado<CalendarioModalidad> | null,
  m2: Resultado<CalendarioModalidad> | null,
  plazo: number,
  t: TextosPagina2,
  moneda: Moneda,
): GraficaPdf {
  // Sin tasa acordada para una de las modalidades no hay qué comparar: la gráfica se omite.
  if (m1 === null || m2 === null) {
    return { titulo: t.tituloGrafica1, rotulo: null, nota: null, dibujo: null, omision: t.comparacionOmitida };
  }
  const series: SerieDatos[] = [];
  for (const [r, nombre, color, trazo] of [
    [m1, t.serieMensual, "marino", "continuo"],
    [m2, t.serieFinal, "verde", "rayado"],
  ] as const) {
    if (r.ok) series.push({ nombre, color, trazo, valores: ["0", ...r.valor.filas.map((f) => f.acumulado)] });
  }
  return {
    titulo: t.tituloGrafica1,
    rotulo: null,
    nota: t.notaGrafica1,
    dibujo: series.length === 0 ? null : dibujo(series, plazo, 0, t.columnaMes, null, moneda),
    omision: series.length === 0 ? t.modalidadNoDisponible : null,
  };
}

/** Tarjetas y gráfica de la página 2 para una cotización ya hecha. */
export function modeloPagina2(c: Cotizacion | CotizacionAjustada, datos: DatosPagina2, textos: TextosPagina2): ModeloPagina2 {
  const { mensual, finalDelPlazo } = datos.calendarios;
  const elegido = c.solicitud.esquema;
  const { moneda } = c.solicitud;
  const especial = c.origenTasa === "especial";
  return {
    textos,
    tarjetas: [
      tarjeta("mensual", textos.modalidad1, elegido === "mensual", mensual, textos, moneda, especial),
      tarjeta("final_del_plazo", textos.modalidad2, elegido === "final_del_plazo", finalDelPlazo, textos, moneda, especial),
    ],
    graficas: [graficaComparacion(mensual, finalDelPlazo, c.solicitud.plazo, textos, moneda)],
  };
}
