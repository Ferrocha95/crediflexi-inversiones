import { beforeEach, describe, expect, it, vi } from "vitest";

// Las acciones leen el Host con headers(); aquí se simula.
const encabezados = vi.hoisted(() => ({ host: "localhost:3000" as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(encabezados.host === null ? {} : { host: encabezados.host }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

// Usuario activo salvo que la prueba diga otra cosa.
const sesion = vi.hoisted(() => ({ activo: true }));
vi.mock("../../../src/servidor/sesion", () => ({
  usuarioActual: async () => (sesion.activo ? { id: "u-1", nombre: "Ejecutivo Sintético", rol: "EJECUTIVO" } : null),
}));

// Si alguna de estas pruebas llegara a la base, fallaría aquí.
const base = vi.hoisted(() => ({ llamadas: 0 }));
vi.mock("../../../src/servidor/supabase/servidor", () => ({
  crearClienteServidor: async () => {
    base.llamadas += 1;
    throw new Error("Estas pruebas no deben llegar a la base.");
  },
}));

import { archivarProspecto, crearProspecto, editarProspecto, restaurarProspecto } from "../../../src/app/(app)/pipeline/acciones";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_FORMA_INVALIDA } from "../../../src/aplicacion/pipeline/entrada";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";

const ID = "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f";
const valido = { nombre: "Prospecto Sintético", contacto: "5512345678", comentarios: "", estatus: "INTERESADO", seguimiento: "" };

const llamadas = {
  crear: () => crearProspecto(valido),
  editar: () => editarProspecto(ID, valido),
  archivar: () => archivarProspecto(ID),
  restaurar: () => restaurarProspecto(ID),
};

beforeEach(() => {
  encabezados.host = "localhost:3000";
  sesion.activo = true;
  base.llamadas = 0;
});

describe.each(Object.entries(llamadas))("acción %s", (_nombre, llamar) => {
  it("con un Host que no es local responde el mensaje del guardia sin tocar la base", async () => {
    encabezados.host = "crediflexi.example";
    expect(await llamar()).toEqual({ ok: false, mensaje: MENSAJE_HOST_NO_LOCAL, errores: {} });
    expect(base.llamadas).toBe(0);
  });

  it("sin usuario activo responde que la sesión expiró", async () => {
    sesion.activo = false;
    expect(await llamar()).toEqual({ ok: false, mensaje: MENSAJE_SESION_EXPIRADA, errores: {} });
    expect(base.llamadas).toBe(0);
  });
});

describe("validación antes de la base", () => {
  it("crear con campos inválidos devuelve los errores por campo", async () => {
    const r = await crearProspecto({ ...valido, contacto: "123" });
    expect(r).toMatchObject({ ok: false, errores: { contacto: "El contacto debe tener 10 dígitos." } });
    expect(base.llamadas).toBe(0);
  });

  it("crear no acepta un ejecutivo_id del cliente", async () => {
    expect(await crearProspecto({ ...valido, ejecutivo_id: ID })).toEqual({ ok: false, mensaje: MENSAJE_FORMA_INVALIDA, errores: {} });
  });

  it.each([
    ["editar", () => editarProspecto("no-es-uuid", valido)],
    ["archivar", () => archivarProspecto(42)],
    ["restaurar", () => restaurarProspecto(null)],
  ])("%s con un id inválido no toca la base", async (_n, llamar) => {
    expect(await llamar()).toEqual({ ok: false, mensaje: MENSAJE_FORMA_INVALIDA, errores: {} });
    expect(base.llamadas).toBe(0);
  });
});
