import type { Decimal } from "../comun/decimal";
import { formatearPesos, formatearPorcentaje } from "../comun/formato";
import type { Aviso } from "../comun/resultado";
import type { Esquema, TablaTasas } from "./semilla.esquema";

/**
 * Aviso NO bloqueante cuando la tasa del monto es mayor que la del tramo
 * inmediato siguiente, en el mismo esquema y plazo. Solo compara con ese tramo;
 * si no hay tramo siguiente o no ofrece el plazo, no hay aviso.
 */
export function avisoDeCoherencia(
  tabla: TablaTasas,
  indice: number,
  esquema: Esquema,
  plazo: number,
  tasa: Decimal,
): Aviso | null {
  const siguiente = tabla.tramos[indice + 1];
  if (siguiente === undefined) return null;
  const tasaSiguiente = siguiente.tasas[esquema].get(plazo);
  if (tasaSiguiente === undefined || !tasa.gt(tasaSiguiente)) return null;

  return {
    codigo: "TASA_MAYOR_QUE_TRAMO_SIGUIENTE",
    severidad: "aviso",
    mensaje:
      `La tasa de este monto (${formatearPorcentaje(tasa)}) es mayor que la del tramo desde ` +
      `${formatearPesos(siguiente.desde)} (${formatearPorcentaje(tasaSiguiente)}). ` +
      "Así lo define la tabla vigente; revísalo antes de confirmar.",
    datos: {
      esquema,
      plazo: String(plazo),
      tasa: tasa.toFixed(),
      tasaTramoSiguiente: tasaSiguiente.toFixed(),
      desdeTramoSiguiente: siguiente.desde.toFixed(2),
    },
  };
}
