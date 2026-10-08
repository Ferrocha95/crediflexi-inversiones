import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ModeloPdf } from "../../aplicacion/modelo";
import type { ModeloReclutamiento } from "../../aplicacion/reclutamiento";
import { DocumentoCotizacion } from "./DocumentoCotizacion";
import { DocumentoReclutamiento } from "./DocumentoReclutamiento";
import { registrarFuente } from "./fuente";

export const RUTA_LOGO = path.join(process.cwd(), "public", "logo-crediflexi.png");
/** Aún no existe (PENDIENTES_TECNICOS.md): mientras falte, el PDF de reclutamiento solo lleva el de Crediflexi. */
export const RUTA_LOGO_RAMI_SISE = path.join(process.cwd(), "public", "logo-rami-sise.png");

/** Convierte el modelo en los bytes del PDF. No guarda nada en disco. */
export async function renderizarPdf(modelo: ModeloPdf): Promise<Uint8Array> {
  registrarFuente();
  // El logo va como bytes: react-pdf toma una ruta de Windows (C:\...) como URL.
  const logo = await readFile(RUTA_LOGO);
  const bytes = await renderToBuffer(DocumentoCotizacion({ modelo, logo }));
  return new Uint8Array(bytes);
}

/** El logo de Rami Sise si el archivo existe; null si no (sin marcador). Otro error sí se lanza. */
async function logoOpcional(ruta: string): Promise<Buffer | null> {
  try {
    return await readFile(ruta);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** "Propuesta de ingresos" (modo reclutamiento) en bytes. No guarda nada en disco. */
export async function renderizarReclutamiento(modelo: ModeloReclutamiento, rutaRamiSise: string = RUTA_LOGO_RAMI_SISE): Promise<Uint8Array> {
  registrarFuente();
  const [crediflexi, ramiSise] = await Promise.all([readFile(RUTA_LOGO), logoOpcional(rutaRamiSise)]);
  const bytes = await renderToBuffer(DocumentoReclutamiento({ modelo, logos: { crediflexi, ramiSise } }));
  return new Uint8Array(bytes);
}
