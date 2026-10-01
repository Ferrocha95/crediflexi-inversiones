import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearCantidad } from "../../../src/domain/comun/formato";
import { aPesosEnteros } from "../../../src/domain/interes/redondeo";
import { salida } from "./ayudas";
import {
  casos,
  cifrasPptx,
  cotizacionDe,
  intentarCotizar,
  motorDe,
  TOLERANCIA_PPTX,
  type Caso,
  type CifraPptx,
  type Intento,
} from "./golden";

const fmt = (d: Decimal) => formatearCantidad(d);

// Un intento por celda, sin lanzar: si una celda no cotiza, fallan solo sus pruebas.
const intentos = new Map<Caso, Intento>(casos.map((c) => [c, intentarCotizar(c)]));
const intentoDe = (c: Caso): Intento => intentos.get(c)!;

interface ComparacionPptx {
  readonly cifra: CifraPptx;
  /** null si la celda no cotizó. */
  readonly motor: Decimal | null;
  readonly diferencia: Decimal | null;
}

const comparaciones: readonly ComparacionPptx[] = cifrasPptx.map((cifra) => {
  const motor = motorDe(cifra, intentoDe(cifra.caso));
  return { cifra, motor, diferencia: motor === null ? null : motor.minus(cifra.pptx).abs() };
});

/** Dentro de una prueba: el valor del motor o un error claro si la celda no cotizó. */
function motorDeComparacion(c: ComparacionPptx): { motor: Decimal; diferencia: Decimal } {
  if (c.motor === null || c.diferencia === null) {
    const intento = intentoDe(c.cifra.caso);
    throw new Error(`La celda ${c.cifra.caso.nombre} no cotiza: ${intento.ok ? "sin valor" : intento.motivo}`);
  }
  return { motor: c.motor, diferencia: c.diferencia };
}

describe("oro (a): las 106 celdas del golden", () => {
  it("el golden trae 106 celdas", () => {
    expect(casos).toHaveLength(106);
  });

  it.each(casos.map((c) => [c.nombre, c] as const))("%s", (_nombre, c) => {
    const cot = cotizacionDe(c, intentoDe(c));

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
  const correctas = comparaciones.filter((c) => !c.cifra.marcadaConError);

  it.each(
    correctas.map((c) => [`${c.cifra.caso.nombre} ${c.cifra.campo}: pptx ${fmt(c.cifra.pptx)}`, c] as const),
  )("%s", (_nombre, c: ComparacionPptx) => {
    const { motor, diferencia } = motorDeComparacion(c);
    expect(diferencia.lte(TOLERANCIA_PPTX)).toBe(true);
    expect(aPesosEnteros(motor).eq(c.cifra.pptx)).toBe(true);
  });
});

describe("oro (b): cifras del pptx con error (el motor da la fórmula)", () => {
  const conError = comparaciones.filter((c) => c.cifra.marcadaConError);

  const nombre = (c: ComparacionPptx) =>
    `${c.cifra.caso.nombre} ${c.cifra.campo}: ` +
    (c.motor === null || c.diferencia === null
      ? `motor sin cotización, pptx ${fmt(c.cifra.pptx)}`
      : `motor ${fmt(c.motor)}, pptx ${fmt(c.cifra.pptx)}, diferencia ${fmt(c.diferencia)}`);

  it.each(conError.map((c) => [nombre(c), c] as const))("%s", (_nombre, c: ComparacionPptx) => {
    const { motor, diferencia } = motorDeComparacion(c);
    const f = c.cifra;
    const formula = f.campo === "ganancia" ? f.caso.celda.ganancia_formula : f.caso.celda.pago_mensual_formula;
    expect(aPesosEnteros(motor).toFixed(0)).toBe(String(formula));
    expect(diferencia.gt(TOLERANCIA_PPTX)).toBe(true);
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
    const sinCotizar = comparaciones.filter((c) => c.diferencia === null).map((c) => clave(c.cifra));
    expect(sinCotizar, "Hay cifras del pptx cuya celda no cotizó").toEqual([]);
    const porElMotor = comparaciones.filter((c) => c.diferencia!.gt(TOLERANCIA_PPTX)).map((c) => clave(c.cifra));
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

  // En Vitest, "$" seguido de un dígito en el texto del título se interpola como
  // elemento del caso ($0, $1, …) y no se puede escapar; los valores que entran
  // por %s no se interpolan. Por eso el monto del tramo va como valor.
  it.each(na.map((c) => [c.nombre, "$1,000,000.00", c] as const))(
    "%s da ok con la tasa del tramo desde %s",
    (_n, _desde, c) => {
      const cot = cotizacionDe(c, intentoDe(c));
      expect(cot.origenTasa).toBe("tramo");
      expect(cot.tramo.desde).toBe("1000000.00");
      expect(salida(cot, "ganancia_total_plazo").redondeado).toBe(c.celda.ganancia_total_plazo);
    },
  );
});
