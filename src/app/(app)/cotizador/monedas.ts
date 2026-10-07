import type { Moneda } from "../../../domain/tasas/semilla.esquema";
import type { OpcionesCotizador, OpcionMoneda } from "../../../aplicacion/opciones";

// Qué monedas se ofrecen según la entidad (aplica_a_entidades de la semilla,
// que llega en las opciones). Puro y sin valores del dominio: corre en el navegador.

const aplica = (m: OpcionMoneda, entidad: string) => m.entidades === null || m.entidades.includes(entidad);

/** Monedas que se ofrecen para la entidad: las que su tabla aplica a esa entidad. */
export function monedasDeEntidad(opciones: OpcionesCotizador, entidad: string): readonly OpcionMoneda[] {
  return opciones.monedas.filter((m) => aplica(m, entidad));
}

/**
 * La moneda que queda al elegir la entidad: la misma si aplica y está
 * habilitada; si no, la primera habilitada de la entidad.
 */
export function monedaParaEntidad(opciones: OpcionesCotizador, entidad: string, actual: Moneda): Moneda {
  const disponibles = monedasDeEntidad(opciones, entidad);
  if (disponibles.some((m) => m.moneda === actual && m.habilitada)) return actual;
  return (disponibles.find((m) => m.habilitada) ?? disponibles[0])?.moneda ?? actual;
}

/** Monedas que NO se ofrecen a la entidad, con las razones sociales a las que sí aplican (para explicarlo). */
export function monedasSoloPara(
  opciones: OpcionesCotizador,
  entidad: string,
): readonly { readonly moneda: Moneda; readonly razonesSociales: readonly string[] }[] {
  return opciones.monedas
    .filter((m) => !aplica(m, entidad) && m.entidades !== null)
    .map((m) => ({
      moneda: m.moneda,
      razonesSociales: m.entidades!.map((clave) => opciones.entidades.find((e) => e.clave === clave)?.razonSocial ?? clave),
    }));
}
