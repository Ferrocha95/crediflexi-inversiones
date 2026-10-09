import * as z from "zod";
import { Decimal } from "../comun/decimal";
import { exitoComision, falloComision, type ResultadoComision } from "./errores";

// Lee de la semilla de parámetros (seed/parametros_iniciales.json) solo lo
// que usa el motor de comisiones: las tablas, los parámetros y los incentivos.
// Es independiente del esquema del cotizador (src/domain/tasas/semilla.esquema.ts).

export const NIVELES = ["N1", "N2", "N3"] as const;
export type Nivel = (typeof NIVELES)[number];

export const TIPOS_INVERSION = ["nueva", "renovacion"] as const;
export type TipoInversion = (typeof TIPOS_INVERSION)[number];

export const ROLES_CON_META = ["EJECUTIVO", "GERENTE"] as const;
export type RolConMeta = (typeof ROLES_CON_META)[number];

export interface TramoComision {
  readonly desde: Decimal;
  /** Límite superior INCLUSIVO; null en el último tramo. */
  readonly hasta: Decimal | null;
  /** Plazo en meses -> tasa completa (fracción del capital, sin redondear). */
  readonly tasas: ReadonlyMap<number, Decimal>;
}

/** Fila de bono de INTERNOS (EJECUTIVO) por captación para la meta; `hasta` INCLUSIVO, null en la última. */
export interface IncentivoInterno {
  /** Etiqueta de la fila ("100% de la meta"); no entra en el cálculo. */
  readonly cumplimiento: string;
  readonly desde: Decimal;
  readonly hasta: Decimal | null;
  readonly bono: Decimal;
}

/** Rango del bono de externos por captación nueva del mes; `hasta` INCLUSIVO, null en el último. */
export interface IncentivoExterno {
  /** Etiqueta de la fila ("100% de la meta interna"); el rango se sigue midiendo en pesos de captación nueva. */
  readonly cumplimiento: string;
  readonly desde: Decimal;
  readonly hasta: Decimal | null;
  readonly bono: Decimal;
}

export interface SemillaComisiones {
  readonly version: string;
  /** Fecha de la semilla (AAAA-MM-DD): la de las tablas vigentes. */
  readonly generado: string;
  readonly tablas: Readonly<Record<TipoInversion, Readonly<Record<Nivel, readonly TramoComision[]>>>>;
  readonly nivelVigente: Nivel;
  readonly montoMinimo: Decimal;
  readonly renovacionesPaganComision: boolean;
  readonly renovacionesCuentanParaMeta: boolean;
  readonly umbralDesbloqueo: Decimal;
  readonly metas: Readonly<Record<RolConMeta, Decimal>>;
  /** Texto de comision_bloqueada_al_cierre_de_mes, tal cual (sigue por confirmar). */
  readonly notaComisionBloqueada: string;
  readonly pago: {
    readonly ultimoDiaQuincena1: number;
    /** Día del MISMO mes en que se paga la quincena 1. */
    readonly diaPagoQuincena1: number;
    /** Día del mes SIGUIENTE en que se paga la quincena 2. */
    readonly diaPagoQuincena2: number;
  };
  /** Ordenados por `desde`; el bono es el de la última fila cuyo `desde` no pasa de la captación. */
  readonly incentivosInternos: readonly IncentivoInterno[];
  readonly sueldoBaseInterno: Decimal;
  /** Ordenados por `desde`, contiguos; el bono es el de la última fila cuyo `desde` no pasa de la captación. */
  readonly incentivosExternos: readonly IncentivoExterno[];
  readonly externos: { readonly sueldoBase: Decimal };
  /** Bono de gerente (por confirmar): fracción de la comisión N1 de las inversiones de su equipo. */
  readonly bonoGerente: {
    readonly porcentaje: Decimal;
    readonly requiereDesbloqueoDelEquipo: boolean;
    readonly estado: string;
  };
  /**
   * Comisión por externos (supuesto por confirmar): fracción de la comisión N1
   * de las inversiones de los externos de un interno. Aparte del bono de gerente.
   */
  readonly redExterna: {
    readonly porcentaje: Decimal;
    readonly requiereDesbloqueoDelInterno: boolean;
    readonly estado: string;
  };
}

// ---------------------------------------------------------------------------
// Piezas de validación
// ---------------------------------------------------------------------------

const RE_FRACCION = /^(0(\.\d+)?|1(\.0+)?)$/;
const fraccion = z
  .string({ error: 'Debe ir como texto decimal entre 0 y 1 (por ejemplo "0.0264"), no como número.' })
  .regex(RE_FRACCION, { error: 'Debe ser una fracción entre 0 y 1 escrita como texto (por ejemplo "0.0264" para 2.64%).' })
  .transform((t) => new Decimal(t));

const montoEntero = z
  .number({ error: "Debe ser un número." })
  .int({ error: "Debe ser un número entero de pesos." })
  .nonnegative({ error: "No puede ser negativo." })
  .transform((n) => new Decimal(n));

const PLAZOS_TABLA = ["6", "12", "18", "24"] as const;

const tramo = z
  .looseObject({
    desde: montoEntero,
    hasta: montoEntero.nullable(),
    "6": fraccion,
    "12": fraccion,
    "18": fraccion,
    "24": fraccion,
  })
  .transform(
    (t): TramoComision => ({
      desde: t.desde,
      hasta: t.hasta,
      tasas: new Map(PLAZOS_TABLA.map((p) => [Number(p), t[p]])),
    }),
  );

const tabla = z.array(tramo).min(1, { error: "La tabla necesita al menos un tramo." }).superRefine((tramos, ctx) => {
  tramos.forEach((t, i) => {
    const siguiente = tramos[i + 1];
    if (siguiente === undefined) {
      if (t.hasta !== null) ctx.addIssue({ code: "custom", path: [i, "hasta"], message: "El último tramo debe tener hasta = null (sin tope)." });
      return;
    }
    if (t.hasta === null || !siguiente.desde.equals(t.hasta.plus(1))) {
      ctx.addIssue({
        code: "custom",
        path: [i + 1, "desde"],
        message: "Los tramos deben ser contiguos: cada 'desde' es el 'hasta' del tramo anterior más 1.",
      });
    }
  });
});

const tablasPorNivel = z.strictObject({ N1: tabla, N2: tabla, N3: tabla });

const quincena1 = z.looseObject({
  desde_dia: z.literal(1, { error: "La quincena 1 empieza el día 1." }),
  hasta_dia: z.number().int().min(1).max(27),
  dia_de_pago: z.number().int().min(1).max(28),
  mes_de_pago: z.literal("MISMO", { error: 'La quincena 1 se paga en el "MISMO" mes.' }),
});
const quincena2 = z.looseObject({
  desde_dia: z.number().int(),
  hasta_dia: z.literal("FIN_DE_MES", { error: 'La quincena 2 termina en "FIN_DE_MES".' }),
  dia_de_pago: z.number().int().min(1).max(28),
  mes_de_pago: z.literal("SIGUIENTE", { error: 'La quincena 2 se paga en el mes "SIGUIENTE".' }),
});

const parametros = z.looseObject({
  desbloqueo: z.looseObject({ umbral: fraccion }),
  metas_mensuales: z.looseObject({ EJECUTIVO: montoEntero, GERENTE: montoEntero }),
  renovaciones_cuentan_para_meta: z.boolean({ error: "Debe ser true o false." }),
  renovaciones_pagan_comision: z.boolean({ error: "Debe ser true o false." }),
  comision_bloqueada_al_cierre_de_mes: z.string().min(1),
  nivel_vigente: z.enum(NIVELES, { error: `Nivel desconocido. Usa uno de: ${NIVELES.join(", ")}.` }),
  pago_comisiones: z
    .looseObject({ quincena_1: quincena1, quincena_2: quincena2 })
    .superRefine((p, ctx) => {
      if (p.quincena_2.desde_dia !== p.quincena_1.hasta_dia + 1) {
        ctx.addIssue({ code: "custom", path: ["quincena_2", "desde_dia"], message: "La quincena 2 empieza el día siguiente al último de la quincena 1." });
      }
      if (p.quincena_1.dia_de_pago !== p.quincena_1.hasta_dia + 1) {
        ctx.addIssue({ code: "custom", path: ["quincena_1", "dia_de_pago"], message: "La quincena 1 se paga el día siguiente a su último día." });
      }
    }),
  externos: z.looseObject({ sueldo_base: montoEntero }),
  bono_gerente: z.looseObject({
    porcentaje: fraccion,
    requiere_desbloqueo_del_equipo: z.boolean({ error: "Debe ser true o false." }),
    estado: z.string().min(1),
  }),
  red_externa: z.looseObject({
    porcentaje: fraccion,
    base: z.string().min(1),
    requiere_desbloqueo_del_interno: z.boolean({ error: "Debe ser true o false." }),
    estado: z.string().min(1),
  }),
  monto_minimo_comision: montoEntero,
});

const incentivo = z.looseObject({ tipo: z.string(), estado: z.string().optional() });
const incentivoInterno = z.looseObject({
  tipo: z.literal("INTERNOS"),
  cumplimiento: z.string().min(1),
  sueldo_base: montoEntero,
  bono: montoEntero,
  desde: montoEntero,
  hasta: montoEntero.nullable(),
});
const incentivoExterno = z.looseObject({
  tipo: z.literal("EXTERNOS"),
  cumplimiento: z.string().min(1),
  bono: montoEntero,
  desde: montoEntero,
  hasta: montoEntero.nullable(),
});

/** Valida las filas de un tipo con su esquema y reporta cada problema con su índice en incentivos_propuesta. */
function validarFilas(
  filas: readonly { tipo: string }[],
  tipo: string,
  esquema: z.ZodType,
  ctx: z.RefinementCtx,
): void {
  filas.forEach((f, i) => {
    if (f.tipo !== tipo) return;
    const r = esquema.safeParse(f);
    if (!r.success) {
      for (const issue of r.error.issues) ctx.addIssue({ code: "custom", path: ["incentivos_propuesta", i, ...issue.path], message: issue.message });
    }
  });
}

const esquemaComisiones = z
  .looseObject({
    version: z.string().min(1),
    generado: z.iso.date({ error: "La fecha 'generado' debe tener el formato AAAA-MM-DD." }),
    comisiones: z.looseObject({ nuevos: tablasPorNivel, renovaciones: tablasPorNivel }),
    parametros,
    incentivos_propuesta: z.array(incentivo),
  })
  .superRefine((s, ctx) => {
    if (!s.incentivos_propuesta.some((f) => f.tipo === "INTERNOS")) {
      ctx.addIssue({ code: "custom", path: ["incentivos_propuesta"], message: "Falta al menos una fila de incentivos INTERNOS." });
    }
    validarFilas(s.incentivos_propuesta, "INTERNOS", incentivoInterno, ctx);
    validarFilas(s.incentivos_propuesta, "EXTERNOS", incentivoExterno, ctx);
  })
  .transform((s, ctx): SemillaComisiones => {
    const internos = s.incentivos_propuesta
      .filter((f) => f.tipo === "INTERNOS")
      .map((f) => incentivoInterno.parse(f))
      .sort((a, b) => a.desde.comparedTo(b.desde));
    const sueldos = new Set(internos.map((f) => f.sueldo_base.toString()));
    if (sueldos.size > 1) {
      ctx.addIssue({ code: "custom", path: ["incentivos_propuesta"], message: "Todas las filas INTERNOS deben tener el mismo sueldo_base." });
      return z.NEVER;
    }
    const externos = s.incentivos_propuesta
      .filter((f) => f.tipo === "EXTERNOS")
      .map((f) => incentivoExterno.parse(f))
      .sort((a, b) => a.desde.comparedTo(b.desde));
    for (const [i, f] of externos.entries()) {
      const siguiente = externos[i + 1];
      if (siguiente === undefined) {
        if (f.hasta !== null) {
          ctx.addIssue({ code: "custom", path: ["incentivos_propuesta"], message: "El último rango EXTERNOS debe quedar sin tope (hasta = null)." });
          return z.NEVER;
        }
      } else if (f.hasta === null || !siguiente.desde.equals(f.hasta.plus(1))) {
        ctx.addIssue({
          code: "custom",
          path: ["incentivos_propuesta"],
          message: "Los rangos EXTERNOS deben ser contiguos: cada 'desde' es el 'hasta' del rango anterior más 1.",
        });
        return z.NEVER;
      }
    }
    const p = s.parametros;
    return {
      version: s.version,
      generado: s.generado,
      tablas: { nueva: s.comisiones.nuevos, renovacion: s.comisiones.renovaciones },
      nivelVigente: p.nivel_vigente,
      montoMinimo: p.monto_minimo_comision,
      renovacionesPaganComision: p.renovaciones_pagan_comision,
      renovacionesCuentanParaMeta: p.renovaciones_cuentan_para_meta,
      umbralDesbloqueo: p.desbloqueo.umbral,
      metas: { EJECUTIVO: p.metas_mensuales.EJECUTIVO, GERENTE: p.metas_mensuales.GERENTE },
      notaComisionBloqueada: p.comision_bloqueada_al_cierre_de_mes,
      pago: {
        ultimoDiaQuincena1: p.pago_comisiones.quincena_1.hasta_dia,
        diaPagoQuincena1: p.pago_comisiones.quincena_1.dia_de_pago,
        diaPagoQuincena2: p.pago_comisiones.quincena_2.dia_de_pago,
      },
      incentivosInternos: internos.map((f) => ({ cumplimiento: f.cumplimiento, desde: f.desde, hasta: f.hasta, bono: f.bono })),
      sueldoBaseInterno: internos[0].sueldo_base,
      incentivosExternos: externos.map((f) => ({ cumplimiento: f.cumplimiento, desde: f.desde, hasta: f.hasta, bono: f.bono })),
      externos: { sueldoBase: p.externos.sueldo_base },
      bonoGerente: {
        porcentaje: p.bono_gerente.porcentaje,
        requiereDesbloqueoDelEquipo: p.bono_gerente.requiere_desbloqueo_del_equipo,
        estado: p.bono_gerente.estado,
      },
      redExterna: {
        porcentaje: p.red_externa.porcentaje,
        requiereDesbloqueoDelInterno: p.red_externa.requiere_desbloqueo_del_interno,
        estado: p.red_externa.estado,
      },
    };
  });

/** Mensajes genéricos de Zod en español, solo para esta validación. */
const erroresEnEspanol = z.locales.es().localeError;

const ruta = (path: readonly PropertyKey[]) => (path.length === 0 ? "(raíz)" : path.map(String).join("."));

/** Valida la parte de comisiones de la semilla. Es pura: recibe el objeto ya leído. */
export function cargarSemillaComisiones(json: unknown): ResultadoComision<SemillaComisiones> {
  const r = esquemaComisiones.safeParse(json, { error: erroresEnEspanol });
  if (r.success) return exitoComision(r.data);
  const detalles = r.error.issues.map((i) => `${ruta(i.path)}: ${i.message}`);
  const n = detalles.length;
  return falloComision(
    "SEMILLA_COMISIONES_INVALIDA",
    `La parte de comisiones de la semilla de parámetros no es válida (${n} ${n === 1 ? "problema" : "problemas"}). ` +
      "Corrige el archivo de parámetros en la ubicación indicada en cada detalle y vuelve a cargarlo.",
    detalles,
  );
}
