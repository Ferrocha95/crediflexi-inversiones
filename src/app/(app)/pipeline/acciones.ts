"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { fechaIsoEnMexico } from "../../../aplicacion/fecha";
import { esHostLocal } from "../../../aplicacion/host";
import { avisosProspecto } from "../../../aplicacion/pipeline/avisos";
import { MENSAJE_FORMA_INVALIDA, validarId, validarProspecto, type ErroresProspecto, type ProspectoValido } from "../../../aplicacion/pipeline/entrada";
import { MENSAJE_ERROR_DESCONOCIDO, mensajeDeErrorBase } from "../../../aplicacion/pipeline/errores";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { MENSAJE_HOST_NO_LOCAL } from "../../../servidor/guardiaHost";
import { leerDueno, listarProspectos } from "../../../servidor/pipeline/consultas";
import { usuarioActual } from "../../../servidor/sesion";
import { crearClienteServidor } from "../../../servidor/supabase/servidor";

/*
 * Acciones del pipeline: crear, editar, archivar y restaurar. Una acción del
 * servidor es un endpoint público, así que cada una, por su cuenta:
 *   1. repite el guardia de host del proxy (no es seguridad real, ver guardiaHost.ts);
 *   2. exige un usuario activo con usuarioActual();
 *   3. valida lo recibido (`unknown`) con Zod;
 *   4. escribe con la sesión del usuario, así que RLS tiene la última palabra.
 * Nadie borra: se archiva. Al crear no se manda ejecutivo_id (lo pone la base).
 */

export type RespuestaPipeline =
  | { readonly ok: true; readonly id: string; readonly avisos: readonly string[] }
  | { readonly ok: false; readonly mensaje: string; readonly errores: ErroresProspecto };

const RUTA = "/pipeline";
const MENSAJE_NO_ENCONTRADO = "No se encontró el prospecto. Puede que ya no exista o que no tengas acceso; recarga la página.";
const MENSAJE_ARCHIVADO = "Este prospecto está archivado. Restáuralo antes de editarlo.";
const MENSAJE_SIN_CAMBIO = "No se guardó el cambio: el prospecto cambió mientras tanto. Recarga la página y vuelve a intentar.";
const SOLO_EL_DUENO = {
  editar: "Solo el dueño puede editar este prospecto.",
  archivar: "Solo el dueño puede archivar este prospecto.",
  restaurar: "Solo el dueño puede restaurar este prospecto.",
} as const;

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

const fallo = (mensaje: string, errores: ErroresProspecto = {}): RespuestaPipeline => ({ ok: false, mensaje, errores });

/** Avisos no bloqueantes, contra los activos que el usuario puede ver ahora. */
async function avisosDe(cliente: Cliente, id: string, p: ProspectoValido): Promise<string[]> {
  try {
    const activos = await listarProspectos(cliente, { archivados: false });
    return avisosProspecto({ id, seguimiento: p.seguimiento, contacto: p.contacto }, { hoy: fechaIsoEnMexico(new Date()), activos });
  } catch {
    return []; // Ya se guardó: no leer los avisos no es motivo para reportar un error.
  }
}

/** Comprueba que el prospecto exista para el usuario y sea suyo. null si puede seguir. */
async function revisarDueno(
  cliente: Cliente,
  id: string,
  usuarioId: string,
  accion: keyof typeof SOLO_EL_DUENO,
): Promise<{ readonly error: RespuestaPipeline } | { readonly error: null; readonly archivado: boolean }> {
  let dueno;
  try {
    dueno = await leerDueno(cliente, id);
  } catch {
    return { error: fallo(MENSAJE_ERROR_DESCONOCIDO) };
  }
  if (dueno === null) return { error: fallo(MENSAJE_NO_ENCONTRADO) };
  if (dueno.ejecutivoId !== usuarioId) return { error: fallo(SOLO_EL_DUENO[accion]) };
  return { error: null, archivado: dueno.archivadoEn !== null };
}

export async function crearProspecto(entrada: unknown): Promise<RespuestaPipeline> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  const v = validarProspecto(entrada);
  if (!v.ok) return fallo(v.mensaje, v.errores);

  const cliente = await crearClienteServidor();
  const { data, error } = await cliente.from("prospectos").insert(v.valor).select("id").single();
  if (error) return fallo(mensajeDeErrorBase(error));
  revalidatePath(RUTA);
  return { ok: true, id: data.id as string, avisos: await avisosDe(cliente, data.id as string, v.valor) };
}

export async function editarProspecto(id: unknown, entrada: unknown): Promise<RespuestaPipeline> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  const prospectoId = validarId(id);
  if (prospectoId === null) return fallo(MENSAJE_FORMA_INVALIDA);
  const v = validarProspecto(entrada);
  if (!v.ok) return fallo(v.mensaje, v.errores);

  const cliente = await crearClienteServidor();
  const revision = await revisarDueno(cliente, prospectoId, usuario.id, "editar");
  if (revision.error !== null) return revision.error;
  if (revision.archivado) return fallo(MENSAJE_ARCHIVADO);

  const { data, error } = await cliente.from("prospectos").update(v.valor).eq("id", prospectoId).is("archivado_en", null).select("id");
  if (error) return fallo(mensajeDeErrorBase(error));
  if (data.length === 0) return fallo(MENSAJE_SIN_CAMBIO);
  revalidatePath(RUTA);
  return { ok: true, id: prospectoId, avisos: await avisosDe(cliente, prospectoId, v.valor) };
}

export async function archivarProspecto(id: unknown): Promise<RespuestaPipeline> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  const prospectoId = validarId(id);
  if (prospectoId === null) return fallo(MENSAJE_FORMA_INVALIDA);

  const cliente = await crearClienteServidor();
  const revision = await revisarDueno(cliente, prospectoId, usuario.id, "archivar");
  if (revision.error !== null) return revision.error;
  if (!revision.archivado) {
    // La hora la pone el servidor; además, un trigger de la base la fija con now().
    const { data, error } = await cliente
      .from("prospectos")
      .update({ archivado_en: new Date().toISOString() })
      .eq("id", prospectoId)
      .is("archivado_en", null)
      .select("id");
    if (error) return fallo(mensajeDeErrorBase(error));
    if (data.length === 0) return fallo(MENSAJE_SIN_CAMBIO);
  }
  revalidatePath(RUTA);
  return { ok: true, id: prospectoId, avisos: [] };
}

export async function restaurarProspecto(id: unknown): Promise<RespuestaPipeline> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  const prospectoId = validarId(id);
  if (prospectoId === null) return fallo(MENSAJE_FORMA_INVALIDA);

  const cliente = await crearClienteServidor();
  const revision = await revisarDueno(cliente, prospectoId, usuario.id, "restaurar");
  if (revision.error !== null) return revision.error;
  if (revision.archivado) {
    const { data, error } = await cliente.from("prospectos").update({ archivado_en: null }).eq("id", prospectoId).select("id");
    if (error) return fallo(mensajeDeErrorBase(error));
    if (data.length === 0) return fallo(MENSAJE_SIN_CAMBIO);
  }
  revalidatePath(RUTA);
  return { ok: true, id: prospectoId, avisos: [] };
}
