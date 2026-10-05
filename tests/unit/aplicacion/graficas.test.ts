import { describe, expect, it } from "vitest";
import {
  escalaLineal,
  marcasMeses,
  marcasValor,
  separarEtiquetas,
  trazado,
} from "../../../src/aplicacion/graficas";

/** Pasos "redondos": 1, 2 o 5 por una potencia de 10. */
function esPasoRedondo(paso: number): boolean {
  const potencia = 10 ** Math.floor(Math.log10(paso));
  return [1, 2, 5, 10].some((m) => Math.abs(paso - m * potencia) < potencia * 1e-9);
}

describe("escalaLineal", () => {
  it("lleva el dominio al rango, también invertido (el eje Y crece hacia arriba)", () => {
    const x = escalaLineal([0, 12], [0, 240]);
    expect(x(0)).toBe(0);
    expect(x(6)).toBe(120);
    expect(x(12)).toBe(240);
    const y = escalaLineal([0, 100], [150, 0]);
    expect(y(0)).toBe(150);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(112.5);
  });

  it("con dominio de amplitud cero devuelve el centro del rango, sin NaN ni Infinity", () => {
    const y = escalaLineal([5000, 5000], [150, 0]);
    expect(y(5000)).toBe(75);
    expect(Number.isFinite(y(7000))).toBe(true);
  });
});

describe("marcasValor", () => {
  it("de 0 a 90,000: marcas redondas que cubren el rango", () => {
    const m = marcasValor(0, 90000);
    expect(m[0]).toBe(0);
    expect(m.at(-1)).toBeGreaterThanOrEqual(90000);
    expect(m).toEqual([0, 20000, 40000, 60000, 80000, 100000]);
  });

  it("con máximo cero devuelve 0 y 1", () => {
    expect(marcasValor(0, 0)).toEqual([0, 1]);
  });

  it("con valores iguales distintos de cero devuelve un rango que los contiene", () => {
    const m = marcasValor(5000, 5000);
    expect(m.length).toBeGreaterThanOrEqual(2);
    expect(m[0]).toBeLessThanOrEqual(5000);
    expect(m.at(-1)).toBeGreaterThanOrEqual(5000);
    expect(m[0]).toBeLessThan(m.at(-1)!);
  });

  it.each([
    [0, 4950],
    [0, 100000],
    [1500000, 2186906.87],
    [500000, 714012.5],
    [950000, 1382770],
    [0, 950400],
    [55000, 65345.5],
  ])("de %s a %s: empieza abajo del mínimo, termina arriba del máximo, pasos iguales y redondos", (min, max) => {
    const m = marcasValor(min, max);
    expect(m[0]).toBeLessThanOrEqual(min);
    expect(m.at(-1)).toBeGreaterThanOrEqual(max);
    expect(m.length).toBeGreaterThanOrEqual(3);
    expect(m.length).toBeLessThanOrEqual(8);
    const paso = m[1] - m[0];
    expect(esPasoRedondo(paso)).toBe(true);
    for (let i = 1; i < m.length; i++) expect(m[i] - m[i - 1]).toBeCloseTo(paso, 6);
  });
});

describe("marcasMeses", () => {
  it.each([
    [6, [0, 1, 2, 3, 4, 5, 6]],
    [12, [0, 2, 4, 6, 8, 10, 12]],
    [18, [0, 3, 6, 9, 12, 15, 18]],
    [24, [0, 3, 6, 9, 12, 15, 18, 21, 24]],
    [48, [0, 6, 12, 18, 24, 30, 36, 42, 48]],
  ])("%s meses", (total, esperadas) => {
    expect(marcasMeses(total)).toEqual(esperadas);
  });

  it("si el total no es múltiplo del paso, termina en el total sin dejar una marca pegada", () => {
    const m = marcasMeses(20);
    expect(m[0]).toBe(0);
    expect(m.at(-1)).toBe(20);
    for (let i = 1; i < m.length; i++) expect(m[i] - m[i - 1]).toBeGreaterThanOrEqual(2);
  });
});

describe("trazado", () => {
  it("una ruta SVG que empieza con M y une los puntos con L", () => {
    expect(
      trazado([
        { x: 0, y: 150 },
        { x: 20, y: 140.5 },
        { x: 40, y: 120.125 },
      ]),
    ).toBe("M0.00 150.00 L20.00 140.50 L40.00 120.13");
  });

  it("sin puntos devuelve una ruta vacía", () => {
    expect(trazado([])).toBe("");
  });
});

describe("separarEtiquetas", () => {
  it("si dos etiquetas chocan, las separa sin salirse de los límites", () => {
    const ys = separarEtiquetas([40, 44], 9, [0, 150]);
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(9);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(150);
    }
  });

  it("si no chocan, las deja donde estaban (en el orden recibido)", () => {
    expect(separarEtiquetas([100, 20], 9, [0, 150])).toEqual([100, 20]);
  });

  it("junto al borde, empuja hacia dentro", () => {
    const ys = separarEtiquetas([1, 2], 9, [0, 150]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(9);
  });
});
