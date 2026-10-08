import { describe, expect, it } from "vitest";
import { camposParaServidor } from "../../../src/app/(app)/cotizador/ajustesPantalla";

const BASE = { entidad: "CREDIFLEXI", moneda: "MXN" as const, esquema: "mensual" as const, monto: "100,000", plazo: 12 };

describe("camposParaServidor", () => {
  it("plazo de tabla: el plazo elegido, los puntos y sin plazo especial", () => {
    expect(camposParaServidor({ ...BASE, puntosExtra: "1.0", especial: null })).toEqual({
      ...BASE,
      puntosExtra: "1.0",
      especial: null,
    });
  });

  it("plazo especial: los meses como número, las tasas sin espacios, la vacía como null, sin plazo de tabla ni puntos", () => {
    expect(
      camposParaServidor({ ...BASE, puntosExtra: "2.0", especial: { meses: " 9 ", tasaMensual: " 17 ", tasaFinal: "" } }),
    ).toEqual({ ...BASE, plazo: null, puntosExtra: "0.0", especial: { plazo: 9, tasaMensual: "17", tasaFinal: null } });
  });

  it.each(["", "abc", "9.5", "-"])("meses %j que no son un entero: plazo 0 (el servidor responde el error en español)", (meses) => {
    const r = camposParaServidor({ ...BASE, puntosExtra: "0.0", especial: { meses, tasaMensual: "17", tasaFinal: "" } });
    expect(r.especial?.plazo).toBe(0);
  });
});
