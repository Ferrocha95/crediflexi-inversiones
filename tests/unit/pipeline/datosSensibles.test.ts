import { describe, expect, it } from "vitest";
import { pareceDatoSensible, revisarDatosSensibles } from "../../../src/aplicacion/pipeline/datosSensibles";

// Todos los valores son sintéticos: tienen la forma de los datos, no son de personas.
const CLABE = "002180701234567891";
const CURP = "GOMA800101HDFRRN09";
const RFC_FISICA = "GOMA800101AB1";
const RFC_MORAL = "ABC900101XY2";

describe("pareceDatoSensible: CLABE", () => {
  it.each([
    [CLABE],
    ["002 180 70123456789 1"],
    ["002-180-701234567891"],
    ["002 180-7012-3456-7891"],
    [`CLABE ${CLABE} para depósito`],
    [`(${CLABE})`],
  ])("detecta %j", (texto) => {
    expect(pareceDatoSensible(texto)).toBe("CLABE");
  });

  it.each([
    ["17 dígitos", "00218070123456789"],
    ["19 dígitos", "0021807012345678912"],
    ["17 dígitos y uno más tras dos espacios", "00218070123456789  1"],
    ["dos teléfonos de 10 dígitos separados por espacio", "5512345678 5587654321"],
    ["dos teléfonos de 10 dígitos separados por guion", "5512345678-5587654321"],
    ["un teléfono con formato", "55 1234 5678"],
    ["llamar el 15/10", "llamar el 15/10"],
    ["un monto con comas", "quiere invertir 1,500,000 a 12 meses"],
    ["18 dígitos separados por punto", "002.180.701.234.567.891"],
  ])("no marca %s", (_nombre, texto) => {
    expect(pareceDatoSensible(texto)).toBeNull();
  });
});

describe("pareceDatoSensible: CURP y RFC", () => {
  it.each([
    [CURP, "CURP"],
    [CURP.toLowerCase(), "CURP"],
    [`su curp es ${CURP}.`, "CURP"],
    [RFC_FISICA, "RFC"],
    [RFC_MORAL, "RFC"],
    [`RFC: ${RFC_FISICA.toLowerCase()}`, "RFC"],
    ["ÑAÑA800101AB1", "RFC"],
    ["A&B900101XY2", "RFC"],
    // & no es carácter de palabra: el RFC "ABC900101XY2" empieza justo después (la base también lo marca).
    ["&ABC900101XY2", "RFC"],
  ])("%j es %s", (texto, tipo) => {
    expect(pareceDatoSensible(texto)).toBe(tipo);
  });

  it.each([
    ["un correo como prospecto900101abc@ejemplo.test", "prospecto900101abc@ejemplo.test"],
    ["RFC pegado a más letras", `X${RFC_FISICA}`],
    ["RFC pegado a un dígito al final", `${RFC_FISICA}4`],
    ["RFC con mes 13", "GOMA801301AB1"],
    ["RFC con día 32", "GOMA800132AB1"],
    ["CURP pegada a una letra acentuada", `é${CURP}`],
    ["CURP pegada a un guion bajo", `_${CURP}`],
    ["texto común", "Interesado en 12 meses, llamar el lunes"],
  ])("no marca %s", (_nombre, texto) => {
    expect(pareceDatoSensible(texto)).toBeNull();
  });

  it("si hay CLABE y RFC, gana la CLABE (mismo orden que la base)", () => {
    expect(pareceDatoSensible(`${RFC_FISICA}, ${CLABE}`)).toBe("CLABE");
  });

  it("como en la base, el dígito final del RFC pegado con un espacio a 18 dígitos forma 19: no es CLABE", () => {
    expect(pareceDatoSensible(`${RFC_FISICA} ${CLABE}`)).toBe("RFC");
  });

  it("si hay CURP, gana la CURP sobre el RFC", () => {
    expect(pareceDatoSensible(`${RFC_FISICA} ${CURP}`)).toBe("CURP");
  });
});

describe("revisarDatosSensibles: nombre y comentarios", () => {
  it("sin datos sensibles no hay errores", () => {
    expect(revisarDatosSensibles({ nombre: "Prospecto Sintético", comentarios: "Llamar el 15/10" })).toEqual({});
  });

  it("marca cada campo y dice qué hacer", () => {
    expect(revisarDatosSensibles({ nombre: `Prospecto ${RFC_FISICA}`, comentarios: `CLABE ${CLABE}` })).toEqual({
      nombre: "El nombre parece incluir un RFC. Esta app no guarda datos bancarios ni de identidad: quítalo y guarda de nuevo.",
      comentarios: "Los comentarios parecen incluir una CLABE. Esta app no guarda datos bancarios ni de identidad: quítala y guarda de nuevo.",
    });
  });

  it("la CURP en los comentarios", () => {
    expect(revisarDatosSensibles({ nombre: "Prospecto", comentarios: CURP }).comentarios).toBe(
      "Los comentarios parecen incluir una CURP. Esta app no guarda datos bancarios ni de identidad: quítala y guarda de nuevo.",
    );
  });

  it("como la base, revisa el nombre y los comentarios juntos: 18 dígitos repartidos entre los dos", () => {
    expect(revisarDatosSensibles({ nombre: "Prospecto 002180701", comentarios: "234567891 resto" })).toEqual({
      comentarios:
        "El nombre o los comentarios parecen incluir un dato bancario o de identidad (CLABE, RFC o CURP). Esta app no los guarda: quítalo y guarda de nuevo.",
    });
  });
});
