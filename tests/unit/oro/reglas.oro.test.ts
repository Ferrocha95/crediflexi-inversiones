import { describe, expect, it } from "vitest";
import { plazosDisponibles } from "../../../src/aplicacion/plazos";
import { cotizar } from "../../../src/domain/interes/cotizar";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { base, cargar, codigoDeError, copiaSemilla, cotizarBien, salida, semillaReal } from "./ayudas";
import { casos } from "./golden";

const ESQUEMAS: readonly Esquema[] = ["mensual", "final_del_plazo"];

describe("oro (d): 1,500,000 pesos a 12 meses al 19% mensual", () => {
  it("23,750.00 mensual y 285,000.00 anual y total, con su desglose", () => {
    const c = cotizarBien({ monto: "1500000", plazo: 12, esquema: "mensual" });
    expect(c.tasa).toBe("0.19");
    expect(salida(c, "rendimiento_mensual_pesos").redondeado).toBe("23750.00");
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe("285000.00");
    expect(salida(c, "ganancia_total_plazo").redondeado).toBe("285000.00");
    expect(salida(c, "ganancia_total_plazo").desglose.operacion).toBe(
      "1,500,000.00 × 0.19 × 12 ÷ 12 = 285,000.00",
    );
  });
});

describe("oro (e): límites entre el tramo 1 y el tramo 2", () => {
  it("199,999.99 pesos cae en el tramo 1 (16.50% a 12 meses)", () => {
    const c = cotizarBien({ monto: "199999.99" });
    expect(c.tramo.indice).toBe(0);
    expect(c.tasa).toBe("0.165");
    expect(salida(c, "rendimiento_mensual_pesos").redondeado).toBe("2750.00");
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe("33000.00");
  });

  it("200,000.00 pesos cae en el tramo 1 (el hasta del tramo 1 incluye 200,000)", () => {
    const c = cotizarBien({ monto: "200000.00" });
    expect(c.tramo.indice).toBe(0);
    expect(c.tasa).toBe("0.165");
  });

  it("200,000.01 y 200,000.99 pesos caen en el tramo 1; 200,001.00 cae en el tramo 2 (límite inferior inclusivo)", () => {
    expect(cotizarBien({ monto: "200000.01" }).tramo.indice).toBe(0);
    expect(cotizarBien({ monto: "200000.99" }).tramo.indice).toBe(0);
    const c = cotizarBien({ monto: "200001.00" });
    expect(c.tramo.indice).toBe(1);
    expect(c.tasa).toBe("0.17");
  });

  it("con límite NO inclusivo (copia), 200,001.00 cae en el tramo 1, 200,001.01 en el 2 y 30,000 queda fuera de rango", () => {
    const j = copiaSemilla();
    j.tasas_mxn.limite_inferior_inclusivo = false;
    const s = cargar(j);
    expect(cotizarBien({ monto: "200001.00" }, s).tramo.indice).toBe(0);
    expect(cotizarBien({ monto: "200001.00" }, s).tasa).toBe("0.165");
    expect(cotizarBien({ monto: "200001.01" }, s).tramo.indice).toBe(1);
    expect(codigoDeError({ monto: "30000" }, s)).toBe("MONTO_FUERA_DE_RANGO");
    expect(cotizarBien({ monto: "30000.01" }, s).tramo.indice).toBe(0);
  });

  it("con el tramo 2 POR_CONFIRMAR, 200,000.99 cotiza y 200,001.00 se bloquea con un mensaje que menciona el tramo", () => {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[1].estatus = "POR_CONFIRMAR";
    const s = cargar(j);
    expect(codigoDeError({ monto: "200000.99" }, s)).toBe("OK");
    expect(codigoDeError({ monto: "200001.00" }, s)).toBe("TRAMO_POR_CONFIRMAR");
    const r = cotizar(s, { ...base, monto: "200001.00" });
    if (r.ok) throw new Error("200,001.00 debía bloquearse");
    expect(r.error.mensaje).toContain("$200,001.00");
  });

  it("con límite NO inclusivo y el tramo 2 POR_CONFIRMAR, 200,001.00 sigue cotizando en el tramo 1 y 200,001.01 se bloquea", () => {
    const j = copiaSemilla();
    j.tasas_mxn.limite_inferior_inclusivo = false;
    j.tasas_mxn.tramos[1].estatus = "POR_CONFIRMAR";
    const s = cargar(j);
    expect(cotizarBien({ monto: "200001.00" }, s).tramo.indice).toBe(0);
    expect(codigoDeError({ monto: "200001.01" }, s)).toBe("TRAMO_POR_CONFIRMAR");
  });
});

describe("oro (g): con la semilla real no hay plazo de 36 meses", () => {
  it("36 meses da PLAZO_NO_DISPONIBLE con 30,000 y con 4,200,000 pesos, y plazosDisponibles es siempre 6, 12, 18 y 24", () => {
    for (const esquema of ESQUEMAS) {
      expect(codigoDeError({ monto: "30000", plazo: 36, esquema })).toBe("PLAZO_NO_DISPONIBLE");
      expect(codigoDeError({ monto: "4200000", plazo: 36, esquema })).toBe("PLAZO_NO_DISPONIBLE");
    }
    const montos = [...new Set(casos.map((c) => c.monto))];
    expect(montos).toHaveLength(21);
    for (const monto of montos) {
      for (const esquema of ESQUEMAS) {
        for (const entidad of ["CREDIFLEXI", "RAMI_SISE"]) {
          const r = plazosDisponibles(semillaReal, { entidad, moneda: "MXN", esquema, monto });
          expect(r.ok ? r.valor : r.error.codigo, `${monto} ${esquema} ${entidad}`).toEqual([6, 12, 18, 24]);
        }
      }
    }
  });
});

describe("oro (h): los cambios en la semilla cambian el resultado", () => {
  it("bloquear el tramo 2 en una copia bloquea sus montos", () => {
    expect(codigoDeError({ monto: "250000" })).toBe("OK");
    const j = copiaSemilla();
    j.tasas_mxn.tramos[1].estatus = "POR_CONFIRMAR";
    expect(codigoDeError({ monto: "250000" }, cargar(j))).toBe("TRAMO_POR_CONFIRMAR");
  });

  it("desbloquear USD con su límite en una copia permite cotizar en USD", () => {
    const usd = { moneda: "USD" as const, monto: "10000", plazo: 12 };
    expect(codigoDeError(usd)).toBe("TABLA_POR_CONFIRMAR");
    const j = copiaSemilla();
    j.tasas_usd.estatus = "CONFIRMADA";
    (j.tasas_usd as { limite_inferior_inclusivo?: boolean }).limite_inferior_inclusivo = true;
    const c = cotizarBien(usd, cargar(j));
    expect(c.solicitud.moneda).toBe("USD");
    expect(c.tramo.estatus).toBe("CONFIRMADA");
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe(
      cargar(j).tablas.USD!.tramos[c.tramo.indice].tasas.mensual.get(12)!.times(10000).toFixed(2),
    );
  });

  it("cambiar una tasa en una copia cambia las salidas", () => {
    expect(salida(cotizarBien({ monto: "300000" }), "rendimiento_anual_pesos").redondeado).toBe("51000.00");
    const j = copiaSemilla();
    j.tasas_mxn.tramos[1].mensual["12"] = "0.18";
    const c = cotizarBien({ monto: "300000" }, cargar(j));
    expect(c.tasa).toBe("0.18");
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe("54000.00");
  });

  it("las copias no alteran la semilla real", () => {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[1].mensual["12"] = "0.99";
    expect(cotizarBien({ monto: "300000" }, semillaReal).tasa).toBe("0.17");
  });
});
