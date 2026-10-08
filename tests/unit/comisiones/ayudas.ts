import semillaJson from "../../../seed/parametros_iniciales.json";
import type { ResultadoComision } from "../../../src/domain/comisiones/errores";
import { cargarSemillaComisiones, type SemillaComisiones } from "../../../src/domain/comisiones/semilla";

// Este módulo no calcula comisiones al importarse: solo carga la semilla real.

export type SemillaJson = typeof semillaJson;

/** Copia profunda de la semilla real para modificarla en una prueba. */
export const copiaSemilla = (): SemillaJson => structuredClone(semillaJson);

/** Solo dentro de una prueba: lanza si el resultado es un error. */
export function bien<T>(r: ResultadoComision<T>): T {
  if (!r.ok) throw new Error(`Se esperaba éxito: [${r.error.codigo}] ${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

/** Solo dentro de una prueba: el error, o lanza si fue un éxito. */
export function mal<T>(r: ResultadoComision<T>) {
  if (r.ok) throw new Error("Se esperaba un error");
  return r.error;
}

export function cargar(json: unknown): SemillaComisiones {
  return bien(cargarSemillaComisiones(json));
}

export const semillaComisiones = cargar(semillaJson);
