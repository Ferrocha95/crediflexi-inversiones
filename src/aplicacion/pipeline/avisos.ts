import { fechaDeTextoIso } from "../fecha";
import { telefonoConFormato } from "./normalizar";
import { sumarDias } from "./semana";

/**
 * Avisos que NO bloquean el guardado (docs/FORMATOS_EXCEL.md §3): una fecha
 * de seguimiento sospechosa y un teléfono repetido entre los activos que el
 * usuario puede ver.
 */

/** Antigüedad a partir de la cual una fecha de seguimiento se considera sospechosa. Pendiente moverla a parámetros. */
export const DIAS_AVISO_SEGUIMIENTO = 60;

export interface ProspectoParaAvisos {
  /** Al editar, el id del propio prospecto (no se compara consigo mismo). */
  readonly id?: string;
  /** AAAA-MM-DD o null. */
  readonly seguimiento: string | null;
  /** Ya normalizado a 10 dígitos. */
  readonly contacto: string;
}

export interface ContextoAvisos {
  /** Hoy en la Ciudad de México, AAAA-MM-DD. */
  readonly hoy: string;
  readonly activos: readonly { readonly id: string; readonly nombre: string; readonly contacto: string }[];
}

const REVISA = "Revisa que sea correcta; puedes guardar de todos modos.";

export function avisosProspecto(p: ProspectoParaAvisos, ctx: ContextoAvisos): string[] {
  const avisos: string[] = [];
  if (p.seguimiento !== null) {
    const fecha = fechaDeTextoIso(p.seguimiento);
    if (p.seguimiento.slice(0, 4) !== ctx.hoy.slice(0, 4)) {
      avisos.push(`La fecha de seguimiento (${fecha}) es de otro año. ${REVISA}`);
    } else if (p.seguimiento < sumarDias(ctx.hoy, -DIAS_AVISO_SEGUIMIENTO)) {
      avisos.push(`La fecha de seguimiento (${fecha}) es de hace más de ${DIAS_AVISO_SEGUIMIENTO} días. ${REVISA}`);
    }
  }
  const repetido = ctx.activos.find((a) => a.contacto === p.contacto && a.id !== p.id);
  if (repetido !== undefined) {
    avisos.push(
      `El teléfono ${telefonoConFormato(p.contacto)} ya está en otro prospecto activo (${repetido.nombre}). Puedes guardar de todos modos.`,
    );
  }
  return avisos;
}
