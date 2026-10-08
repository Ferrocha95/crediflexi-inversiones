import { Decimal } from "../comun/decimal";
import { bonoDeExterno } from "./bonoExterno";
import { comisionDeInversion, type ComisionInversion } from "./comision";
import { exitoComision, falloComision, type ResultadoComision } from "./errores";
import { leerFecha, pagoDeFecha, pagoDeQuincena2, textoDeFecha, type FechaCivil } from "./fechas";
import type { RolConMeta, SemillaComisiones, TipoInversion } from "./semilla";

// Simulador del mes: nada se guarda. Todas las reglas (umbral, meta,
// renovaciones, bono, calendario) salen de la semilla.

export interface InversionDelMes {
  readonly tipo: TipoInversion;
  readonly monto: string;
  readonly plazo: number;
  /** Fecha de captación, AAAA-MM-DD. */
  readonly fecha: string;
  readonly moneda?: "MXN" | "USD";
}

export interface EntradaLiquidacion {
  readonly perfil: "interno" | "externo";
  /** Obligatorio para internos; se ignora en externos. */
  readonly rol?: RolConMeta;
  readonly inversiones: readonly InversionDelMes[];
}

export interface LineaLiquidacion extends ComisionInversion {
  readonly fecha: string;
  readonly cuentaParaMeta: boolean;
}

export interface PagoComision {
  readonly fecha: string;
  readonly monto: Decimal;
  /** Índices (en el orden de entrada) de las inversiones que se pagan ese día. */
  readonly lineas: readonly number[];
}

export interface Liquidacion {
  readonly perfil: "interno" | "externo";
  /** En el orden de entrada. */
  readonly lineas: readonly LineaLiquidacion[];
  readonly captacionParaMeta: Decimal;
  /** null en externos: no tienen meta ni desbloqueo. */
  readonly desbloqueo: {
    readonly meta: Decimal;
    readonly umbral: Decimal;
    readonly desbloqueada: boolean;
    /** Día en que la captación acumulada alcanza el umbral; null si no lo alcanza. */
    readonly fecha: string | null;
  } | null;
  readonly comisionBruta: Decimal;
  readonly comisionPagable: Decimal;
  readonly comisionBloqueada: Decimal;
  /** Qué pasa con lo bloqueado al cierre del mes (parámetro, por confirmar); null si no hay bloqueo. */
  readonly notaBloqueo: string | null;
  /**
   * Bono por captación, aparte de la comisión (no entra en los pagos por
   * quincena). EJECUTIVO: filas INTERNOS; externos: filas EXTERNOS, sobre la
   * captación nueva del mes. null en GERENTE, hasta definirlo.
   */
  readonly bono: Decimal | null;
  readonly sueldoBase: Decimal | null;
  readonly pagos: readonly PagoComision[];
}

const CERO = new Decimal(0);
const sumar = (xs: readonly Decimal[]) => xs.reduce((a, b) => a.plus(b), CERO);

function bonoInterno(s: SemillaComisiones, captacion: Decimal): Decimal {
  // La última fila cuyo "desde" no pasa de la captación (las filas de la semilla dejan huecos de centavos entre sí).
  const fila = [...s.incentivosInternos].reverse().find((f) => captacion.greaterThanOrEqualTo(f.desde));
  return fila?.bono ?? CERO;
}

/** Agrupa las líneas por fecha de pago, en orden de fecha. */
function agrupar(lineas: readonly LineaLiquidacion[], fechaDe: (i: number) => string): PagoComision[] {
  const porFecha = new Map<string, number[]>();
  lineas.forEach((_, i) => {
    const f = fechaDe(i);
    porFecha.set(f, [...(porFecha.get(f) ?? []), i]);
  });
  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, indices]) => ({ fecha, monto: sumar(indices.map((i) => lineas[i].comision)), lineas: indices }));
}

export function liquidarMes(s: SemillaComisiones, e: EntradaLiquidacion): ResultadoComision<Liquidacion> {
  if (e.perfil === "interno" && e.rol === undefined) {
    return falloComision("ENTRADA_INVALIDA", "Elige el rol (Ejecutivo o Gerente): la meta del mes depende del rol.");
  }
  // Cada inversión: su fecha y su comisión.
  const lineas: LineaLiquidacion[] = [];
  const fechas: FechaCivil[] = [];
  for (const [i, inv] of e.inversiones.entries()) {
    const prefijo = `Inversión ${i + 1}: `;
    const f = leerFecha(inv.fecha);
    if (!f.ok) return falloComision(f.error.codigo, prefijo + f.error.mensaje);
    const c = comisionDeInversion(s, inv);
    if (!c.ok) return falloComision(c.error.codigo, prefijo + c.error.mensaje);
    const renovacion = inv.tipo === "renovacion";
    lineas.push({
      ...c.valor,
      comision: renovacion && !s.renovacionesPaganComision ? CERO : c.valor.comision,
      fecha: textoDeFecha(f.valor),
      cuentaParaMeta: !renovacion || s.renovacionesCuentanParaMeta,
    });
    fechas.push(f.valor);
  }
  const mes = fechas[0];
  if (mes !== undefined && fechas.some((f) => f.anio !== mes.anio || f.mes !== mes.mes)) {
    return falloComision(
      "MESES_MEZCLADOS",
      "Todas las inversiones deben ser del mismo mes: la meta y el desbloqueo se miden por mes. Simula cada mes por separado.",
    );
  }

  const comisionBruta = sumar(lineas.map((l) => l.comision));
  // Solo la captación propia (sin red externa desde la semilla 0.8.1).
  const captacionParaMeta = sumar(lineas.filter((l) => l.cuentaParaMeta).map((l) => l.monto));

  if (e.perfil === "externo") {
    const captacionNueva = sumar(lineas.filter((l) => l.tipo === "nueva").map((l) => l.monto));
    return exitoComision({
      perfil: "externo",
      lineas,
      captacionParaMeta,
      desbloqueo: null,
      comisionBruta,
      comisionPagable: comisionBruta,
      comisionBloqueada: CERO,
      notaBloqueo: null,
      bono: bonoDeExterno(s, captacionNueva).bono,
      sueldoBase: s.externos.sueldoBase,
      pagos: agrupar(lineas, (i) => textoDeFecha(pagoDeFecha(s.pago, fechas[i]))),
    });
  }

  const rol = e.rol!;
  const meta = s.metas[rol];
  const umbral = meta.times(s.umbralDesbloqueo);

  // D: el día en que la captación acumulada, en orden cronológico, alcanza el umbral.
  const orden = lineas.map((_, i) => i).sort((a, b) => lineas[a].fecha.localeCompare(lineas[b].fecha));
  let acumulado = CERO;
  let fechaDesbloqueo: FechaCivil | null = null;
  for (const i of orden) {
    if (lineas[i].cuentaParaMeta) acumulado = acumulado.plus(lineas[i].monto);
    if (acumulado.greaterThanOrEqualTo(umbral)) {
      fechaDesbloqueo = fechas[i];
      break;
    }
  }
  const desbloqueada = fechaDesbloqueo !== null;
  const d = fechaDesbloqueo;

  let pagos: PagoComision[] = [];
  if (d !== null) {
    pagos =
      d.dia <= s.pago.ultimoDiaQuincena1
        ? agrupar(lineas, (i) => textoDeFecha(pagoDeFecha(s.pago, fechas[i])))
        : agrupar(lineas, () => textoDeFecha(pagoDeQuincena2(s.pago, d)));
  }

  return exitoComision({
    perfil: "interno",
    lineas,
    captacionParaMeta,
    desbloqueo: { meta, umbral, desbloqueada, fecha: d === null ? null : textoDeFecha(d) },
    comisionBruta,
    comisionPagable: desbloqueada ? comisionBruta : CERO,
    comisionBloqueada: desbloqueada ? CERO : comisionBruta,
    notaBloqueo: desbloqueada ? null : s.notaComisionBloqueada,
    bono: rol === "EJECUTIVO" ? bonoInterno(s, captacionParaMeta) : null,
    sueldoBase: rol === "EJECUTIVO" ? s.sueldoBaseInterno : null,
    pagos,
  });
}
