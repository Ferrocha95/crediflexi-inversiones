import "server-only";
import { MENSAJES_BIBLIOTECA, validarIdCarpeta } from "../../aplicacion/biblioteca/reglas";
import { leerCarpeta } from "./consultas";
import type { crearClienteServidor } from "../supabase/servidor";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export type ResultadoCarpetaDestino = { readonly ok: true; readonly id: string | null } | { readonly ok: false; readonly mensaje: string };

/**
 * Carpeta a la que va un elemento nuevo o movido: ausente, null o "" es Sin
 * carpeta; si no, un uuid de una carpeta que el usuario ve (RLS), activa y de
 * la misma sección. Se revisa antes de escribir para dar un mensaje claro y no
 * dejar un archivo sin fila; la base lo vuelve a revisar (llave compuesta y
 * trigger exigir_carpeta_activa).
 */
export async function carpetaDestino(cliente: Cliente, entrada: unknown, categoria: string): Promise<ResultadoCarpetaDestino> {
  const id = validarIdCarpeta(entrada);
  if (!id.ok) return id;
  if (id.id === null) return { ok: true, id: null };
  const carpeta = await leerCarpeta(cliente, id.id);
  if (carpeta === null || carpeta.categoria !== categoria) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaInvalida };
  if (carpeta.archivada) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaArchivada };
  return { ok: true, id: id.id };
}
