import { describe, expect, it } from "vitest";
import { MENSAJE_MONTO_ILEGIBLE, normalizarMonto } from "../../../src/aplicacion/monto";

function normalizado(texto: string): string {
  const r = normalizarMonto(texto);
  if (!r.ok) throw new Error(`Se esperaba un monto válido: ${r.error.mensaje}`);
  return r.valor;
}

describe("normalizarMonto: formatos aceptados", () => {
  it.each([
    ["150000.50", "150000.50"],
    ["150000", "150000"],
    ["150,000.50", "150000.50"],
    ["1,500,000", "1500000"],
    ["$1,500,000.00", "1500000.00"],
    ["$ 2,000,000", "2000000"],
    ["$150000.5", "150000.5"],
    ["  30,000  ", "30000"],
    ["\u00A01,000\u00A0", "1000"],
    ["999", "999"],
    ["0", "0"],
  ])("%j -> %j", (entrada, esperado) => {
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
  ])("%s (%j)", (_, entrada) => {
    const r = normalizarMonto(entrada);
    if (r.ok) throw new Error(`No debía aceptarse: ${entrada}`);
    expect(r.error.codigo).toBe("MONTO_ILEGIBLE");
    expect(r.error.mensaje).toBe(MENSAJE_MONTO_ILEGIBLE);
  });

  it("el mensaje es el de la pantalla", () => {
    expect(MENSAJE_MONTO_ILEGIBLE).toBe("Escribe el monto como 150,000.50 o 150000.50");
  });
});
