import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProspectoFila } from "../../aplicacion/pipeline/filtros";
import type { Estatus } from "../../aplicacion/pipeline/normalizar";

/**
 * Lecturas del pipeline. Siempre con el cliente de la sesión del usuario
 * (crearClienteServidor), así que RLS decide qué filas ve cada quien: el
 * dueño, sus superiores por la cadena de mando y los directores de su
 * organización. Aquí no se filtra por usuario: eso lo hace la base.
 */

export const MENSAJE_ERROR_LECTURA_PIPELINE =
  "No se pudo leer el pipeline. Recarga la página en unos minutos; si sigue igual, avisa a quien administra el sistema.";

/** Sin nombre visible (por ejemplo, un ejecutivo que ya no está activo). */
export const EJECUTIVO_SIN_NOMBRE = "Sin nombre";

const COLUMNAS =
  "id, ejecutivo_id, nombre, contacto, comentarios, estatus, seguimiento, archivado_en, ejecutivo:usuarios!prospectos_ejecutivo_id_fkey(nombre)";

interface FilaBase {
  id: string;
  ejecutivo_id: string;
  nombre: string;
  contacto: string;
  comentarios: string;
  estatus: Estatus;
  seguimiento: string | null;
  archivado_en: string | null;
  ejecutivo: { nombre: string } | null;
}

/**
 * Prospectos activos (por seguimiento, los que no tienen fecha al final) o
 * archivados (el más reciente primero).
 */
export async function listarProspectos(cliente: SupabaseClient, opciones: { readonly archivados: boolean }): Promise<ProspectoFila[]> {
  const consulta = cliente.from("prospectos").select(COLUMNAS);
  const ordenada = opciones.archivados
    ? consulta.not("archivado_en", "is", null).order("archivado_en", { ascending: false })
    : consulta.is("archivado_en", null).order("seguimiento", { ascending: true, nullsFirst: false });
  const { data, error } = await ordenada.order("creado_en", { ascending: false });
  if (error) throw new Error(MENSAJE_ERROR_LECTURA_PIPELINE);
  return (data as unknown as FilaBase[]).map((f) => ({
    id: f.id,
    ejecutivoId: f.ejecutivo_id,
    ejecutivo: f.ejecutivo?.nombre ?? EJECUTIVO_SIN_NOMBRE,
    nombre: f.nombre,
    contacto: f.contacto,
    comentarios: f.comentarios,
    estatus: f.estatus,
    seguimiento: f.seguimiento,
    archivadoEn: f.archivado_en,
  }));
}

/** Cuántos prospectos archivados puede ver la sesión. */
export async function contarArchivados(cliente: SupabaseClient): Promise<number> {
  const { count, error } = await cliente.from("prospectos").select("id", { count: "exact", head: true }).not("archivado_en", "is", null);
  if (error) throw new Error(MENSAJE_ERROR_LECTURA_PIPELINE);
  return count ?? 0;
}

/** Dueño y estado de un prospecto visible, o null si RLS no lo deja ver (o no existe). */
export async function leerDueno(
  cliente: SupabaseClient,
  id: string,
): Promise<{ readonly ejecutivoId: string; readonly archivadoEn: string | null } | null> {
  const { data, error } = await cliente.from("prospectos").select("ejecutivo_id, archivado_en").eq("id", id).maybeSingle();
  if (error) throw new Error(MENSAJE_ERROR_LECTURA_PIPELINE);
  return data === null ? null : { ejecutivoId: data.ejecutivo_id as string, archivadoEn: data.archivado_en as string | null };
}

export interface EjecutivoVisible {
  readonly id: string;
  readonly nombre: string;
}

/** Usuarios que la sesión puede ver (uno mismo y, para los superiores, su equipo), por nombre. */
export async function ejecutivosVisibles(cliente: SupabaseClient): Promise<EjecutivoVisible[]> {
  const { data, error } = await cliente.from("usuarios").select("id, nombre").order("nombre");
  if (error) throw new Error(MENSAJE_ERROR_LECTURA_PIPELINE);
  return data as EjecutivoVisible[];
}
