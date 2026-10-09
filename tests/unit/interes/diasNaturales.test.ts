// Rendimientos a días naturales y fechas de pago (Sprint 6b).
//
// Los valores esperados de los casos A a F se calcularon fuera del motor (los
// dio Fernando en el Sprint 6b); no se toman de lo que devuelve el motor.
// Base: días reales ÷ 365, siempre 365. Pago k = monto × tasa × días ÷ 365 a
// centavos; el último pago es el rendimiento total menos los anteriores.

import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import {
  calendarioPorFechas,
  calendariosPorFechas,
  diasEntre,
  fechaDePago,
  limitesFechaInicio,
  rendimientosPorFechas,
  validarFechaInicio,
  type CalendarioPorFechas,
} from "../../../src/domain/interes/diasNaturales";
import { semillaReal } from "../oro/ayudas";

const MILLON = new Decimal("1000000");

function filas(c: CalendarioPorFechas) {
  return c.filas.map((f) => [f.fecha, f.dias, f.rendimiento, f.acumulado]);
}

function sumaDePagos(c: CalendarioPorFechas): string {
  return c.filas.reduce((s, f) => s.plus(f.rendimiento), new Decimal(0)).toFixed(2);
}

describe("fechaDePago", () => {
  it("es el mismo día del mes, k meses después", () => {
    expect(fechaDePago("2026-10-15", 1)).toBe("2026-11-15");
    expect(fechaDePago("2026-10-15", 3)).toBe("2027-01-15");
    expect(fechaDePago("2026-10-15", 36)).toBe("2029-10-15");
  });

  it("si el día no existe, es el último día del mes, y los pagos siguientes vuelven al día original", () => {
    expect(fechaDePago("2026-01-31", 1)).toBe("2026-02-28");
    expect(fechaDePago("2026-01-31", 2)).toBe("2026-03-31");
    expect(fechaDePago("2026-01-31", 3)).toBe("2026-04-30");
    expect(fechaDePago("2026-01-31", 4)).toBe("2026-05-31");
    expect(fechaDePago("2028-01-31", 1)).toBe("2028-02-29");
    expect(fechaDePago("2026-03-30", 11)).toBe("2027-02-28");
    expect(fechaDePago("2026-03-29", 23)).toBe("2028-02-29");
  });
});

describe("diasEntre", () => {
  it("cuenta días reales, también en año bisiesto", () => {
    expect(diasEntre("2026-10-15", "2026-11-15")).toBe(31);
    expect(diasEntre("2027-02-15", "2027-03-15")).toBe(28);
    expect(diasEntre("2028-02-15", "2028-03-15")).toBe(29);
    expect(diasEntre("2028-01-15", "2029-01-15")).toBe(366);
    expect(diasEntre("2026-10-15", "2029-10-15")).toBe(1096);
  });
});

describe("calendarioPorFechas: casos de referencia", () => {
  it("caso A: $1,000,000 al 18.00%, Mensual a 6 meses, inicio 2026-10-15", () => {
    const c = calendarioPorFechas(MILLON, new Decimal("0.18"), 6, "mensual", "2026-10-15");
    expect(filas(c)).toEqual([
      ["2026-11-15", 31, "15287.67", "15287.67"],
      ["2026-12-15", 30, "14794.52", "30082.19"],
      ["2027-01-15", 31, "15287.67", "45369.86"],
      ["2027-02-15", 31, "15287.67", "60657.53"],
      ["2027-03-15", 28, "13808.22", "74465.75"],
      ["2027-04-15", 31, "15287.67", "89753.42"],
    ]);
    expect(c.diasTotales).toBe(182);
    expect(c.rendimientoTotal).toBe("89753.42");
    expect(c.total).toBe("1089753.42");
    expect(c.vencimiento).toBe("2027-04-15");
    expect(c.fechaInicio).toBe("2026-10-15");
  });

  it("caso A: anual 180,000.00, promedio mensual 15,000.00 y total por días 89,753.42", () => {
    const r = rendimientosPorFechas(MILLON, new Decimal("0.18"), 6, "2026-10-15");
    expect(r.rendimiento_anual_pesos.redondeado.toFixed(2)).toBe("180000.00");
    expect(r.rendimiento_mensual_pesos.redondeado.toFixed(2)).toBe("15000.00");
    expect(r.ganancia_total_plazo.redondeado.toFixed(2)).toBe("89753.42");
    expect(r.ganancia_total_plazo.desglose.formula).toBe("monto × tasa anual neta × días ÷ 365");
    expect(r.ganancia_total_plazo.desglose.operacion).toBe("1,000,000.00 × 0.18 × 182 ÷ 365 = 89,753.42");
    expect(r.rendimiento_mensual_pesos.desglose.formula).toBe("monto × tasa anual neta ÷ 12");
    expect(r.rendimiento_anual_pesos.desglose.formula).toBe("monto × tasa anual neta");
  });

  it("caso B (fin de mes): inicio 2026-01-31, 181 días y total 89,260.27", () => {
    const c = calendarioPorFechas(MILLON, new Decimal("0.18"), 6, "mensual", "2026-01-31");
    expect(c.filas.map((f) => [f.fecha, f.dias, f.rendimiento])).toEqual([
      ["2026-02-28", 28, "13808.22"],
      ["2026-03-31", 31, "15287.67"],
      ["2026-04-30", 30, "14794.52"],
      ["2026-05-31", 31, "15287.67"],
      ["2026-06-30", 30, "14794.52"],
      ["2026-07-31", 31, "15287.67"],
    ]);
    expect(c.diasTotales).toBe(181);
    expect(c.rendimientoTotal).toBe("89260.27");
    expect(sumaDePagos(c)).toBe("89260.27");
  });

  it("caso C (bisiesto): $1,000,000 al 18.50% a 12 meses, inicio 2028-01-15: base 365 aunque el año tenga 366 días", () => {
    const c = calendarioPorFechas(MILLON, new Decimal("0.185"), 12, "mensual", "2028-01-15");
    expect(c.diasTotales).toBe(366);
    expect(c.rendimientoTotal).toBe("185506.85");
    expect(c.filas.slice(0, 3).map((f) => [f.fecha, f.dias, f.rendimiento])).toEqual([
      ["2028-02-15", 31, "15712.33"],
      ["2028-03-15", 29, "14698.63"],
      ["2028-04-15", 31, "15712.33"],
    ]);
    expect(c.filas.at(-1)).toMatchObject({ fecha: "2029-01-15", dias: 31, rendimiento: "15712.32", acumulado: "185506.85" });
    expect(sumaDePagos(c)).toBe("185506.85");
  });

  it("caso D: $1,000,000 al 20.00%, Al final del plazo a 6 meses: 182 días, 99,726.03 y 1,099,726.03", () => {
    const c = calendarioPorFechas(MILLON, new Decimal("0.20"), 6, "final_del_plazo", "2026-10-15");
    expect(c.diasTotales).toBe(182);
    expect(c.rendimientoTotal).toBe("99726.03");
    expect(c.total).toBe("1099726.03");
    expect(c.vencimiento).toBe("2027-04-15");
    // Devengado en cada fecha de pago: monto × tasa × días transcurridos ÷ 365.
    expect(c.filas[0]).toMatchObject({ fecha: "2026-11-15", dias: 31, devengado: "16986.30" });
    expect(c.filas.at(-1)!.devengado).toBe("99726.03");
  });

  it("caso E: $500,000 al 19.50%, al final del plazo a 12 meses, inicio 2026-03-10: 365 días y 97,500.00", () => {
    const c = calendarioPorFechas(new Decimal("500000"), new Decimal("0.195"), 12, "final_del_plazo", "2026-03-10");
    expect(c.diasTotales).toBe(365);
    expect(c.rendimientoTotal).toBe("97500.00");
  });

  it("caso F: $100,000 al 17.00%, Mensual a 36 meses, inicio 2026-10-15: 1,096 días, 51,046.58 y último pago 1,397.18", () => {
    const c = calendarioPorFechas(new Decimal("100000"), new Decimal("0.17"), 36, "mensual", "2026-10-15");
    expect(c.diasTotales).toBe(1096);
    expect(c.rendimientoTotal).toBe("51046.58");
    expect(c.filas).toHaveLength(36);
    expect(c.filas.at(-1)).toMatchObject({ fecha: "2029-10-15", rendimiento: "1397.18", acumulado: "51046.58" });
    expect(sumaDePagos(c)).toBe("51046.58");
  });
});

describe("calendarioPorFechas: invariantes", () => {
  it("los días de los periodos suman los días totales y el acumulado es la suma corrida", () => {
    const c = calendarioPorFechas(new Decimal("123456.78"), new Decimal("0.1725"), 24, "mensual", "2026-08-31");
    expect(c.filas.reduce((s, f) => s + f.dias, 0)).toBe(c.diasTotales);
    let corrido = new Decimal(0);
    for (const f of c.filas) {
      corrido = corrido.plus(f.rendimiento);
      expect(f.acumulado).toBe(corrido.toFixed(2));
    }
    expect(c.filas.at(-1)!.acumulado).toBe(c.rendimientoTotal);
  });

  it("al final del plazo, el devengado de la última fecha es el rendimiento total", () => {
    const c = calendarioPorFechas(new Decimal("123456.78"), new Decimal("0.1725"), 18, "final_del_plazo", "2026-05-31");
    expect(c.filas.at(-1)!.devengado).toBe(c.rendimientoTotal);
  });
});

describe("validarFechaInicio", () => {
  const rango = { diasAtras: 7, diasAdelante: 365 };

  it("acepta de 7 días atrás a 365 adelante", () => {
    expect(validarFechaInicio("2026-10-09", "2026-10-09", rango).ok).toBe(true);
    expect(validarFechaInicio("2026-10-02", "2026-10-09", rango).ok).toBe(true);
    expect(validarFechaInicio("2027-10-09", "2026-10-09", rango).ok).toBe(true);
  });

  it("rechaza fuera de rango con un mensaje en español", () => {
    const antes = validarFechaInicio("2026-10-01", "2026-10-09", rango);
    expect(antes.ok).toBe(false);
    if (!antes.ok) {
      expect(antes.error.codigo).toBe("FECHA_INICIO_INVALIDA");
      expect(antes.error.mensaje).toMatch(/fecha de inicio/i);
      expect(antes.error.mensaje).toContain("02/10/2026");
      expect(antes.error.mensaje).toContain("09/10/2027");
    }
    expect(validarFechaInicio("2027-10-10", "2026-10-09", rango).ok).toBe(false);
  });

  it("rechaza fechas mal escritas o que no existen", () => {
    for (const texto of ["", "2026-2-1", "15/10/2026", "2026-02-30", "2026-13-01", "2026-10-09T00:00"]) {
      expect(validarFechaInicio(texto, "2026-10-09", rango).ok).toBe(false);
    }
  });
});

describe("limitesFechaInicio", () => {
  it("primera y última fecha permitidas, cruzando meses y años bisiestos", () => {
    expect(limitesFechaInicio("2026-10-09", { diasAtras: 7, diasAdelante: 365 })).toEqual({ minimo: "2026-10-02", maximo: "2027-10-09" });
    expect(limitesFechaInicio("2028-03-03", { diasAtras: 7, diasAdelante: 365 })).toEqual({ minimo: "2028-02-25", maximo: "2029-03-03" });
    expect(limitesFechaInicio("2027-03-03", { diasAtras: 7, diasAdelante: 365 })).toEqual({ minimo: "2027-02-24", maximo: "2028-03-02" });
  });
});

describe("calendariosPorFechas", () => {
  it("plazo especial de 36 meses con tasa acordada mensual (caso F): sin tasa al final del plazo, se omite", () => {
    const r = calendariosPorFechas(
      semillaReal,
      { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: new Decimal("100000"), plazo: 36 },
      { tipo: "especial", plazo: 36, tasas: { mensual: "17.00" } },
      "2026-10-15",
    );
    expect(r.finalDelPlazo.tipo).toBe("sin_tasa");
    expect(r.mensual.tipo).toBe("calendario");
    if (r.mensual.tipo === "calendario") {
      expect(r.mensual.calendario.rendimientoTotal).toBe("51046.58");
      expect(r.mensual.calendario.filas.at(-1)!.rendimiento).toBe("1397.18");
    }
  });

  it("plazo de tabla: las dos modalidades con la tasa de la tabla y el mismo calendario de fechas", () => {
    const r = calendariosPorFechas(
      semillaReal,
      { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: MILLON, plazo: 6 },
      { tipo: "tabla", puntos: "0" },
      "2026-10-15",
    );
    expect(r.mensual.tipo).toBe("calendario");
    expect(r.finalDelPlazo.tipo).toBe("calendario");
    if (r.mensual.tipo === "calendario" && r.finalDelPlazo.tipo === "calendario") {
      expect(r.mensual.calendario.diasTotales).toBe(182);
      expect(r.finalDelPlazo.calendario.vencimiento).toBe("2027-04-15");
    }
  });
});
