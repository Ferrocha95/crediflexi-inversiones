import { Decimal } from "../comun/decimal";
import type { IncentivoExterno, SemillaComisiones } from "./semilla";

// Bono de externos (incentivos_propuesta, filas EXTERNOS): una cantidad fija
// según la captación NUEVA del mes, siempre más la comisión. Debajo del primer
// rango no hay bono. Su fecha de pago no está definida.

export interface BonoExterno {
  readonly bono: Decimal;
  /** El rango que aplica; null si la captación no llega al primero. */
  readonly rango: IncentivoExterno | null;
}

const CERO = new Decimal(0);

export function bonoDeExterno(s: SemillaComisiones, captacionNueva: Decimal): BonoExterno {
  // La última fila cuyo "desde" no pasa de la captación: un monto con centavos
  // entre dos rangos de pesos enteros (1,499,999.50) se queda en el de abajo.
  const rango = [...s.incentivosExternos].reverse().find((f) => captacionNueva.greaterThanOrEqualTo(f.desde)) ?? null;
  return { bono: rango?.bono ?? CERO, rango };
}
