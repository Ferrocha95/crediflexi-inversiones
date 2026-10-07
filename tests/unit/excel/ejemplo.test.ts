import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { semanaDe } from "../../../src/aplicacion/pipeline/semana";
import { exportarPipeline } from "../../../src/servidor/excel/pipeline";
import { leerLibro, prospecto } from "./ayudas";

// Archivo de ejemplo para revisarlo en Excel, FUERA del repositorio. Solo corre
// con la variable EJEMPLO_EXCEL (ruta del .xlsx), por ejemplo:
//   EJEMPLO_EXCEL=C:\dev\informes\pipeline-ejemplo.xlsx npx vitest run tests/unit/excel/ejemplo.test.ts
// Ocho prospectos sintéticos de los tres estatus.

const RUTA = process.env.EJEMPLO_EXCEL;

const PROSPECTOS = [
  prospecto({ nombre: "Prospecto Sintético Alfa", contacto: "5500000101", comentarios: "Pidió la cotización a 12 meses; llamar para confirmar.", estatus: "INTERESADO", seguimiento: "2026-10-08" }),
  prospecto({ nombre: "Prospecto Sintético Beta", contacto: "5500000102", comentarios: "Cita en sucursal el jueves.", estatus: "INTERESADO", seguimiento: "2026-10-09" }),
  prospecto({ nombre: "Prospecto Sintético Gamma", contacto: "5500000103", comentarios: "Responde a veces; enviar información por correo.", estatus: "INTERMITENTE", seguimiento: "2026-10-13" }),
  prospecto({ nombre: "Prospecto Sintético Delta", contacto: "5500000104", comentarios: "Ya invirtió en otro lado.", estatus: "NO_INTERESADO", seguimiento: null }),
  prospecto({ nombre: "Prospecto Sintético Épsilon", contacto: "5500000105", comentarios: "", estatus: "INTERESADO", seguimiento: "2026-10-15" }),
  prospecto({ nombre: "Prospecto Sintético Zeta", contacto: "5500000106", comentarios: "- llamar el lunes por la mañana", estatus: "INTERMITENTE", seguimiento: "2026-10-12" }),
  prospecto({ nombre: "Prospecto Sintético Eta", contacto: "5500000107", comentarios: "Prefiere WhatsApp.", estatus: "INTERMITENTE", seguimiento: "2026-10-20" }),
  prospecto({ nombre: "Prospecto Sintético Theta", contacto: "5500000108", comentarios: "No le interesa por ahora; volver a intentar en enero.", estatus: "NO_INTERESADO", seguimiento: "2027-01-11" }),
];

describe.skipIf(RUTA === undefined)("ejemplo del Excel del pipeline", () => {
  it("escribe el archivo de ejemplo con 8 prospectos sintéticos", async () => {
    const buffer = await exportarPipeline({ filas: PROSPECTOS, ejecutivo: "Ejecutiva Sintética", semana: semanaDe("2026-10-07") });
    writeFileSync(RUTA!, buffer);
    const hoja = (await leerLibro(buffer)).worksheets[0];
    expect(hoja.getCell("A11").value).toBe("PROSPECTO SINTÉTICO THETA");
  });
});
