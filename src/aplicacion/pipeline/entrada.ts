import { z } from "zod";
import { limpiarCampo } from "../campos";
import { revisarDatosSensibles } from "./datosSensibles";
import { MENSAJE_COMENTARIOS_LARGO, MENSAJE_NOMBRE_LARGO, MENSAJE_NOMBRE_VACIO, TOPE_COMENTARIOS, TOPE_NOMBRE } from "./errores";
import { normalizarEstatus, normalizarFecha, normalizarTelefono, type Estatus } from "./normalizar";

/**
 * Validación de lo que llega a las acciones del pipeline. Las acciones son
 * endpoints públicos: se recibe `unknown` y se valida la forma con Zod
 * (objeto estricto: un ejecutivo_id u otra clave de más se rechaza), luego
 * cada campo con sus reglas.
 */

export type CampoProspecto = "nombre" | "contacto" | "comentarios" | "estatus" | "seguimiento";
export type ErroresProspecto = Partial<Record<CampoProspecto, string>>;

export interface ProspectoValido {
  readonly nombre: string;
  readonly contacto: string;
  readonly comentarios: string;
  readonly estatus: Estatus;
  readonly seguimiento: string | null;
}

export const MENSAJE_FORMA_INVALIDA = "La petición no tiene la forma esperada. Recarga la página y vuelve a intentar.";
export const MENSAJE_REVISA_CAMPOS = "Revisa los campos marcados.";

/** Largo máximo que se acepta antes de validar: evita procesar textos enormes. */
const LARGO_BRUTO = 5000;
const texto = z.string().max(LARGO_BRUTO);

const ESQUEMA = z.strictObject({
  nombre: texto,
  contacto: texto,
  comentarios: texto,
  estatus: texto,
  seguimiento: texto,
});

export type RespuestaValidacion =
  | { readonly ok: true; readonly valor: ProspectoValido }
  | { readonly ok: false; readonly mensaje: string; readonly errores: ErroresProspecto };

/** Cuenta caracteres, no unidades UTF-16 (como char_length de Postgres). */
const largo = (s: string) => Array.from(s).length;

export function validarProspecto(entrada: unknown): RespuestaValidacion {
  const forma = ESQUEMA.safeParse(entrada);
  if (!forma.success) return { ok: false, mensaje: MENSAJE_FORMA_INVALIDA, errores: {} };
  const e = forma.data;
  const errores: ErroresProspecto = {};

  // Se limpia sin tope para poder avisar del largo en vez de cortar en silencio.
  const nombre = limpiarCampo(e.nombre, LARGO_BRUTO);
  const comentarios = limpiarCampo(e.comentarios, LARGO_BRUTO);
  if (nombre === "") errores.nombre = MENSAJE_NOMBRE_VACIO;
  else if (largo(nombre) > TOPE_NOMBRE) errores.nombre = MENSAJE_NOMBRE_LARGO;
  if (largo(comentarios) > TOPE_COMENTARIOS) errores.comentarios = MENSAJE_COMENTARIOS_LARGO;

  const contacto = normalizarTelefono(e.contacto);
  if (!contacto.ok) errores.contacto = contacto.mensaje;
  const estatus = normalizarEstatus(e.estatus);
  if (!estatus.ok) errores.estatus = estatus.mensaje;
  const seguimiento = normalizarFecha(e.seguimiento);
  if (!seguimiento.ok) errores.seguimiento = seguimiento.mensaje;

  const sensibles = revisarDatosSensibles({ nombre, comentarios });
  if (sensibles.nombre !== undefined) errores.nombre ??= sensibles.nombre;
  if (sensibles.comentarios !== undefined) errores.comentarios ??= sensibles.comentarios;

  if (Object.keys(errores).length > 0 || !contacto.ok || !estatus.ok || !seguimiento.ok) {
    return { ok: false, mensaje: MENSAJE_REVISA_CAMPOS, errores };
  }
  return { ok: true, valor: { nombre, contacto: contacto.valor, comentarios, estatus: estatus.valor, seguimiento: seguimiento.valor } };
}

const ESQUEMA_ID = z.uuid();

/** El id si es un uuid; null si no. */
export function validarId(id: unknown): string | null {
  const r = ESQUEMA_ID.safeParse(id);
  return r.success ? r.data : null;
}
