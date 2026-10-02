import { TEXTOS } from "./textosPantalla";

// Lógica pura de la petición del PDF: no importa nada de src/domain, de Next
// ni de React, para probarla sin navegador.

/** Campos escritos a mano que solo se imprimen en el PDF. */
export interface OpcionalesPdf {
  readonly preparadoPara: string;
  readonly ejecutivo: string;
  readonly vigencia: string;
  readonly notaAdicional: string;
}

export interface CamposPdf {
  readonly entidad: string;
  readonly moneda: string;
  readonly esquema: string;
  readonly monto: string;
  readonly plazo: number;
}

/**
 * Cuerpo del POST a /cotizador/pdf. No lleva cifras, tasas ni textos del PDF:
 * el servidor recalcula todo. `versionTasas` es la versión que mostró la
 * vista previa, para que el servidor detecte si las tasas cambiaron.
 */
export function cuerpoPeticionPdf(campos: CamposPdf, opcionales: OpcionalesPdf, versionTasas: string) {
  const conTexto = Object.fromEntries(Object.entries(opcionales).filter(([, v]) => v.trim() !== ""));
  return {
    entidad: campos.entidad,
    moneda: campos.moneda,
    esquema: campos.esquema,
    monto: campos.monto,
    plazo: campos.plazo,
    confirmado: true as const,
    versionTasas,
    ...conTexto,
  };
}

/** El mensaje en español que mandó el servidor ({ error }); si no viene, uno genérico con el código. */
export function mensajeDeErrorPdf(estado: number, cuerpo: unknown): string {
  if (typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo) {
    const { error } = cuerpo as { error: unknown };
    if (typeof error === "string" && error.trim() !== "") return error;
  }
  return TEXTOS.errorPdfGenerico(estado);
}

const RE_NOMBRE = /filename="(cotizacion-\d{4}-\d{2}-\d{2}\.pdf)"/;

/** Nombre del archivo según Content-Disposition; si no tiene la forma esperada, el nombre por omisión. */
export function nombreDeArchivo(contentDisposition: string | null): string {
  return RE_NOMBRE.exec(contentDisposition ?? "")?.[1] ?? TEXTOS.nombrePdfPorOmision;
}

/** Largo en caracteres (no en unidades UTF-16), igual que lo cuenta el servidor. */
export function contarCaracteres(texto: string): number {
  return Array.from(texto).length;
}

/** Corta el texto al tope sin partir caracteres. */
export function recortar(texto: string, tope: number): string {
  const letras = Array.from(texto);
  return letras.length <= tope ? texto : letras.slice(0, tope).join("");
}
