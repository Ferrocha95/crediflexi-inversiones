import { describe, expect, it } from "vitest";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { casos, cargar, codigoDeError, copiaSemilla, cotizarBien, salida, semillaReal } from "./ayudas";

const ESQUEMAS: readonly Esquema[] = ["mensual", "final_del_plazo"];
const PLAZOS = [6, 12, 18, 24];
const combinaciones = ESQUEMAS.flatMap((esquema) => PLAZOS.map((plazo) => ({ esquema, plazo })));

describe("oro (d): $1,500,000 a 12 meses al 19% mensual", () => {
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
  it("$199,999.99 cae en el tramo 1 (20.5% a 12 meses)", () => {
    const c = cotizarBien({ monto: "199999.99" });
    expect(c.tramo.indice).toBe(0);
    expect(c.tasa).toBe("0.205");
    expect(salida(c, "rendimiento_mensual_pesos").redondeado).toBe("3416.67");
    expect(salida(c, "rendimiento_anual_pesos").redondeado).toBe("41000.00");
  });

  it("$200,000.00 cae en el tramo 2 (límite inferior inclusivo)", () => {
    const c = cotizarBien({ monto: "200000.00" });
    expect(c.tramo.indice).toBe(1);
    expect(c.tasa).toBe("0.17");
  });

  it("$200,000.01 cae en el tramo 2", () => {
    expect(cotizarBien({ monto: "200000.01" }).tramo.indice).toBe(1);
  });

  it("con límite NO inclusivo (copia), $200,000.00 cae en el tramo 1 y $200,000.01 en el 2", () => {
    const j = copiaSemilla();
    j.tasas_mxn.limite_inferior_inclusivo = false;
    const s = cargar(j);
    expect(cotizarBien({ monto: "199999.99" }, s).tramo.indice).toBe(0);
    expect(cotizarBien({ monto: "200000.00" }, s).tramo.indice).toBe(0);
    expect(cotizarBien({ monto: "200000.00" }, s).tasa).toBe("0.205");
    expect(cotizarBien({ monto: "200000.01" }, s).tramo.indice).toBe(1);
  });

  it("con el tramo 2 POR_CONFIRMAR, $199,999.99 cotiza y $200,000.00 y $200,000.01 se bloquean", () => {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[1].estatus = "POR_CONFIRMAR";
    const s = cargar(j);
    expect(codigoDeError({ monto: "199999.99" }, s)).toBe("OK");
    expect(codigoDeError({ monto: "200000.00" }, s)).toBe("TRAMO_POR_CONFIRMAR");
    expect(codigoDeError({ monto: "200000.01" }, s)).toBe("TRAMO_POR_CONFIRMAR");
  });

  it("con límite NO inclusivo y el tramo 2 POR_CONFIRMAR, $200,000.00 sigue cotizando en el tramo 1", () => {
    const j = copiaSemilla();
    j.tasas_mxn.limite_inferior_inclusivo = false;
    j.tasas_mxn.tramos[1].estatus = "POR_CONFIRMAR";
    const s = cargar(j);
    expect(codigoDeError({ monto: "200000.00" }, s)).toBe("OK");
    expect(codigoDeError({ monto: "200000.01" }, s)).toBe("TRAMO_POR_CONFIRMAR");
  });
});

describe("oro (f): aviso de coherencia", () => {
  const conAviso = (monto: string, esquema: Esquema, plazo: number) =>
    cotizarBien({ monto, esquema, plazo }).avisos.some((a) => a.codigo === "TASA_MAYOR_QUE_TRAMO_SIGUIENTE");

  it.each(["30000", "30000.01", "100000", "199999.99"])(
    "aparece con $%s en todos los esquemas y plazos",
    (monto) => {
      for (const { esquema, plazo } of combinaciones) expect(conAviso(monto, esquema, plazo)).toBe(true);
    },
  );

  it("no aparece con $200,000.00 en ningún esquema ni plazo", () => {
    for (const { esquema, plazo } of combinaciones) expect(conAviso("200000.00", esquema, plazo)).toBe(false);
  });

  it("en todo el golden solo aparece en las celdas del tramo 1 ($30,000)", () => {
    const conAvisoEnGolden = casos.filter((c) => conAviso(c.monto, c.esquema, c.plazo)).map((c) => c.nombre);
    const esperadas = casos.filter((c) => c.monto === "30000").map((c) => c.nombre);
    expect(conAvisoEnGolden).toEqual(esperadas);
    expect(esperadas).toHaveLength(8);
  });

  it("el aviso no convierte el resultado en error", () => {
    expect(codigoDeError({ monto: "30000" })).toBe("OK");
  });
});

describe("oro (g): plazo de 36 meses", () => {
  it("se rechaza con $1,000,000.00", () => {
    expect(codigoDeError({ monto: "1000000.00", plazo: 36 })).toBe("PLAZO_NO_DISPONIBLE");
  });

  it("se rechaza con $1,999,999.99", () => {
    expect(codigoDeError({ monto: "1999999.99", plazo: 36 })).toBe("PLAZO_NO_DISPONIBLE");
  });

  it("se acepta con $2,000,000.00 en ambos esquemas", () => {
    const m = cotizarBien({ monto: "2000000.00", plazo: 36, esquema: "mensual" });
    expect(m.origenTasa).toBe("plazo_adicional");
    expect(salida(m, "ganancia_total_plazo").redondeado).toBe("1200000.00");
    const f = cotizarBien({ monto: "2000000.00", plazo: 36, esquema: "final_del_plazo" });
    expect(salida(f, "ganancia_total_plazo").redondeado).toBe("1320000.00");
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
