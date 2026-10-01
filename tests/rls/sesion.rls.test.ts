// Desactivar a un usuario corta su acceso a los datos de inmediato, aunque su
// sesión (token) siga siendo válida: RLS revisa usuarios.activo en cada consulta.
//
// El usuario se crea solo para esta prueba (marcado rls.test) y se borra al final,
// pase o falle.

import { afterEach, describe, expect, it } from "vitest";
import { Registro, comoAdmin } from "./admin";
import { iniciarSesion } from "./clientes";

const admin = comoAdmin();
const reg = new Registro(admin);

afterEach(async () => {
  await reg.limpiar();
});

describe("RLS sesión: desactivar a un usuario", () => {
  it("con la misma sesión, un usuario que se desactiva deja de ver su propia fila", async () => {
    const organizacionId = await reg.crearOrganizacion("Sesion");
    const sucursalId = await reg.crearSucursal(organizacionId, "Sesion");
    const u = await reg.crearUsuario({ sucursalId });

    const cliente = await iniciarSesion(u.correo, u.contrasena);

    const antes = await cliente.from("usuarios").select("id");
    expect(antes.error).toBeNull();
    expect(antes.data).toEqual([{ id: u.id }]);

    const desactivar = await admin.from("usuarios").update({ activo: false }).eq("id", u.id);
    expect(desactivar.error).toBeNull();

    const despues = await cliente.from("usuarios").select("id");
    expect(despues.error).toBeNull();
    expect(despues.data).toEqual([]);

    // Después lo borra y confirma que ya no existe ni la fila ni la cuenta.
    await reg.limpiar();
    const fila = await admin.from("usuarios").select("id").eq("id", u.id);
    expect(fila.data).toEqual([]);
    const cuenta = await admin.auth.admin.getUserById(u.authId);
    expect(cuenta.data.user).toBeNull();
  });
});
