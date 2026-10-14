import { Decimal } from "../comun/decimal";
import type { Liquidacion } from "./liquidacion";

// "Total estimado del mes (simulación)", Sprint 7a: sueldo base (solo
// EJECUTIVO, propuesta) + comisión pagable + bono por captación. La comisión
// por externos y el bono de gerente se muestran aparte y no entran (decisión
// de Fernando, mientras sigan por confirmar). Sin redondeo: suma montos que ya
// vienen a centavos.

export interface TotalMes {
  /** null si no aplica: GERENTE y externos no tienen sueldo base. */
  readonly sueldoBase: Decimal | null;
  readonly comisionPagable: Decimal;
  /** null si no aplica: el bono del GERENTE no está definido. */
  readonly bono: Decimal | null;
  readonly total: Decimal;
}

export function totalEstimadoDelMes(l: Liquidacion): TotalMes {
  // La liquidación del externo trae su sueldo base de la semilla (0); aquí no cuenta.
  const sueldoBase = l.perfil === "interno" ? l.sueldoBase : null;
  const total = [sueldoBase, l.comisionPagable, l.bono].reduce<Decimal>((a, x) => (x === null ? a : a.plus(x)), new Decimal(0));
  return { sueldoBase, comisionPagable: l.comisionPagable, bono: l.bono, total };
}
