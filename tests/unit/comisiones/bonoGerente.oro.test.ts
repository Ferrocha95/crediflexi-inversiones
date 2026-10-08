import { describe, expect, it } from "vitest";
import { bonoDeGerente } from "../../../src/domain/comisiones/bonoGerente";
import type { SolicitudComision } from "../../../src/domain/comisiones/comision";
import { bien, cargar, copiaSemilla, mal, semillaComisiones as s } from "./ayudas";

// Bono de gerente (por confirmar): 30% de la suma de las comisiones N1 de las
// inversiones de su equipo, nuevas y renovaciones. Cada comisión con la misma
// función de la comisión N1; la suma a 2 decimales y un solo redondeo final.
// Valores de referencia calculados aparte por Fernando.

const nueva = (monto: string, plazo: number): SolicitudComision => ({ tipo: "nueva", monto, plazo });
const renovacion = (monto: string, plazo: number): SolicitudComision => ({ tipo: "renovacion", monto, plazo });

describe("bonoDeGerente", () => {
  it("equipo con 13,530.00 + 4,920.00 + 6,765.00: base 25,215.00 y bono 7,564.50", () => {
    const b = bien(bonoDeGerente(s, [nueva("500000", 12), nueva("400000", 6), renovacion("500000", 12)]));
    expect(b.lineas.map((l) => l.comision.toFixed(2))).toEqual(["13530.00", "4920.00", "6765.00"]);
    expect(b.base.toFixed(2)).toBe("25215.00");
    expect(b.porcentaje.toString()).toBe("0.3");
    expect(b.bono.toFixed(2)).toBe("7564.50");
  });

  it("una sola nueva de 300,001 a 6 meses (3,690.01): bono 1,107.00 (1,107.003 con un solo redondeo)", () => {
    const b = bien(bonoDeGerente(s, [nueva("300001", 6)]));
    expect(b.base.toFixed(2)).toBe("3690.01");
    expect(b.bono.toFixed(2)).toBe("1107.00");
  });

  it("sin inversiones del equipo: base y bono en cero", () => {
    const b = bien(bonoDeGerente(s, []));
    expect([b.base.toFixed(2), b.bono.toFixed(2)]).toEqual(["0.00", "0.00"]);
  });

  it("el porcentaje sale de la semilla (parametros.bono_gerente.porcentaje)", () => {
    const j = copiaSemilla();
    j.parametros.bono_gerente.porcentaje = "0.25";
    expect(bien(bonoDeGerente(cargar(j), [nueva("500000", 12)])).bono.toFixed(2)).toBe("3382.50");
  });

  it("un error de una inversión dice cuál es", () => {
    const e = mal(bonoDeGerente(s, [nueva("500000", 12), nueva("20000", 12)]));
    expect(e.codigo).toBe("MONTO_MENOR_AL_MINIMO");
    expect(e.mensaje).toMatch(/^Inversión del equipo 2:/);
  });
});
