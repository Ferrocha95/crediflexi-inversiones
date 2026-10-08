import { Decimal, RE_MONTO } from "../comun/decimal";
import { aCentavos } from "../interes/redondeo";
import { comisionDeInversion, type ComisionInversion } from "./comision";
import { exitoComision, falloComision, type ResultadoComision } from "./errores";
import { diasDelMes, leerFecha, pagoDeFecha, pagoDeQuincena2, textoDeFecha, type FechaCivil } from "./fechas";
import type { RolConMeta, SemillaComisiones, TipoInversion } from "./semilla";

// Simulador del mes: nada se guarda. Todas las reglas (umbral, red, meta,
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
  /** Solo internos: captación de su red externa en el mes (texto decimal). */
  readonly captacionRedExterna?: string;
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
  /** 30% (parámetro) de la captación de la red externa; cero en externos. */
  readonly aporteRed: Decimal;
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
  /** null si no aplica (GERENTE y externos, hasta definirlo). */
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
  if (e.perfil === "externo" && e.captacionRedExterna !== undefined) {
    return falloComision("ENTRADA_INVALIDA", "La captación de red externa solo aplica al perfil interno. Quítala o cambia el perfil.");
  }
  let red = CERO;
  if (e.captacionRedExterna !== undefined) {
    if (!RE_MONTO.test(e.captacionRedExterna)) {
      return falloComision(
        "MONTO_INVALIDO",
        `La captación de red externa "${e.captacionRedExterna}" no se puede leer. Escríbela sin comas, con máximo 2 decimales.`,
      );
    }
    red = new Decimal(e.captacionRedExterna);
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
  const aporteRed = e.perfil === "interno" ? aCentavos(red.times(s.porcentajeRedExterna)) : CERO;
  const captacionPropia = sumar(lineas.filter((l) => l.cuentaParaMeta).map((l) => l.monto));
  const captacionParaMeta = captacionPropia.plus(aporteRed);

  if (e.perfil === "externo") {
    return exitoComision({
      perfil: "externo",
      lineas,
      aporteRed,
      captacionParaMeta,
      desbloqueo: null,
      comisionBruta,
      comisionPagable: comisionBruta,
      comisionBloqueada: CERO,
      notaBloqueo: null,
      bono: null,
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
  // La red no tiene fecha: cuenta al cierre del mes (supuesto aprobado).
  if (fechaDesbloqueo === null && mes !== undefined && captacionParaMeta.greaterThanOrEqualTo(umbral)) {
    fechaDesbloqueo = { ...mes, dia: diasDelMes(mes.anio, mes.mes) };
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
    aporteRed,
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
