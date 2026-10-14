"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { esHostLocal } from "../../../aplicacion/host";
import {
  MENSAJES_BIBLIOTECA,
  mensajeDeErrorBase,
  puedeAdministrar,
  validarEnlace,
  validarMetadatos,
  type ErroresBiblioteca,
} from "../../../aplicacion/biblioteca/reglas";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { archivarElemento, insertarElemento } from "../../../servidor/biblioteca/consultas";
import { MENSAJE_HOST_NO_LOCAL } from "../../../servidor/guardiaHost";
import { usuarioActual } from "../../../servidor/sesion";
import { crearClienteServidor } from "../../../servidor/supabase/servidor";

/*
 * Acciones de la Biblioteca: agregar un enlace y archivar. Una acción del
 * servidor es un endpoint público, así que cada una, por su cuenta:
 *   1. repite el guardia de host del proxy (no es seguridad real, ver guardiaHost.ts);
 *   2. exige un usuario activo con usuarioActual() y rol Director o Gerente;
 *   3. valida lo recibido (`unknown`);
 *   4. escribe con la sesión del usuario, así que RLS tiene la última palabra.
 * Nadie borra: se archiva. organizacion_id y subido_por los pone la base.
 * Subir un archivo no es una acción: es la ruta /biblioteca/subir.
 */

export type RespuestaBiblioteca =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly mensaje: string; readonly errores: ErroresBiblioteca };

const RUTA = "/biblioteca";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVES_ENLACE = new Set(["nombre", "descripcion", "categoria", "enlace"]);

const fallo = (mensaje: string, errores: ErroresBiblioteca = {}): RespuestaBiblioteca => ({ ok: false, mensaje, errores });

export async function agregarEnlace(entrada: unknown): Promise<RespuestaBiblioteca> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  if (!puedeAdministrar(usuario.rol)) return fallo(MENSAJES_BIBLIOTECA.soloDirectorOGerente);

  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) return fallo(MENSAJES_BIBLIOTECA.formaInvalida);
  if (Object.keys(entrada).some((clave) => !CLAVES_ENLACE.has(clave))) return fallo(MENSAJES_BIBLIOTECA.formaInvalida);

  const metadatos = validarMetadatos(entrada);
  const enlace = validarEnlace((entrada as Record<string, unknown>).enlace);
  const errores: ErroresBiblioteca = metadatos.ok ? {} : { ...metadatos.errores };
  if (!enlace.ok) errores.enlace = enlace.mensaje;
  if (!metadatos.ok || !enlace.ok) return fallo(Object.values(errores)[0] ?? MENSAJES_BIBLIOTECA.formaInvalida, errores);

  const guardado = await insertarElemento(await crearClienteServidor(), {
    categoria: metadatos.valor.categoria,
    nombre: metadatos.valor.nombre,
    descripcion: metadatos.valor.descripcion,
    tipo: "ENLACE",
    enlace: enlace.url,
  });
  if (!guardado.ok) return fallo(mensajeDeErrorBase(guardado.error).mensaje);
  revalidatePath(RUTA);
  return { ok: true, id: guardado.id };
}

export async function archivar(id: unknown): Promise<RespuestaBiblioteca> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  if (!puedeAdministrar(usuario.rol)) return fallo(MENSAJES_BIBLIOTECA.soloDirectorOGerente);
  if (typeof id !== "string" || !UUID.test(id)) return fallo(MENSAJES_BIBLIOTECA.idInvalido);

  if (!(await archivarElemento(await crearClienteServidor(), id))) return fallo(MENSAJES_BIBLIOTECA.noSeArchivo);
  revalidatePath(RUTA);
  return { ok: true, id };
}
