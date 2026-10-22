"use server";

import { headers } from "next/headers";
import { hostAutorizado } from "../../../servidor/guardiaHost";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { usuarioActual } from "../../../servidor/sesion";
import { previsualizarCon, type RespuestaVistaPrevia } from "../../../servidor/vistaPrevia";

/**
 * Vista previa del cotizador. Recibe `unknown` porque una acción del servidor
 * se puede invocar con cualquier POST: la forma se valida adentro. Repite el
 * guardia de host del proxy (no es seguridad real, ver guardiaHost.ts) y exige
 * un usuario activo: el proxy solo confirma que la sesión es válida. No guarda
 * ni registra nada de lo recibido.
 */
export async function previsualizar(campos: unknown): Promise<RespuestaVistaPrevia> {
  const host = (await headers()).get("host");
  // Con Host no local, previsualizarCon responde el mensaje del guardia sin leer la sesión.
  if (hostAutorizado(host) && (await usuarioActual()) === null) {
    return { peticion: numeroDePeticion(campos), plazos: null, resultado: { tipo: "error", mensaje: MENSAJE_SESION_EXPIRADA, detalles: [] } };
  }
  return previsualizarCon(campos, host);
}

/** El número de petición, si viene bien formado, para que la pantalla no descarte la respuesta. */
function numeroDePeticion(campos: unknown): number | null {
  const valor = typeof campos === "object" && campos !== null ? (campos as { peticion?: unknown }).peticion : undefined;
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
}
