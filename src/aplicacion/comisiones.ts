import { Decimal, ROUND_HALF_UP } from "../domain/comun/decimal";
import { formatearPesos } from "../domain/comun/formato";
import { liquidarMes, type InversionDelMes, type Liquidacion } from "../domain/comisiones/liquidacion";
import type { RolConMeta, SemillaComisiones, TipoInversion } from "../domain/comisiones/semilla";
import { fechaDeTextoIso } from "./fecha";
import { normalizarMonto } from "./monto";
import { error, ok, type ResultadoApp } from "./resultado";

// Pantalla /comisiones: convierte lo escrito en la entrada del motor y el
// resultado en texto. No calcula: las cifras salen de liquidarMes.

/** Lo que manda la pantalla: montos tal como se escriben ("1,500,000"). */
export interface CamposComisiones {
  readonly perfil: "interno" | "externo";
  readonly rol: RolConMeta | null;
  readonly inversiones: readonly {
    readonly tipo: TipoInversion;
    readonly monto: string;
    readonly plazo: number | null;
    /** AAAA-MM-DD (el valor de un <input type="date">). */
    readonly fecha: string;
  }[];
  /** "" si no se captura. */
  readonly captacionRedExterna: string;
}

export interface LineaComisionModelo {
  readonly numero: number;
  readonly tipo: TipoInversion;
  readonly monto: string;
  readonly plazo: string;
  readonly tasa: string;
  readonly comision: string;
  /** Desglose: "$500,000.00 × 2.706% = $13,530.00". */
  readonly operacion: string;
  readonly fecha: string;
  readonly cuentaParaMeta: boolean;
  /** null si el mes no se desbloquea (no se paga). */
  readonly fechaPago: string | null;
}

export interface ModeloComisiones {
  readonly perfil: "interno" | "externo";
  readonly lineas: readonly LineaComisionModelo[];
  readonly totales: {
    readonly comisionBruta: string;
    readonly comisionPagable: string;
    readonly comisionBloqueada: string;
    readonly captacionParaMeta: string;
    /** Aporte de la red externa a la meta; null si no hay (o si es externo). */
    readonly aporteRed: string | null;
  };
  /** Solo internos. */
  readonly avance: {
    readonly meta: string;
    readonly umbral: string;
    /** Avance sobre la meta, truncado a entero ("79%" con 799,999.99). */
    readonly porcentaje: string;
    readonly porcentajeUmbral: string;
    /** Para dibujar la barra (0 a 1); no es una cifra de dinero. */
    readonly fraccion: number;
    readonly fraccionUmbral: number;
    readonly desbloqueada: boolean;
    readonly fechaDesbloqueo: string | null;
    readonly faltaParaUmbral: string | null;
    readonly faltaParaMeta: string | null;
  } | null;
  /** Qué pasa con la comisión bloqueada al cierre del mes (parámetro, por confirmar). */
  readonly notaBloqueo: string | null;
  readonly bono: string | null;
  readonly sueldoBase: string | null;
  readonly pagos: readonly { readonly fecha: string; readonly monto: string; readonly inversiones: readonly number[] }[];
  /** Días del calendario de pago, para escribir la regla en pantalla. */
  readonly regla: SemillaComisiones["pago"];
}

/** Tasa de comisión completa en porcentaje, con hasta 3 decimales: "2.904%", "1.23%", "1.20%". */
export function porcentajeComision(tasa: Decimal): string {
  const tres = tasa.times(100).toFixed(3, ROUND_HALF_UP);
  return `${tres.endsWith("0") ? tres.slice(0, -1) : tres}%`;
}

/** Plazos de la tabla del nivel vigente (para el selector de la pantalla). */
export function plazosDeComision(s: SemillaComisiones): number[] {
  return [...(s.tablas.nueva[s.nivelVigente][0]?.tasas.keys() ?? [])];
}

/** Lo que la pantalla necesita antes de simular: los plazos y el porcentaje de la red. */
export interface OpcionesComisiones {
  readonly plazos: readonly number[];
  /** "30%": cuánto de la captación de la red externa cuenta para la meta. */
  readonly porcentajeRed: string;
}

export function opcionesComisiones(s: SemillaComisiones): OpcionesComisiones {
  return { plazos: plazosDeComision(s), porcentajeRed: porcentajeEntero(s.porcentajeRedExterna) };
}

const pesos = (d: Decimal) => formatearPesos(d);
const pesosONulo = (d: Decimal | null) => (d === null ? null : pesos(d));
const porcentajeEntero = (d: Decimal) => `${d.times(100).toFixed(0, Decimal.ROUND_DOWN)}%`;

/** Fecha de pago de cada línea (índice -> fecha), a partir de los pagos agrupados. */
function fechasDePago(l: Liquidacion): Map<number, string> {
  return new Map(l.pagos.flatMap((p) => p.lineas.map((i) => [i, p.fecha] as const)));
}

function avanceDe(l: Liquidacion): ModeloComisiones["avance"] {
  const d = l.desbloqueo;
  if (d === null) return null;
  const fraccion = d.meta.isZero() ? new Decimal(0) : l.captacionParaMeta.div(d.meta);
  const falta = (objetivo: Decimal) => (l.captacionParaMeta.greaterThanOrEqualTo(objetivo) ? null : pesos(objetivo.minus(l.captacionParaMeta)));
  return {
    meta: pesos(d.meta),
    umbral: pesos(d.umbral),
    porcentaje: porcentajeEntero(fraccion),
    porcentajeUmbral: porcentajeEntero(d.meta.isZero() ? new Decimal(0) : d.umbral.div(d.meta)),
    fraccion: Math.min(1, fraccion.toNumber()),
    fraccionUmbral: d.meta.isZero() ? 0 : d.umbral.div(d.meta).toNumber(),
    desbloqueada: d.desbloqueada,
    fechaDesbloqueo: d.fecha === null ? null : fechaDeTextoIso(d.fecha),
    faltaParaUmbral: falta(d.umbral),
    faltaParaMeta: falta(d.meta),
  };
}

export function modeloComisiones(s: SemillaComisiones, c: CamposComisiones): ResultadoApp<ModeloComisiones> {
  const inversiones: InversionDelMes[] = [];
  for (const [i, inv] of c.inversiones.entries()) {
    const prefijo = `Inversión ${i + 1}: `;
    const monto = normalizarMonto(inv.monto);
    if (!monto.ok) return error("COMISION_INVALIDA", prefijo + monto.error.mensaje);
    if (inv.plazo === null) return error("COMISION_INVALIDA", `${prefijo}elige el plazo.`);
    inversiones.push({ tipo: inv.tipo, monto: monto.valor, plazo: inv.plazo, fecha: inv.fecha });
  }

  let red: string | undefined;
  if (c.perfil === "interno" && c.captacionRedExterna.trim() !== "") {
    const r = normalizarMonto(c.captacionRedExterna);
    if (!r.ok && r.error.codigo !== "MONTO_CERO") {
      return error("COMISION_INVALIDA", `Captación de red externa: ${r.error.mensaje}`);
    }
    red = r.ok ? r.valor : undefined;
  }

  const l = liquidarMes(s, {
    perfil: c.perfil,
    ...(c.perfil === "interno" && c.rol !== null ? { rol: c.rol } : {}),
    inversiones,
    ...(red === undefined ? {} : { captacionRedExterna: red }),
  });
  if (!l.ok) return error("COMISION_INVALIDA", l.error.mensaje, l.error.detalles);
  const v = l.valor;
  const pagoDe = fechasDePago(v);

  return ok({
    perfil: v.perfil,
    lineas: v.lineas.map((x, i) => {
      const pago = pagoDe.get(i);
      return {
        numero: i + 1,
        tipo: x.tipo,
        monto: pesos(x.monto),
        plazo: `${x.plazo} meses`,
        tasa: porcentajeComision(x.tasa),
        comision: pesos(x.comision),
        operacion: `${pesos(x.monto)} × ${porcentajeComision(x.tasa)} = ${pesos(x.comision)}`,
        fecha: fechaDeTextoIso(x.fecha),
        cuentaParaMeta: x.cuentaParaMeta,
        fechaPago: pago === undefined ? null : fechaDeTextoIso(pago),
      };
    }),
    totales: {
      comisionBruta: pesos(v.comisionBruta),
      comisionPagable: pesos(v.comisionPagable),
      comisionBloqueada: pesos(v.comisionBloqueada),
      captacionParaMeta: pesos(v.captacionParaMeta),
      aporteRed: v.aporteRed.isZero() ? null : pesos(v.aporteRed),
    },
    avance: avanceDe(v),
    // El parámetro viene como clave ("se_pierde (...)"): se muestra con espacios.
    notaBloqueo: v.notaBloqueo === null ? null : v.notaBloqueo.replace(/^([a-z]+)_([a-z]+)/, "$1 $2"),
    bono: pesosONulo(v.bono),
    sueldoBase: pesosONulo(v.sueldoBase),
    pagos: v.pagos.map((p) => ({ fecha: fechaDeTextoIso(p.fecha), monto: pesos(p.monto), inversiones: p.lineas.map((i) => i + 1) })),
    regla: s.pago,
  });
}
