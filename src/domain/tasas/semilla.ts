import * as z from "zod";
import { crearError } from "../comun/errores";
import { exito, fallo, type Resultado } from "../comun/resultado";
import { esquemaSemilla, type Semilla } from "./semilla.esquema";

/** Mensajes genéricos de Zod en español, solo para esta validación (no toca la configuración global). */
const erroresEnEspanol = z.locales.es().localeError;

function ruta(path: readonly PropertyKey[]): string {
  return path.length === 0 ? "(raíz)" : path.map(String).join(".");
}

/**
 * Valida la semilla de parámetros y la convierte a la forma del dominio
 * (montos y tasas como Decimal). Es pura: recibe el objeto ya leído.
 */
export function cargarSemilla(json: unknown): Resultado<Semilla> {
  const r = esquemaSemilla.safeParse(json, { error: erroresEnEspanol });
  if (r.success) return exito(r.data);

  const detalles = r.error.issues.map((i) => `${ruta(i.path)}: ${i.message}`);
  const n = detalles.length;
  return fallo(
    crearError(
      "SEMILLA_INVALIDA",
      `La semilla de parámetros no es válida (${n} ${n === 1 ? "problema" : "problemas"}). ` +
        "Corrige el archivo de parámetros en la ubicación indicada en cada detalle y vuelve a cargarlo.",
      detalles,
    ),
  );
}
