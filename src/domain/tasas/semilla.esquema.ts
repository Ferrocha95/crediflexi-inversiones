import * as z from "zod";
import { Decimal } from "../comun/decimal";

// ---------------------------------------------------------------------------
// Tipos del dominio (forma normalizada de la semilla)
// ---------------------------------------------------------------------------

export const ESTATUS = ["CONFIRMADA", "SEGUN_USUARIO_PPTX", "POR_CONFIRMAR"] as const;
export type Estatus = (typeof ESTATUS)[number];

export const ESQUEMAS = ["mensual", "final_del_plazo"] as const;
export type Esquema = (typeof ESQUEMAS)[number];

export const MONEDAS = ["MXN", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const SALIDAS = [
  "rendimiento_mensual_pesos",
  "rendimiento_anual_pesos",
  "ganancia_total_plazo",
] as const;
export type Salida = (typeof SALIDAS)[number];

/**
 * Texto exacto de las fórmulas que implementa el motor. Si la semilla trae otra
 * fórmula, la carga falla: el motor no evalúa texto y no debe divergir en silencio.
 */
export const FORMULAS = {
  interes: "simple",
  pago_mensual: "capital * tasa_anual / 12",
  ganancia_total: "capital * tasa_anual * meses / 12",
  rendimiento_mensual_pesos: "capital * tasa_anual / 12",
  rendimiento_anual_pesos: "capital * tasa_anual (equivalente a 12 meses, aunque el plazo sea menor)",
  ganancia_total_plazo: "capital * tasa_anual * meses / 12",
} as const;

export interface Tramo {
  readonly desde: Decimal;
  /** null = sin límite superior. */
  readonly hasta: Decimal | null;
  /** null = el tramo no trae estatus propio y aplica el de la tabla. */
  readonly estatus: Estatus | null;
  readonly tasas: Readonly<Record<Esquema, ReadonlyMap<number, Decimal>>>;
  readonly plazosDisponibles: readonly number[];
}

export interface PlazoAdicional {
  readonly plazoMeses: number;
  readonly aplicaDesdeMonto: Decimal;
  readonly tasas: Readonly<Record<Esquema, Decimal>>;
}

export interface TablaTasas {
  readonly moneda: Moneda;
  readonly fuente: string | null;
  /** null = la tabla no trae estatus propio (cada tramo trae el suyo). */
  readonly estatus: Estatus | null;
  /** null = no definido en la semilla (solo se permite si la tabla está POR_CONFIRMAR). */
  readonly limiteInferiorInclusivo: boolean | null;
  /** null = la semilla no lo indica; aplica a todas las entidades de la semilla. */
  readonly aplicaAEntidades: readonly string[] | null;
  readonly tramos: readonly Tramo[];
  readonly plazoAdicional: PlazoAdicional | null;
}

export type EtiquetasCotizacion = Readonly<Record<Salida, string>>;

export interface ReglasDeCalculo {
  readonly salidas: readonly Salida[];
  readonly etiquetas: {
    readonly mensual: EtiquetasCotizacion;
    readonly final: EtiquetasCotizacion;
  };
}

export interface Semilla {
  readonly version: string;
  readonly generado: string;
  readonly entidades: readonly string[];
  readonly reglas: ReglasDeCalculo;
  readonly tablas: Readonly<Partial<Record<Moneda, TablaTasas>>>;
}

// ---------------------------------------------------------------------------
// Piezas de validación
// ---------------------------------------------------------------------------

const RE_TASA = /^(0(\.\d+)?|1(\.0+)?)$/;
const RE_MONTO = /^\d+(\.\d{1,2})?$/;
const RE_PLAZO = /^[1-9]\d*$/;

const estatus = z.enum(ESTATUS, {
  error: `Estatus desconocido. Usa uno de: ${ESTATUS.join(", ")}.`,
});

const tasa = z
  .string({
    error: 'La tasa debe ir como texto decimal (por ejemplo "0.175"), no como número.',
  })
  .regex(RE_TASA, {
    error: 'La tasa debe ser una fracción entre 0 y 1 escrita como texto (por ejemplo "0.175" para 17.5%).',
    abort: true,
  })
  .transform((s) => new Decimal(s));

/**
 * En la semilla 0.3 los montos de tramo vienen como número JSON. Se convierten
 * con String(n) y se exige que el texto resultante tenga como máximo 2 decimales.
 */
const montoSemilla = z
  .number({ error: "El monto debe ser un número." })
  .refine((n) => RE_MONTO.test(String(n)), {
    error: "El monto debe ser mayor o igual que cero y tener como máximo 2 decimales.",
    abort: true,
  })
  .transform((n) => new Decimal(String(n)));

const plazoMeses = z
  .number({ error: "El plazo debe ser un número entero de meses." })
  .int({ error: "El plazo debe ser un número entero de meses.", abort: true })
  .positive({ error: "El plazo debe ser mayor que cero.", abort: true });

const tasasPorPlazo = z
  .record(
    z.string().regex(RE_PLAZO, { error: "La clave del plazo debe ser un número entero de meses.", abort: true }),
    tasa,
  )
  .transform(
    (r): ReadonlyMap<number, Decimal> =>
      new Map(Object.entries(r).map(([plazo, t]) => [Number(plazo), t])),
  );

const etiquetasEsquema = z.object({
  rendimiento_mensual_pesos: z.string().min(1, { error: "La etiqueta no puede estar vacía." }),
  rendimiento_anual_pesos: z.string().min(1, { error: "La etiqueta no puede estar vacía." }),
  ganancia_total_plazo: z.string().min(1, { error: "La etiqueta no puede estar vacía." }),
});

function formula<K extends keyof typeof FORMULAS>(clave: K) {
  return z.literal(FORMULAS[clave], {
    error: `El motor solo implementa "${FORMULAS[clave]}". Si la regla cambió, hay que cambiar el motor y sus pruebas antes de cambiar la semilla.`,
  });
}

const reglasDeCalculo = z.object({
  interes: formula("interes"),
  pago_mensual: formula("pago_mensual"),
  ganancia_total: formula("ganancia_total"),
  rendimiento_mensual_pesos: formula("rendimiento_mensual_pesos"),
  rendimiento_anual_pesos: formula("rendimiento_anual_pesos"),
  ganancia_total_plazo: formula("ganancia_total_plazo"),
  salidas_de_cotizacion: z
    .array(z.enum(SALIDAS, { error: `Salida desconocida. Usa: ${SALIDAS.join(", ")}.` }))
    .min(1, { error: "Debe haber al menos una salida de cotización." })
    .refine((s) => new Set(s).size === s.length, { error: "Hay salidas de cotización repetidas." }),
  etiquetas_cotizacion: z.object({
    mensual: etiquetasEsquema,
    final: etiquetasEsquema,
  }),
});

// ---------------------------------------------------------------------------
// Validaciones compartidas por las tablas
// ---------------------------------------------------------------------------

type Ctx = z.RefinementCtx;

function validarOrdenDeTramos(
  tramos: readonly { desde: Decimal; hasta: Decimal | null }[],
  ctx: Ctx,
  ruta: (string | number)[],
): void {
  tramos.forEach((t, i) => {
    if (t.hasta !== null && t.hasta.lt(t.desde)) {
      ctx.addIssue({
        code: "custom",
        path: [...ruta, i, "hasta"],
        message: `El tramo ${i + 1} tiene "hasta" menor que "desde". Corrige sus límites.`,
      });
    }
    const siguiente = tramos[i + 1];
    if (siguiente === undefined) return;
    if (!siguiente.desde.gt(t.desde)) {
      ctx.addIssue({
        code: "custom",
        path: [...ruta, i + 1, "desde"],
        message: `Los tramos deben ir ordenados de menor a mayor "desde": el tramo ${i + 2} no es mayor que el ${i + 1}.`,
      });
    }
    if (t.hasta === null) {
      ctx.addIssue({
        code: "custom",
        path: [...ruta, i, "hasta"],
        message: `Solo el último tramo puede no tener "hasta"; el tramo ${i + 1} no es el último.`,
      });
    } else if (!t.hasta.lt(siguiente.desde)) {
      ctx.addIssue({
        code: "custom",
        path: [...ruta, i, "hasta"],
        message: `El tramo ${i + 1} se traslapa con el ${i + 2}: su "hasta" debe ser menor que el "desde" del siguiente.`,
      });
    }
  });
}

function validarEntidades(
  aplica: readonly string[] | undefined,
  entidades: ReadonlySet<string>,
  ctx: Ctx,
  ruta: string,
): void {
  aplica?.forEach((clave, i) => {
    if (!entidades.has(clave)) {
      ctx.addIssue({
        code: "custom",
        path: [ruta, "aplica_a_entidades", i],
        message: `La entidad "${clave}" no existe en "entidades". Agrégala ahí o quítala de esta tabla.`,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Tabla MXN: un arreglo de tramos con ambos esquemas por tramo
// ---------------------------------------------------------------------------

const tramoMxn = z
  .object({
    desde: montoSemilla,
    hasta: montoSemilla.nullable(),
    estatus,
    mensual: tasasPorPlazo,
    final_del_plazo: tasasPorPlazo,
    plazos_disponibles: z
      .array(plazoMeses)
      .min(1, { error: "El tramo debe tener al menos un plazo disponible." }),
  })
  .superRefine((t, ctx) => {
    for (const plazo of t.plazos_disponibles) {
      for (const esquema of ESQUEMAS) {
        if (!t[esquema].has(plazo)) {
          ctx.addIssue({
            code: "custom",
            path: [esquema],
            message: `El plazo de ${plazo} meses está en plazos_disponibles pero no tiene tasa en "${esquema}". Captura la tasa o quita el plazo.`,
          });
        }
      }
    }
  })
  .transform(
    (t): Tramo => ({
      desde: t.desde,
      hasta: t.hasta,
      estatus: t.estatus,
      tasas: { mensual: t.mensual, final_del_plazo: t.final_del_plazo },
      plazosDisponibles: [...t.plazos_disponibles],
    }),
  );

const plazoAdicional = z
  .object({
    plazo_meses: plazoMeses,
    aplica_desde_monto: montoSemilla,
    mensual: tasa,
    final_del_plazo: tasa,
  })
  .transform(
    (p): PlazoAdicional => ({
      plazoMeses: p.plazo_meses,
      aplicaDesdeMonto: p.aplica_desde_monto,
      tasas: { mensual: p.mensual, final_del_plazo: p.final_del_plazo },
    }),
  );

const tablaMxn = z
  .object({
    fuente: z.string().optional(),
    estatus: estatus.optional(),
    limite_inferior_inclusivo: z.boolean({
      error: "Falta limite_inferior_inclusivo (true o false) en la tabla MXN.",
    }),
    aplica_a_entidades: z.array(z.string().min(1)).min(1).optional(),
    tramos: z.array(tramoMxn).min(1, { error: "La tabla debe tener al menos un tramo." }),
    plazo_adicional: plazoAdicional.nullable().optional(),
  })
  .superRefine((t, ctx) => validarOrdenDeTramos(t.tramos, ctx, ["tramos"]))
  .transform(
    (t): TablaTasas => ({
      moneda: "MXN",
      fuente: t.fuente ?? null,
      estatus: t.estatus ?? null,
      limiteInferiorInclusivo: t.limite_inferior_inclusivo,
      aplicaAEntidades: t.aplica_a_entidades ?? null,
      tramos: t.tramos,
      plazoAdicional: t.plazo_adicional ?? null,
    }),
  );

// ---------------------------------------------------------------------------
// Tabla USD: un arreglo de filas por esquema; se normaliza a tramos
// ---------------------------------------------------------------------------

const filaUsd = z
  .object({ desde: montoSemilla, hasta: montoSemilla.nullable() })
  .catchall(tasa)
  .superRefine((fila, ctx) => {
    for (const clave of Object.keys(fila)) {
      if (clave !== "desde" && clave !== "hasta" && !RE_PLAZO.test(clave)) {
        ctx.addIssue({
          code: "custom",
          path: [clave],
          message: `"${clave}" no es un plazo: las columnas de tasa deben ser meses enteros.`,
        });
      }
    }
  })
  .transform((fila) => {
    const tasas = new Map<number, Decimal>();
    for (const [clave, valor] of Object.entries(fila)) {
      if (clave !== "desde" && clave !== "hasta") tasas.set(Number(clave), valor as Decimal);
    }
    return { desde: fila.desde as Decimal, hasta: fila.hasta as Decimal | null, tasas };
  });

const tablaUsd = z
  .object({
    fuente: z.string().optional(),
    estatus,
    limite_inferior_inclusivo: z.boolean().optional(),
    aplica_a_entidades: z.array(z.string().min(1)).min(1).optional(),
    mensual: z.array(filaUsd).min(1, { error: "La tabla debe tener al menos un tramo." }),
    final_del_plazo: z.array(filaUsd).min(1, { error: "La tabla debe tener al menos un tramo." }),
  })
  .superRefine((t, ctx) => {
    if (t.estatus !== "POR_CONFIRMAR" && t.limite_inferior_inclusivo === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["limite_inferior_inclusivo"],
        message:
          "Para usar la tabla USD (estatus distinto de POR_CONFIRMAR) hay que definir limite_inferior_inclusivo (true o false).",
      });
    }
    if (t.mensual.length !== t.final_del_plazo.length) {
      ctx.addIssue({
        code: "custom",
        path: ["final_del_plazo"],
        message: `"mensual" tiene ${t.mensual.length} tramos y "final_del_plazo" ${t.final_del_plazo.length}: deben tener los mismos tramos.`,
      });
      return;
    }
    t.mensual.forEach((m, i) => {
      const f = t.final_del_plazo[i];
      const mismosLimites =
        m.desde.eq(f.desde) &&
        (m.hasta === null ? f.hasta === null : f.hasta !== null && m.hasta.eq(f.hasta));
      if (!mismosLimites) {
        ctx.addIssue({
          code: "custom",
          path: ["final_del_plazo", i],
          message: `El tramo ${i + 1} tiene límites distintos en "mensual" y "final_del_plazo": deben coincidir.`,
        });
      }
      const plazosM = [...m.tasas.keys()].sort((a, b) => a - b).join(",");
      const plazosF = [...f.tasas.keys()].sort((a, b) => a - b).join(",");
      if (plazosM !== plazosF) {
        ctx.addIssue({
          code: "custom",
          path: ["final_del_plazo", i],
          message: `El tramo ${i + 1} tiene plazos distintos en "mensual" (${plazosM}) y "final_del_plazo" (${plazosF}): deben coincidir.`,
        });
      }
    });
    validarOrdenDeTramos(t.mensual, ctx, ["mensual"]);
  })
  .transform(
    (t): TablaTasas => ({
      moneda: "USD",
      fuente: t.fuente ?? null,
      estatus: t.estatus,
      limiteInferiorInclusivo: t.limite_inferior_inclusivo ?? null,
      aplicaAEntidades: t.aplica_a_entidades ?? null,
      tramos: t.mensual.map(
        (m, i): Tramo => ({
          desde: m.desde,
          hasta: m.hasta,
          estatus: null,
          tasas: { mensual: m.tasas, final_del_plazo: t.final_del_plazo[i].tasas },
          plazosDisponibles: [...m.tasas.keys()].sort((a, b) => a - b),
        }),
      ),
      plazoAdicional: null,
    }),
  );

// ---------------------------------------------------------------------------
// Semilla completa (solo lo que usa el motor de tasas; el resto se ignora)
// ---------------------------------------------------------------------------

export const esquemaSemilla = z
  .object({
    version: z.string().min(1),
    generado: z.iso.date({ error: "La fecha 'generado' debe tener el formato AAAA-MM-DD." }),
    entidades: z
      .array(z.object({ clave: z.string().min(1) }))
      .min(1, { error: "La semilla debe tener al menos una entidad." }),
    reglas_de_calculo: reglasDeCalculo,
    tasas_mxn: tablaMxn.optional(),
    tasas_usd: tablaUsd.optional(),
  })
  .superRefine((s, ctx) => {
    const claves = new Set(s.entidades.map((e) => e.clave));
    if (s.tasas_mxn) validarEntidades(s.tasas_mxn.aplicaAEntidades ?? undefined, claves, ctx, "tasas_mxn");
    if (s.tasas_usd) validarEntidades(s.tasas_usd.aplicaAEntidades ?? undefined, claves, ctx, "tasas_usd");
  })
  .transform(
    (s): Semilla => ({
      version: s.version,
      generado: s.generado,
      entidades: s.entidades.map((e) => e.clave),
      reglas: {
        salidas: s.reglas_de_calculo.salidas_de_cotizacion,
        etiquetas: s.reglas_de_calculo.etiquetas_cotizacion,
      },
      tablas: {
        ...(s.tasas_mxn ? { MXN: s.tasas_mxn } : {}),
        ...(s.tasas_usd ? { USD: s.tasas_usd } : {}),
      },
    }),
  );
