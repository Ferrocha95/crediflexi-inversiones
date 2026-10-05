// Escenario ilustrativo de reinversión a dos plazos seguidos (gráfica 2 del PDF).
//
// Valores esperados calculados fuera del motor. Mensual (modo Creciente): cada
// pago se redondea a centavos y se reinvierte; la tasa se busca para el capital
// al inicio de cada mes. Al final del plazo: al vencer se renueva capital más
// ganancia con la tasa del nuevo monto.

import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import {
  INCREMENTO_MINIMO_REINVERSION,
  escenarioReinversion,
  type EscenarioReinversion,
  type PuntoEscenario,
} from "../../../src/domain/interes/escenario";
import type { Semilla } from "../../../src/domain/tasas/semilla.esquema";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { cargar, copiaSemilla, semillaReal } from "../oro/ayudas";

const ENTIDADES = ["CREDIFLEXI", "RAMI_SISE"] as const;

function escenario(
  entidad: string,
  monto: string,
  plazo: number,
  esquema: Esquema,
  s: Semilla = semillaReal,
): EscenarioReinversion {
  return escenarioReinversion(s, { entidad, moneda: "MXN", esquema, monto, plazo });
}

function puntosDe(e: EscenarioReinversion): readonly PuntoEscenario[] {
  if (e.tipo !== "ok") throw new Error(`Se esperaba un escenario y se omitió: ${e.motivo}`);
  return e.puntos;
}

/** Punto del mes k (1 a 2 × plazo). */
const mes = (puntos: readonly PuntoEscenario[], k: number) => puntos[k - 1];
const resta = (a: string, b: string) => new Decimal(a).minus(b).toFixed(2);

describe.each(ENTIDADES)("escenario de reinversión mensual (%s)", (entidad) => {
  it("1,500,000 pesos a 12 meses: pagos reinvertidos, capital al mes 13, valor final y sin reinvertir", () => {
    const e = escenario(entidad, "1500000", 12, "mensual");
    const p = puntosDe(e);
    expect(e.tipo === "ok" && e.meses).toBe(24);
    expect(e.tipo === "ok" && e.finPrimerPlazo).toBe(12);
    expect(p).toHaveLength(24);
    expect(mes(p, 2).rendimiento).toBe("24126.04");
    expect(mes(p, 12).valor).toBe("1811176.51");
    expect(mes(p, 24).rendimiento).toBe("34086.33");
    expect(mes(p, 24).valor).toBe("2186906.87");
    expect(mes(p, 24).sinReinvertir).toBe("2070000.00");
  });

  it("950,000 pesos a 12 meses: la tasa sube de tramo en el mes 5", () => {
    const p = puntosDe(escenario(entidad, "950000", 12, "mensual"));
    expect(mes(p, 1).rendimiento).toBe("14645.83");
    expect(mes(p, 2).rendimiento).toBe("14871.62");
    for (const k of [1, 2, 3, 4]) expect(new Decimal(mes(p, k).tasa).eq("0.185"), `mes ${k}`).toBe(true);
    for (let k = 5; k <= 24; k++) expect(new Decimal(mes(p, k).tasa).eq("0.19"), `mes ${k}`).toBe(true);
    expect(mes(p, 12).valor).toBe("1145197.60");
    expect(mes(p, 24).rendimiento).toBe("21552.61");
    expect(mes(p, 24).valor).toBe("1382770.00");
    expect(mes(p, 24).sinReinvertir).toBe("1301500.00");
  });

  it("55,000 pesos a 6 meses: se omite porque el primer pago (733.33) es menor al incremento mínimo", () => {
    expect(INCREMENTO_MINIMO_REINVERSION.eq(1000)).toBe(true);
    expect(escenario(entidad, "55000", 6, "mensual")).toEqual({ tipo: "omitido", motivo: "INCREMENTO_MINIMO" });
  });

  it("cada valor es el anterior más el pago del mes, ya redondeado a centavos", () => {
    const p = puntosDe(escenario(entidad, "950000", 12, "mensual"));
    let anterior = "950000.00";
    for (const punto of p) {
      expect(new Decimal(punto.rendimiento).decimalPlaces()).toBeLessThanOrEqual(2);
      expect(resta(punto.valor, anterior)).toBe(punto.rendimiento);
      anterior = punto.valor;
    }
  });
});

describe.each(ENTIDADES)("escenario de reinversión al final del plazo (%s)", (entidad) => {
  const CASOS = [
    {
      nombre: "500,000 pesos a 12 meses: renueva 597,500 al 19.50%",
      monto: "500000",
      plazo: 12,
      primerTotal: "97500.00",
      renovado: "597500.00",
      tasa2: "0.195",
      segundoTotal: "116512.50",
      final: "714012.50",
      sin: "695000.00",
    },
    {
      nombre: "580,000 pesos a 12 meses: al renovar 693,100 cambia de tramo y la tasa sube al 20.00%",
      monto: "580000",
      plazo: 12,
      primerTotal: "113100.00",
      renovado: "693100.00",
      tasa2: "0.2",
      segundoTotal: "138620.00",
      final: "831720.00",
      sin: "806200.00",
    },
    {
      nombre: "55,000 pesos a 6 meses: renueva 59,950 (aquí no aplica el incremento mínimo)",
      monto: "55000",
      plazo: 6,
      primerTotal: "4950.00",
      renovado: "59950.00",
      tasa2: "0.18",
      segundoTotal: "5395.50",
      final: "65345.50",
      sin: "64900.00",
    },
    {
      nombre: "1,500,000 pesos a 24 meses: renueva 2,160,000",
      monto: "1500000",
      plazo: 24,
      primerTotal: "660000.00",
      renovado: "2160000.00",
      tasa2: "0.22",
      segundoTotal: "950400.00",
      final: "3110400.00",
      sin: "2820000.00",
    },
  ] as const;

  for (const c of CASOS) {
    it(c.nombre, () => {
      const e = escenario(entidad, c.monto, c.plazo, "final_del_plazo");
      const p = puntosDe(e);
      expect(p).toHaveLength(2 * c.plazo);
      expect(e.tipo === "ok" && e.finPrimerPlazo).toBe(c.plazo);
      expect(resta(mes(p, c.plazo).valor, c.monto)).toBe(c.primerTotal);
      expect(mes(p, c.plazo).valor).toBe(c.renovado);
      expect(new Decimal(mes(p, c.plazo + 1).tasa).eq(c.tasa2)).toBe(true);
      expect(resta(mes(p, 2 * c.plazo).valor, c.renovado)).toBe(c.segundoTotal);
      expect(mes(p, 2 * c.plazo).valor).toBe(c.final);
      expect(mes(p, 2 * c.plazo).sinReinvertir).toBe(c.sin);
    });
  }

  it("en el primer plazo el valor coincide con sin reinvertir", () => {
    const p = puntosDe(escenario(entidad, "580000", 12, "final_del_plazo"));
    for (let k = 1; k <= 12; k++) expect(mes(p, k).valor, `mes ${k}`).toBe(mes(p, k).sinReinvertir);
  });
});

describe("escenario de reinversión: se omite si una tasa no está disponible", () => {
  // Copia sintética: el tramo 3 (desde 400,001) queda POR_CONFIRMAR.
  function semillaConTramo3PorConfirmar(): Semilla {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[2].estatus = "POR_CONFIRMAR";
    return cargar(j);
  }

  it("mensual: al crecer el capital entra a un tramo POR_CONFIRMAR y el escenario se omite", () => {
    expect(escenario("CREDIFLEXI", "380000", 24, "mensual", semillaConTramo3PorConfirmar())).toEqual({
      tipo: "omitido",
      motivo: "TASA_NO_DISPONIBLE",
    });
  });

  it("al final del plazo: el capital renovado cae en un tramo POR_CONFIRMAR y el escenario se omite", () => {
    expect(escenario("CREDIFLEXI", "380000", 12, "final_del_plazo", semillaConTramo3PorConfirmar())).toEqual({
      tipo: "omitido",
      motivo: "TASA_NO_DISPONIBLE",
    });
  });

  it("si la cotización base no se puede resolver, el escenario se omite sin lanzar", () => {
    expect(escenario("CREDIFLEXI", "1000", 6, "mensual")).toEqual({ tipo: "omitido", motivo: "TASA_NO_DISPONIBLE" });
  });
});
