// Pruebas de solo lectura de la política de RLS sobre public.usuarios.
// Comparan el conjunto exacto de usuarios visibles para cada persona.

import { describe, expect, inject, it } from "vitest";
import { clavesDe, esperarSinFilasOPermisoDenegado, ordenadas } from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import type { ClaveUsuario } from "./fixtures";

interface Caso {
  nombre: string;
  quien: ClaveUsuario;
  ve: ClaveUsuario[];
}

const CASOS: Caso[] = [
  { nombre: "un ejecutivo (E1) solo se ve a sí mismo", quien: "E1", ve: ["E1"] },
  { nombre: "un ejecutivo (E2) solo se ve a sí mismo", quien: "E2", ve: ["E2"] },
  { nombre: "un ejecutivo de otra sucursal (E3) solo se ve a sí mismo", quien: "E3", ve: ["E3"] },
  { nombre: "un ejecutivo de otra organización (E4) solo se ve a sí mismo", quien: "E4", ve: ["E4"] },
  {
    nombre: "el gerente G1 se ve a sí mismo y a todos sus subordinados, incluidos el inactivo y el de otra sucursal",
    quien: "G1",
    ve: ["G1", "E1", "E2", "E5", "E6"],
  },
  {
    nombre: "el gerente G2 se ve a sí mismo y a su subordinado, y no ve a E6 aunque comparten sucursal",
    quien: "G2",
    ve: ["G2", "E3"],
  },
  {
    nombre: "el director D1 ve a toda su organización y a nadie de la otra",
    quien: "D1",
    ve: ["D1", "G1", "E1", "E2", "E5", "G2", "E3", "E6"],
  },
  {
    nombre: "el director D2 ve a toda su organización y a nadie de la otra",
    quien: "D2",
    ve: ["D2", "E4"],
  },
  { nombre: "un usuario inactivo (E5) inicia sesión pero no ve ninguna fila", quien: "E5", ve: [] },
];

describe("RLS usuarios: cada quien ve exactamente lo que le corresponde", () => {
  for (const caso of CASOS) {
    it(caso.nombre, async () => {
      const { idsUsuarios } = inject("rls");
      const cliente = await comoUsuario(caso.quien);

      const { data, error } = await cliente.from("usuarios").select("id");

      expect(error).toBeNull();
      expect(clavesDe(data ?? [], idsUsuarios)).toEqual(ordenadas(caso.ve));
    });
  }

  it("anon no ve ninguna fila de usuarios (o recibe permisos denegados)", async () => {
    const resultado = await comoAnonimo().from("usuarios").select("id");
    esperarSinFilasOPermisoDenegado(resultado);
  });

  it("un ejecutivo (E1) no ve a su compañero E2, ni a su jefe G1, ni al director D1", async () => {
    const { idsUsuarios } = inject("rls");
    const e1 = await comoUsuario("E1");

    const { data, error } = await e1
      .from("usuarios")
      .select("id")
      .in("id", [idsUsuarios.E2, idsUsuarios.G1, idsUsuarios.D1]);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
