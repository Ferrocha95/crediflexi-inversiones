import { rmSync } from "node:fs";
import path from "node:path";
import { test as teardown } from "@playwright/test";
import { borrarTodoE2E, RUTA_SESION } from "./usuarios";

// Proyecto "limpieza" (teardown del setup): borra los usuarios @e2e.test, la
// organización E2E y la sesión guardada.
teardown("borrar los usuarios e2e y la sesión guardada", async () => {
  await borrarTodoE2E();
  rmSync(path.dirname(RUTA_SESION), { recursive: true, force: true });
});
