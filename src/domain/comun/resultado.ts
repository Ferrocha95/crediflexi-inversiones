import type { ErrorCotizacion } from "./errores";

export type CodigoAviso = "TASA_MAYOR_QUE_TRAMO_SIGUIENTE";

/** Aviso NO bloqueante: acompaña a un resultado exitoso. */
export interface Aviso {
  readonly codigo: CodigoAviso;
  readonly severidad: "aviso";
  readonly mensaje: string;
  readonly datos?: Readonly<Record<string, string>>;
}

export type Resultado<T> =
  | { readonly ok: true; readonly valor: T; readonly avisos: readonly Aviso[] }
  | { readonly ok: false; readonly error: ErrorCotizacion };

export function exito<T>(valor: T, avisos: readonly Aviso[] = []): Resultado<T> {
  return { ok: true, valor, avisos };
}

export function fallo<T>(error: ErrorCotizacion): Resultado<T> {
  return { ok: false, error };
}
