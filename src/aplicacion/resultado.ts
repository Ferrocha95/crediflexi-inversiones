import * as z from "zod";

/**
 * Errores de la capa de aplicación (lectura de archivos y parámetros que no
 * son del motor de tasas). Cada mensaje dice, en español claro, qué falló y
 * qué hacer.
 */
export type CodigoErrorAplicacion =
  | "ARCHIVO_ILEGIBLE"
  | "SEMILLA_INVALIDA"
  | "ENTIDADES_INVALIDAS"
  | "TEXTOS_INVALIDOS";

export interface ErrorAplicacion {
  readonly codigo: CodigoErrorAplicacion;
  readonly mensaje: string;
  readonly detalles?: readonly string[];
}

export type ResultadoApp<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly error: ErrorAplicacion };

export function ok<T>(valor: T): ResultadoApp<T> {
  return { ok: true, valor };
}

export function error<T>(
  codigo: CodigoErrorAplicacion,
  mensaje: string,
  detalles?: readonly string[],
): ResultadoApp<T> {
  return { ok: false, error: detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles } };
}

/** Mensajes genéricos de Zod en español, solo para estas validaciones (no toca la configuración global). */
const erroresEnEspanol = z.locales.es().localeError;

function ruta(path: readonly PropertyKey[]): string {
  return path.length === 0 ? "(raíz)" : path.map(String).join(".");
}

/**
 * Valida `json` con `esquema`. Si falla, el mensaje nombra el archivo y cada
 * detalle dice la ubicación del problema dentro del archivo.
 */
export function validar<T>(
  esquema: z.ZodType<T>,
  json: unknown,
  codigo: CodigoErrorAplicacion,
  archivo: string,
): ResultadoApp<T> {
  const r = esquema.safeParse(json, { error: erroresEnEspanol });
  if (r.success) return ok(r.data);

  const detalles = r.error.issues.map((i) => `${ruta(i.path)}: ${i.message}`);
  const n = detalles.length;
  return error(
    codigo,
    `El archivo ${archivo} no es válido (${n} ${n === 1 ? "problema" : "problemas"}). ` +
      "Corrígelo en la ubicación indicada en cada detalle y vuelve a cargarlo.",
    detalles,
  );
}
