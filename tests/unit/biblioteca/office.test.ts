import { describe, expect, it } from "vitest";
import { MENSAJES_BIBLIOTECA } from "../../../src/aplicacion/biblioteca/reglas";
import { revisarOffice } from "../../../src/servidor/biblioteca/office";
import { libroSintetico } from "../excel/ayudas";
import { armarZip, type EntradaManual } from "../excel/zipManual";

// DOCX, XLSX y PPTX pasan por la revisión de ZIP existente
// (src/servidor/excel/zip.ts: estructura estricta, sin cifrado, sin ZIP64 y con
// tope real de lo descomprimido) y, además, por las reglas de Office de la
// Biblioteca: la parte principal del tipo y nada de macros, ActiveX ni objetos
// incrustados binarios. Todo con archivos sintéticos.

const texto = (t: string) => new TextEncoder().encode(t);
const tipos = (principal: string) =>
  texto(
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Override PartName="/${principal}" ContentType="application/xml"/></Types>`,
  );

const PRINCIPAL = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" } as const;

function office(ext: keyof typeof PRINCIPAL, extra: EntradaManual[] = []): Uint8Array {
  return armarZip([
    { nombre: "[Content_Types].xml", contenido: tipos(PRINCIPAL[ext]) },
    { nombre: "_rels/.rels", contenido: texto("<Relationships/>") },
    { nombre: PRINCIPAL[ext], contenido: texto("<documento>Contenido sintético</documento>") },
    ...extra,
  ]);
}

describe("revisarOffice", () => {
  for (const ext of ["docx", "xlsx", "pptx"] as const) {
    it(`un ${ext} sintético bien formado se acepta`, () => {
      expect(revisarOffice(office(ext), ext)).toBeNull();
    });
  }

  it("un .xlsx real de exceljs se acepta", async () => {
    const bytes = await libroSintetico([["Prospecto Sintético", "5500000001", "INTERESADO"]]);
    expect(revisarOffice(bytes, "xlsx")).toBeNull();
  });

  it("firma falsa: un PDF llamado .docx se rechaza", () => {
    expect(revisarOffice(texto("%PDF-1.7\nAAAA"), "docx")).toBe(MENSAJES_BIBLIOTECA.firmaNoCoincide("docx"));
  });

  it("extensión engañosa: un .docx llamado .xlsx (o .pptx) se rechaza por no traer su parte principal", () => {
    expect(revisarOffice(office("docx"), "xlsx")).toBe(MENSAJES_BIBLIOTECA.firmaNoCoincide("xlsx"));
    expect(revisarOffice(office("docx"), "pptx")).toBe(MENSAJES_BIBLIOTECA.firmaNoCoincide("pptx"));
  });

  it("un ZIP cualquiera llamado .docx (sin [Content_Types].xml) se rechaza", () => {
    const zip = armarZip([{ nombre: "word/document.xml", contenido: texto("<x/>") }]);
    expect(revisarOffice(zip, "docx")).toBe(MENSAJES_BIBLIOTECA.firmaNoCoincide("docx"));
  });

  it.each([
    ["docx", "word/vbaProject.bin"],
    ["pptx", "ppt/vbaProject.bin"],
    ["xlsx", "xl/vbaProject.bin"],
    ["docx", "word/VBAPROJECT.BIN"],
    ["docx", "customUI/vbaProject.bin"],
    ["docx", "word/vbaData.xml"],
  ] as const)("un %s con macros (%s) se rechaza", (ext, parte) => {
    expect(revisarOffice(office(ext, [{ nombre: parte, contenido: texto("macro") }]), ext)).toBe(MENSAJES_BIBLIOTECA.officeConMacros);
  });

  it("un .docx con controles ActiveX se rechaza", () => {
    const bytes = office("docx", [{ nombre: "word/activeX/activeX1.xml", contenido: texto("<ax/>") }]);
    expect(revisarOffice(bytes, "docx")).toBe(MENSAJES_BIBLIOTECA.officeConActivos);
  });

  it("un .pptx con un objeto incrustado binario (oleObject .bin) se rechaza", () => {
    const bytes = office("pptx", [{ nombre: "ppt/embeddings/oleObject1.bin", contenido: texto("MZ") }]);
    expect(revisarOffice(bytes, "pptx")).toBe(MENSAJES_BIBLIOTECA.officeConActivos);
  });

  it("un .docx con una hoja de Excel incrustada como .xlsx se acepta", () => {
    const bytes = office("docx", [{ nombre: "word/embeddings/Hoja1.xlsx", contenido: texto("PK") }]);
    expect(revisarOffice(bytes, "docx")).toBeNull();
  });

  it("bomba: lo descomprimido pasa del tope real y se rechaza sin mencionar Excel", () => {
    const grande = new Uint8Array(51 * 1024 * 1024);
    const r = revisarOffice(office("docx", [{ nombre: "word/media/bomba.bin.txt", contenido: grande }]), "docx");
    expect(r).toBe(MENSAJES_BIBLIOTECA.officeDanado);
    expect(r).not.toMatch(/Excel|pipeline/);
  });

  it("un ZIP alterado (datos pegados al final) se rechaza con el mensaje de la Biblioteca", () => {
    const zip = armarZip(
      [
        { nombre: "[Content_Types].xml", contenido: tipos(PRINCIPAL.docx) },
        { nombre: PRINCIPAL.docx, contenido: texto("<d/>") },
      ],
      { datosAlFinal: texto("basura") },
    );
    expect(revisarOffice(zip, "docx")).toBe(MENSAJES_BIBLIOTECA.officeDanado);
  });

  it("una entrada cifrada se rechaza", () => {
    const zip = armarZip([
      { nombre: "[Content_Types].xml", contenido: tipos(PRINCIPAL.docx) },
      { nombre: PRINCIPAL.docx, contenido: texto("<d/>"), banderas: 1 },
    ]);
    expect(revisarOffice(zip, "docx")).toBe(MENSAJES_BIBLIOTECA.officeDanado);
  });
});
