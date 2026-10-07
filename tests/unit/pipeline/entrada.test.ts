import { describe, expect, it } from "vitest";
import { MENSAJE_FORMA_INVALIDA, validarId, validarProspecto } from "../../../src/aplicacion/pipeline/entrada";

const base = {
  nombre: "  Prospecto   Sintético ",
  contacto: "+52 (55) 1234-5678",
  comentarios: " Llamar el 15/10 ",
  estatus: "intermitente ",
  seguimiento: "15/10/2026",
};

describe("validarProspecto", () => {
  it("limpia y normaliza todos los campos", () => {
    expect(validarProspecto(base)).toEqual({
      ok: true,
      valor: {
        nombre: "Prospecto Sintético",
        contacto: "5512345678",
        comentarios: "Llamar el 15/10",
        estatus: "INTERMITENTE",
        seguimiento: "2026-10-15",
      },
    });
  });

  it("seguimiento vacío queda en null; comentarios vacíos se aceptan", () => {
    const r = validarProspecto({ ...base, seguimiento: "", comentarios: "" });
    expect(r.ok && r.valor).toMatchObject({ seguimiento: null, comentarios: "" });
  });

  it("quita caracteres invisibles del nombre", () => {
    const r = validarProspecto({ ...base, nombre: `Prospecto${String.fromCharCode(0x200b)} Sintético${String.fromCharCode(0x202e)}` });
    expect(r.ok && r.valor.nombre).toBe("Prospecto Sintético");
  });

  it("reúne un error por campo, en español", () => {
    const r = validarProspecto({ nombre: "  ", contacto: "123", comentarios: "", estatus: "CIERRE", seguimiento: "31/02/2026" });
    expect(r).toEqual({
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: {
        nombre: "Escribe el nombre del prospecto.",
        contacto: "El contacto debe tener 10 dígitos.",
        estatus: "El estatus debe ser INTERESADO, INTERMITENTE o NO INTERESADO.",
        seguimiento: "La fecha de seguimiento 31/02/2026 no existe. Revisa el día y el mes.",
      },
    });
  });

  it("no corta en silencio: más de 150 caracteres en el nombre o 1000 en comentarios es error", () => {
    const r = validarProspecto({ ...base, nombre: "a".repeat(151), comentarios: "b".repeat(1001) });
    expect(r).toMatchObject({
      ok: false,
      errores: {
        nombre: "El nombre admite hasta 150 caracteres. Acórtalo y guarda de nuevo.",
        comentarios: "Los comentarios admiten hasta 1000 caracteres. Acórtalos y guarda de nuevo.",
      },
    });
  });

  it("150 y 1000 caracteres exactos se aceptan", () => {
    expect(validarProspecto({ ...base, nombre: "a".repeat(150), comentarios: "b".repeat(1000) }).ok).toBe(true);
  });

  it("rechaza datos sensibles en el nombre o los comentarios", () => {
    const r = validarProspecto({ ...base, comentarios: "CLABE 002180701234567891" });
    expect(r).toMatchObject({
      ok: false,
      errores: { comentarios: "Los comentarios parecen incluir una CLABE. Esta app no guarda datos bancarios ni de identidad: quítala y guarda de nuevo." },
    });
  });

  it.each([null, "texto", 7, [], { ...base, ejecutivo_id: "otro" }, { ...base, nombre: 5 }, { nombre: "x" }])(
    "rechaza una forma inválida: %j",
    (entrada) => {
      expect(validarProspecto(entrada)).toEqual({ ok: false, mensaje: MENSAJE_FORMA_INVALIDA, errores: {} });
    },
  );
});

describe("validarId", () => {
  it("acepta un uuid", () => {
    expect(validarId("0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f")).toBe("0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f");
  });
  it.each(["", "1", null, 5, "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f' or 1=1"])("rechaza %j", (id) => {
    expect(validarId(id)).toBeNull();
  });
});
