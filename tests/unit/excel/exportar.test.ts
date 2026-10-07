import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { nombreArchivoPipeline } from "../../../src/aplicacion/excel/archivo";
import { semanaDe } from "../../../src/aplicacion/pipeline/semana";
import { exportarPipeline, HOJA_PIPELINE } from "../../../src/servidor/excel/pipeline";
import { leerLibro, prospecto } from "./ayudas";

const SEMANA = semanaDe("2026-10-01"); // 28 de septiembre a 2 de octubre de 2026
const FILAS = [
  prospecto({ id: "1", nombre: "José Sintético Uno", contacto: "5500000001", comentarios: "Llamar el lunes", estatus: "INTERESADO", seguimiento: "2026-10-15" }),
  prospecto({ id: "2", nombre: "Ana Sintética Dos", contacto: "5500000002", comentarios: "Responde a veces", estatus: "INTERMITENTE", seguimiento: "2026-01-01" }),
  prospecto({ id: "3", nombre: "Luis Sintético Tres", contacto: "5500000003", estatus: "NO_INTERESADO", seguimiento: null }),
];

async function exportar(filas = FILAS, ejecutivo = "Ejecutiva Sintética Ñúñez") {
  const buffer = await exportarPipeline({ filas, ejecutivo, semana: SEMANA });
  const libro = await leerLibro(buffer);
  const hoja = libro.getWorksheet(HOJA_PIPELINE);
  if (hoja === undefined) throw new Error("Falta la hoja PROSPECTOS SUCURSAL");
  return { buffer, hoja };
}

const argb = (c: ExcelJS.Cell) => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

describe("exportarPipeline: encabezado", () => {
  it("C1, C2 y D1 con sus textos", async () => {
    const { hoja } = await exportar();
    expect(hoja.getCell("C1").value).toBe(" PIPELINE INVERSIONES");
    expect(hoja.getCell("C2").value).toBe("EJECUTIVA SINTÉTICA ÑÚÑEZ");
    expect(hoja.getCell("D1").value).toBe("28 DE SEPTIEMBRE A 2 DE OCTUBRE 2026");
  });

  it("A1:B2 y D1:F2 combinadas", async () => {
    const { hoja } = await exportar();
    const combinadas = (hoja.model as unknown as { merges: string[] }).merges;
    expect([...combinadas].sort()).toEqual(["A1:B2", "D1:F2"]);
  });

  it("fuentes del encabezado: Arial 30 blanco centrado en C1 y D1; Arial 24 blanco en C2", async () => {
    const { hoja } = await exportar();
    for (const ref of ["C1", "D1"]) {
      const c = hoja.getCell(ref);
      expect(c.font).toMatchObject({ name: "Arial", size: 30, color: { argb: "FFFFFFFF" } });
      expect(c.alignment).toMatchObject({ horizontal: "center", vertical: "middle" });
    }
    expect(hoja.getCell("C2").font).toMatchObject({ name: "Arial", size: 24, color: { argb: "FFFFFFFF" } });
  });

  it("el rango de la semana (D1:F2) ajusta el texto: en Arial 30 no cabe en una línea", async () => {
    const { hoja } = await exportar();
    expect(hoja.getCell("D1").alignment).toMatchObject({ wrapText: true });
  });

  it("fondo #012553 en A1:F2 y altos 64.5 y 60", async () => {
    const { hoja } = await exportar();
    for (const r of [1, 2]) for (const col of "ABCDEF") expect(argb(hoja.getCell(`${col}${r}`)), `${col}${r}`).toBe("FF012553");
    expect(hoja.getRow(1).height).toBe(64.5);
    expect(hoja.getRow(2).height).toBe(60);
  });

  it("anchos de columna A 49.1, B 19.1, C 114, D 19.4, E 17.7 y F 29", async () => {
    const { hoja } = await exportar();
    expect([1, 2, 3, 4, 5, 6].map((i) => hoja.getColumn(i).width)).toEqual([49.1, 19.1, 114, 19.4, 17.7, 29]);
  });

  it("la imagen del logo queda anclada en A1:B2", async () => {
    const { hoja } = await exportar();
    const imagenes = hoja.getImages();
    expect(imagenes).toHaveLength(1);
    const { tl, br } = imagenes[0].range;
    expect([tl.nativeCol, tl.nativeRow]).toEqual([0, 0]);
    expect([br.nativeCol, br.nativeRow]).toEqual([2, 2]);
  });

  it("fila 3: encabezados con fondo #DAE9F8 y Arial 12 negrita color #012653, con bordes finos", async () => {
    const { hoja } = await exportar();
    expect([1, 2, 3, 4, 5, 6].map((i) => hoja.getRow(3).getCell(i).value)).toEqual(["NOMBRE", "CONTACTO", "COMENTARIOS", "ESTATUS", "SEGUIMIENTO", "EJECUTIVO"]);
    for (let i = 1; i <= 6; i++) {
      const c = hoja.getRow(3).getCell(i);
      expect(argb(c)).toBe("FFDAE9F8");
      expect(c.font).toMatchObject({ name: "Arial", size: 12, bold: true, color: { argb: "FF012653" } });
      expect(c.border).toMatchObject({ top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } });
    }
  });
});

describe("exportarPipeline: filas de datos", () => {
  it("toda la fila A–F se pinta por estatus", async () => {
    const { hoja } = await exportar();
    const esperado = ["FFA8D08D", "FFFFD965", "FFF4B083"];
    esperado.forEach((color, i) => {
      for (const col of "ABCDEF") expect(argb(hoja.getCell(`${col}${4 + i}`)), `${col}${4 + i}`).toBe(color);
    });
  });

  it("Arial 12 negrita color #012653 y bordes finos en cada celda", async () => {
    const { hoja } = await exportar();
    for (let r = 4; r <= 6; r++) {
      for (let i = 1; i <= 6; i++) {
        const c = hoja.getRow(r).getCell(i);
        expect(c.font, c.address).toMatchObject({ name: "Arial", size: 12, bold: true, color: { argb: "FF012653" } });
        expect(c.border, c.address).toMatchObject({ top: { style: "thin" }, bottom: { style: "thin" } });
      }
    }
  });

  it("nombre y ejecutivo en mayúsculas; estatus con espacio", async () => {
    const { hoja } = await exportar();
    expect(hoja.getCell("A4").value).toBe("JOSÉ SINTÉTICO UNO");
    expect(hoja.getCell("F4").value).toBe("EJECUTIVA SINTÉTICA ÑÚÑEZ");
    expect(hoja.getCell("D6").value).toBe("NO INTERESADO");
  });

  it("contacto como número con formato General", async () => {
    const { hoja } = await exportar();
    expect(hoja.getCell("B4").value).toBe(5500000001);
    expect(hoja.getCell("B4").type).toBe(ExcelJS.ValueType.Number);
    expect(hoja.getCell("B4").numFmt ?? "General").toBe("General");
  });

  it("un contacto que empieza con 0 se escribe como texto para no perder el cero", async () => {
    const { hoja } = await exportar([prospecto({ contacto: "0123456789" })]);
    expect(hoja.getCell("B4").value).toBe("0123456789");
  });

  it("seguimiento como fecha D/M/YYYY que vuelve el mismo día", async () => {
    const { hoja } = await exportar();
    const c = hoja.getCell("E4");
    expect(c.numFmt).toBe("d/m/yyyy");
    expect(c.value).toBeInstanceOf(Date);
    const f = c.value as Date;
    expect([f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()]).toEqual([2026, 10, 15]);
    const enero = hoja.getCell("E5").value as Date;
    expect(enero.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(hoja.getCell("E6").value).toBeNull();
  });

  it("comentarios con ajuste de texto y alineados a la izquierda", async () => {
    const { hoja } = await exportar();
    expect(hoja.getCell("C4").alignment).toMatchObject({ wrapText: true, horizontal: "left" });
    expect(hoja.getCell("C4").value).toBe("Llamar el lunes");
  });

  it("sin prospectos: solo el encabezado y la fila 3", async () => {
    const { hoja } = await exportar([]);
    expect(hoja.getCell("A3").value).toBe("NOMBRE");
    expect(hoja.getCell("A4").value).toBeNull();
  });
});

describe("fórmulas inertes", () => {
  it.each([
    ["=HYPERLINK(\"http://ejemplo.test\",\"clic\")"],
    ["+SUMA(1,2)"],
    ["-2+3"],
    ["@SUMA(1,2)"],
    [" =1+1"],
    ["\t=1+1"],
  ])("el nombre %j se exporta como texto, sin fórmula y con el texto idéntico (en mayúsculas)", async (nombre) => {
    const { hoja } = await exportar([prospecto({ nombre })]);
    const c = hoja.getCell("A4");
    expect(c.type).toBe(ExcelJS.ValueType.String);
    expect(c.formula).toBeUndefined();
    expect(c.value).toBe(nombre.toLocaleUpperCase("es-MX"));
  });

  it("un comentario que empieza con \"- llamar\" conserva exactamente su texto", async () => {
    const { hoja } = await exportar([prospecto({ comentarios: "- llamar el viernes" })]);
    const c = hoja.getCell("C4");
    expect(c.type).toBe(ExcelJS.ValueType.String);
    expect(c.formula).toBeUndefined();
    expect(c.value).toBe("- llamar el viernes");
  });
});

describe("nombreArchivoPipeline", () => {
  it("usa el mes del viernes", () => {
    expect(nombreArchivoPipeline(semanaDe("2026-10-07"))).toBe("PIPELINE_OCTUBRE.xlsx");
  });

  it("una semana que cruza de septiembre a octubre toma octubre", () => {
    expect(nombreArchivoPipeline(SEMANA)).toBe("PIPELINE_OCTUBRE.xlsx");
  });

  it("cruce de año: enero", () => {
    expect(nombreArchivoPipeline(semanaDe("2025-12-30"))).toBe("PIPELINE_ENERO.xlsx");
  });
});
