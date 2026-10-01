import { describe, expect, it } from "vitest";
import { limpiarCampo } from "../../../src/aplicacion/campos";

describe("limpiarCampo", () => {
  it("recorta los espacios de los extremos", () => {
    expect(limpiarCampo("  Persona Sintética Uno  ", 120)).toBe("Persona Sintética Uno");
  });

  it("cambia los caracteres de control por un espacio", () => {
    expect(limpiarCampo("Persona\nSintética\tUno\r\n", 120)).toBe("Persona Sintética Uno");
    expect(limpiarCampo("Ejecutivo\u0000Prueba\u0007", 120)).toBe("Ejecutivo Prueba");
    expect(limpiarCampo("A\u0085B\u009FC", 120)).toBe("A B C");
  });

  it("quita los caracteres invisibles de formato y de dirección del texto", () => {
    expect(limpiarCampo("Persona\u202ESintética", 120)).toBe("Persona Sintética");
    expect(limpiarCampo("\uFEFFPersona\u200BUno", 120)).toBe("Persona Uno");
    expect(limpiarCampo("Uno\u2028Dos\u2029Tres", 120)).toBe("Uno Dos Tres");
  });

  it("no junta palabras ni deja espacios dobles", () => {
    expect(limpiarCampo("Uno \n Dos", 120)).toBe("Uno Dos");
  });

  it("conserva acentos, ñ, signos y correo", () => {
    const texto = "Ejecutivo Sintético · ejecutivo.prueba@ejemplo.test · 55 0000 0000 ¿Sí? ¡Año!";
    expect(limpiarCampo(texto, 120)).toBe(texto);
  });

  it("corta al tope de caracteres", () => {
    expect(limpiarCampo("a".repeat(301), 300)).toBe("a".repeat(300));
    expect(limpiarCampo("a".repeat(300), 300)).toBe("a".repeat(300));
  });

  it("corta después de limpiar y vuelve a recortar el espacio final", () => {
    expect(limpiarCampo("   abc def", 4)).toBe("abc");
  });

  it("cuenta caracteres, no unidades de UTF-16: no parte un emoji", () => {
    expect(limpiarCampo("😀😀😀", 2)).toBe("😀😀");
  });

  it("un texto vacío o de puro control queda vacío", () => {
    expect(limpiarCampo("", 60)).toBe("");
    expect(limpiarCampo("\n\t\u0000 ", 60)).toBe("");
  });
});
