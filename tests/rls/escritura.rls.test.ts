// Pruebas de escritura con RLS: nadie que no sea administrador puede insertar,
// actualizar ni borrar en organizaciones, sucursales ni usuarios.
// Cada intento debe fallar con 42501 (permiso denegado) y, después de cada uno,
// un administrador confirma que los datos no cambiaron.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { comoAdmin, sufijo } from "./admin";
import { PERMISO_DENEGADO } from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import { MARCA } from "./fixtures";
import { tomarFotoBase } from "./foto";

type Actor = "E1" | "G1" | "D1" | "anon";
type Tabla = "organizaciones" | "sucursales" | "usuarios";

const ACTORES: Actor[] = ["E1", "G1", "D1", "anon"];
const TABLAS: Tabla[] = ["organizaciones", "sucursales", "usuarios"];

const clientes = {} as Record<Actor, SupabaseClient>;

beforeAll(async () => {
  for (const actor of ACTORES) {
    clientes[actor] = actor === "anon" ? comoAnonimo() : await comoUsuario(actor);
  }
});

// Confirma con administrador que los datos base siguen idénticos a la foto
// tomada al crearlos y que no apareció ninguna fila con el nombre intentado.
async function confirmarSinCambios(tabla: Tabla, nombreIntentado?: string): Promise<void> {
  const rls = inject("rls");
  const admin = comoAdmin();

  expect(await tomarFotoBase(admin, rls)).toEqual(rls.fotoBase);

  if (nombreIntentado) {
    const { data, error } = await admin.from(tabla).select("id").eq("nombre", nombreIntentado);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  }
}

function filaNueva(tabla: Tabla, nombre: string): Record<string, unknown> {
  const { idsOrganizaciones, idsSucursales } = inject("rls");
  switch (tabla) {
    case "organizaciones":
      return { nombre };
    case "sucursales":
      return { organizacion_id: idsOrganizaciones.A, nombre };
    case "usuarios":
      return { auth_id: randomUUID(), nombre, rol: "EJECUTIVO", sucursal_id: idsSucursales.A1 };
  }
}

// Fila base que cada intento de update/delete apunta, según la tabla.
function objetivo(tabla: Tabla): string {
  const { idsOrganizaciones, idsSucursales, idsUsuarios } = inject("rls");
  switch (tabla) {
    case "organizaciones":
      return idsOrganizaciones.A;
    case "sucursales":
      return idsSucursales.A1;
    case "usuarios":
      return idsUsuarios.E2;
  }
}

describe("RLS escritura: nadie sin privilegios de administrador puede modificar datos", () => {
  for (const actor of ACTORES) {
    for (const tabla of TABLAS) {
      it(`${actor} no puede insertar en ${tabla} (42501) y no aparece ninguna fila nueva`, async () => {
        const nombre = `Intrusa ${sufijo()} ${MARCA}`;
        // Sin .select(): con RETURNING, un insert permitido también devolvería
        // 42501 si la fila nueva no pasa la política de lectura, y la prueba no
        // distinguiría ese caso de un insert rechazado.
        const { data, error } = await clientes[actor].from(tabla).insert(filaNueva(tabla, nombre));

        expect(data).toBeNull();
        expect(error?.code).toBe(PERMISO_DENEGADO);
        await confirmarSinCambios(tabla, nombre);
      });

      it(`${actor} no puede actualizar ${tabla} (42501) y los datos no cambian`, async () => {
        const { data, error } = await clientes[actor]
          .from(tabla)
          .update({ nombre: `Alterada ${sufijo()}` })
          .eq("id", objetivo(tabla))
          .select("id");

        expect(data).toBeNull();
        expect(error?.code).toBe(PERMISO_DENEGADO);
        await confirmarSinCambios(tabla);
      });

      it(`${actor} no puede borrar en ${tabla} (42501) y los datos no cambian`, async () => {
        const { data, error } = await clientes[actor]
          .from(tabla)
          .delete()
          .eq("id", objetivo(tabla))
          .select("id");

        expect(data).toBeNull();
        expect(error?.code).toBe(PERMISO_DENEGADO);
        await confirmarSinCambios(tabla);
      });
    }
  }
});

describe("RLS escritura: un ejecutivo no puede cambiar sus propios datos de control", () => {
  const cambios: { nombre: string; valores: Record<string, unknown> }[] = [
    { nombre: "E1 no puede ascenderse cambiando su propio rol", valores: { rol: "DIRECTOR_REGIONAL" } },
    { nombre: "E1 no puede quitarse o cambiar su propio jefe", valores: { jefe_id: null } },
    { nombre: "E1 no puede cambiar su propio campo activo", valores: { activo: false } },
  ];

  for (const cambio of cambios) {
    it(`${cambio.nombre} (42501) y su fila no cambia`, async () => {
      const { idsUsuarios } = inject("rls");
      const { data, error } = await clientes.E1
        .from("usuarios")
        .update(cambio.valores)
        .eq("id", idsUsuarios.E1)
        .select("id");

      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISO_DENEGADO);
      await confirmarSinCambios("usuarios");
    });
  }
});
