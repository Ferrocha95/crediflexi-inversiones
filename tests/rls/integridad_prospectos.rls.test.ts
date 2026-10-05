// Integridad de public.prospectos con escrituras de administrador (service_role,
// sin RLS): restricciones, tipo de estatus, guardia de datos sensibles y
// trigger que impide reasignar.
//
// Cada prueba crea sus propias filas marcadas (rls.test) con un Registro y las
// borra en afterEach. Los valores "sensibles" son genéricos y públicos (RFC y
// CURP genéricos, tarjeta de prueba, ceros), nunca datos de personas.

import { randomUUID } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, inject, it } from "vitest";
import { Registro, comoAdmin, sufijo } from "./admin";
import { CHECK_VIOLADO, LLAVE_FORANEA_VIOLADA, VALOR_INVALIDO } from "./ayudas";
import { MARCA } from "./fixtures";

const MSJ_REASIGNAR = "No se puede cambiar el ejecutivo de un prospecto.";

const admin = comoAdmin();
let reg: Registro;

beforeEach(() => {
  reg = new Registro(admin);
});

afterEach(async () => {
  await reg.limpiar();
});

/** Inserta como administrador a nombre de E1 y anota lo que se haya creado. */
async function insertar(cambios: Record<string, unknown>): Promise<PostgrestError | null> {
  const { data, error } = await admin
    .from("prospectos")
    .insert({
      ejecutivo_id: inject("rls").idsUsuarios.E1,
      nombre: `Prospecto Sintético ${sufijo()} ${MARCA}`,
      contacto: "5500000020",
      estatus: "INTERESADO",
      ...cambios,
    })
    .select("id");
  reg.anotar("prospectos", data);
  return error;
}

function esperarRechazoPor(error: PostgrestError | null, codigo: string, nombre: string) {
  expect(error, "se esperaba que la operación fuera rechazada").not.toBeNull();
  expect(error?.code).toBe(codigo);
  expect(error?.message).toContain(nombre);
}

describe("Integridad prospectos: contacto de 10 dígitos", () => {
  it("acepta 10 dígitos", async () => {
    expect(await insertar({ contacto: "5512345678" })).toBeNull();
  });

  for (const [caso, contacto] of [
    ["9 dígitos", "551234567"],
    ["11 dígitos", "55123456789"],
    ["con espacios", "55 1234 5678"],
    ["con letras", "abcdefghij"],
    ["vacío", ""],
    ["dígitos de ancho completo", "５５１２３４５６７８"],
  ] as const) {
    it(`rechaza un contacto ${caso} (23514)`, async () => {
      esperarRechazoPor(await insertar({ contacto }), CHECK_VIOLADO, "prospectos_contacto_10_digitos");
    });
  }
});

describe("Integridad prospectos: nombre, comentarios y estatus", () => {
  it("acepta comentarios de 1000 caracteres y rechaza 1001 (23514)", async () => {
    expect(await insertar({ comentarios: "a".repeat(1000) })).toBeNull();
    esperarRechazoPor(
      await insertar({ comentarios: "a".repeat(1001) }),
      CHECK_VIOLADO,
      "prospectos_comentarios_largo_maximo",
    );
  });

  it("rechaza un nombre de solo espacios (23514)", async () => {
    esperarRechazoPor(await insertar({ nombre: "   " }), CHECK_VIOLADO, "prospectos_nombre_no_vacio");
  });

  it("rechaza un nombre de más de 150 caracteres (23514)", async () => {
    esperarRechazoPor(await insertar({ nombre: "a".repeat(151) }), CHECK_VIOLADO, "prospectos_nombre_largo_maximo");
  });

  for (const estatus of ["NO INTERESADO", "INTERMITENTE ", "interesado", "CIERRE"]) {
    it(`rechaza el estatus ${JSON.stringify(estatus)} (22P02)`, async () => {
      esperarRechazoPor(await insertar({ estatus }), VALOR_INVALIDO, "estatus_prospecto");
    });
  }
});

describe("Integridad prospectos: guardia de datos sensibles", () => {
  for (const [caso, campo, valor] of [
    ["un RFC genérico en comentarios", "comentarios", "Su RFC es XAXX010101000"],
    ["una CURP genérica en comentarios", "comentarios", "CURP XEXX010101HNEXXXA4"],
    ["una CLABE de 18 ceros seguidos", "comentarios", "CLABE 000000000000000000"],
    ["una CLABE de 18 ceros separada con espacios", "comentarios", "CLABE 000 000 00000000000 0"],
    ["una CLABE de 18 ceros separada con guiones", "comentarios", "CLABE 000-000-00000000000-0"],
    ["un RFC genérico en el nombre", "nombre", `XAXX010101000 ${MARCA}`],
    ["un RFC genérico aislado en una frase", "comentarios", "su RFC es XAXX010101000."],
    ["una CURP genérica aislada en una frase", "comentarios", "su CURP es XEXX010101HNEXXXA4."],
  ] as const) {
    it(`rechaza ${caso} (23514)`, async () => {
      esperarRechazoPor(await insertar({ [campo]: valor }), CHECK_VIOLADO, "prospectos_sin_datos_sensibles");
    });
  }

  for (const [caso, valor] of [
    ["dos teléfonos de 10 dígitos separados por un espacio", "Llamar al 5512345678 5587654321"],
    ['"llamar el 15/10"', "llamar el 15/10"],
    ["un teléfono de 10 dígitos", "Su otro número es 5512345678"],
    ["un texto normal", "Interesado en el plazo de 12 meses; pidió la cotización por correo."],
    ["19 dígitos seguidos (no es una CLABE)", "Folio 0000000000000000000"],
    ["17 dígitos seguidos (no es una CLABE)", "Folio 00000000000000000"],
    ["un correo sintético con letras y una fecha pegadas", "Escribir a prospecto900101abc@ejemplo.test"],
  ] as const) {
    it(`acepta ${caso}`, async () => {
      expect(await insertar({ comentarios: valor })).toBeNull();
    });
  }
});

describe("Integridad prospectos: no se reasigna ni se apunta a un ejecutivo inexistente", () => {
  it("ni el administrador puede cambiar el ejecutivo (23514 con mensaje en español)", async () => {
    const { idsUsuarios } = inject("rls");
    const id = await reg.crearProspecto({ ejecutivoId: idsUsuarios.E1 });
    const { error } = await admin.from("prospectos").update({ ejecutivo_id: idsUsuarios.E2 }).eq("id", id);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(error?.message).toBe(MSJ_REASIGNAR);
  });

  it("un ejecutivo inexistente da 23503", async () => {
    esperarRechazoPor(await insertar({ ejecutivo_id: randomUUID() }), LLAVE_FORANEA_VIOLADA, "prospectos_ejecutivo_id_fkey");
  });
});
