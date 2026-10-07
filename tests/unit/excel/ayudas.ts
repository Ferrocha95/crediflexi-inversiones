import ExcelJS from "exceljs";
import type { ProspectoFila } from "../../../src/aplicacion/pipeline/filtros";

// Ayudantes de las pruebas del Excel. Todo es sintético y se genera en memoria:
// ningún .xlsx se versiona.

export const ENCABEZADOS = ["NOMBRE", "CONTACTO", "COMENTARIOS", "ESTATUS", "SEGUIMIENTO", "EJECUTIVO"] as const;

export function prospecto(cambios: Partial<ProspectoFila>): ProspectoFila {
  return {
    id: "p",
    ejecutivoId: "u-1",
    ejecutivo: "Ejecutiva Sintética",
    nombre: "Prospecto Sintético",
    contacto: "5512345678",
    comentarios: "",
    estatus: "INTERESADO",
    seguimiento: null,
    archivadoEn: null,
    ...cambios,
  };
}

export async function leerLibro(bytes: Uint8Array | ArrayBuffer): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes as ArrayBuffer);
  return libro;
}

export type Celda = ExcelJS.CellValue;

/**
 * Un .xlsx sintético con una hoja, los encabezados en la fila indicada y las
 * filas dadas (cada fila, una lista de valores de A a F).
 */
export async function libroSintetico(
  filas: readonly (readonly Celda[])[],
  opciones: { hoja?: string; filaEncabezados?: number; encabezados?: readonly string[] } = {},
): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(opciones.hoja ?? "PROSPECTOS SUCURSAL");
  const inicio = opciones.filaEncabezados ?? 3;
  if (inicio > 1) hoja.getCell("C1").value = " PIPELINE INVERSIONES";
  hoja.getRow(inicio).values = [...(opciones.encabezados ?? ENCABEZADOS)];
  filas.forEach((f, i) => {
    hoja.getRow(inicio + 1 + i).values = [...f];
  });
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

/** Reemplaza en los bytes cada aparición de un texto ASCII por otro del mismo largo. */
export function reemplazarAscii(bytes: Uint8Array, de: string, a: string): Uint8Array {
  if (de.length !== a.length) throw new Error("Los textos deben tener el mismo largo.");
  const salida = new Uint8Array(bytes);
  const busca = Buffer.from(de, "latin1");
  const pone = Buffer.from(a, "latin1");
  let veces = 0;
  for (let i = 0; i <= salida.length - busca.length; i++) {
    let igual = true;
    for (let j = 0; j < busca.length && igual; j++) igual = salida[i + j] === busca[j];
    if (igual) {
      salida.set(pone, i);
      veces += 1;
    }
  }
  if (veces === 0) throw new Error(`No se encontró "${de}" en el archivo.`);
  return salida;
}

/** Fija el tamaño descomprimido declarado de una entrada en el directorio central del ZIP. */
export function declararTamano(bytes: Uint8Array, entrada: string, tamano: number): Uint8Array {
  const salida = new Uint8Array(bytes);
  const vista = new DataView(salida.buffer);
  const nombre = Buffer.from(entrada, "latin1");
  for (let i = 0; i + 46 <= salida.length; i++) {
    if (vista.getUint32(i, true) !== 0x02014b50) continue;
    const largo = vista.getUint16(i + 28, true);
    if (largo === nombre.length && Buffer.from(salida.subarray(i + 46, i + 46 + largo)).equals(nombre)) {
      vista.setUint32(i + 24, tamano, true);
      return salida;
    }
  }
  throw new Error(`No se encontró la entrada ${entrada} en el directorio central.`);
}
