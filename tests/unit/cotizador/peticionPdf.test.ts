import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contarCaracteres,
  cuerpoPeticionPdf,
  mensajeDeErrorPdf,
  nombreDeArchivo,
  recortar,
  type OpcionalesPdf,
} from "../../../src/app/(app)/cotizador/peticionPdf";
import { TEXTOS } from "../../../src/app/(app)/cotizador/textosPantalla";

const CAMPOS = { entidad: "RAMI_SISE", moneda: "MXN", esquema: "final_del_plazo", monto: "1,500,000", plazo: 12 } as const;
const VACIOS: OpcionalesPdf = { preparadoPara: "", ejecutivo: "", vigencia: "", notaAdicional: "" };

describe("cuerpoPeticionPdf", () => {
  it("manda los campos, confirmado: true y la versión de las tasas de la vista previa", () => {
    expect(cuerpoPeticionPdf(CAMPOS, VACIOS, "0.5")).toEqual({
      entidad: "RAMI_SISE",
      moneda: "MXN",
      esquema: "final_del_plazo",
      monto: "1,500,000",
      plazo: 12,
      confirmado: true,
      versionTasas: "0.5",
    });
  });

  it("los opcionales viajan solo si tienen texto", () => {
    const cuerpo = cuerpoPeticionPdf(
      CAMPOS,
      { preparadoPara: "Persona Sintética Uno", ejecutivo: "  ", vigencia: "15 días naturales", notaAdicional: "" },
      "0.5",
    );
    expect(cuerpo).toMatchObject({ preparadoPara: "Persona Sintética Uno", vigencia: "15 días naturales" });
    expect(cuerpo).not.toHaveProperty("ejecutivo");
    expect(cuerpo).not.toHaveProperty("notaAdicional");
  });

  it("no manda cifras, tasa ni textos del PDF", () => {
    const claves = Object.keys(
      cuerpoPeticionPdf(CAMPOS, { preparadoPara: "a", ejecutivo: "b", vigencia: "c", notaAdicional: "d" }, "0.5"),
    ).sort();
    expect(claves).toEqual(
      [
        "confirmado",
        "ejecutivo",
        "entidad",
        "esquema",
        "monto",
        "moneda",
        "notaAdicional",
        "plazo",
        "preparadoPara",
        "versionTasas",
        "vigencia",
      ].sort(),
    );
  });
});

describe("mensajeDeErrorPdf", () => {
  it("usa el mensaje en español que manda el servidor", () => {
    expect(mensajeDeErrorPdf(422, { error: "El plazo no está disponible." })).toBe("El plazo no está disponible.");
  });

  it("el 409 muestra el mensaje del servidor sobre las tasas", () => {
    expect(mensajeDeErrorPdf(409, { error: "Las tasas cambiaron desde tu vista previa; vuelve a revisarla." })).toBe(
      "Las tasas cambiaron desde tu vista previa; vuelve a revisarla.",
    );
  });

  it.each([
    ["sin cuerpo", undefined],
    ["texto plano", "Prohibido"],
    ["sin error", { mensaje: "otro" }],
    ["error vacío", { error: "" }],
    ["error no textual", { error: 5 }],
  ])("%s: mensaje genérico con el código", (_, cuerpo) => {
    expect(mensajeDeErrorPdf(403, cuerpo)).toBe(TEXTOS.errorPdfGenerico(403));
  });
});

describe("nombreDeArchivo", () => {
  it("toma el nombre del encabezado Content-Disposition", () => {
    expect(nombreDeArchivo('attachment; filename="cotizacion-2026-10-01.pdf"')).toBe("cotizacion-2026-10-01.pdf");
  });

  it.each([null, "attachment", 'attachment; filename="../otro.exe"', 'attachment; filename="a b.pdf"'])(
    "%j: usa el nombre por omisión",
    (encabezado) => {
      expect(nombreDeArchivo(encabezado)).toBe(TEXTOS.nombrePdfPorOmision);
    },
  );
});

describe("contarCaracteres y recortar", () => {
  it("cuentan caracteres, no unidades UTF-16 (igual que el servidor)", () => {
    expect(contarCaracteres("año")).toBe(3);
    expect(contarCaracteres("\u{1F600}\u{1F600}")).toBe(2);
  });

  it("recortar deja el texto en el tope sin partir caracteres", () => {
    expect(recortar("abcdef", 4)).toBe("abcd");
    expect(recortar("\u{1F600}\u{1F600}\u{1F600}", 2)).toBe("\u{1F600}\u{1F600}");
    expect(recortar("corto", 120)).toBe("corto");
  });
});

describe("peticionPdf.ts es lógica pura", () => {
  const codigo = readFileSync(path.join(process.cwd(), "src/app/(app)/cotizador/peticionPdf.ts"), "utf8");
  it("no importa nada de src/domain, de la aplicación, del servidor, de Next ni de React", () => {
    const origenes = [...codigo.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(origenes.filter((o) => /domain|aplicacion|servidor|^next|^react/.test(o))).toEqual([]);
  });
});
