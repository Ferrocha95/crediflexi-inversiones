import type { PostgrestError } from "@supabase/supabase-js";
import { expect } from "vitest";

// Traduce ids a claves de fixture (E1, A2, ...) y las ordena, para comparar
// conjuntos sin depender del orden y con mensajes legibles cuando fallan.
// Un id que no pertenece a los datos sintéticos aparece como "desconocido:<id>".
export function clavesDe<C extends string>(
  filas: readonly { id: string }[],
  ids: Record<C, string>,
): string[] {
  const porId = new Map<string, string>(
    Object.entries<string>(ids).map(([clave, id]) => [id, clave]),
  );
  return filas.map((f) => porId.get(f.id) ?? `desconocido:${f.id}`).sort();
}

export function ordenadas(claves: readonly string[]): string[] {
  return [...claves].sort();
}

// Códigos de Postgres usados en las pruebas.
export const PERMISO_DENEGADO = "42501"; // insufficient_privilege
export const CHECK_VIOLADO = "23514"; // check_violation (y los raise de los triggers)
export const UNICO_VIOLADO = "23505"; // unique_violation
export const LLAVE_FORANEA_VIOLADA = "23503"; // foreign_key_violation
export const VALOR_INVALIDO = "22P02"; // invalid_text_representation (enum)

// Para anon: o no devuelve filas, o devuelve un error de permisos denegados.
// Cualquier otro error (o cualquier fila) hace fallar la prueba.
export function esperarSinFilasOPermisoDenegado(resultado: {
  data: unknown[] | null;
  error: PostgrestError | null;
}): void {
  if (resultado.error) {
    expect(resultado.error.code).toBe(PERMISO_DENEGADO);
    expect(resultado.data).toBeNull();
  } else {
    expect(resultado.data).toEqual([]);
  }
}
