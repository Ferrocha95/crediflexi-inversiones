import { rmSync } from "node:fs";
import path from "node:path";
import { expect, test as teardown } from "@playwright/test";
import { borrarTodoE2E, contarRestosE2E, crearProspectoE2E, idsUsuariosE2E, idUsuarioE2E, RUTA_SESION, USUARIO_PRINCIPAL } from "./usuarios";

// Proyecto "limpieza" (teardown del setup): borra los usuarios @e2e.test, sus
// prospectos, la organización E2E y la sesión guardada. De paso comprueba la
// limpieza: deja a propósito un prospecto del usuario principal (prospectos.
// ejecutivo_id es "on delete restrict") y exige que no quede ningún resto.
teardown("borrar los usuarios e2e, sus prospectos y la sesión guardada, sin dejar restos", async () => {
  const principal = await idUsuarioE2E(USUARIO_PRINCIPAL.correo);
  expect(principal, "el usuario principal del setup debe existir").not.toBeNull();
  await crearProspectoE2E({ ejecutivoId: principal!, nombre: "Prospecto Sintético Limpieza", contacto: "5500000999", estatus: "INTERESADO" });

  const usuarios = await idsUsuariosE2E();
  await borrarTodoE2E();
  expect(await contarRestosE2E(usuarios)).toEqual({ cuentas: 0, usuarios: 0, prospectos: 0, organizaciones: 0 });

  rmSync(path.dirname(RUTA_SESION), { recursive: true, force: true });
});
