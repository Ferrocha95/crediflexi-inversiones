"use server";

import { headers } from "next/headers";
import { esHostLocal } from "../../../aplicacion/host";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { simularCon, type RespuestaComisiones } from "../../../servidor/comisiones";
import { usuarioActual } from "../../../servidor/sesion";

/**
 * Simulador de comisiones del mes. Recibe `unknown` porque una acción del
 * servidor se puede invocar con cualquier POST: la forma se valida adentro.
 * Repite el guardia de host del proxy y exige un usuario activo. No guarda ni
 * registra nada de lo recibido.
 */
export async function simular(campos: unknown): Promise<RespuestaComisiones> {
  const host = (await headers()).get("host");
  // Con Host no local, simularCon responde el mensaje del guardia sin leer la sesión.
  if (esHostLocal(host) && (await usuarioActual()) === null) {
    return { peticion: numeroDePeticion(campos), resultado: { tipo: "error", mensaje: MENSAJE_SESION_EXPIRADA, detalles: [] } };
  }
  return simularCon(campos, host);
}

/** El número de petición, si viene bien formado, para que la pantalla no descarte la respuesta. */
function numeroDePeticion(campos: unknown): number | null {
  const valor = typeof campos === "object" && campos !== null ? (campos as { peticion?: unknown }).peticion : undefined;
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
}
