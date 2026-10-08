import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf } from "../../../../src/aplicacion/modelo";
import { datosPagina2 } from "../../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import { renderizarPdf } from "../../../../src/servidor/pdf/renderizar";
import { cotizarBien, semillaReal } from "../../oro/ayudas";
import { extraerTexto } from "./extraer";
import { benchmarkReal } from "../../benchmarkReal";

// PDF real de Rami Sise en USD (datos sintéticos): 10,000 USD a 12 meses.

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const AHORA = new Date("2026-10-07T18:00:00Z");

describe("PDF real en USD", () => {
  // Pago mensual de referencia (tests/golden/rendimientos_usd.json, tramo de 4,000 a 40,000).
  it.each([
    [6, "$66.67 USD"],
    [12, "$70.83 USD"],
    [24, "$79.17 USD"],
  ])("RAMI_SISE 10,000 dólares a %s meses: 2 páginas y las cifras con USD", async (plazo, pagoMensual) => {
    const c = cotizarBien({ entidad: "RAMI_SISE", moneda: "USD", monto: "10000", plazo });
    const m = sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, {}, AHORA, datosPagina2(semillaReal, c.solicitud)));
    const { paginas, porPagina } = await extraerTexto(await renderizarPdf(m));
    expect(paginas).toBe(2);
    expect(porPagina[0]).toContain("$10,000.00 USD");
    expect(porPagina[0]).toContain(pagoMensual);
    expect(porPagina[1]).toContain(pagoMensual);
    expect(porPagina[1]).toContain(m.pagina2.tarjetas[0].detalle!.renglones[2].cifra);
    expect(porPagina[1]).not.toMatch(/undefined|NaN/);
  }, 60_000);
});
