"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { esHostLocal } from "../../../aplicacion/host";
import {
  CATEGORIAS,
  MENSAJES_BIBLIOTECA,
  TOPE_CARPETAS,
  mensajeDeErrorBase,
  puedeAdministrar,
  validarEnlace,
  validarIdCarpeta,
  validarMetadatos,
  validarNombreCarpeta,
  type ErroresBiblioteca,
} from "../../../aplicacion/biblioteca/reglas";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { carpetaDestino } from "../../../servidor/biblioteca/carpetas";
import {
  archivarElemento,
  archivarFilaCarpeta,
  cambiarCarpeta,
  contarCarpetasActivas,
  insertarCarpeta,
  insertarElemento,
  leerElementoParaMover,
} from "../../../servidor/biblioteca/consultas";
import { MENSAJE_HOST_NO_LOCAL } from "../../../servidor/guardiaHost";
import { usuarioActual } from "../../../servidor/sesion";
import { crearClienteServidor } from "../../../servidor/supabase/servidor";

/*
 * Acciones de la Biblioteca: agregar un enlace, archivar, crear y archivar
 * subcarpetas y mover un elemento a otra carpeta de su sección. Una acción del
 * servidor es un endpoint público, así que cada una, por su cuenta:
 *   1. repite el guardia de host del proxy (no es seguridad real, ver guardiaHost.ts);
 *   2. exige un usuario activo con usuarioActual() y rol Director o Gerente;
 *   3. valida lo recibido (`unknown`);
 *   4. escribe con la sesión del usuario, así que RLS tiene la última palabra.
 * Nadie borra: se archiva. organizacion_id, subido_por y creado_por los pone
 * la base; las claves de más (organizacion_id, creado_por…) se rechazan.
 * Subir un archivo no es una acción: es la ruta /biblioteca/subir.
 */

export type RespuestaBiblioteca =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly mensaje: string; readonly errores: ErroresBiblioteca };

const RUTA = "/biblioteca";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVES_ENLACE = new Set(["nombre", "descripcion", "categoria", "enlace", "carpeta_id"]);
const CLAVES_CARPETA = new Set(["categoria", "nombre"]);
const CLAVES_MOVER = ["carpeta_id", "id"];

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
  const idCarpeta = validarIdCarpeta((entrada as Record<string, unknown>).carpeta_id);
  if (!idCarpeta.ok) return fallo(idCarpeta.mensaje, { carpeta: idCarpeta.mensaje });

  const cliente = await crearClienteServidor();
  const carpeta = await carpetaDestino(cliente, idCarpeta.id, metadatos.valor.categoria);
  if (!carpeta.ok) return fallo(carpeta.mensaje, { carpeta: carpeta.mensaje });

  const guardado = await insertarElemento(cliente, {
    categoria: metadatos.valor.categoria,
    nombre: metadatos.valor.nombre,
    descripcion: metadatos.valor.descripcion,
    tipo: "ENLACE",
    enlace: enlace.url,
    ...(carpeta.id === null ? {} : { carpeta_id: carpeta.id }),
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

export async function crearCarpeta(entrada: unknown): Promise<RespuestaBiblioteca> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  if (!puedeAdministrar(usuario.rol)) return fallo(MENSAJES_BIBLIOTECA.soloDirectorOGerente);

  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) return fallo(MENSAJES_BIBLIOTECA.formaInvalida);
  if (Object.keys(entrada).some((clave) => !CLAVES_CARPETA.has(clave))) return fallo(MENSAJES_BIBLIOTECA.formaInvalida);
  const { categoria, nombre } = entrada as Record<string, unknown>;
  const errores: ErroresBiblioteca = {};
  if (typeof categoria !== "string" || !(CATEGORIAS as readonly string[]).includes(categoria)) errores.categoria = MENSAJES_BIBLIOTECA.categoriaInvalida;
  const limpio = validarNombreCarpeta(nombre);
  if (!limpio.ok) errores.nombre = limpio.mensaje;
  if (!limpio.ok || errores.categoria !== undefined) return fallo(Object.values(errores)[0] ?? MENSAJES_BIBLIOTECA.formaInvalida, errores);

  const cliente = await crearClienteServidor();
  // Tope de carpetas activas por sección: solo en la app (pendiente en la base).
  const activas = await contarCarpetasActivas(cliente, categoria as string);
  if (activas === null) return fallo(MENSAJES_BIBLIOTECA.fallaGuardar);
  if (activas >= TOPE_CARPETAS) return fallo(MENSAJES_BIBLIOTECA.carpetaTope, { nombre: MENSAJES_BIBLIOTECA.carpetaTope });

  const guardada = await insertarCarpeta(cliente, { categoria: categoria as string, nombre: limpio.nombre });
  if (!guardada.ok) {
    const mensaje = mensajeDeErrorBase(guardada.error).mensaje;
    return fallo(mensaje, { nombre: mensaje });
  }
  revalidatePath(RUTA);
  return { ok: true, id: guardada.id };
}

export async function archivarCarpeta(id: unknown): Promise<RespuestaBiblioteca> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  if (!puedeAdministrar(usuario.rol)) return fallo(MENSAJES_BIBLIOTECA.soloDirectorOGerente);
  if (typeof id !== "string" || !UUID.test(id)) return fallo(MENSAJES_BIBLIOTECA.idInvalido);

  const r = await archivarFilaCarpeta(await crearClienteServidor(), id);
  if (!r.ok) return fallo(r.error === null ? MENSAJES_BIBLIOTECA.noSeArchivoCarpeta : mensajeDeErrorBase(r.error).mensaje);
  revalidatePath(RUTA);
  return { ok: true, id };
}

/** Mueve un elemento activo a otra carpeta de su misma sección, o a Sin carpeta (carpeta_id null). */
export async function moverElemento(entrada: unknown): Promise<RespuestaBiblioteca> {
  if (!esHostLocal((await headers()).get("host"))) return fallo(MENSAJE_HOST_NO_LOCAL);
  const usuario = await usuarioActual();
  if (usuario === null) return fallo(MENSAJE_SESION_EXPIRADA);
  if (!puedeAdministrar(usuario.rol)) return fallo(MENSAJES_BIBLIOTECA.soloDirectorOGerente);

  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) return fallo(MENSAJES_BIBLIOTECA.formaInvalida);
  if (Object.keys(entrada).sort().join(",") !== CLAVES_MOVER.join(",")) return fallo(MENSAJES_BIBLIOTECA.formaInvalida);
  const { id, carpeta_id } = entrada as Record<string, unknown>;
  if (typeof id !== "string" || !UUID.test(id)) return fallo(MENSAJES_BIBLIOTECA.idInvalido);
  const idCarpeta = validarIdCarpeta(carpeta_id);
  if (!idCarpeta.ok) return fallo(idCarpeta.mensaje, { carpeta: idCarpeta.mensaje });

  const cliente = await crearClienteServidor();
  const elemento = await leerElementoParaMover(cliente, id);
  if (elemento === null) return fallo(MENSAJES_BIBLIOTECA.noEncontrado);
  if (elemento.archivado) return fallo(MENSAJES_BIBLIOTECA.noSeMovio);
  // La carpeta debe ser de la MISMA sección del elemento (la base lo vuelve a revisar con la llave compuesta).
  const carpeta = await carpetaDestino(cliente, idCarpeta.id, elemento.categoria);
  if (!carpeta.ok) return fallo(carpeta.mensaje, { carpeta: carpeta.mensaje });

  const r = await cambiarCarpeta(cliente, id, carpeta.id);
  if (!r.ok) return fallo(r.error === null ? MENSAJES_BIBLIOTECA.noSeMovio : mensajeDeErrorBase(r.error).mensaje);
  revalidatePath(RUTA);
  return { ok: true, id };
}
