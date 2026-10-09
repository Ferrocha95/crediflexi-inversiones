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

import { fechaIsoEnMexico } from "../../../src/aplicacion/fecha";
import { MENSAJE_MONTO_CERO, MENSAJE_MONTO_ILEGIBLE } from "../../../src/aplicacion/monto";
import { previsualizar } from "../../../src/app/(app)/cotizador/acciones";
import { cotizar } from "../../../src/domain/interes/cotizar";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";
import type { RespuestaVistaPrevia } from "../../../src/servidor/vistaPrevia";
import { MENSAJE_FORMA_INVALIDA } from "../../../src/servidor/vistaPrevia";
import { semillaReal } from "../oro/ayudas";

const base = {
  peticion: 1,
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "1,500,000",
  plazo: 12 as number | null,
  /** La vista previa valida la fecha de inicio contra hoy: se usa hoy en la Ciudad de México. */
  fechaInicio: fechaIsoEnMexico(new Date()),
};

async function pedir(cambios: Record<string, unknown> = {}): Promise<RespuestaVistaPrevia> {
  return previsualizar({ ...base, ...cambios });
}

async function vista(cambios: Record<string, unknown> = {}) {
  const r = await pedir(cambios);
  if (r.resultado.tipo !== "vista_previa") throw new Error(`Se esperaba vista previa: ${JSON.stringify(r.resultado)}`);
  return r.resultado.vistaPrevia;
}

async function errorDe(cambios: Record<string, unknown> | unknown) {
  const r = typeof cambios === "object" && cambios !== null ? await pedir(cambios as Record<string, unknown>) : await previsualizar(cambios);
  if (r.resultado.tipo !== "error") throw new Error(`Se esperaba un error: ${JSON.stringify(r.resultado)}`);
  return { respuesta: r, ...r.resultado };
}

const valores = (r: RespuestaVistaPrevia) => (r.plazos ?? []).map((p) => p.valor);

beforeEach(() => {
  encabezados.host = "localhost:3000";
});

describe.each(["CREDIFLEXI", "RAMI_SISE"])("previsualizar (%s)", (entidad) => {
  it("ejemplo oficial: 1,500,000 pesos a 12 meses al 19% -> 23,750.00 y 285,000.00", async () => {
    const v = await vista({ entidad });
    expect(v.tasa).toBe("19.00%");
    expect(v.salidas.map((s) => [s.etiqueta, s.cifra])).toEqual([
      ["Rendimiento mensual (promedio)", "$23,750.00"],
      ["Rendimiento anual (12 meses)", "$285,000.00"],
      ["Rendimiento total (12 meses)", "$285,000.00"],
    ]);
    expect(v.salidas[0].operacion).toBe("1,500,000.00 × 0.19 ÷ 12 = 23,750.00");
    expect(v.solicitud.entidad).toBe(entidad);
  });

  it("devuelve los plazos disponibles con su etiqueta", async () => {
    const r = await pedir({ entidad });
    expect(r.plazos).toEqual([
      { valor: 6, etiqueta: "6 meses" },
      { valor: 12, etiqueta: "12 meses" },
      { valor: 18, etiqueta: "18 meses" },
      { valor: 24, etiqueta: "24 meses" },
    ]);
  });

  it("200,000 pesos a 6 meses no trae avisos", async () => {
    expect((await vista({ entidad, monto: "200000", plazo: 6 })).avisos).toEqual([]);
  });
});

describe("previsualizar: plazo", () => {
  it("sin plazo pide elegirlo y trae los plazos", async () => {
    const r = await pedir({ plazo: null });
    expect(r.resultado).toEqual({ tipo: "elige_plazo" });
    expect(valores(r)).toEqual([6, 12, 18, 24]);
  });

  it("un plazo que dejó de estar disponible (36 con 1,999,999.99) pide elegir otro, sin error", async () => {
    const r = await pedir({ monto: "1999999.99", plazo: 36 });
    expect(r.resultado).toEqual({ tipo: "elige_plazo" });
    expect(valores(r)).not.toContain(36);
  });
});

describe("previsualizar: errores del dominio y del monto, tal cual", () => {
  it("USD devuelve el error del dominio", async () => {
    const e = await errorDe({ moneda: "USD" });
    const dominio = cotizar(semillaReal, { entidad: "CREDIFLEXI", moneda: "USD", esquema: "mensual", monto: "1500000", plazo: 12 });
    if (dominio.ok) throw new Error("El dominio debía rechazar USD");
    expect(e.mensaje).toBe(dominio.error.mensaje);
    expect(e.respuesta.plazos).toBeNull();
  });

  it("un monto debajo del mínimo devuelve el mensaje del dominio", async () => {
    const e = await errorDe({ monto: "29,999.99" });
    expect(e.mensaje).toMatch(/por debajo del mínimo/);
  });

  it("un monto ilegible devuelve el mensaje de la pantalla", async () => {
    expect((await errorDe({ monto: "1.500.000" })).mensaje).toBe(MENSAJE_MONTO_ILEGIBLE);
  });

  it("un monto en cero devuelve su mensaje", async () => {
    expect((await errorDe({ monto: "0.00" })).mensaje).toBe(MENSAJE_MONTO_CERO);
  });

  it("una entidad que no existe devuelve el error del dominio", async () => {
    expect((await errorDe({ entidad: "ENTIDAD_SINTETICA" })).mensaje).toMatch(/no existe en la semilla/);
  });
});

describe("previsualizar: rechaza campos con forma inválida", () => {
  it.each([
    ["nulo", null],
    ["texto", "hola"],
    ["arreglo", [1, 2]],
  ])("entrada %s", async (_, entrada) => {
    const r = await previsualizar(entrada);
    expect(r.resultado).toMatchObject({ tipo: "error", mensaje: MENSAJE_FORMA_INVALIDA });
    expect(r.peticion).toBeNull();
    expect(r.plazos).toBeNull();
  });

  it.each([
    ["moneda desconocida", { moneda: "EUR" }],
    ["esquema desconocido", { esquema: "trimestral" }],
    ["plazo como texto", { plazo: "12" }],
    ["plazo con decimales", { plazo: 12.5 }],
    ["plazo negativo", { plazo: -6 }],
    ["monto como número", { monto: 1500000 }],
    ["monto demasiado largo", { monto: "1".repeat(41) }],
    ["entidad demasiado larga", { entidad: "E".repeat(41) }],
    ["número de petición negativo", { peticion: -1 }],
    ["sin número de petición", { peticion: undefined }],
    ["campo de más", { tasa: "0.99" }],
  ])("%s", async (_, cambios) => {
    const e = await errorDe(cambios);
    expect(e.mensaje).toBe(MENSAJE_FORMA_INVALIDA);
  });
});

describe("previsualizar: respuesta", () => {
  it("devuelve el número de petición recibido", async () => {
    expect((await pedir({ peticion: 41 })).peticion).toBe(41);
  });

  it("solo trae texto y números: sobrevive igual a JSON y no incluye la semilla", async () => {
    const r = await pedir();
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(JSON.stringify(r)).not.toMatch(/tasas_mxn|tramos|plazos_disponibles|limite_inferior/);
  });
});

describe("previsualizar: guardia de host", () => {
  it.each([["público", "ejemplo.com"], ["de la red local", "192.168.1.10:3000"], ["ausente", null]])(
    "con un Host %s no calcula nada y responde con el mensaje del guardia",
    async (_, host) => {
      encabezados.host = host;
      const r = await pedir();
      expect(r).toEqual({
        peticion: null,
        plazos: null,
        resultado: { tipo: "error", mensaje: MENSAJE_HOST_NO_LOCAL, detalles: [] },
      });
    },
  );

  it("con localhost sí calcula", async () => {
    encabezados.host = "127.0.0.1:3100";
    expect((await pedir()).resultado.tipo).toBe("vista_previa");
  });

  it("con Host no local no lee la sesión", async () => {
    encabezados.host = "ejemplo.com";
    sesion.llamadas = 0;
    await pedir();
    expect(sesion.llamadas).toBe(0);
  });
});

describe("previsualizar: usuario activo", () => {
  it("un usuario inactivo con sesión vigente no recibe vista previa: error en español", async () => {
    encabezados.host = "localhost:3000";
    sesion.activo = false;
    try {
      const r = await pedir({ peticion: 7 });
      expect(r).toEqual({
        peticion: 7,
        plazos: null,
        resultado: { tipo: "error", mensaje: MENSAJE_SESION_EXPIRADA, detalles: [] },
      });
    } finally {
      sesion.activo = true;
    }
  });

  it("con usuario activo calcula y consulta la sesión", async () => {
    encabezados.host = "localhost:3000";
    sesion.llamadas = 0;
    expect((await pedir()).resultado.tipo).toBe("vista_previa");
    expect(sesion.llamadas).toBe(1);
  });
});
