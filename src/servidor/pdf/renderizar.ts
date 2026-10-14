import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ModeloPdfComisiones } from "../../aplicacion/comisiones";
import type { ModeloPdf } from "../../aplicacion/modelo";
import type { ModeloReclutamiento } from "../../aplicacion/reclutamiento";
import { DocumentoComisiones } from "./DocumentoComisiones";
import { DocumentoCotizacion } from "./DocumentoCotizacion";
import { DocumentoReclutamiento } from "./DocumentoReclutamiento";
import type { LogoPdf } from "./Encabezado";
import { registrarFuente } from "./fuente";
import { dimensionesPng } from "./png";

/** Los dos logos juntos, en el encabezado de los dos PDF (nombre provisional; se puede reemplazar el archivo). */
export const RUTA_LOGOS = path.join(process.cwd(), "public", "logos-crediflexi-rami-sise.png");

/** El logo como bytes (react-pdf toma una ruta de Windows, C:\..., como URL) con su medida. */
async function leerLogo(): Promise<LogoPdf> {
  const datos = await readFile(RUTA_LOGOS);
  return { datos, ...dimensionesPng(datos) };
}

/** Convierte el modelo en los bytes del PDF. No guarda nada en disco. */
export async function renderizarPdf(modelo: ModeloPdf): Promise<Uint8Array> {
  registrarFuente();
  const bytes = await renderToBuffer(DocumentoCotizacion({ modelo, logo: await leerLogo() }));
  return new Uint8Array(bytes);
}

/** "Propuesta de ingresos" (modo reclutamiento) en bytes. No guarda nada en disco. */
export async function renderizarReclutamiento(modelo: ModeloReclutamiento): Promise<Uint8Array> {
  registrarFuente();
  const bytes = await renderToBuffer(DocumentoReclutamiento({ modelo, logo: await leerLogo() }));
  return new Uint8Array(bytes);
}

/** Simulación de comisiones del mes (Gerente y Ejecutivo) en bytes. No guarda nada en disco. */
export async function renderizarComisiones(modelo: ModeloPdfComisiones): Promise<Uint8Array> {
  registrarFuente();
  const bytes = await renderToBuffer(DocumentoComisiones({ modelo, logo: await leerLogo() }));
  return new Uint8Array(bytes);
}
