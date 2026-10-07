import { describe, expect, it } from "vitest";
import { MENSAJES_ARCHIVO, TOPES_IMPORTACION } from "../../../src/aplicacion/excel/archivo";
import { semanaDe } from "../../../src/aplicacion/pipeline/semana";
import { analizarArchivo } from "../../../src/servidor/excel/importar";
import { exportarPipeline } from "../../../src/servidor/excel/pipeline";
import { MENSAJES_ZIP, revisarZip } from "../../../src/servidor/excel/zip";
import { declararTamano, libroSintetico, prospecto, reemplazarAscii } from "./ayudas";
import { armarZip, BASICO, cerosComprimidos } from "./zipManual";

const MB = 1024 * 1024;
const rechazo = (mensaje: string) => ({ ok: false, mensaje });
const CTX = { hoy: "2026-10-07", usuario: { nombre: "Ejecutiva Sintética" }, activos: [] };

describe("revisarZip: archivos buenos", () => {
  it("el ZIP armado a mano de referencia pasa (control de las pruebas de abajo)", () => {
    const r = revisarZip(armarZip(BASICO));
    expect(r).toEqual({ ok: true, entradas: ["[Content_Types].xml", "xl/workbook.xml"], descomprimido: 8 + 11 });
  });

  it("también con una entrada guardada sin compresión", () => {
    const r = revisarZip(armarZip([...BASICO, { nombre: "xl/media/a.bin", contenido: Buffer.alloc(100, 7), metodo: 0 }]));
    expect(r).toMatchObject({ ok: true, descomprimido: 8 + 11 + 100 });
  });

  it("el archivo que exporta la propia app pasa la revisión y se importa", async () => {
    const filas = [prospecto({ nombre: "Prospecto Sintético Uno", contacto: "5500000501" })];
    const bytes = new Uint8Array(await exportarPipeline({ filas, ejecutivo: "Ejecutiva Sintética", semana: semanaDe("2026-10-07") }));
    expect(revisarZip(bytes).ok).toBe(true);
    const r = await analizarArchivo(bytes, "PIPELINE_OCTUBRE.xlsx", CTX);
    expect(r.ok && r.filas.map((f) => f.estado)).toEqual(["importable"]);
  });

  it("un .xlsx creado por ExcelJS con 2,000 filas pasa la revisión y se importa", async () => {
    const fila = ["Prospecto Sintético", "5512345678", "", "INTERESADO", "", ""];
    const bytes = await libroSintetico(Array.from({ length: TOPES_IMPORTACION.filas }, () => fila));
    expect(revisarZip(bytes).ok).toBe(true);
    const r = await analizarArchivo(bytes, "pipeline.xlsx", CTX);
    expect(r.ok && r.filas.length).toBe(2000);
  });
});

describe("revisarZip: bombas ZIP (bytes reales, no los declarados)", () => {
  it("una bomba de 60 MB de ceros que declara un tamaño falso pequeño se rechaza por los bytes reales, sin pasar de unos 150 MB de memoria", async () => {
    const picoAntes = process.resourceUsage().maxRSS * 1024;
    const bomba = armarZip([...BASICO, { nombre: "xl/worksheets/sheet1.xml", comprimido: await cerosComprimidos(60), declarado: 1000 }]);
    expect(bomba.length).toBeLessThan(TOPES_IMPORTACION.bytes); // cabe en los 5 MB del archivo
    expect(revisarZip(bomba)).toEqual(rechazo(MENSAJES_ARCHIVO.descomprimido));
    const crecimiento = process.resourceUsage().maxRSS * 1024 - picoAntes;
    expect(crecimiento, "crecimiento del pico de memoria").toBeLessThan(150 * MB);
  });

  it("la misma bomba importada por analizarArchivo se rechaza antes de llegar a ExcelJS", async () => {
    const bomba = armarZip([...BASICO, { nombre: "xl/worksheets/sheet1.xml", comprimido: await cerosComprimidos(60), declarado: 1000 }]);
    expect(await analizarArchivo(bomba, "pipeline.xlsx", CTX)).toEqual(rechazo(MENSAJES_ARCHIVO.descomprimido));
  });

  it("una bomba que declara su tamaño verdadero se rechaza por el tamaño declarado, sin descomprimir", async () => {
    const bomba = armarZip([...BASICO, { nombre: "xl/worksheets/sheet1.xml", comprimido: await cerosComprimidos(60), declarado: 60 * MB }]);
    expect(revisarZip(bomba)).toEqual(rechazo(MENSAJES_ARCHIVO.descomprimido));
  });

  it("el presupuesto es acumulado: una entrada honesta de 30 MB y otra de 30 MB que declara poco suman más de 50 MB reales", async () => {
    const parte = await cerosComprimidos(30);
    const bomba = armarZip([
      { nombre: "xl/a.xml", comprimido: parte, declarado: 30 * MB },
      { nombre: "xl/b.xml", comprimido: parte, declarado: 10 },
    ]);
    expect(revisarZip(bomba)).toEqual(rechazo(MENSAJES_ARCHIVO.descomprimido));
  });

  it("un tamaño declarado distinto del real se rechaza (deflate)", () => {
    const r = revisarZip(armarZip([...BASICO, { nombre: "xl/styles.xml", contenido: Buffer.from("<styleSheet/>"), declarado: 5 }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.tamanoNoCoincide));
  });

  it("un tamaño declarado distinto del real se rechaza (guardado sin compresión)", () => {
    const r = revisarZip(armarZip([...BASICO, { nombre: "xl/media/a.bin", contenido: Buffer.alloc(100), metodo: 0, declarado: 99 }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.tamanoNoCoincide));
  });

  it("un tamaño declarado distinto del real se rechaza en un .xlsx de ExcelJS alterado", async () => {
    const alterado = declararTamano(await libroSintetico([]), "xl/workbook.xml", 3);
    expect(revisarZip(alterado)).toEqual(rechazo(MENSAJES_ZIP.tamanoNoCoincide));
  });

  it("la suma declarada de más de 50 MB se rechaza", async () => {
    const inflado = declararTamano(await libroSintetico([]), "xl/workbook.xml", TOPES_IMPORTACION.descomprimido);
    expect(revisarZip(inflado)).toEqual(rechazo(MENSAJES_ARCHIVO.descomprimido));
  });

  it("datos deflate dañados se rechazan", () => {
    const r = revisarZip(armarZip([...BASICO, { nombre: "xl/styles.xml", comprimido: Buffer.from([0xff, 0xff, 0xff, 0xff]), declarado: 4 }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.danado));
  });
});

describe("revisarZip: el índice no puede diferir del que leería ExcelJS", () => {
  it("datos pegados después del final del ZIP", () => {
    expect(revisarZip(armarZip(BASICO, { datosAlFinal: Buffer.from("datos de más") }))).toEqual(rechazo(MENSAJES_ZIP.finConDatos));
  });

  it("un comentario en el registro de fin", () => {
    expect(revisarZip(armarZip(BASICO, { comentario: "hola" }))).toEqual(rechazo(MENSAJES_ZIP.comentario));
  });

  it("dos registros de fin de directorio", () => {
    expect(revisarZip(armarZip(BASICO, { finDuplicado: true }))).toEqual(rechazo(MENSAJES_ZIP.variosFines));
  });

  it("el número de entradas declarado no coincide con el directorio", () => {
    expect(revisarZip(armarZip(BASICO, { totalDeclarado: 3 }))).toEqual(rechazo(MENSAJES_ZIP.conteoEntradas));
    expect(revisarZip(armarZip(BASICO, { totalDeclarado: 1 }))).toEqual(rechazo(MENSAJES_ZIP.conteoEntradas));
  });

  it("un encabezado local que contradice al directorio en el nombre", () => {
    const r = revisarZip(armarZip([BASICO[0], { nombre: "xl/workbook.xml", nombreLocal: "xl/workbook.xmm", contenido: Buffer.from("<workbook/>") }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.localNoCoincide));
  });

  it("un encabezado local que contradice al directorio en el método", () => {
    const r = revisarZip(armarZip([BASICO[0], { nombre: "xl/workbook.xml", metodoLocal: 0, contenido: Buffer.from("<workbook/>") }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.localNoCoincide));
  });

  it("dos entradas con el mismo nombre", () => {
    expect(revisarZip(armarZip([...BASICO, BASICO[1]]))).toEqual(rechazo(MENSAJES_ZIP.duplicada));
  });

  it("dos entradas con el mismo nombre en distinta combinación de mayúsculas", () => {
    expect(revisarZip(armarZip([...BASICO, { nombre: "XL/Workbook.xml", contenido: Buffer.from("<w/>") }]))).toEqual(rechazo(MENSAJES_ZIP.duplicada));
  });
});

describe("revisarZip: lo que nunca se admite", () => {
  it("una entrada cifrada", () => {
    const r = revisarZip(armarZip([...BASICO, { nombre: "xl/styles.xml", contenido: Buffer.from("<s/>"), banderas: 0x0001 }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.cifrada));
  });

  it("ZIP64", () => {
    const r = revisarZip(armarZip([...BASICO, { nombre: "xl/styles.xml", contenido: Buffer.from("<s/>"), zip64: true }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.zip64));
  });

  it("ZIP64 marcado en el registro de fin", () => {
    expect(revisarZip(armarZip(BASICO, { totalDeclarado: 0xffff }))).toEqual(rechazo(MENSAJES_ZIP.zip64));
  });

  it.each(["../xl/workbook2.xml", "xl/../../fuera.xml", "/xl/abs.xml", "\\xl\\abs.xml", "xl/a..b.xml"])("un nombre de ruta no permitido: %s", (nombre) => {
    const r = revisarZip(armarZip([...BASICO, { nombre, contenido: Buffer.from("<x/>") }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.rutaNoPermitida));
  });

  it("más de 200 entradas", () => {
    const muchas = Array.from({ length: 201 }, (_, i) => ({ nombre: `xl/p${i}.xml`, contenido: Buffer.from("x"), metodo: 0 as const }));
    expect(revisarZip(armarZip(muchas))).toEqual(rechazo(MENSAJES_ZIP.demasiadasEntradas));
  });

  it("200 entradas sí se admiten", () => {
    const justas = Array.from({ length: 200 }, (_, i) => ({ nombre: `xl/p${i}.xml`, contenido: Buffer.from("x"), metodo: 0 as const }));
    expect(revisarZip(armarZip(justas)).ok).toBe(true);
  });

  it("un método de compresión distinto de guardado o deflate", () => {
    const r = revisarZip(armarZip([BASICO[0], { nombre: "xl/x.xml", contenido: Buffer.from("x"), metodo: 0, metodoLocal: 12 }]));
    // El directorio dice 0 y el local 12: lo detecta la comparación; con ambos en 12 lo detecta el método.
    expect(r).toEqual(rechazo(MENSAJES_ZIP.localNoCoincide));
  });

  it("un método de compresión no admitido en los dos encabezados (12, bzip2)", () => {
    const r = revisarZip(armarZip([BASICO[0], { nombre: "xl/x.xml", contenido: Buffer.from("x"), metodo: 0, metodoEscrito: 12 }]));
    expect(r).toEqual(rechazo(MENSAJES_ZIP.metodo));
  });

  it("una macro (xl/vbaProject.bin), en un ZIP armado a mano y en un .xlsx de ExcelJS renombrado", async () => {
    expect(revisarZip(armarZip([...BASICO, { nombre: "xl/vbaProject.bin", contenido: Buffer.from("macro") }]))).toEqual(rechazo(MENSAJES_ARCHIVO.macros));
    const renombrado = reemplazarAscii(await libroSintetico([]), "docProps/core.xml", "XL/VBAPROJECT.BIN");
    expect(revisarZip(renombrado)).toEqual(rechazo(MENSAJES_ARCHIVO.macros));
  });

  it.each([
    ["texto que no es ZIP", new TextEncoder().encode("hola, esto no es un Excel")],
    ["vacío", new Uint8Array()],
  ])("%s: no tiene índice", (_n, bytes) => {
    expect(revisarZip(bytes)).toEqual(rechazo(MENSAJES_ARCHIVO.indice));
  });

  it("un ZIP cortado (sin el final del directorio central)", async () => {
    const bytes = await libroSintetico([]);
    expect(revisarZip(bytes.subarray(0, bytes.length - 30))).toEqual(rechazo(MENSAJES_ARCHIVO.indice));
  });
});
