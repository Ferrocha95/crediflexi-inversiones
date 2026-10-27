import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { MENSAJES_ARCHIVO, TOPES_IMPORTACION } from "../../../src/aplicacion/excel/archivo";
import { semanaDe } from "../../../src/aplicacion/pipeline/semana";
import { analizarArchivo, type ContextoImportacion } from "../../../src/servidor/excel/importar";
import { exportarPipeline } from "../../../src/servidor/excel/pipeline";
import { libroSintetico, prospecto, reemplazarAscii } from "./ayudas";

const CTX: ContextoImportacion = {
  hoy: "2026-10-07",
  usuario: { nombre: "Ejecutiva Sintética" },
  activos: [{ id: "a-1", nombre: "Prospecto Sintético Activo", contacto: "5500000001" }],
};

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function analizar(filas: Parameters<typeof libroSintetico>[0], opciones?: Parameters<typeof libroSintetico>[1], nombre = "pipeline.xlsx") {
  return analizarArchivo(await libroSintetico(filas, opciones), nombre, CTX);
}

async function filasDe(filas: Parameters<typeof libroSintetico>[0], opciones?: Parameters<typeof libroSintetico>[1]) {
  const r = await analizar(filas, opciones);
  if (!r.ok) throw new Error(`Se esperaba un análisis correcto: ${r.mensaje}`);
  return r;
}

describe("analizarArchivo: datos sucios del pipeline real (sintéticos)", () => {
  const FILAS: ExcelJS.CellValue[][] = [
    ["Prospecto Sintético Uno", 5512345678, "", "INTERMITENTE ", fecha("2026-10-15"), ""],
    ["Prospecto Sintético Dos", "55-1234-5679", "CLABE 002180701234567891", "INTERESADO", "", "Ejecutiva Sintética"],
    ["Prospecto Sintético Tres", "5512340000", "", "NO INTERESADO", "15/10/2025", "Otro Ejecutivo"],
    ["Prospecto Sintético Cuatro", { formula: "1+1", result: 2 }, "", "INTERESADO", "", ""],
    ['=HYPERLINK("http://ejemplo.test")', "5512340001", "", "INTERESADO", 46310, ""],
    ["Prospecto Sintético Seis", "5512345678", "", "INTERESADO", "", ""],
    ["Prospecto Sintético Siete", "5500000001", "", "INTERESADO", "", ""],
    ["PROSPECTO SINTÉTICO OCHO", "+52 55 1234 0002", "- llamar el lunes", "interesado", "2026-10-20", "EJECUTIVA SINTÉTICA"],
    [null, null, null, null, null, null],
  ];

  it("una fila del reporte por cada fila con datos, con su número de fila de Excel", async () => {
    const r = await filasDe(FILAS);
    expect(r.hoja).toBe("PROSPECTOS SUCURSAL");
    expect(r.filas.map((f) => f.fila)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(r.conteo).toEqual({ total: 8, importables: 3, conAviso: 3, rechazadas: 2 });
  });

  it("estatus con espacio al final, teléfono guardado como número, fecha como Date y sin ejecutivo", async () => {
    const f = (await filasDe(FILAS)).filas[0];
    expect(f).toMatchObject({
      estado: "importable",
      datos: { nombre: "Prospecto Sintético Uno", contacto: "5512345678", comentarios: "", estatus: "INTERMITENTE", seguimiento: "2026-10-15" },
      motivo: null,
    });
    expect(f.correcciones).toEqual(['El estatus "INTERMITENTE " se corrigió a INTERMITENTE.', "Sin ejecutivo: queda a tu nombre."]);
  });

  it("CLABE en comentarios: rechazada por el guardia de datos sensibles", async () => {
    const f = (await filasDe(FILAS)).filas[1];
    expect(f.estado).toBe("rechazada");
    expect(f.datos).toBeNull();
    expect(f.motivo).toContain("Los comentarios parecen incluir una CLABE.");
  });

  it("seguimiento de 2025 y otro ejecutivo: se importa con aviso y la fila queda a nombre de quien importa", async () => {
    const f = (await filasDe(FILAS)).filas[2];
    expect(f.estado).toBe("con_aviso");
    expect(f.datos).toMatchObject({ estatus: "NO_INTERESADO", seguimiento: "2025-10-15" });
    expect(f.avisos).toEqual(["La fecha de seguimiento (15/10/2025) es de otro año. Revisa que sea correcta; puedes guardar de todos modos."]);
    expect(f.correcciones).toEqual(['El ejecutivo "Otro Ejecutivo" se cambió por ti: todo lo importado queda a tu nombre.']);
  });

  it("una fila con una celda de fórmula se rechaza con el nombre de la celda", async () => {
    const f = (await filasDe(FILAS)).filas[3];
    expect(f).toMatchObject({ estado: "rechazada", datos: null, motivo: "la celda B7 tiene una fórmula" });
  });

  it("un texto que empieza con = no es fórmula: se importa como texto; la fecha como número de serie se lee", async () => {
    const f = (await filasDe(FILAS)).filas[4];
    expect(f.estado).toBe("importable");
    expect(f.datos).toMatchObject({ nombre: '=HYPERLINK("http://ejemplo.test")', seguimiento: "2026-10-15" });
    expect(f.correcciones).toContain("El seguimiento venía como número de serie de Excel (46310) y se leyó como 15/10/2026.");
  });

  it("teléfono repetido dentro del archivo: se importa con aviso", async () => {
    const f = (await filasDe(FILAS)).filas[5];
    expect(f.estado).toBe("con_aviso");
    expect(f.avisos).toEqual(["El teléfono 55 1234 5678 se repite en la fila 4 del archivo. Se importa de todos modos."]);
  });

  it("teléfono repetido contra los activos visibles: se importa con aviso", async () => {
    const f = (await filasDe(FILAS)).filas[6];
    expect(f.estado).toBe("con_aviso");
    expect(f.avisos).toEqual([
      "El teléfono 55 0000 0001 ya está en otro prospecto activo (Prospecto Sintético Activo). Puedes guardar de todos modos.",
    ]);
  });

  it("nombre en mayúsculas tal cual, teléfono con +52 y espacios, estatus en minúsculas, comentario con guion y el mismo ejecutivo", async () => {
    const f = (await filasDe(FILAS)).filas[7];
    expect(f.estado).toBe("importable");
    expect(f.datos).toEqual({
      nombre: "PROSPECTO SINTÉTICO OCHO",
      contacto: "5512340002",
      comentarios: "- llamar el lunes",
      estatus: "INTERESADO",
      seguimiento: "2026-10-20",
    });
    expect(f.correcciones).toEqual(['El teléfono "+52 55 1234 0002" se corrigió a 5512340002.', 'El estatus "interesado" se corrigió a INTERESADO.']);
  });
});

describe("analizarArchivo: hoja y encabezados", () => {
  it("busca la fila de encabezados por texto, aunque no esté en la fila 3, y usa la primera hoja si no hay PROSPECTOS SUCURSAL", async () => {
    const r = await filasDe([["Prospecto Sintético", "5512345678", "", "INTERESADO", "", ""]], { hoja: "Hoja1", filaEncabezados: 1 });
    expect(r.hoja).toBe("Hoja1");
    expect(r.filas[0]).toMatchObject({ fila: 2, estado: "importable" });
  });

  it("acepta las columnas en otro orden y sin las opcionales", async () => {
    const r = await filasDe([["INTERESADO", "Prospecto Sintético", "5512345678"]], { encabezados: ["ESTATUS ", "nombre", "Contacto"] });
    expect(r.filas[0].datos).toEqual({ nombre: "Prospecto Sintético", contacto: "5512345678", comentarios: "", estatus: "INTERESADO", seguimiento: "" });
  });

  it("sin la fila de encabezados: mensaje que dice qué columnas faltan", async () => {
    const r = await analizar([["x"]], { encabezados: ["A", "B", "C"] });
    expect(r).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.sinEncabezados });
  });

  it("2,000 filas se aceptan y 2,001 se rechazan", async () => {
    const fila = ["Prospecto Sintético", "5512345678", "", "INTERESADO", "", ""];
    const dosMil = await analizar(Array.from({ length: TOPES_IMPORTACION.filas }, () => fila));
    expect(dosMil.ok).toBe(true);
    const demasiadas = await analizar(Array.from({ length: TOPES_IMPORTACION.filas + 1 }, () => fila));
    expect(demasiadas).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.demasiadasFilas });
  });
});

describe("analizarArchivo: rechazos del archivo", () => {
  it("más de 4 MiB (4 MiB + 1 byte)", async () => {
    const grande = new Uint8Array(TOPES_IMPORTACION.bytes + 1);
    grande.set([0x50, 0x4b, 0x03, 0x04]);
    expect(await analizarArchivo(grande, "pipeline.xlsx", CTX)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.muyGrande });
  });

  it("un archivo que no es ZIP", async () => {
    expect(await analizarArchivo(new TextEncoder().encode("NOMBRE,CONTACTO\n"), "pipeline.xlsx", CTX)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.noZip });
  });

  it.each(["pipeline.xls", "pipeline.xlsm", "pipeline.csv", "pipeline"])("extensión %s", async (nombre) => {
    expect(await analizarArchivo(await libroSintetico([]), nombre, CTX)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.noXlsx });
  });

  it("un ZIP con xl/vbaProject.bin", async () => {
    const conMacros = reemplazarAscii(await libroSintetico([]), "docProps/core.xml", "xl/vbaProject.bin");
    expect(await analizarArchivo(conMacros, "pipeline.xlsx", CTX)).toEqual({ ok: false, mensaje: MENSAJES_ARCHIVO.macros });
  });
});

describe("ida y vuelta: exportar e importar el resultado", () => {
  it("los datos coinciden (el nombre vuelve en mayúsculas, como se exporta) y no hay correcciones", async () => {
    const originales = [
      prospecto({ nombre: "José Sintético Uno", contacto: "5500000301", comentarios: "- llamar el lunes", estatus: "INTERESADO", seguimiento: "2026-10-15" }),
      prospecto({ nombre: "=HYPERLINK(\"http://ejemplo.test\")", contacto: "5500000302", comentarios: "+ interesada", estatus: "INTERMITENTE", seguimiento: "2026-12-31" }),
      prospecto({ nombre: "Luis Sintético Tres", contacto: "5500000303", comentarios: "", estatus: "NO_INTERESADO", seguimiento: null }),
    ];
    const buffer = await exportarPipeline({ filas: originales, ejecutivo: "Ejecutiva Sintética", semana: semanaDe("2026-10-07") });
    const r = await analizarArchivo(new Uint8Array(buffer), "PIPELINE_OCTUBRE.xlsx", { ...CTX, activos: [] });
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.filas.map((f) => f.estado)).toEqual(["importable", "importable", "importable"]);
    expect(r.filas.map((f) => f.correcciones)).toEqual([[], [], []]);
    expect(r.filas.map((f) => f.datos)).toEqual(
      originales.map((p) => ({
        nombre: p.nombre.toLocaleUpperCase("es-MX"),
        contacto: p.contacto,
        comentarios: p.comentarios,
        estatus: p.estatus,
        seguimiento: p.seguimiento ?? "",
      })),
    );
  });
});
