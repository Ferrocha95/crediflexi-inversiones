import * as z from "zod";
import type { RangoFechaInicio } from "../domain/interes/diasNaturales";
import { validar, type ResultadoApp } from "./resultado";

/**
 * Rango permitido de la fecha de inicio (cotizador.fecha_inicio de la semilla,
 * Sprint 6b), leído con un esquema propio como las razones sociales: el tipo
 * Semilla del dominio no lo guarda. El resto de la semilla se ignora.
 */
const dias = (campo: string) =>
  z
    .number({ error: `${campo}: debe ser un número entero de días.` })
    .int({ error: `${campo}: debe ser un número entero de días.` })
    .min(0, { error: `${campo}: no puede ser negativo.` })
    .max(3660, { error: `${campo}: no puede pasar de 3660 días.` });

const esquemaRango = z
  .object({
    cotizador: z.object({
      fecha_inicio: z.object({
        dias_atras: dias("Los días hacia atrás"),
        dias_adelante: dias("Los días hacia adelante"),
      }),
    }),
  })
  .transform((s): RangoFechaInicio => ({ diasAtras: s.cotizador.fecha_inicio.dias_atras, diasAdelante: s.cotizador.fecha_inicio.dias_adelante }));

/** Días hacia atrás y hacia adelante de hoy que admite la fecha de inicio. Es pura. */
export function cargarRangoFechaInicio(json: unknown, archivo: string): ResultadoApp<RangoFechaInicio> {
  return validar(esquemaRango, json, "SEMILLA_INVALIDA", archivo);
}
