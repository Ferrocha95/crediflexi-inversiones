import * as z from "zod";
import { validar, type ResultadoApp } from "./resultado";

/**
 * Razón social de cada entidad, leída de entidades[] de la semilla con un
 * esquema propio: el tipo Semilla del dominio solo guarda la clave
 * (PENDIENTES_TECNICOS, pendiente x). El resto de la semilla se ignora.
 */
const esquemaEntidades = z
  .object({
    entidades: z
      .array(
        z.object({
          clave: z.string({ error: "Falta la clave de la entidad." }).trim().min(1),
          razon_social: z
            .string({ error: "Falta la razón social de la entidad." })
            .trim()
            .min(1, { error: "La razón social no puede estar vacía." }),
        }),
      )
      .min(1, { error: "La semilla debe tener al menos una entidad." }),
  })
  .superRefine((s, ctx) => {
    const vistas = new Set<string>();
    s.entidades.forEach((e, i) => {
      if (vistas.has(e.clave)) {
        ctx.addIssue({
          code: "custom",
          path: ["entidades", i, "clave"],
          message: `La entidad ${e.clave} está repetida. Deja una sola.`,
        });
      }
      vistas.add(e.clave);
    });
  })
  .transform((s): ReadonlyMap<string, string> => new Map(s.entidades.map((e) => [e.clave, e.razon_social])));

/** Mapa clave -> razón social, en el orden de la semilla. Es pura. */
export function cargarRazonesSociales(json: unknown, archivo: string): ResultadoApp<ReadonlyMap<string, string>> {
  return validar(esquemaEntidades, json, "ENTIDADES_INVALIDAS", archivo);
}
