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

// Código de Postgres para "permission denied" (insufficient_privilege).
export const PERMISO_DENEGADO = "42501";

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
