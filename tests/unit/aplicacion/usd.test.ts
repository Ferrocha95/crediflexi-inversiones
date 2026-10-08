// USD en la pantalla y en el PDF (Rami Sise). Cifras de referencia calculadas
// fuera del motor (tests/golden/rendimientos_usd.json): 10,000 USD a 12 meses
// en el primer tramo, tasa mensual 8.50%:
//   pago mensual = 10,000 × 0.085 ÷ 12 = 70.833… → 70.83
//   anual = 850.00; total del plazo = 850.00
//   último mes del calendario = 850.00 − 70.83 × 11 = 70.87

import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../src/aplicacion/entidades";
import { formatearDinero } from "../../../src/aplicacion/dinero";
import { modeloPdf, modeloVistaPrevia } from "../../../src/aplicacion/modelo";
import { datosPagina2 } from "../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../src/aplicacion/textos";
import { Decimal } from "../../../src/domain/comun/decimal";
import { cotizarBien, semillaReal } from "../oro/ayudas";
import { benchmarkReal } from "../benchmarkReal";

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const AHORA = new Date("2026-10-07T18:00:00Z");
const USD = { entidad: "RAMI_SISE", moneda: "USD", monto: "10000", plazo: 12 } as const;

describe("formatearDinero", () => {
  it("MXN se queda como hoy: solo el signo de pesos", () => {
    expect(formatearDinero(new Decimal("23750"), "MXN")).toBe("$23,750.00");
  });

  it("USD lleva el sufijo USD", () => {
    expect(formatearDinero(new Decimal("70.83"), "USD")).toBe("$70.83 USD");
    expect(formatearDinero(new Decimal("1500000"), "USD")).toBe("$1,500,000.00 USD");
  });
});

describe("vista previa y PDF en USD", () => {
  it("la vista previa muestra cada cifra con USD", () => {
    const v = modeloVistaPrevia(cotizarBien(USD), textos);
    expect(v.solicitud.monto).toBe("$10,000.00 USD");
    expect(v.salidas.map((s) => s.cifra)).toEqual(["$70.83 USD", "$850.00 USD", "$850.00 USD"]);
  });

  it("la página 1 del PDF muestra la cifra principal y los resultados con USD", () => {
    const c = cotizarBien(USD);
    const m = sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, {}, AHORA, datosPagina2(semillaReal, c.solicitud)));
    expect(m.cifraPrincipal.cifra).toBe("$70.83 USD");
    expect(m.cifras.map((x) => x.cifra)).toEqual(["$70.83 USD", "$850.00 USD", "$850.00 USD"]);
    expect(m.solicitud.monto).toBe("$10,000.00 USD");
  });

  it("la página 2 lleva USD en las tarjetas, en las filas y en las etiquetas finales de la gráfica", () => {
    const c = cotizarBien(USD);
    const m = sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, {}, AHORA, datosPagina2(semillaReal, c.solicitud)));
    const [m1, m2] = m.pagina2.tarjetas;
    expect(m1.detalle!.renglones.map((r) => r.cifra)).toEqual(["$10,000.00 USD", "$850.00 USD", "$10,850.00 USD"]);
    expect(m1.detalle!.filas[0].rendimiento).toBe("$70.83 USD");
    expect(m1.detalle!.filas[11].rendimiento).toBe("$70.87 USD");
    expect(m1.detalle!.filas[11].acumulado).toBe("$850.00 USD");
    for (const r of m2.detalle!.renglones) expect(r.cifra).toMatch(/ USD$/);
    for (const s of m.pagina2.graficas[0].dibujo!.series) expect(s.final.texto).toMatch(/ USD$/);
  });

  it("en MXN las cifras siguen sin sufijo", () => {
    const v = modeloVistaPrevia(cotizarBien({ monto: "1500000", plazo: 12 }), textos);
    expect(v.salidas[0].cifra).toBe("$23,750.00");
  });
});
