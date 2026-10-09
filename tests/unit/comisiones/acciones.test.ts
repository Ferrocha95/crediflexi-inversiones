import { beforeEach, describe, expect, it, vi } from "vitest";

// La acción lee el encabezado Host con headers() de next/headers; aquí se simula.
const encabezados = vi.hoisted(() => ({ host: "localhost:3000" as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(encabezados.host === null ? {} : { host: encabezados.host }),
}));

// La acción comprueba al usuario con usuarioActual(); aquí, activo salvo que la prueba diga otra cosa.
const sesion = vi.hoisted(() => ({ activo: true, llamadas: 0 }));
vi.mock("../../../src/servidor/sesion", () => ({
  usuarioActual: async () => {
    sesion.llamadas += 1;
    return sesion.activo ? { id: "u-1", nombre: "Ejecutivo Sintético", rol: "EJECUTIVO" } : null;
  },
}));

import { simular } from "../../../src/app/(app)/comisiones/acciones";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_FORMA_COMISIONES, simularCon, type RespuestaComisiones } from "../../../src/servidor/comisiones";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";

const base = {
  peticion: 3,
  perfil: "interno",
  rol: "EJECUTIVO",
  inversiones: [
    { tipo: "nueva", monto: "500,000", plazo: 12, fecha: "2026-10-07" },
    { tipo: "nueva", monto: "400000", plazo: 6, fecha: "2026-10-09" },
  ],
  equipo: [] as unknown[],
  externos: [] as unknown[],
};

function modelo(r: RespuestaComisiones) {
  if (r.resultado.tipo !== "modelo") throw new Error(`Se esperaba el modelo: ${JSON.stringify(r.resultado)}`);
  return r.resultado.modelo;
}

function error(r: RespuestaComisiones) {
  if (r.resultado.tipo !== "error") throw new Error(`Se esperaba un error: ${JSON.stringify(r.resultado)}`);
  return r.resultado;
}

beforeEach(() => {
  encabezados.host = "localhost:3000";
  sesion.activo = true;
  sesion.llamadas = 0;
});

describe("acción simular (/comisiones)", () => {
  it("calcula el mes con la semilla real y devuelve el número de petición", async () => {
    const r = await simular(base);
    expect(r.peticion).toBe(3);
    expect(modelo(r).totales.comisionPagable).toBe("$18,450.00");
  });

  it("la respuesta solo trae texto y números (nada de Decimal)", async () => {
    const r = await simular(base);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it("sin usuario activo responde el aviso de sesión expirada", async () => {
    sesion.activo = false;
    expect(error(await simular(base)).mensaje).toBe(MENSAJE_SESION_EXPIRADA);
  });

  it("con Host no local responde el mensaje del guardia sin leer la sesión", async () => {
    encabezados.host = "crediflexi.example.com";
    expect(error(await simular(base)).mensaje).toBe(MENSAJE_HOST_NO_LOCAL);
    expect(sesion.llamadas).toBe(0);
  });

  it.each([
    ["sin perfil", { perfil: undefined }],
    ["perfil desconocido", { perfil: "socio" }],
    ["rol desconocido", { rol: "DIRECTOR_REGIONAL" }],
    ["clave de más", { extra: 1 }],
    ["plazo con decimales", { inversiones: [{ ...base.inversiones[0], plazo: 12.5 }] }],
    ["tipo desconocido", { inversiones: [{ ...base.inversiones[0], tipo: "incremento" }] }],
    ["monto demasiado largo", { inversiones: [{ ...base.inversiones[0], monto: "9".repeat(41) }] }],
    ["más de 50 inversiones", { inversiones: Array.from({ length: 51 }, () => base.inversiones[0]) }],
  ])("forma inválida (%s): mensaje de forma", async (_, cambio) => {
    expect(error(await simular({ ...base, ...cambio })).mensaje).toBe(MENSAJE_FORMA_COMISIONES);
  });

  it("GERENTE con inversiones del equipo: el bono de gerente llega aparte", async () => {
    const r = await simular({
      ...base,
      rol: "GERENTE",
      equipo: [
        { tipo: "nueva", monto: "500,000", plazo: 12 },
        { tipo: "nueva", monto: "400000", plazo: 6 },
        { tipo: "renovacion", monto: "500000", plazo: 12 },
      ],
    });
    expect(modelo(r).bonoGerente).toMatchObject({ base: "$25,215.00", bono: "$7,564.50" });
  });

  it("la captación de red externa ya no se acepta (forma inválida)", async () => {
    expect(error(await simular({ ...base, captacionRedExterna: "500000" })).mensaje).toBe(MENSAJE_FORMA_COMISIONES);
  });

  it("EJECUTIVO con Mis externos: la comisión por externos llega aparte (25,215.00 -> 7,564.50, desbloqueada)", async () => {
    const r = await simular({
      ...base,
      externos: [
        { tipo: "nueva", monto: "500,000", plazo: 12 },
        { tipo: "nueva", monto: "400000", plazo: 6 },
        { tipo: "renovacion", monto: "500000", plazo: 12 },
      ],
    });
    expect(modelo(r).redExterna).toMatchObject({ base: "$25,215.00", comision: "$7,564.50", desbloqueada: true });
  });

  it("50 inversiones de Mis externos se aceptan; 51 son forma inválida", async () => {
    const de = (n: number) => Array.from({ length: n }, () => ({ tipo: "nueva", monto: "500000", plazo: 12 }));
    expect(modelo(await simular({ ...base, externos: de(50) })).redExterna).not.toBeNull();
    expect(error(await simular({ ...base, externos: de(51) })).mensaje).toBe(MENSAJE_FORMA_COMISIONES);
  });

  it("una inversión de Mis externos con fecha o con claves de más: forma inválida", async () => {
    const r = await simular({ ...base, externos: [{ tipo: "nueva", monto: "500000", plazo: 12, fecha: "2026-10-07" }] });
    expect(error(r).mensaje).toBe(MENSAJE_FORMA_COMISIONES);
  });

  it("más de 50 inversiones del equipo: forma inválida", async () => {
    const equipo = Array.from({ length: 51 }, () => ({ tipo: "nueva", monto: "500000", plazo: 12 }));
    expect(error(await simular({ ...base, rol: "GERENTE", equipo })).mensaje).toBe(MENSAJE_FORMA_COMISIONES);
  });

  it("un error del motor llega con su mensaje en español", async () => {
    const r = await simular({ ...base, inversiones: [{ ...base.inversiones[0], monto: "20000" }] });
    expect(error(r).mensaje).toMatch(/^Inversión 1: .*\$30,000\.00/);
  });

  it("si la semilla de comisiones no se puede leer, lo dice", async () => {
    const r = await simularCon(base, "localhost:3000", async () => ({
      ok: false,
      error: { codigo: "SEMILLA_INVALIDA", mensaje: "seed/parametros_iniciales.json: la parte de comisiones no es válida." },
    }));
    expect(error(r).mensaje).toContain("seed/parametros_iniciales.json");
  });
});
