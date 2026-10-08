import * as z from "zod";
import { Decimal } from "../domain/comun/decimal";
import { formatearPorcentaje, listaEnEspanol } from "../domain/comun/formato";
import type { Moneda } from "../domain/tasas/semilla.esquema";
import { fechaIsoEnMexico, fechaLarga } from "./fecha";
import { rellenar } from "./rellenar";
import { validar, type ResultadoApp } from "./resultado";
import type { TextosPagina2 } from "./textos";

// Comparativo de tasas de la página 2 del PDF (seed/benchmark.json). Todas las
// reglas (antigüedad máxima, vigencia, fuente oficial) salen del archivo; aquí
// solo se aplican y se les da forma de texto y de barras.

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const fechaIso = z
  .string()
  .regex(RE_FECHA_ISO, "Escribe la fecha como AAAA-MM-DD.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "La fecha no existe.");
const textoNoVacio = z.string().trim().min(1, "No puede ir vacío.");
/** Tasa anual como fracción decimal en texto ("0.0609" = 6.09%). */
const tasaDecimal = z.string().regex(/^\d+(\.\d+)?$/, 'Escribe la tasa como fracción decimal en texto, por ejemplo "0.0609".');

const esquemaInstrumento = z.strictObject({
  id: textoNoVacio,
  nombre: textoNoVacio,
  grupo: textoNoVacio,
  tasa_anual: tasaDecimal,
  fecha_dato: fechaIso,
  vigente_hasta: fechaIso.nullable(),
  condiciones: textoNoVacio,
  /** Si existe, el nombre lleva asterisco y la nota va debajo del comparativo. */
  nota_asterisco: textoNoVacio.optional(),
  fuente: z.strictObject({ nombre: textoNoVacio, nombre_corto: textoNoVacio, url: z.url() }),
  verificacion: textoNoVacio,
  incluir_en_pdf: z.boolean(),
  motivo_si_no_se_incluye: textoNoVacio.optional(),
});

const esquemaBenchmark = z.strictObject({
  version: textoNoVacio,
  actualizado_al: fechaIso,
  tipo_de_dato: textoNoVacio,
  reglas: z.strictObject({
    dias_maximos_de_antiguedad: z.number().int().nonnegative(),
    omitir_si_vigente_hasta_ya_paso: z.boolean(),
    solo_se_publica_lo_verificado_en_fuente_oficial: z.boolean(),
  }),
  avisos: z.array(textoNoVacio),
  instrumentos: z.array(esquemaInstrumento),
});

export type Benchmark = z.infer<typeof esquemaBenchmark>;
export type InstrumentoBenchmark = Benchmark["instrumentos"][number];

/** Valida seed/benchmark.json. Es pura: recibe el objeto ya leído y el nombre del archivo para los mensajes. */
export function cargarBenchmark(json: unknown, archivo: string): ResultadoApp<Benchmark> {
  return validar(esquemaBenchmark, json, "BENCHMARK_INVALIDO", archivo);
}

/** Valor de `verificacion` que cuenta como verificado en fuente oficial. */
const VERIFICACION_OFICIAL = "OFICIAL";

/** Lienzo de las barras, en puntos (columna derecha de la página 2). */
export const LIENZO_BENCHMARK = { anchoEtiqueta: 128, anchoBarra: 88, altoBarra: 8 } as const;

export interface BarraBenchmark {
  /** Nombre del instrumento con su asterisco, o el rótulo "Tu tasa". */
  readonly nombre: string;
  readonly tasa: string;
  /** Largo de la barra en puntos, proporcional a la tasa mayor. */
  readonly ancho: number;
  /** La tasa cotizada: se distingue por trazo y peso, no solo por color. */
  readonly tuya: boolean;
}

export type BenchmarkPdf =
  | {
      readonly tipo: "grafica";
      readonly titulo: string;
      readonly actualizado: string;
      /** De mayor a menor tasa. */
      readonly barras: readonly BarraBenchmark[];
      /** Avisos del archivo y, al final, la nota de cada asterisco. */
      readonly notas: readonly string[];
      readonly fuentes: string;
    }
  | { readonly tipo: "omitido"; readonly titulo: string; readonly texto: string };

const MS_POR_DIA = 86_400_000;
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA);


/**
 * Comparativo de tu tasa contra los instrumentos publicables del archivo, a
 * la fecha de `ahora` en la Ciudad de México. Se omite completo en dólares,
 * con datos más viejos que la antigüedad máxima o sin instrumentos que mostrar.
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
  const desactualizado = { tipo: "omitido", titulo, texto: t.benchmarkDesactualizado } as const;
  if (diasEntre(b.actualizado_al, hoy) > b.reglas.dias_maximos_de_antiguedad) return desactualizado;

  const publicables = b.instrumentos.filter(
    (i) =>
      i.incluir_en_pdf &&
      (!b.reglas.solo_se_publica_lo_verificado_en_fuente_oficial || i.verificacion === VERIFICACION_OFICIAL) &&
      // Comparación de textos AAAA-MM-DD: vale el día completo del vigente_hasta.
      !(b.reglas.omitir_si_vigente_hasta_ya_paso && i.vigente_hasta !== null && i.vigente_hasta < hoy),
  );
  if (publicables.length === 0) return desactualizado;

  // Asteriscos en el orden del archivo: "*", "**", ...
  const asteriscos = new Map<string, string>();
  for (const i of publicables) if (i.nota_asterisco !== undefined) asteriscos.set(i.id, "*".repeat(asteriscos.size + 1));

  const filas = [
    { nombre: t.benchmarkTuTasa, tasa: new Decimal(cotizacion.tasa), tuya: true },
    ...publicables.map((i) => ({ nombre: `${i.nombre}${asteriscos.get(i.id) ?? ""}`, tasa: new Decimal(i.tasa_anual), tuya: false })),
  ];
  // sort es estable: con la misma tasa, tu tasa queda primero y los demás en el orden del archivo.
  filas.sort((x, y) => y.tasa.comparedTo(x.tasa));
  const mayor = filas[0].tasa;

  return {
    tipo: "grafica",
    titulo,
    actualizado: rellenar(t.benchmarkActualizado, { fecha: fechaLarga(b.actualizado_al) }),
    barras: filas.map((f) => ({
      nombre: f.nombre,
      tasa: formatearPorcentaje(f.tasa),
      // Coordenada de dibujo (no es dinero): número.
      ancho: mayor.isZero() ? 0 : f.tasa.div(mayor).times(LIENZO_BENCHMARK.anchoBarra).toNumber(),
      tuya: f.tuya,
    })),
    notas: [
      ...b.avisos,
      ...publicables.flatMap((i) => (i.nota_asterisco === undefined ? [] : [`${asteriscos.get(i.id)} ${i.nota_asterisco}`])),
    ],
    fuentes: rellenar(t.benchmarkFuentes, { fuentes: listaEnEspanol([...new Set(publicables.map((i) => i.fuente.nombre_corto))]) }),
  };
}
