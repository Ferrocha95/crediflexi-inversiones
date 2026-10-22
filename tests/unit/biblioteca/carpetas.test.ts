import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LARGO_NOMBRE_CARPETA,
  MENSAJES_BIBLIOTECA,
  TOPE_CARPETAS,
  mensajeDeErrorBase,
  validarIdCarpeta,
  validarNombreCarpeta,
} from "../../../src/aplicacion/biblioteca/reglas";

// Reglas de las subcarpetas de la Biblioteca que no necesitan servidor: el
// nombre (1 a 80 caracteres, sin controles ni invisibles, sin datos
// sensibles), el id de la carpeta elegida, el tope de 30 por sección y los
// mensajes de los rechazos de la base. Los invisibles se arman con
// String.fromCharCode para que el archivo no lleve ninguno.

const c = (n: number) => String.fromCharCode(n);

describe("validarNombreCarpeta", () => {
  it("acepta un nombre normal y lo devuelve limpio (NFC, espacios simples, sin espacios a los lados)", () => {
    expect(validarNombreCarpeta("  Guías   de  ventas ")).toEqual({ ok: true, nombre: "Guías de ventas" });
    expect(validarNombreCarpeta("Gui" + "a" + c(0x301) + "s")).toEqual({ ok: true, nombre: "Guiás" });
  });

  it("acepta 80 caracteres y rechaza 81", () => {
    expect(validarNombreCarpeta("N".repeat(80))).toEqual({ ok: true, nombre: "N".repeat(80) });
    expect(validarNombreCarpeta("N".repeat(81))).toEqual({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaNombreLargo });
  });

  it.each([
    ["vacío", ""],
    ["de solo espacios", "   "],
    ["de solo invisibles", c(0x200b) + c(0xfeff)],
  ])("rechaza un nombre %s", (_n, nombre) => {
    expect(validarNombreCarpeta(nombre)).toEqual({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaNombreVacio });
  });

  it("quita controles e invisibles, y cambia los saltos de línea y tabuladores por un espacio", () => {
    const sucio = "Guías" + c(0x200b) + c(0x202e) + c(0xfeff) + c(0x3164) + " de" + c(0x0a) + "ventas" + c(0x09) + "2026";
    expect(validarNombreCarpeta(sucio)).toEqual({ ok: true, nombre: "Guías de ventas 2026" });
  });

  it.each([
    ["una CLABE", "Cuenta 012180001234567891"],
    ["un RFC", "Contrato GODE561231GR8"],
    ["una CURP", "GODE561231HDFRRN09"],
  ])("rechaza %s", (_n, nombre) => {
    const r = validarNombreCarpeta(nombre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toMatch(/no guarda datos bancarios ni de identidad/);
  });

  it("rechaza lo que no es texto", () => {
    for (const valor of [undefined, null, 5, {}, ["Guías"]]) {
      expect(validarNombreCarpeta(valor)).toEqual({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaNombreVacio });
    }
  });
});

describe("validarIdCarpeta", () => {
  const ID = "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f";

  it("vacío, null o ausente es Sin carpeta", () => {
    for (const valor of [undefined, null, ""]) expect(validarIdCarpeta(valor)).toEqual({ ok: true, id: null });
  });

  it("un uuid es esa carpeta (en minúsculas)", () => {
    expect(validarIdCarpeta(ID)).toEqual({ ok: true, id: ID });
    expect(validarIdCarpeta(ID.toUpperCase())).toEqual({ ok: true, id: ID });
  });

  it.each([["texto", "carpeta"], ["número", 5], ["uuid con espacios", ` ${ID}`], ["objeto", {}], ["uuid con salto", `${ID}\n`]])(
    "rechaza %s",
    (_n, valor) => {
      expect(validarIdCarpeta(valor)).toEqual({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaInvalida });
    },
  );
});

describe("mensajeDeErrorBase: rechazos de las carpetas", () => {
  it.each([
    [{ code: "23505", message: 'duplicate key value violates unique constraint "biblioteca_carpetas_nombre_unico_activas"' }, MENSAJES_BIBLIOTECA.carpetaRepetida],
    [{ code: "23514", message: "la carpeta tiene elementos activos (biblioteca_carpetas_sin_elementos_activos)" }, MENSAJES_BIBLIOTECA.carpetaConElementos],
    [{ code: "23514", message: "la carpeta está archivada (biblioteca_carpeta_archivada)" }, MENSAJES_BIBLIOTECA.carpetaArchivada],
    [{ code: "23514", message: "la carpeta del elemento está archivada (biblioteca_restaurar_en_carpeta_archivada)" }, MENSAJES_BIBLIOTECA.carpetaArchivada],
    [
      { code: "23503", message: 'insert or update on table "biblioteca" violates foreign key constraint "biblioteca_carpeta_misma_seccion_y_organizacion"' },
      MENSAJES_BIBLIOTECA.carpetaInvalida,
    ],
    [{ code: "23514", message: 'new row violates check constraint "biblioteca_carpetas_nombre_largo_maximo"' }, MENSAJES_BIBLIOTECA.carpetaNombreLargo],
    [{ code: "23514", message: 'new row violates check constraint "biblioteca_carpetas_nombre_sin_invisibles"' }, MENSAJES_BIBLIOTECA.carpetaNombreVacio],
    [{ code: "23514", message: 'new row violates check constraint "biblioteca_carpetas_sin_datos_sensibles"' }, MENSAJES_BIBLIOTECA.datoSensibleCarpeta],
  ])("%j", (error, mensaje) => {
    expect(mensajeDeErrorBase(error).mensaje).toBe(mensaje);
  });

  it("los rechazos de los elementos siguen igual", () => {
    expect(mensajeDeErrorBase({ code: "23514", message: 'violates check constraint "biblioteca_sin_datos_sensibles"' }).mensaje).toBe(
      MENSAJES_BIBLIOTECA.datoSensibleBase,
    );
    expect(mensajeDeErrorBase({ code: "42501", message: "permission denied" }).mensaje).toBe(MENSAJES_BIBLIOTECA.soloDirectorOGerente);
  });
});

describe("carpetas: topes iguales a los de la migración", () => {
  const migracion = readFileSync(path.join(process.cwd(), "supabase", "migrations", "20261022120000_biblioteca_carpetas.sql"), "utf8");

  it("nombre de 80 caracteres", () => {
    expect(LARGO_NOMBRE_CARPETA).toBe(80);
    expect(migracion).toContain(`char_length(nombre) <= ${LARGO_NOMBRE_CARPETA}`);
  });

  it("el tope de 30 carpetas activas por sección vive solo en la app (pendiente reforzarlo en la base)", () => {
    expect(TOPE_CARPETAS).toBe(30);
    expect(MENSAJES_BIBLIOTECA.carpetaTope).toContain("30");
  });

  it("los nombres de restricción que traduce la app existen en la migración", () => {
    for (const nombre of [
      "biblioteca_carpetas_nombre_unico_activas",
      "biblioteca_carpetas_sin_elementos_activos",
      "biblioteca_carpeta_archivada",
      "biblioteca_restaurar_en_carpeta_archivada",
      "biblioteca_carpeta_misma_seccion_y_organizacion",
      "biblioteca_carpetas_nombre_largo_maximo",
      "biblioteca_carpetas_nombre_sin_invisibles",
      "biblioteca_carpetas_sin_datos_sensibles",
    ]) {
      expect(migracion, nombre).toContain(nombre);
    }
  });
});
