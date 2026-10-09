import * as z from "zod";
import { Decimal } from "../domain/comun/decimal";
import { formatearPorcentaje, listaEnEspanol } from "../domain/comun/formato";
import type { Moneda } from "../domain/tasas/semilla.esquema";
import { fechaIsoEnMexico, fechaLarga } from "./fecha";
import { rellenar } from "./rellenar";
import { validar, type ResultadoApp } from "./resultado";
import type { TextosPagina2 } from "./textos";

// Comparativo de tasas de la página 2 del PDF (seed/benchmark.json 0.4). Todas
// las reglas (antigüedad máxima, vigencia, grupos, palabras de la fecha) salen
// del archivo; aquí solo se aplican y se les da forma de texto y de barras.

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const fechaIso = z
  .string()
  .regex(RE_FECHA_ISO, "Escribe la fecha como AAAA-MM-DD.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "La fecha no existe.");
const textoNoVacio = z.string().trim().min(1, "No puede ir vacío.");
/** Tasa anual como fracción decimal en texto ("0.0609" = 6.09%). */
const tasaDecimal = z.string().regex(/^\d+(\.\d+)?$/, 'Escribe la tasa como fracción decimal en texto, por ejemplo "0.0609".');

export const TIPOS_DATO = ["tasa_vigente", "rendimiento_historico"] as const;
export type TipoDato = (typeof TIPOS_DATO)[number];
const FECHA_TIPOS = ["publicacion", "vigencia_hasta", "corte"] as const;
const porTipoDato = <T extends z.ZodType>(valor: T) => z.strictObject({ tasa_vigente: valor, rendimiento_historico: valor });

const esquemaInstrumento = z
  .strictObject({
    id: textoNoVacio,
    nombre: textoNoVacio,
    grupo: textoNoVacio,
    tipo_dato: z.enum(TIPOS_DATO, { error: `Usa uno de: ${TIPOS_DATO.join(", ")}.` }),
    /** null: sin dato (nunca se dibuja). */
    tasa_anual: tasaDecimal.nullable(),
    moneda: z.enum(["MXN", "USD"], { error: "Usa MXN o USD." }),
    periodo: textoNoVacio.nullable(),
    fecha_dato: fechaIso.nullable(),
    fecha_tipo: z.enum(FECHA_TIPOS, { error: `Usa uno de: ${FECHA_TIPOS.join(", ")}.` }).nullable(),
    condiciones: textoNoVacio,
    /** Si existe, el nombre lleva su número de nota ("(1)") y la nota va debajo del comparativo. */
    nota_asterisco: textoNoVacio.nullable(),
    fuente: z.strictObject({ nombre: textoNoVacio, nombre_corto: textoNoVacio, url: z.url() }),
    verificacion: z.enum(["OFICIAL", "SECUNDARIA", "SIN_DATO"], { error: "Usa OFICIAL, SECUNDARIA o SIN_DATO." }),
    incluir_en_pdf: z.boolean(),
    motivo_si_no_se_incluye: textoNoVacio.optional(),
  })
  .superRefine((i, ctx) => {
    // Todo lo que se dibuja lleva su propia fecha junto a la barra.
    if (!i.incluir_en_pdf || i.tasa_anual === null) return;
    if (i.fecha_dato === null) ctx.addIssue({ code: "custom", path: ["fecha_dato"], message: "Un instrumento que va en el PDF necesita su fecha." });
    if (i.fecha_tipo === null) ctx.addIssue({ code: "custom", path: ["fecha_tipo"], message: "Un instrumento que va en el PDF necesita su tipo de fecha." });
  });

const esquemaBenchmark = z.strictObject({
  version: textoNoVacio,
  actualizado_al: fechaIso,
  tipo_de_dato: textoNoVacio,
  reglas: z.strictObject({
    mostrar_fecha_por_instrumento: z.boolean(),
    /** null: sin tope de antigüedad. */
    dias_maximos_de_antiguedad: z.number().int().nonnegative().nullable(),
    omitir_si_vigente_hasta_ya_paso: z.boolean(),
    fecha_tipos: z.strictObject({ publicacion: textoNoVacio, vigencia_hasta: textoNoVacio, corte: textoNoVacio }),
    grupos: porTipoDato(textoNoVacio),
  }),
  avisos: porTipoDato(z.array(textoNoVacio)),
  instrumentos: z.array(esquemaInstrumento),
});

export type Benchmark = z.infer<typeof esquemaBenchmark>;
export type InstrumentoBenchmark = Benchmark["instrumentos"][number];

/** Valida seed/benchmark.json. Es pura: recibe el objeto ya leído y el nombre del archivo para los mensajes. */
export function cargarBenchmark(json: unknown, archivo: string): ResultadoApp<Benchmark> {
  return validar(esquemaBenchmark, json, "BENCHMARK_INVALIDO", archivo);
}

/** Lienzo de las barras, en puntos (columna derecha de la página 2). */
export const LIENZO_BENCHMARK = { anchoEtiqueta: 128, anchoBarra: 88, altoBarra: 7 } as const;

export interface BarraBenchmark {
  /** Nombre del instrumento con su número de nota, o el rótulo "Tu tasa". */
  readonly nombre: string;
  readonly tasa: string;
  /** Largo de la barra en puntos, proporcional a la tasa mayor de los dos grupos. */
  readonly ancho: number;
  /** La tasa cotizada: se distingue por trazo y peso, no solo por color. */
  readonly tuya: boolean;
  /** "publicada el 8 de octubre de 2026"; null en tu tasa o si el archivo no pide fechas. */
  readonly fecha: string | null;
  /** Periodo del rendimiento histórico, tal cual del archivo ("10 años al 30/06/2026"). */
  readonly periodo: string | null;
  readonly moneda: Moneda;
  /** La línea debajo del nombre: fecha, periodo y, si es en dólares, "en dólares (USD)"; null en tu tasa. */
  readonly detalle: string | null;
}

export interface GrupoBenchmark {
  readonly clave: TipoDato;
  readonly titulo: string;
  /** De mayor a menor tasa. */
  readonly barras: readonly BarraBenchmark[];
  /** Los avisos del archivo para este grupo. */
  readonly leyendas: readonly string[];
}

export type BenchmarkPdf =
  | {
      readonly tipo: "grafica";
      readonly titulo: string;
      readonly actualizado: string;
      /** Primero la última tasa publicada (con tu tasa), luego el rendimiento histórico; un grupo sin instrumentos no va. */
      readonly grupos: readonly GrupoBenchmark[];
      /** "La tasa de Crediflexi se muestra neta; las demás, brutas…" (archivo de textos). */
      readonly notaNeta: string;
      /** Las notas numeradas, en el orden del archivo. */
      readonly notas: readonly string[];
      readonly fuentes: string;
    }
  | { readonly tipo: "omitido"; readonly titulo: string; readonly texto: string };

const MS_POR_DIA = 86_400_000;
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA);

interface Fila {
  readonly grupo: TipoDato;
  readonly nombre: string;
  readonly tasa: Decimal;
  readonly tuya: boolean;
  readonly fecha: string | null;
  readonly periodo: string | null;
  readonly moneda: Moneda;
}

/**
 * Comparativo de tu tasa contra los instrumentos del archivo, a la fecha de
 * `ahora` en la Ciudad de México. Se dibuja todo instrumento con incluir_en_pdf
 * verdadero y tasa no nula, con la última tasa publicada aunque ya no esté
 * vigente, salvo que un interruptor del archivo diga otra cosa. Se omite
 * completo en dólares (compara contra tasas en pesos) o sin instrumentos.
 */
export function modeloBenchmark(
  b: Benchmark,
  cotizacion: { readonly tasa: string; readonly moneda: Moneda },
  ahora: Date,
  t: TextosPagina2,
): BenchmarkPdf {
  const titulo = t.benchmarkTitulo;
  if (cotizacion.moneda !== "MXN") return { tipo: "omitido", titulo, texto: t.benchmarkSoloPesos };

  const hoy = fechaIsoEnMexico(ahora);
  const { reglas } = b;
  const publicables = b.instrumentos.flatMap((i) => {
    if (!i.incluir_en_pdf || i.tasa_anual === null || i.fecha_dato === null || i.fecha_tipo === null) return [];
    // Antigüedad por instrumento, sobre su propia fecha (tope inclusivo); null = sin tope.
    if (reglas.dias_maximos_de_antiguedad !== null && diasEntre(i.fecha_dato, hoy) > reglas.dias_maximos_de_antiguedad) return [];
    // Comparación de textos AAAA-MM-DD: vale el día completo de la vigencia.
    if (reglas.omitir_si_vigente_hasta_ya_paso && i.fecha_tipo === "vigencia_hasta" && i.fecha_dato < hoy) return [];
    return [{ ...i, tasa_anual: i.tasa_anual, fecha_dato: i.fecha_dato, fecha_tipo: i.fecha_tipo }];
  });
  if (publicables.length === 0) return { tipo: "omitido", titulo, texto: t.benchmarkDesactualizado };

  // Notas numeradas en el orden del archivo: "(1)", "(2)", ... (con cinco notas, los asteriscos ya no se leían bien).
  const marcas = new Map<string, string>();
  for (const i of publicables) if (i.nota_asterisco !== null) marcas.set(i.id, `(${marcas.size + 1})`);

  const tuya: Fila = {
    grupo: "tasa_vigente",
    nombre: t.benchmarkTuTasa,
    tasa: new Decimal(cotizacion.tasa),
    tuya: true,
    fecha: null,
    periodo: null,
    moneda: cotizacion.moneda,
  };
  const filas: Fila[] = [
    tuya,
    ...publicables.map((i) => ({
      grupo: i.tipo_dato,
      nombre: marcas.has(i.id) ? `${i.nombre} ${marcas.get(i.id)}` : i.nombre,
      tasa: new Decimal(i.tasa_anual),
      tuya: false,
      fecha: reglas.mostrar_fecha_por_instrumento ? `${reglas.fecha_tipos[i.fecha_tipo]} ${fechaLarga(i.fecha_dato)}` : null,
      periodo: i.periodo,
      moneda: i.moneda,
    })),
  ];
  // Una sola escala para los dos grupos.
  const mayor = filas.reduce((m, f) => (f.tasa.greaterThan(m) ? f.tasa : m), new Decimal(0));

  const grupos = TIPOS_DATO.flatMap((clave): GrupoBenchmark[] => {
    const delGrupo = filas.filter((f) => f.grupo === clave);
    if (!delGrupo.some((f) => !f.tuya)) return [];
    // sort es estable: con la misma tasa, tu tasa queda primero y los demás en el orden del archivo.
    delGrupo.sort((x, y) => y.tasa.comparedTo(x.tasa));
    return [
      {
        clave,
        titulo: reglas.grupos[clave],
        barras: delGrupo.map((f) => ({
          nombre: f.nombre,
          tasa: formatearPorcentaje(f.tasa),
          // Coordenada de dibujo (no es dinero): número.
          ancho: mayor.isZero() ? 0 : f.tasa.div(mayor).times(LIENZO_BENCHMARK.anchoBarra).toNumber(),
          tuya: f.tuya,
          fecha: f.fecha,
          periodo: f.periodo,
          moneda: f.moneda,
          detalle: f.tuya ? null : [f.fecha, f.periodo, f.moneda === "USD" ? t.benchmarkEnDolares : null].filter((d) => d !== null).join(" · ") || null,
        })),
        leyendas: b.avisos[clave],
      },
    ];
  });

  return {
    tipo: "grafica",
    titulo,
    actualizado: rellenar(t.benchmarkActualizado, { fecha: fechaLarga(b.actualizado_al) }),
    grupos,
    notaNeta: t.benchmarkNotaNeta,
    notas: publicables.flatMap((i) => (i.nota_asterisco === null ? [] : [`${marcas.get(i.id)} ${i.nota_asterisco}`])),
    fuentes: rellenar(t.benchmarkFuentes, { fuentes: listaEnEspanol([...new Set(publicables.map((i) => i.fuente.nombre_corto))]) }),
  };
}
