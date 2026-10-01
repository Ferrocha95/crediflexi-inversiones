import semillaJson from "../../../seed/parametros_iniciales.json";
import type { CodigoError } from "../../../src/domain/comun/errores";
import { cotizar, type Cotizacion, type SalidaCotizada } from "../../../src/domain/interes/cotizar";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import { cargarSemilla } from "../../../src/domain/tasas/semilla";
import type { Salida, Semilla } from "../../../src/domain/tasas/semilla.esquema";

// Este módulo no cotiza al importarse: cotizarBien y codigoDeError solo se
// llaman dentro de las pruebas.

export type SemillaJson = typeof semillaJson;

/** Copia profunda de la semilla real para modificarla en una prueba. */
export const copiaSemilla = (): SemillaJson => structuredClone(semillaJson);

export function cargar(json: unknown): Semilla {
  const r = cargarSemilla(json);
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

export const semillaReal = cargar(semillaJson);

export const base: SolicitudTasa = {
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "1500000",
  plazo: 12,
};

/** Solo dentro de una prueba: lanza si no cotiza. */
export function cotizarBien(cambios: Partial<SolicitudTasa>, s: Semilla = semillaReal): Cotizacion {
  const r = cotizar(s, { ...base, ...cambios });
  if (!r.ok) throw new Error(`Se esperaba una cotización: [${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

export function codigoDeError(cambios: Partial<SolicitudTasa>, s: Semilla = semillaReal): CodigoError | "OK" {
  const r = cotizar(s, { ...base, ...cambios });
  return r.ok ? "OK" : r.error.codigo;
}

export function salida(c: Cotizacion, clave: Salida): SalidaCotizada {
  const s = c.salidas.find((x) => x.clave === clave);
  if (s === undefined) throw new Error(`La cotización no trae la salida ${clave}`);
  return s;
}
