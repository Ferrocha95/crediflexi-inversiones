import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MENSAJE_ERROR_DESCONOCIDO, mensajeDeErrorBase, TOPE_COMENTARIOS, TOPE_NOMBRE } from "../../../src/aplicacion/pipeline/errores";

const violacion = (restriccion: string) => ({
  code: "23514",
  message: `new row for relation "prospectos" violates check constraint "${restriccion}"`,
});

describe("mensajeDeErrorBase", () => {
  it.each([
    ["prospectos_contacto_10_digitos", "El contacto debe tener 10 dígitos."],
    [
      "prospectos_sin_datos_sensibles",
      "El nombre o los comentarios parecen incluir un dato bancario o de identidad (CLABE, RFC o CURP). Esta app no los guarda: quítalo y guarda de nuevo.",
    ],
    ["prospectos_nombre_largo_maximo", "El nombre admite hasta 150 caracteres. Acórtalo y guarda de nuevo."],
    ["prospectos_comentarios_largo_maximo", "Los comentarios admiten hasta 1000 caracteres. Acórtalos y guarda de nuevo."],
    ["prospectos_nombre_no_vacio", "Escribe el nombre del prospecto."],
  ])("%s", (restriccion, mensaje) => {
    expect(mensajeDeErrorBase(violacion(restriccion))).toBe(mensaje);
  });

  it("42501 es falta de permiso", () => {
    expect(mensajeDeErrorBase({ code: "42501", message: "new row violates row-level security policy" })).toBe("No tienes permiso para hacer esto.");
  });

  it("cualquier otro error da un mensaje claro, sin el detalle técnico", () => {
    const m = mensajeDeErrorBase({ code: "XX000", message: "algo interno" });
    expect(m).toBe(MENSAJE_ERROR_DESCONOCIDO);
    expect(m).not.toContain("algo interno");
  });

  it("los topes coinciden con la migración", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261005120000_prospectos.sql"), "utf8");
    expect(sql).toContain(`check (char_length(nombre) <= ${TOPE_NOMBRE})`);
    expect(sql).toContain(`check (char_length(comentarios) <= ${TOPE_COMENTARIOS})`);
    expect([TOPE_NOMBRE, TOPE_COMENTARIOS]).toEqual([150, 1000]);
  });
});
