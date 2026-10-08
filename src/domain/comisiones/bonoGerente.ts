import { Decimal } from "../comun/decimal";
import { aCentavos } from "../interes/redondeo";
import { comisionDeInversion, type ComisionInversion, type SolicitudComision } from "./comision";
import { exitoComision, falloComision, type ResultadoComision } from "./errores";
import type { SemillaComisiones } from "./semilla";

// Bono de gerente (por confirmar, parametros.bono_gerente): el porcentaje de
// la comisión N1 de las inversiones de su equipo, nuevas y renovaciones. No
// cambia la meta del gerente, que se mide sobre su propia captación.

export interface BonoGerente {
  /** Comisión de cada inversión del equipo, con la misma función de la comisión N1. */
  readonly lineas: readonly ComisionInversion[];
  /** Suma de esas comisiones, a 2 decimales. */
  readonly base: Decimal;
  readonly porcentaje: Decimal;
  /** porcentaje × base, con un solo redondeo final a 2 decimales (mitad hacia arriba). */
  readonly bono: Decimal;
}

export function bonoDeGerente(s: SemillaComisiones, inversionesDelEquipo: readonly SolicitudComision[]): ResultadoComision<BonoGerente> {
  const lineas: ComisionInversion[] = [];
  for (const [i, inv] of inversionesDelEquipo.entries()) {
    const c = comisionDeInversion(s, inv);
    if (!c.ok) return falloComision(c.error.codigo, `Inversión del equipo ${i + 1}: ${c.error.mensaje}`);
    lineas.push(c.valor);
  }
  const base = aCentavos(lineas.reduce((a, l) => a.plus(l.comision), new Decimal(0)));
  const porcentaje = s.bonoGerente.porcentaje;
  return exitoComision({ lineas, base, porcentaje, bono: aCentavos(base.times(porcentaje)) });
}
