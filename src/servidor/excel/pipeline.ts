import "server-only";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProspectoFila } from "../../aplicacion/pipeline/filtros";
import { estatusEnPantalla, type Estatus } from "../../aplicacion/pipeline/normalizar";
import { rangoSemanaEnTexto, type Semana } from "../../aplicacion/pipeline/semana";

/**
 * Excel del pipeline con el formato que se manda cada viernes
 * (docs/FORMATOS_EXCEL.md §1): hoja PROSPECTOS SUCURSAL, encabezado azul con
 * el logo, encabezados en la fila 3 y una fila por prospecto, pintada
 * completa según su estatus.
 *
 * Texto que empieza con =, +, - o @: se escribe como cadena (celda de texto),
 * nunca como fórmula, y el texto visible no cambia. exceljs 4.4.0 no soporta
 * quotePrefix (PENDIENTES_TECNICOS.md): la celda es inerte al abrir el
 * archivo, pero si alguien la edita en Excel, Excel puede convertirla.
 */

export const HOJA_PIPELINE = "PROSPECTOS SUCURSAL";
export const TITULO_PIPELINE = " PIPELINE INVERSIONES";
export const ENCABEZADOS_PIPELINE = ["NOMBRE", "CONTACTO", "COMENTARIOS", "ESTATUS", "SEGUIMIENTO", "EJECUTIVO"] as const;

const ANCHOS = [49.1, 19.1, 114.0, 19.4, 17.7, 29.0];
const ALTO_FILA_1 = 64.5;
const ALTO_FILA_2 = 60.0;
const FORMATO_FECHA = "d/m/yyyy";

/** Colores en ARGB (docs/FORMATOS_EXCEL.md). */
const COLOR = {
  encabezado: "FF012553",
  encabezados: "FFDAE9F8",
  texto: "FF012653",
  blanco: "FFFFFFFF",
} as const;

const FONDO_ESTATUS: Record<Estatus, string> = {
  INTERESADO: "FFA8D08D",
  INTERMITENTE: "FFFFD965",
  NO_INTERESADO: "FFF4B083",
};

const RUTA_LOGO = path.join(process.cwd(), "public", "logo-encabezado-excel.png");

const relleno = (argb: string): ExcelJS.FillPattern => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const FINO: Partial<ExcelJS.Border> = { style: "thin" };
const BORDES = { top: FINO, left: FINO, bottom: FINO, right: FINO } as Partial<ExcelJS.Borders>;
const FUENTE_TABLA: Partial<ExcelJS.Font> = { name: "Arial", size: 12, bold: true, color: { argb: COLOR.texto } };

const mayusculas = (s: string) => s.toLocaleUpperCase("es-MX");

/** AAAA-MM-DD -> Date a las 00:00 UTC: exceljs convierte en UTC, así el día no se mueve. */
function fechaUtc(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** El contacto como número (formato General). Con un cero al frente va como texto para no perderlo. */
const contactoParaExcel = (contacto: string): number | string => (/^[1-9][0-9]{9}$/.test(contacto) ? Number(contacto) : contacto);

export async function exportarPipeline(entrada: {
  readonly filas: readonly ProspectoFila[];
  readonly ejecutivo: string;
  readonly semana: Semana;
}): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Crediflexi Inversiones";
  const hoja = libro.addWorksheet(HOJA_PIPELINE);

  ANCHOS.forEach((ancho, i) => {
    hoja.getColumn(i + 1).width = ancho;
  });
  hoja.getRow(1).height = ALTO_FILA_1;
  hoja.getRow(2).height = ALTO_FILA_2;

  // Encabezado azul (A1:F2).
  for (const r of [1, 2]) for (let c = 1; c <= 6; c++) hoja.getRow(r).getCell(c).fill = relleno(COLOR.encabezado);
  hoja.mergeCells("A1:B2");
  hoja.mergeCells("D1:F2");

  const titulo = hoja.getCell("C1");
  titulo.value = TITULO_PIPELINE;
  titulo.font = { name: "Arial", size: 30, color: { argb: COLOR.blanco } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };

  const ejecutivo = hoja.getCell("C2");
  ejecutivo.value = mayusculas(entrada.ejecutivo);
  ejecutivo.font = { name: "Arial", size: 24, color: { argb: COLOR.blanco } };
  ejecutivo.alignment = { vertical: "middle" };

  const rango = hoja.getCell("D1");
  rango.value = rangoSemanaEnTexto(entrada.semana);
  rango.font = { name: "Arial", size: 30, color: { argb: COLOR.blanco } };
  // En Arial 30 el rango no cabe en una línea de D:F: se ajusta en las dos filas combinadas.
  rango.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const logo = libro.addImage({ buffer: readFileSync(RUTA_LOGO) as unknown as ExcelJS.Buffer, extension: "png" });
  hoja.addImage(logo, "A1:B2");

  // Fila 3: encabezados.
  const encabezados = hoja.getRow(3);
  ENCABEZADOS_PIPELINE.forEach((texto, i) => {
    const c = encabezados.getCell(i + 1);
    c.value = texto;
    c.font = FUENTE_TABLA;
    c.fill = relleno(COLOR.encabezados);
    c.border = BORDES;
  });

  // Desde la fila 4: un prospecto por fila.
  entrada.filas.forEach((p, i) => {
    const fila = hoja.getRow(4 + i);
    const valores: ExcelJS.CellValue[] = [
      mayusculas(p.nombre),
      contactoParaExcel(p.contacto),
      p.comentarios,
      estatusEnPantalla(p.estatus),
      p.seguimiento === null ? null : fechaUtc(p.seguimiento),
      // Un archivo lleva a un solo ejecutivo: el mismo nombre de C2.
      mayusculas(entrada.ejecutivo),
    ];
    valores.forEach((valor, j) => {
      const c = fila.getCell(j + 1);
      c.value = valor; // Una cadena siempre es texto: exceljs solo escribe fórmulas con { formula }.
      c.font = FUENTE_TABLA;
      c.fill = relleno(FONDO_ESTATUS[p.estatus]);
      c.border = BORDES;
    });
    fila.getCell(2).numFmt = "General";
    fila.getCell(3).alignment = { wrapText: true, horizontal: "left", vertical: "top" };
    fila.getCell(5).numFmt = FORMATO_FECHA;
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}
