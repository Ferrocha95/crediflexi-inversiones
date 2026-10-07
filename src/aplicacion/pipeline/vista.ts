import { fechaDeTextoIso } from "../fecha";
import { esVencido, type ProspectoFila } from "./filtros";
import { estatusEnPantalla, telefonoConFormato, type Estatus } from "./normalizar";

/**
 * Una fila del pipeline lista para la pantalla: el texto ya formateado para
 * la tabla, si es del usuario (solo el dueño edita) y los valores crudos para
 * llenar el diálogo de edición.
 */
export interface FilaPantalla {
  readonly datos: {
    readonly id: string;
    readonly nombre: string;
    readonly contacto: string;
    readonly comentarios: string;
    readonly estatus: "INTERESADO" | "INTERMITENTE" | "NO INTERESADO";
    readonly seguimiento: string;
    readonly ejecutivo: string;
    readonly vencido: boolean;
  };
  readonly propio: boolean;
  readonly archivado: boolean;
  readonly valores: ValoresProspecto;
}

/** Lo que muestra el formulario: texto tal cual (la fecha en AAAA-MM-DD o vacía). */
export interface ValoresProspecto {
  readonly nombre: string;
  readonly contacto: string;
  readonly comentarios: string;
  readonly estatus: Estatus;
  readonly seguimiento: string;
}

export const SIN_SEGUIMIENTO = "—";

export function filaParaPantalla(fila: ProspectoFila, hoy: string, usuarioId: string): FilaPantalla {
  return {
    datos: {
      id: fila.id,
      nombre: fila.nombre,
      contacto: telefonoConFormato(fila.contacto),
      comentarios: fila.comentarios,
      estatus: estatusEnPantalla(fila.estatus) as FilaPantalla["datos"]["estatus"],
      seguimiento: fila.seguimiento === null ? SIN_SEGUIMIENTO : fechaDeTextoIso(fila.seguimiento),
      ejecutivo: fila.ejecutivo,
      vencido: esVencido(fila, hoy),
    },
    propio: fila.ejecutivoId === usuarioId,
    archivado: fila.archivadoEn !== null,
    valores: {
      nombre: fila.nombre,
      contacto: fila.contacto,
      comentarios: fila.comentarios,
      estatus: fila.estatus,
      seguimiento: fila.seguimiento ?? "",
    },
  };
}

export type TipoListaVacia = "sin_resultados" | "solo_archivados" | "sin_prospectos" | "sin_archivados";

/**
 * Qué decir cuando la lista no muestra filas: que los filtros no coinciden,
 * que no hay activos pero sí archivados, que no hay ningún prospecto o que no
 * hay archivados.
 */
export function tipoListaVacia(c: { readonly vistaArchivados: boolean; readonly totalSinFiltrar: number; readonly archivados: number }): TipoListaVacia {
  if (c.totalSinFiltrar > 0) return "sin_resultados";
  if (c.vistaArchivados) return "sin_archivados";
  return c.archivados > 0 ? "solo_archivados" : "sin_prospectos";
}
