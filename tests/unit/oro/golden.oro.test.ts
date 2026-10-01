import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearCantidad } from "../../../src/domain/comun/formato";
import { cotizar } from "../../../src/domain/interes/cotizar";
import { aPesosEnteros } from "../../../src/domain/interes/redondeo";
import {
  base,
  casos,
  cifrasPptx,
  cotizarCaso,
  salida,
  semillaReal,
  TOLERANCIA_PPTX,
  type CifraPptx,
} from "./ayudas";

const fmt = (d: Decimal) => formatearCantidad(d);

describe("oro (a): las 106 celdas del golden", () => {
  it("el golden trae 106 celdas", () => {
    expect(casos).toHaveLength(106);
  });

  it.each(casos.map((c) => [c.nombre, c] as const))("%s", (_nombre, c) => {
    const r = cotizar(semillaReal, { ...base, monto: c.monto, esquema: c.esquema, plazo: c.plazo });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cot = r.valor;

    // Tasa: igualdad decimal (no de texto).
    expect(new Decimal(cot.tasa).eq(new Decimal(c.celda.tasa))).toBe(true);

    // Las tres salidas, como texto con 2 decimales.
    expect(salida(cot, "rendimiento_mensual_pesos").redondeado).toBe(c.celda.rendimiento_mensual_pesos);
    expect(salida(cot, "rendimiento_anual_pesos").redondeado).toBe(c.celda.rendimiento_anual_pesos);
    expect(salida(cot, "ganancia_total_plazo").redondeado).toBe(c.celda.ganancia_total_plazo);

    // Valores "por fórmula" del golden, en pesos enteros desde el exacto.
    const total = new Decimal(salida(cot, "ganancia_total_plazo").exacto);
    expect(aPesosEnteros(total).toFixed(0)).toBe(String(c.celda.ganancia_formula));
    if (c.celda.pago_mensual_formula !== undefined) {
      const mensual = new Decimal(salida(cot, "rendimiento_mensual_pesos").exacto);
      expect(aPesosEnteros(mensual).toFixed(0)).toBe(String(c.celda.pago_mensual_formula));
    }
  });
});

describe("oro (a): contra el pptx, tolerancia de $0.50 en las cifras sin error", () => {
  const correctas = cifrasPptx.filter((f) => !f.marcadaConError);

  it.each(correctas.map((f) => [`${f.caso.nombre} ${f.campo}: pptx ${fmt(f.pptx)}`, f] as const))(
    "%s",
    (_nombre, f: CifraPptx) => {
      expect(f.diferencia.lte(TOLERANCIA_PPTX)).toBe(true);
      expect(aPesosEnteros(f.motor).eq(f.pptx)).toBe(true);
    },
  );
});

describe("oro (b): cifras del pptx con error (el motor da la fórmula)", () => {
  const conError = cifrasPptx.filter((f) => f.marcadaConError);

  it.each(
    conError.map(
      (f) =>
        [
          `${f.caso.nombre} ${f.campo}: motor ${fmt(f.motor)}, pptx ${fmt(f.pptx)}, diferencia ${fmt(f.diferencia)}`,
          f,
        ] as const,
    ),
  )("%s", (_nombre, f: CifraPptx) => {
    const formula = f.campo === "ganancia" ? f.caso.celda.ganancia_formula : f.caso.celda.pago_mensual_formula;
    expect(aPesosEnteros(f.motor).toFixed(0)).toBe(String(formula));
    expect(f.diferencia.gt(TOLERANCIA_PPTX)).toBe(true);
  });

  it("resumen: el motor discrepa del pptx en exactamente las 10 cifras de la lámina de $800,000", () => {
    const esperadas = [
      "800000 mensual 6 pago_mensual",
      "800000 mensual 12 ganancia",
      "800000 mensual 12 pago_mensual",
      "800000 mensual 18 ganancia",
      "800000 mensual 18 pago_mensual",
      "800000 mensual 24 ganancia",
      "800000 mensual 24 pago_mensual",
      "800000 final 12 ganancia",
      "800000 final 18 ganancia",
      "800000 final 24 ganancia",
    ];
    const clave = (f: CifraPptx) => `${f.caso.monto} ${f.caso.esquemaGolden} ${f.caso.plazo} ${f.campo}`;
    const porElMotor = cifrasPptx.filter((f) => f.diferencia.gt(TOLERANCIA_PPTX)).map(clave);
    const marcadas = cifrasPptx.filter((f) => f.marcadaConError).map(clave);
    expect(porElMotor.sort()).toEqual([...esperadas].sort());
    expect(marcadas.sort()).toEqual([...esperadas].sort());
  });
});

describe("oro (c): celdas que el pptx marca N/A", () => {
  const na = casos.filter((c) => c.celda.pptx_dice_na);

  it("son exactamente 6: $2,000,000 en 6, 12 y 18 meses de ambos esquemas", () => {
    expect(na.map((c) => `${c.monto} ${c.esquemaGolden} ${c.plazo}`).sort()).toEqual(
      [
        "2000000 final 12",
        "2000000 final 18",
        "2000000 final 6",
        "2000000 mensual 12",
        "2000000 mensual 18",
        "2000000 mensual 6",
      ].sort(),
    );
  });

  it.each(na.map((c) => [c.nombre, c] as const))("%s da ok con la tasa del tramo desde $1,000,000", (_n, c) => {
    const cot = cotizarCaso(c);
    expect(cot.origenTasa).toBe("tramo");
    expect(cot.tramo.desde).toBe("1000000.00");
    expect(salida(cot, "ganancia_total_plazo").redondeado).toBe(c.celda.ganancia_total_plazo);
  });
});
