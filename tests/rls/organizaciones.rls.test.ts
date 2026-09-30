// Pruebas de solo lectura de la política de RLS sobre public.organizaciones.
// Cada usuario activo ve únicamente su propia organización.

import { describe, expect, inject, it } from "vitest";
import { clavesDe, esperarSinFilasOPermisoDenegado } from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import type { ClaveOrganizacion, ClaveUsuario } from "./fixtures";

const USUARIOS_A: ClaveUsuario[] = ["D1", "G1", "E1", "E2", "E6", "G2", "E3"];
const USUARIOS_B: ClaveUsuario[] = ["D2", "E4"];

function casos(usuarios: ClaveUsuario[], organizacion: ClaveOrganizacion) {
  return usuarios.map((quien) => ({ quien, organizacion }));
}

describe("RLS organizaciones: cada quien ve solo su propia organización", () => {
  for (const { quien, organizacion } of [
    ...casos(USUARIOS_A, "A"),
    ...casos(USUARIOS_B, "B"),
  ]) {
    it(`${quien} ve solo la organización ${organizacion}, la suya`, async () => {
      const { idsOrganizaciones } = inject("rls");
      const cliente = await comoUsuario(quien);

      const { data, error } = await cliente.from("organizaciones").select("id");

      expect(error).toBeNull();
      expect(clavesDe(data ?? [], idsOrganizaciones)).toEqual([organizacion]);
    });
  }

  it("un usuario inactivo (E5) no ve ninguna organización", async () => {
    const e5 = await comoUsuario("E5");

    const { data, error } = await e5.from("organizaciones").select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anon no ve ninguna organización (o recibe permisos denegados)", async () => {
    const resultado = await comoAnonimo().from("organizaciones").select("id");
    esperarSinFilasOPermisoDenegado(resultado);
  });
});
