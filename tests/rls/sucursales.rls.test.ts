// Pruebas de solo lectura de la política de RLS sobre public.sucursales.
// Comparan el conjunto exacto de sucursales visibles para cada persona.

import { describe, expect, inject, it } from "vitest";
import { clavesDe, esperarSinFilasOPermisoDenegado, ordenadas } from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import type { ClaveSucursal, ClaveUsuario } from "./fixtures";

interface Caso {
  nombre: string;
  quien: ClaveUsuario;
  ve: ClaveSucursal[];
}

const CASOS: Caso[] = [
  { nombre: "el director D1 ve todas las sucursales de su organización", quien: "D1", ve: ["A1", "A2"] },
  {
    nombre: "el gerente G1 ve su sucursal y la de su subordinado E6 en otra sucursal",
    quien: "G1",
    ve: ["A1", "A2"],
  },
  { nombre: "el gerente G2 ve solo su sucursal, donde están él y su subordinado", quien: "G2", ve: ["A2"] },
  { nombre: "un ejecutivo (E1) ve solo su sucursal", quien: "E1", ve: ["A1"] },
  { nombre: "un ejecutivo de la sucursal 2 (E3) ve solo su sucursal", quien: "E3", ve: ["A2"] },
  {
    nombre: "un ejecutivo (E6) ve solo su sucursal, no la de su jefe",
    quien: "E6",
    ve: ["A2"],
  },
  { nombre: "el director D2 ve solo las sucursales de su organización", quien: "D2", ve: ["B1"] },
  { nombre: "un ejecutivo de la organización B (E4) ve solo su sucursal", quien: "E4", ve: ["B1"] },
  { nombre: "un usuario inactivo (E5) no ve ninguna sucursal", quien: "E5", ve: [] },
];

describe("RLS sucursales: cada quien ve exactamente las sucursales que le corresponden", () => {
  for (const caso of CASOS) {
    it(caso.nombre, async () => {
      const { idsSucursales } = inject("rls");
      const cliente = await comoUsuario(caso.quien);

      const { data, error } = await cliente.from("sucursales").select("id");

      expect(error).toBeNull();
      expect(clavesDe(data ?? [], idsSucursales)).toEqual(ordenadas(caso.ve));
    });
  }

  it("anon no ve ninguna sucursal (o recibe permisos denegados)", async () => {
    const resultado = await comoAnonimo().from("sucursales").select("id");
    esperarSinFilasOPermisoDenegado(resultado);
  });
});
