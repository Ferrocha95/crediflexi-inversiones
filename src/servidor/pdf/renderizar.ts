import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ModeloPdf } from "../../aplicacion/modelo";
import { DocumentoCotizacion } from "./DocumentoCotizacion";
import { registrarFuente } from "./fuente";

export const RUTA_LOGO = path.join(process.cwd(), "public", "logo-crediflexi.png");

/** Convierte el modelo en los bytes del PDF. No guarda nada en disco. */
export async function renderizarPdf(modelo: ModeloPdf): Promise<Uint8Array> {
  registrarFuente();
  // El logo va como bytes: react-pdf toma una ruta de Windows (C:\...) como URL.
  const logo = await readFile(RUTA_LOGO);
  const bytes = await renderToBuffer(DocumentoCotizacion({ modelo, logo }));
  return new Uint8Array(bytes);
}
