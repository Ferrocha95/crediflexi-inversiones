import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import { cotizar, type Cotizacion, type SalidaCotizada } from "../../../src/domain/interes/cotizar";
import { cargarSemilla } from "../../../src/domain/tasas/semilla";
import type { Salida, Semilla } from "../../../src/domain/tasas/semilla.esquema";

function cargar(json: unknown): Semilla {
  const r = cargarSemilla(json);
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

const semilla = cargar(semillaJson);

const base: SolicitudTasa = {
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "500000",
  plazo: 12,
};

function cotizarBien(cambios: Partial<SolicitudTasa> = {}, s: Semilla = semilla): Cotizacion {
  const r = cotizar(s, { ...base, ...cambios });
  if (!r.ok) throw new Error(`Se esperaba una cotización: [${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

function salida(c: Cotizacion, clave: Salida): SalidaCotizada {
  const s = c.salidas.find((x) => x.clave === clave);
  if (s === undefined) throw new Error(`Falta la salida ${clave}`);
  return s;
}

describe("cotizar", () => {
  it("500,000 pesos a 12 meses al 17.5% mensual: 7,291.67 y 87,500.00", () => {
    const c = cotizarBien();
    expect(c.tasa).toBe("0.175");
    expect(salida(c, "rendimiento_mensual_pesos").redondeado).toBe("7291.67");
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe("87500.00");
    expect(salida(c, "ganancia_total_plazo").redondeado).toBe("87500.00");
  });

  it("guarda el valor exacto de cada salida como texto", () => {
    const c = cotizarBien();
    expect(salida(c, "rendimiento_mensual_pesos").exacto).toMatch(/^7291\.6666666666/);
    expect(salida(c, "rendimiento_anual_pesos").exacto).toBe("87500");
  });

  it("guarda la solicitud, la tasa, el tramo con su estatus y la versión de la semilla", () => {
    const c = cotizarBien();
    expect(c.solicitud).toEqual({
      entidad: "CREDIFLEXI",
      moneda: "MXN",
      esquema: "mensual",
      monto: "500000.00",
      plazo: 12,
    });
    expect(c.origenTasa).toBe("tramo");
    expect(c.tramo).toEqual({ indice: 2, desde: "400001.00", hasta: "600000.00", estatus: "CONFIRMADA" });
    expect(c.semilla).toEqual({ version: semillaJson.version, generado: "2026-10-02" });
  });

  it("entrega las salidas en el orden de la semilla", () => {
    expect(cotizarBien().salidas.map((s) => s.clave)).toEqual(semilla.reglas.salidas);
  });

  it("usa las etiquetas del esquema mensual", () => {
    const c = cotizarBien();
    expect(salida(c, "rendimiento_mensual_pesos").etiqueta).toBe("Pago mensual");
    expect(salida(c, "ganancia_total_plazo").etiqueta).toBe("Ganancia total en el plazo");
  });

  it("final_del_plazo usa las etiquetas 'final' de la semilla", () => {
    const c = cotizarBien({ esquema: "final_del_plazo" });
    expect(salida(c, "rendimiento_mensual_pesos").etiqueta).toBe(
      "Rendimiento mensual equivalente (se paga al final del plazo)",
    );
    expect(salida(c, "ganancia_total_plazo").etiqueta).toBe("Ganancia total al final del plazo");
    expect(c.tasa).toBe("0.195");
  });

  it("incluye el desglose de cada salida", () => {
    const c = cotizarBien({ monto: "1500000" });
    expect(salida(c, "ganancia_total_plazo").desglose).toEqual({
      formula: "monto × tasa anual × plazo ÷ 12",
      operacion: "1,500,000.00 × 0.19 × 12 ÷ 12 = 285,000.00",
    });
    expect(salida(c, "rendimiento_mensual_pesos").desglose.operacion).toBe(
      "1,500,000.00 × 0.19 ÷ 12 = 23,750.00",
    );
  });

  it("un empate a medio peso (412.50) se guarda en centavos sin redondear a pesos", () => {
    const c = cotizarBien({ monto: "30000", plazo: 12 });
    expect(salida(c, "rendimiento_mensual_pesos").exacto).toBe("412.5");
    expect(salida(c, "rendimiento_mensual_pesos").redondeado).toBe("412.50");
  });

  it("el anual no sale del mensual redondeado", () => {
    const c = cotizarBien({ plazo: 18 });
    // 500,000 × 0.18 = 90,000.00, no 7,500.00 × 12 redondeado de nuevo.
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe("90000.00");
    expect(salida(c, "ganancia_total_plazo").redondeado).toBe("135000.00");
  });

  it("es serializable tal cual (listo para guardarse como snapshot)", () => {
    const c = cotizarBien();
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });

  it("propaga los errores del resolver sin calcular", () => {
    const r = cotizar(semilla, { ...base, monto: "29999.99" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("MONTO_FUERA_DE_RANGO");
  });

  it("el resultado ok trae los avisos también en el snapshot", () => {
    const r = cotizar(semilla, base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.avisos).toEqual(r.avisos);
  });
});
