import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { borrarTodoE2E, crearOrganizacionE2E, crearUsuarioE2E, entrar, RUTA_SESION, USUARIO_PRINCIPAL } from "./usuarios";

// Proyecto "setup": deja una sesión iniciada para las demás pruebas. Borra
// restos de una corrida anterior, crea la organización y el usuario principal
// (@e2e.test) e inicia sesión por /acceso. La sesión se guarda fuera del
// repositorio (RUTA_SESION). La contraseña solo vive en memoria.
setup("crear el usuario principal e iniciar sesión", async ({ page }) => {
  await borrarTodoE2E();
  await crearOrganizacionE2E();
  const usuario = await crearUsuarioE2E(USUARIO_PRINCIPAL);
  await entrar(page, usuario.correo, usuario.contrasena);
  mkdirSync(path.dirname(RUTA_SESION), { recursive: true });
  await page.context().storageState({ path: RUTA_SESION });
});
