// Pruebas de integridad con escrituras de administrador (service_role, sin RLS).
// Comprueban triggers, restricciones e índices de las migraciones.
//
// Cada prueba crea sus propias filas marcadas (rls.test) con un Registro y las
// borra en afterEach, pase o falle. No tocan los datos base de fixtures.ts.

import { randomUUID } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Registro, comoAdmin, sufijo } from "./admin";
import {
  CHECK_VIOLADO,
  LLAVE_FORANEA_VIOLADA,
  UNICO_VIOLADO,
  VALOR_INVALIDO,
} from "./ayudas";
import { MARCA } from "./fixtures";

const MSJ_AUTOJEFE = "Un usuario no puede ser su propio jefe.";
const MSJ_CICLO = "No se puede asignar ese jefe: formaría un ciclo en la cadena de mando.";
const MSJ_JEFE_OTRA_ORG = "No se puede asignar ese jefe: pertenece a otra organización.";
const MSJ_MOVER_OTRA_ORG = "No se puede mover al usuario a una sucursal de otra organización.";
const MSJ_CAMBIAR_ORG_SUCURSAL = "No se puede cambiar la organización de una sucursal.";

const admin = comoAdmin();
let reg: Registro;

beforeEach(() => {
  reg = new Registro(admin);
});

afterEach(async () => {
  await reg.limpiar();
});

async function leerUsuario(id: string) {
  const { data, error } = await admin.from("usuarios").select("*").eq("id", id).single();
  expect(error).toBeNull();
  return data;
}

// Organización con una sucursal, lista para colgar usuarios.
async function orgConSucursal() {
  const organizacionId = await reg.crearOrganizacion();
  const sucursalId = await reg.crearSucursal(organizacionId);
  return { organizacionId, sucursalId };
}

function esperarRechazo(error: PostgrestError | null, codigo: string, mensaje?: string) {
  expect(error, "se esperaba que la operación fuera rechazada").not.toBeNull();
  expect(error?.code).toBe(codigo);
  if (mensaje !== undefined) expect(error?.message).toBe(mensaje);
}

// Los mensajes nativos de Postgres quedan en inglés (la traducción se hará en
// la app); basta con exigir que nombren la restricción o el tipo que falló.
function esperarRechazoPor(error: PostgrestError | null, codigo: string, restriccion: string) {
  esperarRechazo(error, codigo);
  expect(error?.message).toContain(restriccion);
}

// ---------------------------------------------------------------------------
// Escenarios que producen un error de restricción.
// ---------------------------------------------------------------------------

async function intentarOrganizacionDuplicada() {
  const base = `Duplicada ${sufijo()}`;
  const primera = await admin
    .from("organizaciones")
    .insert({ nombre: `${base} ${MARCA}` })
    .select("id");
  reg.anotar("organizaciones", primera.data);
  expect(primera.error).toBeNull();

  const r = await admin
    .from("organizaciones")
    .insert({ nombre: `  ${base.toUpperCase()} ${MARCA}  ` })
    .select("id");
  reg.anotar("organizaciones", r.data);
  return r.error;
}

async function intentarSucursalDuplicada() {
  const organizacionId = await reg.crearOrganizacion();
  const base = `Repetida ${sufijo()}`;
  const primera = await admin
    .from("sucursales")
    .insert({ organizacion_id: organizacionId, nombre: `${base} ${MARCA}` })
    .select("id");
  reg.anotar("sucursales", primera.data);
  expect(primera.error).toBeNull();

  const r = await admin
    .from("sucursales")
    .insert({ organizacion_id: organizacionId, nombre: ` ${base.toLowerCase()} ${MARCA.toUpperCase()} ` })
    .select("id");
  reg.anotar("sucursales", r.data);
  return { error: r.error, organizacionId, nombre: `${base} ${MARCA}` };
}

async function intentarOrganizacionSinNombre(nombre: string) {
  const r = await admin.from("organizaciones").insert({ nombre }).select("id");
  reg.anotar("organizaciones", r.data);
  return r.error;
}

async function intentarNivelN4() {
  const { sucursalId } = await orgConSucursal();
  const u = await reg.crearUsuario({ sucursalId });
  const { error } = await admin.from("usuarios").update({ nivel_comision: "N4" }).eq("id", u.id);
  return { error, usuario: u };
}

async function intentarRolInvalido() {
  const { sucursalId } = await orgConSucursal();
  const u = await reg.crearUsuario({ sucursalId });
  const { error } = await admin.from("usuarios").update({ rol: "JEFE_SUPREMO" }).eq("id", u.id);
  return { error, usuario: u };
}

async function intentarBorrarJefeConSubordinados() {
  const { sucursalId } = await orgConSucursal();
  const jefe = await reg.crearUsuario({ sucursalId, rol: "GERENTE" });
  await reg.crearUsuario({ sucursalId, jefeId: jefe.id });
  const { error } = await admin.from("usuarios").delete().eq("id", jefe.id);
  return { error, jefe };
}

async function intentarBorrarSucursalConUsuarios() {
  const { sucursalId } = await orgConSucursal();
  await reg.crearUsuario({ sucursalId });
  const { error } = await admin.from("sucursales").delete().eq("id", sucursalId);
  return { error, sucursalId };
}

async function intentarBorrarOrganizacionConSucursales() {
  const { organizacionId } = await orgConSucursal();
  const { error } = await admin.from("organizaciones").delete().eq("id", organizacionId);
  return { error, organizacionId };
}

async function intentarBorrarCuentaConUsuario() {
  const { sucursalId } = await orgConSucursal();
  const u = await reg.crearUsuario({ sucursalId });
  const { error } = await admin.auth.admin.deleteUser(u.authId);
  return { error, usuario: u };
}

// ---------------------------------------------------------------------------

describe("Integridad: cadena de mando", () => {
  it("rechaza que un usuario sea su propio jefe al actualizar", async () => {
    const { sucursalId } = await orgConSucursal();
    const u = await reg.crearUsuario({ sucursalId });

    const { error } = await admin.from("usuarios").update({ jefe_id: u.id }).eq("id", u.id);

    esperarRechazo(error, CHECK_VIOLADO, MSJ_AUTOJEFE);
    expect((await leerUsuario(u.id)).jefe_id).toBeNull();
  });

  it("rechaza que un usuario sea su propio jefe al insertar", async () => {
    const { sucursalId } = await orgConSucursal();
    const cuenta = await reg.crearCuenta();
    const id = randomUUID();

    const r = await admin
      .from("usuarios")
      .insert({ id, auth_id: cuenta.authId, nombre: "Autojefe", rol: "EJECUTIVO", sucursal_id: sucursalId, jefe_id: id })
      .select("id");
    reg.anotar("usuarios", r.data);

    esperarRechazo(r.error, CHECK_VIOLADO, MSJ_AUTOJEFE);
  });

  it("rechaza un ciclo directo: si Q reporta a P, P no puede reportar a Q", async () => {
    const { sucursalId } = await orgConSucursal();
    const p = await reg.crearUsuario({ sucursalId, rol: "GERENTE" });
    const q = await reg.crearUsuario({ sucursalId, jefeId: p.id });

    const { error } = await admin.from("usuarios").update({ jefe_id: q.id }).eq("id", p.id);

    esperarRechazo(error, CHECK_VIOLADO, MSJ_CICLO);
    expect((await leerUsuario(p.id)).jefe_id).toBeNull();
  });

  it("rechaza un ciclo de más de dos niveles: con P → Q → R → S, P no puede reportar a S", async () => {
    const { sucursalId } = await orgConSucursal();
    const p = await reg.crearUsuario({ sucursalId, rol: "DIRECTOR_REGIONAL" });
    const q = await reg.crearUsuario({ sucursalId, rol: "GERENTE", jefeId: p.id });
    const r = await reg.crearUsuario({ sucursalId, rol: "GERENTE", jefeId: q.id });
    const s = await reg.crearUsuario({ sucursalId, jefeId: r.id });

    const { error } = await admin.from("usuarios").update({ jefe_id: s.id }).eq("id", p.id);

    esperarRechazo(error, CHECK_VIOLADO, MSJ_CICLO);
    expect((await leerUsuario(p.id)).jefe_id).toBeNull();
  });

  it("rechaza al insertar un usuario cuyo jefe es de otra organización", async () => {
    const x = await orgConSucursal();
    const y = await orgConSucursal();
    const jefeY = await reg.crearUsuario({ sucursalId: y.sucursalId, rol: "GERENTE" });
    const cuenta = await reg.crearCuenta();

    const r = await admin
      .from("usuarios")
      .insert({ auth_id: cuenta.authId, nombre: "Cruzado", rol: "EJECUTIVO", sucursal_id: x.sucursalId, jefe_id: jefeY.id })
      .select("id");
    reg.anotar("usuarios", r.data);

    esperarRechazo(r.error, CHECK_VIOLADO, MSJ_JEFE_OTRA_ORG);
  });

  it("rechaza al actualizar el jefe de un usuario a alguien de otra organización", async () => {
    const x = await orgConSucursal();
    const y = await orgConSucursal();
    const jefeY = await reg.crearUsuario({ sucursalId: y.sucursalId, rol: "GERENTE" });
    const u = await reg.crearUsuario({ sucursalId: x.sucursalId });

    const { error } = await admin.from("usuarios").update({ jefe_id: jefeY.id }).eq("id", u.id);

    esperarRechazo(error, CHECK_VIOLADO, MSJ_JEFE_OTRA_ORG);
    expect((await leerUsuario(u.id)).jefe_id).toBeNull();
  });

  it("rechaza mover a un usuario a una sucursal de otra organización", async () => {
    const x = await orgConSucursal();
    const y = await orgConSucursal();
    const u = await reg.crearUsuario({ sucursalId: x.sucursalId });

    const { error } = await admin.from("usuarios").update({ sucursal_id: y.sucursalId }).eq("id", u.id);

    esperarRechazo(error, CHECK_VIOLADO, MSJ_MOVER_OTRA_ORG);
    expect((await leerUsuario(u.id)).sucursal_id).toBe(x.sucursalId);
  });
});

describe("Integridad: la organización de una sucursal no cambia", () => {
  it("rechaza cambiar organizacion_id de una sucursal a otra organización", async () => {
    const x = await orgConSucursal();
    const otra = await reg.crearOrganizacion();

    const { error } = await admin.from("sucursales").update({ organizacion_id: otra }).eq("id", x.sucursalId);

    esperarRechazo(error, CHECK_VIOLADO, MSJ_CAMBIAR_ORG_SUCURSAL);
    const { data } = await admin.from("sucursales").select("organizacion_id").eq("id", x.sucursalId).single();
    expect(data?.organizacion_id).toBe(x.organizacionId);
  });

  it("permite cambiar el nombre de una sucursal", async () => {
    const x = await orgConSucursal();
    const nombre = `Renombrada ${sufijo()} ${MARCA}`;

    const { error } = await admin.from("sucursales").update({ nombre }).eq("id", x.sucursalId);

    expect(error).toBeNull();
    const { data } = await admin.from("sucursales").select("nombre").eq("id", x.sucursalId).single();
    expect(data?.nombre).toBe(nombre);
  });

  it("permite \"cambiar\" organizacion_id de una sucursal al mismo valor", async () => {
    const x = await orgConSucursal();

    const { error } = await admin
      .from("sucursales")
      .update({ organizacion_id: x.organizacionId })
      .eq("id", x.sucursalId);

    expect(error).toBeNull();
  });
});

describe("Integridad: nombres únicos sin distinguir mayúsculas ni espacios", () => {
  it("rechaza una organización con el mismo nombre en otras mayúsculas y con espacios", async () => {
    esperarRechazoPor(await intentarOrganizacionDuplicada(), UNICO_VIOLADO, "organizaciones_nombre_unico");
  });

  it("rechaza una sucursal con el mismo nombre en la misma organización", async () => {
    const { error } = await intentarSucursalDuplicada();
    esperarRechazoPor(error, UNICO_VIOLADO, "sucursales_organizacion_nombre_unico");
  });

  it("permite el mismo nombre de sucursal en otra organización", async () => {
    const { nombre } = await intentarSucursalDuplicada();
    const otra = await reg.crearOrganizacion();

    const r = await admin.from("sucursales").insert({ organizacion_id: otra, nombre }).select("id");
    reg.anotar("sucursales", r.data);

    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(1);
  });
});

describe("Integridad: nombres vacíos", () => {
  for (const nombre of ["", "   "]) {
    const cual = nombre === "" ? "vacío" : "de solo espacios";

    it(`rechaza una organización con nombre ${cual}`, async () => {
      esperarRechazoPor(await intentarOrganizacionSinNombre(nombre), CHECK_VIOLADO, "organizaciones_nombre_no_vacio");
    });

    it(`rechaza una sucursal con nombre ${cual}`, async () => {
      const organizacionId = await reg.crearOrganizacion();
      const r = await admin.from("sucursales").insert({ organizacion_id: organizacionId, nombre }).select("id");
      reg.anotar("sucursales", r.data);
      esperarRechazoPor(r.error, CHECK_VIOLADO, "sucursales_nombre_no_vacio");
    });

    it(`rechaza un usuario con nombre ${cual}`, async () => {
      const { sucursalId } = await orgConSucursal();
      const cuenta = await reg.crearCuenta();
      const r = await admin
        .from("usuarios")
        .insert({ auth_id: cuenta.authId, nombre, rol: "EJECUTIVO", sucursal_id: sucursalId })
        .select("id");
      reg.anotar("usuarios", r.data);
      esperarRechazoPor(r.error, CHECK_VIOLADO, "usuarios_nombre_no_vacio");
    });
  }
});

describe("Integridad: nivel de comisión y rol", () => {
  it("rechaza nivel_comision 'N4'", async () => {
    const { error, usuario } = await intentarNivelN4();
    esperarRechazoPor(error, CHECK_VIOLADO, "usuarios_nivel_comision_valido");
    expect((await leerUsuario(usuario.id)).nivel_comision).toBeNull();
  });

  it("acepta nivel_comision 'N1'", async () => {
    const { sucursalId } = await orgConSucursal();
    const u = await reg.crearUsuario({ sucursalId });
    const { error } = await admin.from("usuarios").update({ nivel_comision: "N1" }).eq("id", u.id);
    expect(error).toBeNull();
    expect((await leerUsuario(u.id)).nivel_comision).toBe("N1");
  });

  it("acepta nivel_comision vacío (sin nivel asignado)", async () => {
    const { sucursalId } = await orgConSucursal();
    const u = await reg.crearUsuario({ sucursalId });
    await admin.from("usuarios").update({ nivel_comision: "N2" }).eq("id", u.id);
    const { error } = await admin.from("usuarios").update({ nivel_comision: null }).eq("id", u.id);
    expect(error).toBeNull();
    expect((await leerUsuario(u.id)).nivel_comision).toBeNull();
  });

  it("rechaza un rol que no es DIRECTOR_REGIONAL, GERENTE ni EJECUTIVO", async () => {
    const { error, usuario } = await intentarRolInvalido();
    esperarRechazoPor(error, VALOR_INVALIDO, "rol_usuario");
    expect((await leerUsuario(usuario.id)).rol).toBe("EJECUTIVO");
  });
});

describe("Integridad: on delete restrict", () => {
  it("rechaza borrar un usuario que tiene subordinados", async () => {
    const { error, jefe } = await intentarBorrarJefeConSubordinados();
    esperarRechazoPor(error, LLAVE_FORANEA_VIOLADA, "usuarios_jefe_id_fkey");
    await leerUsuario(jefe.id);
  });

  it("rechaza borrar una sucursal que tiene usuarios", async () => {
    const { error, sucursalId } = await intentarBorrarSucursalConUsuarios();
    esperarRechazoPor(error, LLAVE_FORANEA_VIOLADA, "usuarios_sucursal_id_fkey");
    const { data } = await admin.from("sucursales").select("id").eq("id", sucursalId);
    expect(data).toHaveLength(1);
  });

  it("rechaza borrar una organización que tiene sucursales", async () => {
    const { error, organizacionId } = await intentarBorrarOrganizacionConSucursales();
    esperarRechazoPor(error, LLAVE_FORANEA_VIOLADA, "sucursales_organizacion_id_fkey");
    const { data } = await admin.from("organizaciones").select("id").eq("id", organizacionId);
    expect(data).toHaveLength(1);
  });

  it("rechaza borrar una cuenta de auth que tiene fila en usuarios", async () => {
    const { error, usuario } = await intentarBorrarCuentaConUsuario();
    expect(error, "se esperaba que Auth rechazara el borrado").not.toBeNull();

    const cuenta = await admin.auth.admin.getUserById(usuario.authId);
    expect(cuenta.error).toBeNull();
    expect(cuenta.data.user?.id).toBe(usuario.authId);
    expect((await leerUsuario(usuario.id)).auth_id).toBe(usuario.authId);
  });
});

describe("Integridad: actualizado_en y creado_en", () => {
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function comprobarFechas(tabla: "organizaciones" | "sucursales" | "usuarios", id: string, cambio: Record<string, unknown>) {
    const antes = await admin.from(tabla).select("creado_en, actualizado_en").eq("id", id).single();
    expect(antes.error).toBeNull();
    await esperar(20);

    const { error } = await admin.from(tabla).update(cambio).eq("id", id);
    expect(error).toBeNull();

    const despues = await admin.from(tabla).select("creado_en, actualizado_en").eq("id", id).single();
    expect(despues.error).toBeNull();
    expect(despues.data?.creado_en).toBe(antes.data?.creado_en);
    expect(despues.data?.actualizado_en).not.toBe(antes.data?.actualizado_en);
    expect(new Date(despues.data?.actualizado_en).getTime()).toBeGreaterThan(
      new Date(antes.data?.actualizado_en).getTime(),
    );
  }

  it("en organizaciones, actualizado_en cambia al actualizar y creado_en no", async () => {
    const id = await reg.crearOrganizacion();
    await comprobarFechas("organizaciones", id, { nombre: `Actualizada ${sufijo()} ${MARCA}` });
  });

  it("en sucursales, actualizado_en cambia al actualizar y creado_en no", async () => {
    const { sucursalId } = await orgConSucursal();
    await comprobarFechas("sucursales", sucursalId, { nombre: `Actualizada ${sufijo()} ${MARCA}` });
  });

  it("en usuarios, actualizado_en cambia al actualizar y creado_en no", async () => {
    const { sucursalId } = await orgConSucursal();
    const u = await reg.crearUsuario({ sucursalId });
    await comprobarFechas("usuarios", u.id, { nombre: `Actualizado ${sufijo()}` });
  });
});
