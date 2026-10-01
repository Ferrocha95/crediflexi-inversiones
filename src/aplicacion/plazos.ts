import { exito, fallo, type Resultado } from "../domain/comun/resultado";
import { cotizar } from "../domain/interes/cotizar";
import type { SolicitudTasa } from "../domain/tasas/resolver";
import type { Semilla } from "../domain/tasas/semilla.esquema";

export type ConsultaPlazos = Omit<SolicitudTasa, "plazo">;

/**
 * Plazos que cotizar acepta para esta entidad, moneda, esquema y monto, de
 * menor a mayor. No repite ninguna regla del dominio: prueba con cotizar cada
 * plazo que aparece en la tabla (los de los tramos y el plazo adicional) y se
 * queda con los que cotizan. Mientras el dominio no exponga esta función
 * (PENDIENTES_TECNICOS, pendiente w), este es el único lugar que la resuelve.
 *
 * Si el problema no es el plazo (moneda, entidad, estatus, monto o tramo),
 * devuelve el error del dominio tal cual. Para saberlo, primero cotiza con
 * plazo 0: el resolver revisa el plazo al final (BLUEPRINT §11.1), así que
 * cualquier otro error sale antes que PLAZO_NO_DISPONIBLE.
 */
export function plazosDisponibles(semilla: Semilla, consulta: ConsultaPlazos): Resultado<readonly number[]> {
  const sonda = cotizar(semilla, { ...consulta, plazo: 0 });
  if (!sonda.ok && sonda.error.codigo !== "PLAZO_NO_DISPONIBLE") return fallo(sonda.error);

  const tabla = semilla.tablas[consulta.moneda];
  const candidatos = new Set<number>();
  for (const tramo of tabla?.tramos ?? []) tramo.plazosDisponibles.forEach((p) => candidatos.add(p));
  if (tabla?.plazoAdicional) candidatos.add(tabla.plazoAdicional.plazoMeses);

  const plazos = [...candidatos]
    .sort((a, b) => a - b)
    .filter((plazo) => cotizar(semilla, { ...consulta, plazo }).ok);
  return exito(plazos);
}
