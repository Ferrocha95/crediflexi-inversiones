import { Decimal } from "../comun/decimal";
import { aCentavos } from "../interes/redondeo";
import { comisionDeInversion, type ComisionInversion, type SolicitudComision } from "./comision";
import { exitoComision, falloComision, type ResultadoComision } from "./errores";
import type { SemillaComisiones } from "./semilla";

// Comisión por externos (supuesto por confirmar, parametros.red_externa): el
// porcentaje de la comisión N1 de las inversiones de los externos de un
// interno, nuevas y renovaciones. Se paga aparte: no se descuenta a los
// externos. Queda sujeta al desbloqueo del propio interno. No se mezcla con el
// bono de gerente, que tiene su propio parámetro.

export interface ComisionRedExterna {
  /** Comisión de cada inversión de los externos, con la misma función de la comisión N1. */
  readonly lineas: readonly ComisionInversion[];
  /** Suma de esas comisiones, a 2 decimales. */
  readonly base: Decimal;
  readonly porcentaje: Decimal;
  /** porcentaje × base, con un solo redondeo final a 2 decimales (mitad hacia arriba). */
  readonly comision: Decimal;
  /** true si se paga: el interno desbloqueó su mes o el parámetro no exige el desbloqueo. */
  readonly desbloqueada: boolean;
  readonly pagable: Decimal;
  readonly bloqueada: Decimal;
}

const CERO = new Decimal(0);

export function comisionPorRedExterna(
  s: SemillaComisiones,
  inversionesDeSusExternos: readonly SolicitudComision[],
  desbloqueadaDelInterno: boolean,
): ResultadoComision<ComisionRedExterna> {
  const lineas: ComisionInversion[] = [];
  for (const [i, inv] of inversionesDeSusExternos.entries()) {
    const c = comisionDeInversion(s, inv);
    if (!c.ok) return falloComision(c.error.codigo, `Inversión de tus externos ${i + 1}: ${c.error.mensaje}`);
    lineas.push(c.valor);
  }
  const base = aCentavos(lineas.reduce((a, l) => a.plus(l.comision), CERO));
  const porcentaje = s.redExterna.porcentaje;
  const comision = aCentavos(base.times(porcentaje));
  const desbloqueada = desbloqueadaDelInterno || !s.redExterna.requiereDesbloqueoDelInterno;
  return exitoComision({
    lineas,
    base,
    porcentaje,
    comision,
    desbloqueada,
    pagable: desbloqueada ? comision : CERO,
    bloqueada: desbloqueada ? CERO : comision,
  });
}
