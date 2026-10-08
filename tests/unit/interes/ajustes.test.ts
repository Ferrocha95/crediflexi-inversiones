import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { Decimal } from "../../../src/domain/comun/decimal";
import type { CodigoError } from "../../../src/domain/comun/errores";
import { calendariosAjustados, cotizarConAjuste, tasaMaximaDeTabla, type Ajuste } from "../../../src/domain/interes/ajustes";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import type { Salida } from "../../../src/domain/tasas/semilla.esquema";
import { semillaReal } from "../oro/ayudas";

// Valores de referencia calculados FUERA del motor (Sprint 3a, decididos con el dueño).

const base: SolicitudTasa = { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1500000", plazo: 12 };
const tabla = (puntos: string): Ajuste => ({ tipo: "tabla", puntos });
const especial = (plazo: number, tasas: { mensual?: string; final_del_plazo?: string }): Ajuste => ({ tipo: "especial", plazo, tasas });

function bien(solicitud: Partial<SolicitudTasa>, ajuste: Ajuste) {
  const r = cotizarConAjuste(semillaReal, { ...base, ...solicitud }, ajuste);
  if (!r.ok) throw new Error(`[${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

function codigo(solicitud: Partial<SolicitudTasa>, ajuste: Ajuste): CodigoError | "OK" {
  const r = cotizarConAjuste(semillaReal, { ...base, ...solicitud }, ajuste);
  return r.ok ? "OK" : r.error.codigo;
}

const cifras = (c: ReturnType<typeof bien>) =>
  (["rendimiento_mensual_pesos", "rendimiento_anual_pesos", "ganancia_total_plazo"] as Salida[]).map(
    (k) => c.salidas.find((s) => s.clave === k)!.redondeado,
  );

describe("puntos extra sobre la tasa de tabla", () => {
  it("1,500,000 a 12 meses mensual: tabla 19.00% + 1.0 = 20.00%", () => {
    const c = bien({}, tabla("1.0"));
    expect([c.tasaTabla, c.puntos, c.tasa]).toEqual(["0.19", "1", "0.2"]);
    expect(cifras(c)).toEqual(["25000.00", "300000.00", "300000.00"]);
  });

  it("500,000 a 12 meses mensual: tabla 17.50% + 2.5 = 20.00%", () => {
    const c = bien({ monto: "500000" }, tabla("2.5"));
    expect([c.tasaTabla, c.tasa]).toEqual(["0.175", "0.2"]);
    expect(cifras(c)).toEqual(["8333.33", "100000.00", "100000.00"]);
  });

  it("55,000 a 6 meses al final del plazo: tabla 18.00% + 0.5 = 18.50%", () => {
    const c = bien({ monto: "55000", plazo: 6, esquema: "final_del_plazo" }, tabla("0.5"));
    expect([c.tasaTabla, c.tasa]).toEqual(["0.18", "0.185"]);
    expect(cifras(c)).toEqual(["847.92", "10175.00", "5087.50"]);
  });

  it("10,000 USD (Rami Sise) a 12 meses mensual: tabla 8.50% + 1.0 = 9.50%", () => {
    const c = bien({ entidad: "RAMI_SISE", moneda: "USD", monto: "10000" }, tabla("1"));
    expect([c.tasaTabla, c.tasa]).toEqual(["0.085", "0.095"]);
    expect(cifras(c)).toEqual(["79.17", "950.00", "950.00"]);
  });

  it("0 puntos da exactamente la cotización de tabla", () => {
    const c = bien({}, tabla("0"));
    expect([c.tasaTabla, c.tasa, c.origenTasa]).toEqual(["0.19", "0.19", "tramo"]);
    expect(cifras(c)).toEqual(["23750.00", "285000.00", "285000.00"]);
  });

  it.each(["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.0"])("acepta %s puntos", (p) => {
    expect(codigo({}, tabla(p))).toBe("OK");
  });

  it.each(["0.3", "5.5", "-1", "6", "0.25", "", "abc", "1e1", " 1"])("rechaza %j puntos", (p) => {
    expect(codigo({}, tabla(p))).toBe("PUNTOS_INVALIDOS");
  });

  it("los puntos suben las DOS modalidades del calendario", () => {
    const { mensual, finalDelPlazo } = calendariosAjustados(semillaReal, base, tabla("1"));
    if (mensual.tipo !== "calendario" || finalDelPlazo.tipo !== "calendario") throw new Error("se esperaban dos calendarios");
    const tablaFinal = bien({ esquema: "final_del_plazo" }, tabla("0")).tasa;
    expect(mensual.calendario.tasa).toBe("0.2");
    expect(new Decimal(finalDelPlazo.calendario.tasa).eq(new Decimal(tablaFinal).plus("0.01"))).toBe(true);
    expect(mensual.calendario.filas[0].rendimiento).toBe("25000.00");
  });
});

describe("plazo especial con tasa acordada", () => {
  it("100,000 a 9 meses al 17% mensual: pago 1,416.67, anual 17,000.00, total 12,750.00", () => {
    const c = bien({ monto: "100000", plazo: 9 }, especial(9, { mensual: "17.00" }));
    expect([c.tasa, c.tasaTabla, c.origenTasa, c.tramo]).toEqual(["0.17", null, "especial", null]);
    expect(cifras(c)).toEqual(["1416.67", "17000.00", "12750.00"]);
  });

  it("el calendario mensual tiene ocho pagos de 1,416.67 y el último de 1,416.64", () => {
    const { mensual } = calendariosAjustados(semillaReal, { ...base, monto: "100000", plazo: 9 }, especial(9, { mensual: "17" }));
    if (mensual.tipo !== "calendario") throw new Error("se esperaba el calendario mensual");
    expect(mensual.calendario.filas.map((f) => f.rendimiento)).toEqual([...Array(8).fill("1416.67"), "1416.64"]);
  });

  it("al vencimiento al 19%: anual 19,000.00, total 14,250.00", () => {
    const c = bien({ monto: "100000", plazo: 9, esquema: "final_del_plazo" }, especial(9, { final_del_plazo: "19" }));
    expect(cifras(c).slice(1)).toEqual(["19000.00", "14250.00"]);
  });

  it("la modalidad sin tasa capturada se omite (sin_tasa) y la otra se calcula", () => {
    const { mensual, finalDelPlazo } = calendariosAjustados(semillaReal, { ...base, monto: "100000", plazo: 9 }, especial(9, { mensual: "17" }));
    expect(mensual.tipo).toBe("calendario");
    expect(finalDelPlazo.tipo).toBe("sin_tasa");
  });

  it("con las dos tasas se calculan las dos modalidades", () => {
    const r = calendariosAjustados(semillaReal, { ...base, monto: "100000", plazo: 9 }, especial(9, { mensual: "17", final_del_plazo: "19" }));
    expect([r.mensual.tipo, r.finalDelPlazo.tipo]).toEqual(["calendario", "calendario"]);
  });

  it("funciona en cualquier entidad y moneda, también USD de Rami Sise", () => {
    const c = bien({ entidad: "RAMI_SISE", moneda: "USD", monto: "10000", plazo: 9 }, especial(9, { mensual: "9.5" }));
    expect(cifras(c)[0]).toBe("79.17");
  });

  it.each([0, 25, 1.5, -3])("rechaza un plazo especial de %s meses", (plazo) => {
    expect(codigo({ monto: "100000", plazo }, especial(plazo, { mensual: "17" }))).toBe("PLAZO_ESPECIAL_INVALIDO");
  });

  it.each([1, 24])("acepta %s meses", (plazo) => {
    expect(codigo({ monto: "100000", plazo }, especial(plazo, { mensual: "17" }))).toBe("OK");
  });

  it.each(["0", "-1", "17.123", "abc", "", "1e2"])("rechaza la tasa %j", (tasa) => {
    expect(codigo({ monto: "100000", plazo: 9 }, especial(9, { mensual: tasa }))).toBe("TASA_INVALIDA");
  });

  it("sin tasa para la modalidad elegida no cotiza", () => {
    expect(codigo({ monto: "100000", plazo: 9 }, especial(9, { final_del_plazo: "19" }))).toBe("TASA_INVALIDA");
  });
});

describe("sonda del plazo especial: el motor SÍ valida entidad, moneda y monto mínimo", () => {
  // resolverTasa revisa en orden: tabla de la moneda, entidad, estatus de la tabla,
  // monto, tramo (mínimo y máximo), estatus del tramo y, al final, el plazo. La
  // sonda usa plazo 0, así que todo lo anterior al plazo se valida igual que en tabla.
  it("monto debajo del mínimo en pesos", () => {
    expect(codigo({ monto: "29999.99", plazo: 9 }, especial(9, { mensual: "17" }))).toBe("MONTO_FUERA_DE_RANGO");
  });

  it("CREDIFLEXI con USD", () => {
    expect(codigo({ moneda: "USD", monto: "10000", plazo: 9 }, especial(9, { mensual: "9" }))).toBe("ENTIDAD_SIN_TABLA");
  });

  it("3,999.99 USD de Rami Sise", () => {
    expect(codigo({ entidad: "RAMI_SISE", moneda: "USD", monto: "3999.99", plazo: 9 }, especial(9, { mensual: "9" }))).toBe(
      "MONTO_FUERA_DE_RANGO",
    );
  });

  it("monto ilegible", () => {
    expect(codigo({ monto: "abc", plazo: 9 }, especial(9, { mensual: "17" }))).toBe("MONTO_INVALIDO");
  });

  it("entidad que no existe", () => {
    expect(codigo({ entidad: "ENTIDAD_SINTETICA", plazo: 9 }, especial(9, { mensual: "17" }))).toBe("ENTIDAD_SIN_TABLA");
  });
});

describe("tasaMaximaDeTabla: para el aviso de tasa acordada alta", () => {
  // Máximo calculado aquí directamente del JSON de la semilla, sin el motor.
  const maximoJson = (filas: Record<string, unknown>[]) =>
    Math.max(...filas.flatMap((f) => Object.entries(f).filter(([k]) => /^\d+$/.test(k)).map(([, v]) => Number(v))));

  it("USD: el máximo de la tabla en dólares", () => {
    const usd = semillaJson.tasas_usd as unknown as Record<string, Record<string, unknown>[]>;
    const esperado = Math.max(maximoJson(usd.mensual), maximoJson(usd.final_del_plazo));
    expect(Number(tasaMaximaDeTabla(semillaReal, "USD")!.toFixed())).toBe(esperado);
  });

  it("MXN: incluye el plazo adicional de 36 meses", () => {
    expect(tasaMaximaDeTabla(semillaReal, "MXN")!.gte(new Decimal("0.19"))).toBe(true);
  });
});
