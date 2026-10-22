import "server-only";
import type { FilaBiblioteca, FilaCarpeta } from "../../aplicacion/biblioteca/vista";
import type { crearClienteServidor } from "../supabase/servidor";

/**
 * Consultas de la Biblioteca, siempre con la sesión del usuario (RLS y las
 * políticas del bucket tienen la última palabra). Nunca con una llave de
 * servicio. El bucket es privado: los archivos se leen con una URL firmada de
 * vida corta que crea el servidor y que nunca llega al navegador.
 */

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export const BUCKET = "biblioteca";
/** Vida de la URL firmada, en segundos: solo la usa el servidor para reenviar los bytes. */
export const VIDA_URL_FIRMADA = 60;

export interface FilaNueva {
  readonly categoria: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly tipo: "ARCHIVO" | "ENLACE";
  readonly enlace?: string;
  readonly ruta?: string;
  readonly tipo_mime?: string;
  readonly tamano_bytes?: number;
  /** Subcarpeta de la misma sección; sin ella, Sin carpeta. */
  readonly carpeta_id?: string | null;
}

type ErrorBase = { code?: string; message: string };

export interface ElementoArchivo {
  readonly nombre: string;
  readonly tipo: string;
  readonly ruta: string | null;
  readonly tipo_mime: string | null;
}

export const MAXIMO_FILAS = 1000;

/**
 * Elementos visibles para el usuario: RLS ya decide (su organización; lo
 * archivado, solo Director y Gerente). Lanza si la lectura falla.
 */
export async function listarElementos(cliente: Cliente): Promise<FilaBiblioteca[]> {
  const { data, error } = await cliente
    .from("biblioteca")
    .select("id, categoria, nombre, descripcion, tipo, enlace, ruta, tipo_mime, tamano_bytes, subido_por_nombre, creado_en, archivado_en, carpeta_id")
    .order("creado_en", { ascending: false })
    .limit(MAXIMO_FILAS);
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaBiblioteca[];
}

/** Organización del usuario (RLS solo devuelve la propia); null si no hay una sola. */
export async function organizacionDelUsuario(cliente: Cliente): Promise<string | null> {
  const { data, error } = await cliente.from("organizaciones").select("id").limit(2);
  if (error || data === null || data.length !== 1) return null;
  return data[0].id as string;
}

/** Sube el objeto sin reemplazar nada (upsert: false). null si salió bien; si no, el error. */
export async function subirObjeto(cliente: Cliente, ruta: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  const { error } = await cliente.storage.from(BUCKET).upload(ruta, bytes, { contentType: mime, upsert: false });
  return error === null ? null : error.message;
}

/** Inserta la fila. organizacion_id y subido_por los pone la base. */
export async function insertarElemento(
  cliente: Cliente,
  fila: FilaNueva,
): Promise<{ readonly ok: true; readonly id: string } | { readonly ok: false; readonly error: { code?: string; message: string } }> {
  const { data, error } = await cliente.from("biblioteca").insert(fila).select("id").single();
  if (error || data === null) return { ok: false, error: { code: error?.code, message: error?.message ?? "sin fila" } };
  return { ok: true, id: data.id as string };
}

/** Archiva (la hora la pone la base). true si se archivó una fila. */
export async function archivarElemento(cliente: Cliente, id: string): Promise<boolean> {
  const { data, error } = await cliente
    .from("biblioteca")
    .update({ archivado_en: new Date().toISOString() })
    .eq("id", id)
    .is("archivado_en", null)
    .select("id");
  return error === null && data !== null && data.length === 1;
}

/** Fila visible para el usuario (RLS); null si no existe o no la puede ver. Lanza si la lectura falla. */
export async function leerElemento(cliente: Cliente, id: string): Promise<ElementoArchivo | null> {
  const { data, error } = await cliente.from("biblioteca").select("nombre, tipo, ruta, tipo_mime").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ElementoArchivo | null) ?? null;
}

// --- Carpetas ------------------------------------------------------------------

/**
 * Carpetas visibles para el usuario: RLS ya decide (su organización; las
 * archivadas, solo Director y Gerente). Lanza si la lectura falla.
 */
export async function listarCarpetas(cliente: Cliente): Promise<FilaCarpeta[]> {
  const { data, error } = await cliente
    .from("biblioteca_carpetas")
    .select("id, categoria, nombre, archivado_en")
    .order("nombre", { ascending: true })
    .limit(MAXIMO_FILAS);
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaCarpeta[];
}

/** Carpeta visible para el usuario (RLS): su sección y si está archivada; null si no la ve o la lectura falla. */
export async function leerCarpeta(cliente: Cliente, id: string): Promise<{ readonly categoria: string; readonly archivada: boolean } | null> {
  const { data, error } = await cliente.from("biblioteca_carpetas").select("categoria, archivado_en").eq("id", id).maybeSingle();
  if (error || data === null) return null;
  return { categoria: data.categoria as string, archivada: data.archivado_en !== null };
}

/** Carpetas activas de una sección (las que ve el usuario); null si no se pudo contar. */
export async function contarCarpetasActivas(cliente: Cliente, categoria: string): Promise<number | null> {
  const { count, error } = await cliente
    .from("biblioteca_carpetas")
    .select("id", { count: "exact", head: true })
    .eq("categoria", categoria)
    .is("archivado_en", null);
  return error || count === null ? null : count;
}

/** Inserta la carpeta. organizacion_id y creado_por los pone la base. */
export async function insertarCarpeta(
  cliente: Cliente,
  fila: { readonly categoria: string; readonly nombre: string },
): Promise<{ readonly ok: true; readonly id: string } | { readonly ok: false; readonly error: ErrorBase }> {
  const { data, error } = await cliente.from("biblioteca_carpetas").insert(fila).select("id").single();
  if (error || data === null) return { ok: false, error: { code: error?.code, message: error?.message ?? "sin fila" } };
  return { ok: true, id: data.id as string };
}

/**
 * Archiva la carpeta (la hora la pone la base; el trigger la rechaza si tiene
 * elementos activos). error null: no se archivó ninguna fila.
 */
export async function archivarFilaCarpeta(
  cliente: Cliente,
  id: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: ErrorBase | null }> {
  const { data, error } = await cliente
    .from("biblioteca_carpetas")
    .update({ archivado_en: new Date().toISOString() })
    .eq("id", id)
    .is("archivado_en", null)
    .select("id");
  if (error) return { ok: false, error: { code: error.code, message: error.message } };
  return data !== null && data.length === 1 ? { ok: true } : { ok: false, error: null };
}

/** Elemento visible para el usuario (RLS): su sección y si está archivado; null si no lo ve o la lectura falla. */
export async function leerElementoParaMover(cliente: Cliente, id: string): Promise<{ readonly categoria: string; readonly archivado: boolean } | null> {
  const { data, error } = await cliente.from("biblioteca").select("categoria, archivado_en").eq("id", id).maybeSingle();
  if (error || data === null) return null;
  return { categoria: data.categoria as string, archivado: data.archivado_en !== null };
}

/**
 * Cambia la carpeta de un elemento activo (null: Sin carpeta). La llave
 * compuesta impide salir de la sección. error null: no se movió ninguna fila.
 */
export async function cambiarCarpeta(
  cliente: Cliente,
  id: string,
  carpeta: string | null,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: ErrorBase | null }> {
  const { data, error } = await cliente
    .from("biblioteca")
    .update({ carpeta_id: carpeta })
    .eq("id", id)
    .is("archivado_en", null)
    .select("id");
  if (error) return { ok: false, error: { code: error.code, message: error.message } };
  return data !== null && data.length === 1 ? { ok: true } : { ok: false, error: null };
}

/** URL firmada de vida corta, creada con la sesión del usuario (pasa por la política de lectura del bucket). */
export async function firmarDescarga(cliente: Cliente, ruta: string): Promise<string | null> {
  const { data, error } = await cliente.storage.from(BUCKET).createSignedUrl(ruta, VIDA_URL_FIRMADA);
  return error === null && data !== null ? data.signedUrl : null;
}
