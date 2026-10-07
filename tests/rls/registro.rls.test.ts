// Registro público cerrado (supabase/config.toml: enable_signup = false en
// [auth] y en [auth.email]) y contraseñas con la regla de 12 caracteres,
// minúscula, mayúscula y dígito. Solo el administrador crea usuarios.

import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { generarContrasena } from "../../scripts/contrasena.mjs";
import { leerEntornoLocal, OPCIONES_CLIENTE } from "./entorno";

const entorno = leerEntornoLocal();
const admin = createClient(entorno.url, entorno.llaveSecreta, OPCIONES_CLIENTE);
const publico = createClient(entorno.url, entorno.llavePublicable, OPCIONES_CLIENTE);

const creados: string[] = [];
const correo = (sufijo: string) => `registro.${sufijo}.${Date.now()}@rls.test`;

afterAll(async () => {
  for (const id of creados) await admin.auth.admin.deleteUser(id);
});

async function existeCorreo(email: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.some((u) => u.email === email);
}

describe("registro público cerrado", () => {
  it("un signUp con la llave publicable falla y no crea la cuenta", async () => {
    const email = correo("publico");
    const { data, error } = await publico.auth.signUp({ email, password: generarContrasena() });
    if (data.user) creados.push(data.user.id);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("signup_disabled");
    expect(await existeCorreo(email)).toBe(false);
  });

  it("admin.createUser sigue funcionando con una contraseña generada", async () => {
    const email = correo("admin");
    const { data, error } = await admin.auth.admin.createUser({ email, password: generarContrasena(), email_confirm: true });
    if (data.user) creados.push(data.user.id);
    expect(error).toBeNull();
    expect(data.user?.email).toBe(email);
  });

  it.each(["abc123", "todominusculas1", "SoloLetrasLargas"])("una contraseña débil (%s) se rechaza incluso al administrador", async (password) => {
    const { data, error } = await admin.auth.admin.createUser({ email: correo("debil"), password, email_confirm: true });
    if (data.user) creados.push(data.user.id);
    expect(error?.code).toBe("weak_password");
  });

  it("la cuenta creada por el administrador puede iniciar sesión", async () => {
    const email = correo("entra");
    const password = generarContrasena();
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (data.user) creados.push(data.user.id);
    const cliente = createClient(entorno.url, entorno.llavePublicable, OPCIONES_CLIENTE);
    const { error } = await cliente.auth.signInWithPassword({ email, password });
    expect(error).toBeNull();
  });
});
