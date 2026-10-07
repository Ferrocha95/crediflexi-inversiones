import { describe, expect, it } from "vitest";
import {
  estatusEnPantalla,
  MENSAJE_CONTACTO_10_DIGITOS,
  normalizarEstatus,
  normalizarFecha,
  normalizarTelefono,
  telefonoConFormato,
} from "../../../src/aplicacion/pipeline/normalizar";

const ok = <T,>(valor: T) => ({ ok: true, valor });

describe("normalizarTelefono", () => {
  it.each([
    ["5512345678", "5512345678"],
    ["55 1234 5678", "5512345678"],
    ["55-1234-5678", "5512345678"],
    ["55.1234.5678", "5512345678"],
    ["(55) 1234-5678", "5512345678"],
    ["  55 12 34 56 78 ", "5512345678"],
    ["+52 55 1234 5678", "5512345678"],
    ["+52 (55) 1234-5678", "5512345678"],
    ["52 55 1234 5678", "5512345678"],
    ["525512345678", "5512345678"],
  ])("acepta %j y deja %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toEqual(ok(esperado));
  });

  it("un número de 10 dígitos que empieza con 52 se queda igual", () => {
    expect(normalizarTelefono("5212345678")).toEqual(ok("5212345678"));
  });

  it.each(["551234567", "55123456789", "+1 555 123 4567", "55 1234 567a", "5512345678 ext 2", "+5255123456", "55_1234_5678", "５５１２３４５６７８", "52+5512345678"])(
    "rechaza %j con el mensaje de 10 dígitos",
    (entrada) => {
      expect(normalizarTelefono(entrada)).toEqual({ ok: false, mensaje: MENSAJE_CONTACTO_10_DIGITOS });
    },
  );

  it("vacío pide escribir el teléfono", () => {
    expect(normalizarTelefono("   ")).toEqual({ ok: false, mensaje: "Escribe el teléfono de contacto (10 dígitos)." });
  });

  it("el mensaje dice qué falló", () => {
    expect(MENSAJE_CONTACTO_10_DIGITOS).toBe("El contacto debe tener 10 dígitos.");
  });
});

describe("telefonoConFormato", () => {
  it("separa en 2, 4 y 4", () => {
    expect(telefonoConFormato("5512345678")).toBe("55 1234 5678");
  });
  it("deja igual lo que no tiene 10 dígitos", () => {
    expect(telefonoConFormato("123")).toBe("123");
  });
});

describe("normalizarEstatus", () => {
  it.each([
    ["INTERESADO", "INTERESADO"],
    ["interesado", "INTERESADO"],
    ["INTERMITENTE ", "INTERMITENTE"],
    ["  Intermitente", "INTERMITENTE"],
    ["NO INTERESADO", "NO_INTERESADO"],
    ["no  interesado", "NO_INTERESADO"],
    ["NO_INTERESADO", "NO_INTERESADO"],
  ])("%j -> %s", (entrada, esperado) => {
    expect(normalizarEstatus(entrada)).toEqual(ok(esperado));
  });

  it.each(["", "CIERRE", "INTERESADA", "NO"])("rechaza %j", (entrada) => {
    expect(normalizarEstatus(entrada)).toEqual({
      ok: false,
      mensaje: "El estatus debe ser INTERESADO, INTERMITENTE o NO INTERESADO.",
    });
  });

  it("en pantalla NO_INTERESADO se escribe con espacio", () => {
    expect(estatusEnPantalla("NO_INTERESADO")).toBe("NO INTERESADO");
    expect(estatusEnPantalla("INTERESADO")).toBe("INTERESADO");
  });
});

describe("normalizarFecha", () => {
  it.each([
    ["2026-10-15", "2026-10-15"],
    ["15/10/2026", "2026-10-15"],
    ["5/1/2026", "2026-01-05"],
    ["05/01/2026", "2026-01-05"],
    [" 29/2/2028 ", "2028-02-29"],
    ["2028-02-29", "2028-02-29"],
  ])("%j -> %s", (entrada, esperado) => {
    expect(normalizarFecha(entrada)).toEqual(ok(esperado));
  });

  it("vacía queda sin seguimiento", () => {
    expect(normalizarFecha("")).toEqual(ok(null));
    expect(normalizarFecha("  ")).toEqual(ok(null));
  });

  it.each(["31/02/2026", "29/02/2026", "2026-02-30", "31/4/2026", "0/1/2026", "1/13/2026", "2026-13-01", "2026-00-10"])(
    "rechaza la fecha que no existe %j",
    (entrada) => {
      expect(normalizarFecha(entrada)).toEqual({
        ok: false,
        mensaje: `La fecha de seguimiento ${entrada} no existe. Revisa el día y el mes.`,
      });
    },
  );

  it.each(["15-10-2026", "15/10/26", "2026/10/15", "mañana", "15/10", "10/15/2026x", "0001-01-01x"])("rechaza el formato %j", (entrada) => {
    expect(normalizarFecha(entrada)).toEqual({
      ok: false,
      mensaje: "Escribe la fecha de seguimiento como D/M/AAAA (por ejemplo, 15/10/2026) o AAAA-MM-DD.",
    });
  });
});
