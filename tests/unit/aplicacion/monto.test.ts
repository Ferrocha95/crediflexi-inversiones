import { describe, expect, it } from "vitest";
import {
  MENSAJE_MONTO_CERO,
  MENSAJE_MONTO_ILEGIBLE,
  normalizarMonto,
} from "../../../src/aplicacion/monto";

function normalizado(texto: string): string {
  const r = normalizarMonto(texto);
  if (!r.ok) throw new Error(`Se esperaba un monto válido: ${r.error.mensaje}`);
  return r.valor;
}

function errorDe(texto: string): { codigo: string; mensaje: string } {
  const r = normalizarMonto(texto);
  if (r.ok) throw new Error(`No debía aceptarse: ${texto}`);
  return r.error;
}

const NBSP = String.fromCharCode(0xa0);

describe("normalizarMonto: formatos aceptados", () => {
  it.each([
    ["entero sin comas", "150000", "150000"],
    ["con centavos", "150000.50", "150000.50"],
    ["con comas de miles y centavos", "150,000.50", "150000.50"],
    ["millones con comas", "1,500,000", "1500000"],
    ["con signo de pesos, comas y centavos", "$1,500,000.00", "1500000.00"],
    ["con signo de pesos y un espacio", "$ 2,000,000", "2000000"],
    ["con signo de pesos y un decimal", "$150000.5", "150000.5"],
    ["con espacios a los lados", "  30,000  ", "30000"],
    ["con espacios duros a los lados", `${NBSP}1,000${NBSP}`, "1000"],
    ["tres cifras", "999", "999"],
    ["un centavo", "0.01", "0.01"],
    ["ceros a la izquierda sin comas", "0150000", "0150000"],
  ])("%s", (_, entrada, esperado) => {
    expect(normalizado(entrada)).toBe(esperado);
  });
});

describe("normalizarMonto: formatos que no se entienden", () => {
  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["solo el signo", "$"],
    ["comas mal agrupadas", "1,50,000"],
    ["grupo de cuatro", "1,5000"],
    ["coma al final", "150,"],
    ["formato europeo", "1.500.000"],
    ["coma decimal", "150000,50"],
    ["tres decimales", "150000.505"],
    ["punto sin decimales", "150000."],
    ["decimales sin entero", ".50"],
    ["negativo", "-150000"],
    ["signo al final", "150000$"],
    ["espacio en medio", "150 000"],
    ["exponente", "1e6"],
    ["letras", "mil pesos"],
    ["moneda escrita", "150000 MXN"],
    ["cero inicial en grupo", "01,000"],
  ])("%s", (_, entrada) => {
    const e = errorDe(entrada);
    expect(e.codigo).toBe("MONTO_ILEGIBLE");
    expect(e.mensaje).toBe(MENSAJE_MONTO_ILEGIBLE);
  });

  it("el mensaje es el de la pantalla", () => {
    expect(MENSAJE_MONTO_ILEGIBLE).toBe("Escribe el monto como 150,000.50 o 150000.50");
  });
});

describe("normalizarMonto: monto igual a cero", () => {
  it.each([
    ["cero", "0"],
    ["cero con centavos", "0.00"],
    ["cero con un decimal", "0.0"],
    ["triple cero", "000"],
    ["dobles ceros con centavos", "00.00"],
    ["cero con signo de pesos", "$0"],
    ["cero con signo de pesos y centavos", "$ 0.00"],
  ])("%s", (_, entrada) => {
    const e = errorDe(entrada);
    expect(e.codigo).toBe("MONTO_CERO");
    expect(e.mensaje).toBe(MENSAJE_MONTO_CERO);
  });

  it("el mensaje dice que debe ser mayor que cero", () => {
    expect(MENSAJE_MONTO_CERO).toBe("El monto debe ser mayor que cero.");
  });
});
