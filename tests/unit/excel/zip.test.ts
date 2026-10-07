import { describe, expect, it } from "vitest";
import { MENSAJES_ARCHIVO, TOPES_IMPORTACION } from "../../../src/aplicacion/excel/archivo";
import { revisarZip } from "../../../src/servidor/excel/zip";
import { declararTamano, libroSintetico, reemplazarAscii } from "./ayudas";

describe("revisarZip: índice (directorio central) leído sin dependencias", () => {
  it("un .xlsx normal pasa y se listan sus entradas", async () => {
    const r = revisarZip(await libroSintetico([["Prospecto Sintético", "5512345678", "", "INTERESADO", "", ""]]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entradas).toContain("xl/workbook.xml");
      expect(r.entradas).toContain("docProps/core.xml");
      expect(r.descomprimido).toBeGreaterThan(0);
    }
  });

  it("rechaza un archivo que trae xl/vbaProject.bin (macros)", async () => {
    // docProps/core.xml y xl/vbaProject.bin miden 17 caracteres: se renombra en los bytes, sin escribir un ZIP.
    const conMacros = reemplazarAscii(await libroSintetico([]), "docProps/core.xml", "xl/vbaProject.bin");
    expect(revisarZip(conMacros)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.macros });
  });

  it("también con otra combinación de mayúsculas", async () => {
    const conMacros = reemplazarAscii(await libroSintetico([]), "docProps/core.xml", "XL/VBAPROJECT.BIN");
    expect(revisarZip(conMacros)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.macros });
  });

  it("rechaza si la suma de los tamaños descomprimidos declarados pasa de 50 MB", async () => {
    const inflado = declararTamano(await libroSintetico([]), "xl/workbook.xml", TOPES_IMPORTACION.descomprimido);
    expect(revisarZip(inflado)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.descomprimido });
  });

  it("acepta justo por debajo del tope", async () => {
    const bytes = await libroSintetico([]);
    const r0 = revisarZip(bytes);
    if (!r0.ok) throw new Error("se esperaba un ZIP válido");
    const otros = r0.descomprimido - 1024; // lo que no es xl/workbook.xml, aproximado por arriba
    const casi = declararTamano(bytes, "xl/workbook.xml", TOPES_IMPORTACION.descomprimido - otros - 1024);
    expect(revisarZip(casi).ok).toBe(true);
  });

  it.each([
    ["texto que no es ZIP", new TextEncoder().encode("hola, esto no es un Excel")],
    ["vacío", new Uint8Array()],
  ])("rechaza %s", (_n, bytes) => {
    expect(revisarZip(bytes)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.indice });
  });

  it("rechaza un ZIP cortado (sin el final del directorio central)", async () => {
    const bytes = await libroSintetico([]);
    expect(revisarZip(bytes.subarray(0, bytes.length - 30))).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.indice });
  });
});
