import { Decimal, ROUND_HALF_UP } from "../domain/comun/decimal";
import { formatearPesos } from "../domain/comun/formato";
import { bonoDeGerente } from "../domain/comisiones/bonoGerente";
import type { ComisionInversion, SolicitudComision } from "../domain/comisiones/comision";
import { liquidarMes, type InversionDelMes, type Liquidacion } from "../domain/comisiones/liquidacion";
import { comisionPorRedExterna } from "../domain/comisiones/redExterna";
import type { IncentivoExterno, IncentivoInterno, RolConMeta, SemillaComisiones, TipoInversion } from "../domain/comisiones/semilla";
import { totalEstimadoDelMes } from "../domain/comisiones/totalMes";
import { fechaDeTextoIso } from "./fecha";
import { normalizarMonto } from "./monto";
import { error, ok, type ResultadoApp } from "./resultado";
import type { TextosComisiones } from "./textos";

// Pantalla /comisiones: convierte lo escrito en la entrada del motor y el
// resultado en texto. No calcula: las cifras salen de liquidarMes, para el
// gerente de bonoDeGerente y, para Mis externos, de comisionPorRedExterna.

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
  /** Solo GERENTE: inversiones de su equipo para el bono de gerente (por confirmar). Sin fecha. */
  readonly equipo: readonly InversionSinFecha[];
  /** Solo internos: inversiones de sus externos para la comisión por externos (supuesto por confirmar). Sin fecha. */
  readonly externos: readonly InversionSinFecha[];
}

export interface InversionSinFecha {
  readonly tipo: TipoInversion;
  readonly monto: string;
  readonly plazo: number | null;
}

/** Comisión de una inversión de otra persona (equipo o externos), sin fecha ni pago. */
export interface LineaSinFechaModelo {
  readonly numero: number;
  readonly tipo: TipoInversion;
  readonly monto: string;
  readonly plazo: string;
  readonly tasa: string;
  readonly comision: string;
}

/** Una fila de la tabla de incentivos, en pesos enteros ("$1,000,000"). */
export interface FilaIncentivoModelo {
  readonly cumplimiento: string;
  readonly desde: string;
  /** null en el último rango ("En adelante"). */
  readonly hasta: string | null;
  readonly bono: string;
  /** La fila que alcanza la captación del mes (como mucho una). */
  readonly alcanzada: boolean;
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
    /** null en externos: no tienen desbloqueo. */
    readonly comisionBloqueada: string | null;
    readonly captacionParaMeta: string;
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
  /** Solo perfil interno con rol EJECUTIVO (propuesta), en pesos enteros; null en los demás casos. */
  readonly sueldoBase: string | null;
  /**
   * Tabla de incentivos: filas EXTERNOS (por captación nueva) para el externo
   * y filas INTERNOS (por captación para la meta) para el EJECUTIVO; null en GERENTE.
   */
  readonly incentivos: {
    readonly tipo: "interno" | "externo";
    readonly filas: readonly FilaIncentivoModelo[];
    /** Solo externo: la meta interna de un ejecutivo, como referencia (el externo no tiene meta). */
    readonly metaReferencia: string | null;
    /** Solo EJECUTIVO: desde qué porcentaje y monto se desbloquean las comisiones. */
    readonly desbloqueo: { readonly porcentaje: string; readonly umbral: string } | null;
  } | null;
  /** Solo internos con inversiones de sus externos: comisión por externos (supuesto por confirmar). */
  readonly redExterna: {
    readonly lineas: readonly LineaSinFechaModelo[];
    readonly base: string;
    readonly porcentaje: string;
    readonly comision: string;
    /** "30% × $25,215.00 = $7,564.50". */
    readonly operacion: string;
    readonly desbloqueada: boolean;
    readonly pagable: string;
    readonly bloqueada: string;
    /** Umbral de desbloqueo del propio interno, en pesos enteros. */
    readonly umbral: string;
    /** Qué pasa con lo bloqueado al cierre del mes; null si está desbloqueada. */
    readonly notaBloqueo: string | null;
  } | null;
  /** Solo GERENTE con inversiones del equipo; aparte de su comisión y de su meta. */
  readonly bonoGerente: {
    readonly base: string;
    readonly porcentaje: string;
    readonly bono: string;
    /** "30% × $25,215.00 = $7,564.50". */
    readonly operacion: string;
    readonly lineas: readonly LineaSinFechaModelo[];
  } | null;
  readonly pagos: readonly { readonly fecha: string; readonly monto: string; readonly inversiones: readonly number[] }[];
  /** Días del calendario de pago, para escribir la regla en pantalla. */
  readonly regla: SemillaComisiones["pago"];
  /**
   * "Total estimado del mes (simulación)" (Sprint 7a), de totalEstimadoDelMes:
   * sueldo base (solo EJECUTIVO) + comisión pagable + bono. La comisión por
   * externos y el bono de gerente van aparte y no entran.
   */
  readonly totalMes: {
    readonly total: string;
    /** Los sumandos que aplican, en orden. */
    readonly partes: readonly { readonly clave: "sueldoBase" | "comisionPagable" | "bono"; readonly monto: string }[];
    /** "$15,000.00 + $28,380.00 + $0.00 = $43,380.00"; null con un solo sumando. */
    readonly operacion: string | null;
  };
}

/** Lo que dibuja el PDF de comisiones (Sprint 7a): el mismo modelo de la pantalla, con su fecha y sus textos. */
export interface ModeloPdfComisiones {
  readonly textos: TextosComisiones;
  /** Fecha del documento (hoy en la Ciudad de México), DD/MM/AAAA. */
  readonly fecha: string;
  readonly rol: RolConMeta;
  readonly comisiones: ModeloComisiones;
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

/** Lo que la pantalla necesita antes de simular: los plazos. */
export interface OpcionesComisiones {
  readonly plazos: readonly number[];
}

export function opcionesComisiones(s: SemillaComisiones): OpcionesComisiones {
  return { plazos: plazosDeComision(s) };
}

const pesos = (d: Decimal) => formatearPesos(d);
const pesosONulo = (d: Decimal | null) => (d === null ? null : pesos(d));
/** Pesos sin centavos cuando son cero, para los montos fijos de la semilla ("$1,000,000"). */
const pesosEnteros = (d: Decimal) => formatearPesos(d).replace(/\.00$/, "");
const porcentajeEntero = (d: Decimal) => `${d.times(100).toFixed(0, Decimal.ROUND_DOWN)}%`;
// El parámetro viene como clave ("se_pierde (...)"): se muestra con espacios.
const notaLegible = (nota: string) => nota.replace(/^([a-z]+)_([a-z]+)/, "$1 $2");

const lineasSinFecha = (lineas: readonly ComisionInversion[]): LineaSinFechaModelo[] =>
  lineas.map((x, i) => ({
    numero: i + 1,
    tipo: x.tipo,
    monto: pesos(x.monto),
    plazo: `${x.plazo} meses`,
    tasa: porcentajeComision(x.tasa),
    comision: pesos(x.comision),
  }));

/** Lee montos y plazos de una lista sin fecha (equipo o externos); el error dice cuál inversión. */
function solicitudesSinFecha(lista: readonly InversionSinFecha[], nombre: string): ResultadoApp<SolicitudComision[]> {
  const solicitudes: SolicitudComision[] = [];
  for (const [i, inv] of lista.entries()) {
    const prefijo = `${nombre} ${i + 1}: `;
    const monto = normalizarMonto(inv.monto);
    if (!monto.ok) return error("COMISION_INVALIDA", prefijo + monto.error.mensaje);
    if (inv.plazo === null) return error("COMISION_INVALIDA", `${prefijo}elige el plazo.`);
    solicitudes.push({ tipo: inv.tipo, monto: monto.valor, plazo: inv.plazo });
  }
  return ok(solicitudes);
}

/** Tabla de incentivos del perfil: la fila alcanzada la marca el motor (filaIncentivo). */
function incentivosDe(s: SemillaComisiones, l: Liquidacion, rol: RolConMeta | null): ModeloComisiones["incentivos"] {
  const fila = (f: IncentivoInterno | IncentivoExterno, i: number): FilaIncentivoModelo => ({
    cumplimiento: f.cumplimiento,
    desde: pesosEnteros(f.desde),
    hasta: f.hasta === null ? null : pesosEnteros(f.hasta),
    bono: pesosEnteros(f.bono),
    alcanzada: l.filaIncentivo === i,
  });
  if (l.perfil === "externo") {
    return { tipo: "externo", filas: s.incentivosExternos.map(fila), metaReferencia: pesosEnteros(s.metas.EJECUTIVO), desbloqueo: null };
  }
  if (rol !== "EJECUTIVO" || l.desbloqueo === null) return null;
  return {
    tipo: "interno",
    filas: s.incentivosInternos.map(fila),
    metaReferencia: null,
    desbloqueo: { porcentaje: porcentajeEntero(s.umbralDesbloqueo), umbral: pesosEnteros(l.desbloqueo.umbral) },
  };
}

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

  const gerente = c.perfil === "interno" && c.rol === "GERENTE";
  if (!gerente && c.equipo.length > 0) {
    return error("COMISION_INVALIDA", "Las inversiones del equipo solo aplican al rol Gerente. Quítalas o cambia el rol.");
  }
  if (c.perfil !== "interno" && c.externos.length > 0) {
    return error("COMISION_INVALIDA", "Las inversiones de Mis externos solo aplican al perfil Interno. Quítalas o cambia el perfil.");
  }
  const equipo = solicitudesSinFecha(c.equipo, "Inversión del equipo");
  if (!equipo.ok) return equipo;
  const externos = solicitudesSinFecha(c.externos, "Inversión de tus externos");
  if (!externos.ok) return externos;

  const l = liquidarMes(s, {
    perfil: c.perfil,
    ...(c.perfil === "interno" && c.rol !== null ? { rol: c.rol } : {}),
    inversiones,
  });
  if (!l.ok) return error("COMISION_INVALIDA", l.error.mensaje, l.error.detalles);
  const v = l.valor;
  const pagoDe = fechasDePago(v);
  const tm = totalEstimadoDelMes(v);
  const partes: ModeloComisiones["totalMes"]["partes"] = [
    ...(tm.sueldoBase === null ? [] : [{ clave: "sueldoBase" as const, monto: pesos(tm.sueldoBase) }]),
    { clave: "comisionPagable" as const, monto: pesos(tm.comisionPagable) },
    ...(tm.bono === null ? [] : [{ clave: "bono" as const, monto: pesos(tm.bono) }]),
  ];

  let bonoGerente: ModeloComisiones["bonoGerente"] = null;
  if (gerente && equipo.valor.length > 0) {
    const b = bonoDeGerente(s, equipo.valor);
    if (!b.ok) return error("COMISION_INVALIDA", b.error.mensaje, b.error.detalles);
    const porcentaje = porcentajeEntero(b.valor.porcentaje);
    bonoGerente = {
      base: pesos(b.valor.base),
      porcentaje,
      bono: pesos(b.valor.bono),
      operacion: `${porcentaje} × ${pesos(b.valor.base)} = ${pesos(b.valor.bono)}`,
      lineas: lineasSinFecha(b.valor.lineas),
    };
  }

  // Mis externos: sujeta al desbloqueo del propio interno; aparte de su comisión y del bono de gerente.
  let redExterna: ModeloComisiones["redExterna"] = null;
  if (v.desbloqueo !== null && externos.valor.length > 0) {
    const r = comisionPorRedExterna(s, externos.valor, v.desbloqueo.desbloqueada);
    if (!r.ok) return error("COMISION_INVALIDA", r.error.mensaje, r.error.detalles);
    const porcentaje = porcentajeEntero(r.valor.porcentaje);
    redExterna = {
      lineas: lineasSinFecha(r.valor.lineas),
      base: pesos(r.valor.base),
      porcentaje,
      comision: pesos(r.valor.comision),
      operacion: `${porcentaje} × ${pesos(r.valor.base)} = ${pesos(r.valor.comision)}`,
      desbloqueada: r.valor.desbloqueada,
      pagable: pesos(r.valor.pagable),
      bloqueada: pesos(r.valor.bloqueada),
      umbral: pesosEnteros(v.desbloqueo.umbral),
      notaBloqueo: r.valor.desbloqueada ? null : notaLegible(s.notaComisionBloqueada),
    };
  }

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
      comisionBloqueada: pesosONulo(v.comisionBloqueada),
      captacionParaMeta: pesos(v.captacionParaMeta),
    },
    avance: avanceDe(v),
    notaBloqueo: v.notaBloqueo === null ? null : notaLegible(v.notaBloqueo),
    bono: pesosONulo(v.bono),
    // El sueldo base (propuesta) solo se muestra al perfil interno con rol EJECUTIVO.
    sueldoBase: c.perfil === "interno" && c.rol === "EJECUTIVO" && v.sueldoBase !== null ? pesosEnteros(v.sueldoBase) : null,
    incentivos: incentivosDe(s, v, c.rol),
    redExterna,
    bonoGerente,
    pagos: v.pagos.map((p) => ({ fecha: fechaDeTextoIso(p.fecha), monto: pesos(p.monto), inversiones: p.lineas.map((i) => i + 1) })),
    regla: s.pago,
    totalMes: {
      total: pesos(tm.total),
      partes,
      operacion: partes.length < 2 ? null : `${partes.map((p) => p.monto).join(" + ")} = ${pesos(tm.total)}`,
    },
  });
}
