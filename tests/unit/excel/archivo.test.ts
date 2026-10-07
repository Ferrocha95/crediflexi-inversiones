import { describe, expect, it } from "vitest";
import { resumenImportacion, TOPES_IMPORTACION } from "../../../src/aplicacion/excel/archivo";

describe("resumenImportacion", () => {
  it.each([
    [{ total: 3, importables: 2, conAviso: 0, rechazadas: 1 }, "3 filas: 2 se importan y 1 no se importa."],
    [{ total: 8, importables: 3, conAviso: 3, rechazadas: 2 }, "8 filas: 3 se importan, 3 se importan con aviso y 2 no se importan."],
    [{ total: 1, importables: 1, conAviso: 0, rechazadas: 0 }, "1 fila: 1 se importa."],
    [{ total: 1, importables: 0, conAviso: 1, rechazadas: 0 }, "1 fila: 1 se importa con aviso."],
    [{ total: 2, importables: 0, conAviso: 0, rechazadas: 2 }, "2 filas: 2 no se importan."],
    [{ total: 0, importables: 0, conAviso: 0, rechazadas: 0 }, "El archivo no tiene filas de prospectos debajo de los encabezados."],
  ])("%j", (conteo, texto) => {
    expect(resumenImportacion(conteo)).toBe(texto);
  });
});

describe("TOPES_IMPORTACION", () => {
  it("5 MB, 50 MB descomprimidos y 2,000 filas", () => {
    expect(TOPES_IMPORTACION).toEqual({ bytes: 5 * 1024 * 1024, descomprimido: 50 * 1024 * 1024, filas: 2000 });
  });
});
