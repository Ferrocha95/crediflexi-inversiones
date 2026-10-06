"use server";

import { headers } from "next/headers";
import { previsualizarCon, type RespuestaVistaPrevia } from "../../../servidor/vistaPrevia";

/**
 * Vista previa del cotizador. Recibe `unknown` porque una acción del servidor
 * se puede invocar con cualquier POST: la forma se valida adentro. Repite el
 * guardia de host del proxy (no es seguridad real, ver guardiaHost.ts). No
 * guarda ni registra nada de lo recibido.
 */
export async function previsualizar(campos: unknown): Promise<RespuestaVistaPrevia> {
  const host = (await headers()).get("host");
  return previsualizarCon(campos, host);
}
