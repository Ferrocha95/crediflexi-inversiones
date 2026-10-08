import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { modeloReclutamiento, type CamposReclutamiento } from "../../../src/aplicacion/reclutamiento";
import { cargarTextos } from "../../../src/aplicacion/textos";
import { semillaComisiones as s } from "../comisiones/ayudas";

// Modo reclutamiento: perfil externo, tabla N1, cada monto por plazo como una
// sola inversión nueva. Cifras calculadas a mano con las tasas completas:
//   Escenario 1: 300,000 a 12 (2.64%) = 7,920.00
//   Escenario 2: 200,000 a 6 (1.20%) = 2,400.00 + 500,000 a 12 (2.706%) = 13,530.00 -> 15,930.00
//   Escenario 3: 300,000 a 6 (1.20%) = 3,600.00 + 500,000 a 12 = 13,530.00 + 500,000 a 24 (5.658%) = 28,290.00 -> 45,420.00

const t = (() => {
  const r = cargarTextos(textosJson, "seed/textos_cotizacion.json");
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor.reclutamiento;
})();

const OCTUBRE = new Date("2026-10-08T12:00:00-06:00");

const EJEMPLO: CamposReclutamiento = { presenta: "Persona Sintética Uno", escenarios: t.escenariosEjemplo };

function modelo(c: Partial<CamposReclutamiento> = {}, ahora = OCTUBRE) {
  const r = modeloReclutamiento(s, t, { ...EJEMPLO, ...c }, ahora);
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

function error(c: Partial<CamposReclutamiento>) {
  const r = modeloReclutamiento(s, t, { ...EJEMPLO, ...c }, OCTUBRE);
  if (r.ok) throw new Error("Se esperaba un error");
  return r.error;
}

describe("modeloReclutamiento con los escenarios de ejemplo", () => {
  it("total y desglose por plazo de cada escenario", () => {
    const m = modelo();
    expect(m.escenarios.map((e) => [e.nombre, e.total])).toEqual([
      ["Escenario 1", "$7,920.00"],
      ["Escenario 2", "$15,930.00"],
      ["Escenario 3", "$45,420.00"],
    ]);
    expect(m.escenarios[2].lineas.map((l) => [l.plazo, l.monto, l.tasa, l.comision])).toEqual([
      ["6 meses", "$300,000.00", "1.20%", "$3,600.00"],
      ["12 meses", "$500,000.00", "2.706%", "$13,530.00"],
      ["24 meses", "$500,000.00", "5.658%", "$28,290.00"],
    ]);
    expect(m.escenarios[0].lineas[0].operacion).toBe("$300,000.00 × 2.64% = $7,920.00");
  });

  it("la gráfica compara los totales: el mayor ocupa todo el ancho", () => {
    const g = modelo().grafica;
    expect(g.map((b) => [b.nombre, b.total])).toEqual([
      ["Escenario 1", "$7,920.00"],
      ["Escenario 2", "$15,930.00"],
      ["Escenario 3", "$45,420.00"],
    ]);
    expect(g[2].fraccion).toBe(1);
    expect(g[0].fraccion).toBeCloseTo(7920 / 45420, 10);
    expect(g[1].fraccion).toBeCloseTo(15930 / 45420, 10);
  });

  it("el aviso fijo lleva la fecha de las tablas vigentes en palabras", () => {
    expect(modelo().aviso).toBe(
      "Ejemplo calculado con las tablas vigentes al 7 de octubre de 2026. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos.",
    );
  });

  it("las fechas de pago por quincena del mes en curso (Ciudad de México)", () => {
    expect(modelo().fechas).toEqual([
      "Lo captado del 1 al 15 de octubre se pagaría el 16/10/2026.",
      "Lo captado del 16 al fin de octubre se pagaría el 01/11/2026.",
    ]);
  });

  it("en diciembre, la segunda quincena se pagaría el 1 de enero del año siguiente", () => {
    expect(modelo({}, new Date("2026-12-10T12:00:00-06:00")).fechas[1]).toBe(
      "Lo captado del 16 al fin de diciembre se pagaría el 01/01/2027.",
    );
  });

  it("quien presenta: limpio y en la línea del PDF; vacío no lleva línea", () => {
    expect(modelo({ presenta: "  Persona\u200B Sintética  " }).presenta).toBe("Presenta: Persona Sintética");
    expect(modelo({ presenta: "   " }).presenta).toBeNull();
  });

  it("la fecha del documento es la de hoy en la Ciudad de México", () => {
    expect(modelo({}, new Date("2026-10-09T05:30:00Z")).fecha).toBe("08/10/2026");
  });
});

describe("modeloReclutamiento con lo que captura quien presenta", () => {
  const escenario = (nombre: string, montos: Record<string, string>) => ({ nombre, montos });

  it("acepta comas y signo de pesos; vacío o cero no cuenta", () => {
    const m = modelo({ escenarios: [escenario("A", { "6": "", "12": "$1,500,000", "18": "0", "24": "" }), escenario("B", {}), escenario("C", {})] });
    expect(m.escenarios[0].lineas.map((l) => [l.plazo, l.comision])).toEqual([["12 meses", "$43,560.00"]]);
    expect(m.escenarios[1].lineas).toEqual([]);
    expect(m.escenarios[1].total).toBe("$0.00");
  });

  it("sin captación en ningún escenario, las barras quedan en cero", () => {
    expect(modelo({ escenarios: [escenario("A", {}), escenario("B", {}), escenario("C", {})] }).grafica.map((b) => b.fraccion)).toEqual([0, 0, 0]);
  });

  it("un monto menor al mínimo dice en qué escenario y plazo", () => {
    const e = error({ escenarios: [escenario("A", {}), escenario("B", { "12": "20,000" }), escenario("C", {})] });
    expect(e.mensaje).toMatch(/^B, 12 meses: .*\$30,000\.00/);
  });

  it("un monto ilegible dice en qué escenario y plazo", () => {
    expect(error({ escenarios: [escenario("A", { "6": "mucho" }), escenario("B", {}), escenario("C", {})] }).mensaje).toMatch(/^A, 6 meses: /);
  });

  it("un plazo que no está en la tabla se rechaza", () => {
    expect(error({ escenarios: [escenario("A", { "9": "100000" }), escenario("B", {}), escenario("C", {})] }).mensaje).toMatch(/9 meses/);
  });

  it("un escenario sin nombre se rechaza", () => {
    expect(error({ escenarios: [escenario(" ", {}), escenario("B", {}), escenario("C", {})] }).mensaje).toMatch(/nombre del escenario 1/);
  });

  it("los nombres se limpian y se cortan a 40 caracteres", () => {
    const m = modelo({ escenarios: [escenario("N".repeat(60), {}), escenario("B", {}), escenario("C", {})] });
    expect(m.escenarios[0].nombre).toHaveLength(40);
  });
});
