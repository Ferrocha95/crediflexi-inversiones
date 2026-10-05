// El esquema privado y las funciones de trigger no deben ser alcanzables por la
// Data API: un usuario autenticado no puede llamarlas por RPC ni consultar el
// esquema privado, y ninguna llamada devuelve datos.

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { comoUsuario } from "./clientes";

let e1: SupabaseClient;

beforeAll(async () => {
  e1 = await comoUsuario("E1");
});

// PGRST106: esquema no expuesto. PGRST202: función no encontrada en el caché
// de esquema. 42501: permiso denegado.
const CODIGOS_ACEPTADOS = ["PGRST106", "PGRST202", "42501"];

function esperarFalloSinDatos(
  resultado: { data: unknown; error: PostgrestError | null },
  codigos: readonly string[] = CODIGOS_ACEPTADOS,
) {
  expect(resultado.error, "se esperaba que la llamada fallara").not.toBeNull();
  expect(codigos).toContain(resultado.error?.code);
  expect(resultado.data).toBeNull();
}

// Apuntar a .schema("privado") debe fallar porque el esquema no está expuesto.
function esperarEsquemaNoExpuesto(resultado: { data: unknown; error: PostgrestError | null }) {
  esperarFalloSinDatos(resultado, ["PGRST106"]);
}

describe("RLS privado: las funciones auxiliares no se exponen por la API", () => {
  it("authenticated no puede llamar por RPC a subordinados (no está en public)", async () => {
    const { idsUsuarios } = inject("rls");
    esperarFalloSinDatos(await e1.rpc("subordinados", { p_jefe: idsUsuarios.E1 }));
  });

  it("authenticated no puede llamar por RPC a usuario_actual (no está en public)", async () => {
    esperarFalloSinDatos(await e1.rpc("usuario_actual"));
  });

  it("authenticated no puede llamar por RPC a subordinados apuntando al esquema privado", async () => {
    const { idsUsuarios } = inject("rls");
    esperarEsquemaNoExpuesto(await e1.schema("privado").rpc("subordinados", { p_jefe: idsUsuarios.E1 }));
  });

  it("authenticated no puede llamar por RPC a usuario_actual apuntando al esquema privado", async () => {
    esperarEsquemaNoExpuesto(await e1.schema("privado").rpc("usuario_actual"));
  });

  it("authenticated no puede llamar por RPC a sucursal_visible apuntando al esquema privado", async () => {
    const { idsSucursales } = inject("rls");
    esperarEsquemaNoExpuesto(await e1.schema("privado").rpc("sucursal_visible", { p_sucursal: idsSucursales.A1 }));
  });

  it("authenticated no puede consultar tablas a través del esquema privado", async () => {
    esperarEsquemaNoExpuesto(await e1.schema("privado").from("usuarios").select("id"));
  });
});

describe("RLS privado: las funciones de trigger de public no se pueden llamar por RPC", () => {
  for (const funcion of [
    "fijar_actualizado_en",
    "validar_cadena_de_mando",
    "impedir_cambio_organizacion_sucursal",
    "impedir_reasignar_prospecto",
    "fijar_archivado_en",
  ]) {
    it(`authenticated no puede llamar por RPC a public.${funcion}`, async () => {
      esperarFalloSinDatos(await e1.rpc(funcion));
    });
  }
});

describe("RLS privado: las funciones auxiliares de prospectos no se exponen por la API", () => {
  for (const funcion of ["usuario_actual_id", "usuarios_de_mi_organizacion", "parece_dato_sensible"]) {
    it(`authenticated no puede llamar por RPC a ${funcion} (no está en public)`, async () => {
      esperarFalloSinDatos(await e1.rpc(funcion));
    });

    it(`authenticated no puede llamar por RPC a ${funcion} apuntando al esquema privado`, async () => {
      esperarEsquemaNoExpuesto(await e1.schema("privado").rpc(funcion));
    });
  }
});
