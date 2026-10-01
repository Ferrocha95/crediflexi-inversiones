// Casos de borde de la cadena de mando: usuario sin jefe, jefe inactivo a media
// cadena, ejecutivo con subordinado y cambio de jefe con sesiones abiertas.
//
// No tocan los datos base de fixtures.ts: cada prueba crea su propia
// organización con sucursales y usuarios marcados (rls.test) y los borra en
// afterEach, pase o falle. Se comparan conjuntos exactos de ids.

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Registro, comoAdmin, type UsuarioCreado } from "./admin";
import { clavesDe, ordenadas } from "./ayudas";
import { iniciarSesion } from "./clientes";

const admin = comoAdmin();
let reg: Registro;

beforeEach(() => {
  reg = new Registro(admin);
});

afterEach(async () => {
  await reg.limpiar();
});

function sesion(u: UsuarioCreado): Promise<SupabaseClient> {
  return iniciarSesion(u.correo, u.contrasena);
}

// Lee la tabla con la sesión dada y devuelve las claves visibles, ordenadas.
async function visibles<C extends string>(
  cliente: SupabaseClient,
  tabla: "organizaciones" | "sucursales" | "usuarios",
  ids: Record<C, string>,
): Promise<string[]> {
  const { data, error } = await cliente.from(tabla).select("id");
  expect(error).toBeNull();
  return clavesDe(data ?? [], ids);
}

describe("RLS bordes: usuario sin jefe", () => {
  it("cada quien ve lo que le toca cuando hay un ejecutivo sin jefe en la organización", async () => {
    const x = await reg.crearOrganizacion("Bordes");
    const s = await reg.crearSucursal(x, "Bordes");
    const d = await reg.crearUsuario({ sucursalId: s, rol: "DIRECTOR_REGIONAL" });
    const g = await reg.crearUsuario({ sucursalId: s, rol: "GERENTE", jefeId: d.id });
    const ec = await reg.crearUsuario({ sucursalId: s, rol: "EJECUTIVO", jefeId: g.id });
    const es = await reg.crearUsuario({ sucursalId: s, rol: "EJECUTIVO" });
    const ids = { D: d.id, G: g.id, Ec: ec.id, Es: es.id };

    expect(await visibles(await sesion(d), "usuarios", ids)).toEqual(ordenadas(["D", "G", "Ec", "Es"]));
    expect(await visibles(await sesion(g), "usuarios", ids)).toEqual(ordenadas(["G", "Ec"]));
    expect(await visibles(await sesion(ec), "usuarios", ids)).toEqual(["Ec"]);
    expect(await visibles(await sesion(es), "usuarios", ids)).toEqual(["Es"]);
  });
});

describe("RLS bordes: jefe inactivo a media cadena", () => {
  it("con D → G1 → G2 (inactivo) → E, la cadena no se corta y G2 no ve nada", async () => {
    const x = await reg.crearOrganizacion("Bordes");
    const s1 = await reg.crearSucursal(x, "Bordes");
    const s2 = await reg.crearSucursal(x, "Bordes");
    const d = await reg.crearUsuario({ sucursalId: s1, rol: "DIRECTOR_REGIONAL" });
    const g1 = await reg.crearUsuario({ sucursalId: s1, rol: "GERENTE", jefeId: d.id });
    const g2 = await reg.crearUsuario({ sucursalId: s1, rol: "GERENTE", jefeId: g1.id, activo: false });
    const e = await reg.crearUsuario({ sucursalId: s2, rol: "EJECUTIVO", jefeId: g2.id });
    const ids = { D: d.id, G1: g1.id, G2: g2.id, E: e.id };
    const sucursales = { S1: s1, S2: s2 };

    const clienteG1 = await sesion(g1);
    expect(await visibles(clienteG1, "usuarios", ids)).toEqual(ordenadas(["G1", "G2", "E"]));
    expect(await visibles(clienteG1, "sucursales", sucursales)).toEqual(ordenadas(["S1", "S2"]));

    const clienteG2 = await sesion(g2);
    expect(await visibles(clienteG2, "usuarios", ids)).toEqual([]);
    expect(await visibles(clienteG2, "sucursales", sucursales)).toEqual([]);
    expect(await visibles(clienteG2, "organizaciones", { X: x })).toEqual([]);

    expect(await visibles(await sesion(e), "usuarios", ids)).toEqual(["E"]);
    expect(await visibles(await sesion(d), "usuarios", ids)).toEqual(ordenadas(["D", "G1", "G2", "E"]));
  });
});

describe("RLS bordes: ejecutivo con subordinado", () => {
  it("un ejecutivo que es jefe de otro ejecutivo solo se ve a sí mismo, y el subordinado también", async () => {
    const x = await reg.crearOrganizacion("Bordes");
    const s = await reg.crearSucursal(x, "Bordes");
    const ex = await reg.crearUsuario({ sucursalId: s, rol: "EJECUTIVO" });
    const ey = await reg.crearUsuario({ sucursalId: s, rol: "EJECUTIVO", jefeId: ex.id });
    const ids = { Ex: ex.id, Ey: ey.id };

    expect(await visibles(await sesion(ex), "usuarios", ids)).toEqual(["Ex"]);
    expect(await visibles(await sesion(ey), "usuarios", ids)).toEqual(["Ey"]);
  });
});

describe("RLS bordes: cambio de jefe", () => {
  it("con las mismas sesiones, el jefe anterior deja de ver al usuario y el nuevo empieza a verlo", async () => {
    const x = await reg.crearOrganizacion("Bordes");
    const s = await reg.crearSucursal(x, "Bordes");
    const g1 = await reg.crearUsuario({ sucursalId: s, rol: "GERENTE" });
    const g2 = await reg.crearUsuario({ sucursalId: s, rol: "GERENTE" });
    const e = await reg.crearUsuario({ sucursalId: s, rol: "EJECUTIVO", jefeId: g1.id });
    const ids = { G1: g1.id, G2: g2.id, E: e.id };

    const clienteG1 = await sesion(g1);
    const clienteG2 = await sesion(g2);
    expect(await visibles(clienteG1, "usuarios", ids)).toEqual(ordenadas(["G1", "E"]));
    expect(await visibles(clienteG2, "usuarios", ids)).toEqual(["G2"]);

    const cambio = await admin.from("usuarios").update({ jefe_id: g2.id }).eq("id", e.id);
    expect(cambio.error).toBeNull();

    expect(await visibles(clienteG1, "usuarios", ids)).toEqual(["G1"]);
    expect(await visibles(clienteG2, "usuarios", ids)).toEqual(ordenadas(["G2", "E"]));
  });
});
