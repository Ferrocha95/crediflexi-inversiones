import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf } from "../../../../src/aplicacion/modelo";
import { datosPagina2 } from "../../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import { cotizarConAjuste } from "../../../../src/domain/interes/ajustes";
import { dimensionesPng } from "../../../../src/servidor/pdf/png";
import { renderizarPdf, RUTA_LOGOS } from "../../../../src/servidor/pdf/renderizar";
import { benchmarkReal } from "../../benchmarkReal";
import { semillaReal } from "../../oro/ayudas";
import { imagenesPorPagina, textosConTamano } from "./extraer";

// Encabezado con los dos logos juntos (una sola imagen, public/logos-crediflexi-rami-sise.png)
// y letra mínima del comparativo. Datos sintéticos.

const TIEMPO = 60_000;

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const AHORA = new Date("2026-10-08T12:00:00-06:00");

function modelo(entidad: string, moneda: "MXN" | "USD" = "MXN", plazo = 24) {
  const ajuste = { tipo: "tabla", puntos: "0" } as const;
  const monto = moneda === "MXN" ? "1500000" : "50000";
  const c = sinError(cotizarConAjuste(semillaReal, { entidad, moneda, esquema: "mensual", monto, plazo }, ajuste));
  return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, { preparadoPara: "Persona Sintética" }, AHORA, datosPagina2(semillaReal, c.solicitud, ajuste)));
}

describe("dimensionesPng", () => {
  it("lee el ancho y el alto del encabezado del PNG", () => {
    expect(dimensionesPng(readFileSync(path.join(process.cwd(), "public", "logos-crediflexi-rami-sise.png")))).toEqual({ ancho: 601, alto: 145 });
    expect(dimensionesPng(readFileSync(path.join(process.cwd(), "public", "logo-crediflexi.png")))).toEqual({ ancho: 1834, alto: 539 });
  });

  it("rechaza lo que no es PNG con un mensaje en español", () => {
    expect(() => dimensionesPng(new TextEncoder().encode("no es una imagen"))).toThrow(/no es un PNG/);
  });
});

describe("PDF de la cotización: los dos logos juntos en el encabezado de las dos páginas", () => {
  it("el logo es public/logos-crediflexi-rami-sise.png", () => {
    expect(RUTA_LOGOS).toBe(path.join(process.cwd(), "public", "logos-crediflexi-rami-sise.png"));
  });

  it.each(["CREDIFLEXI", "RAMI_SISE"])("%s: cada página pinta una sola imagen, la combinada de 601 × 145", { timeout: TIEMPO }, async (entidad) => {
    const bytes = await renderizarPdf(modelo(entidad));
    expect(await imagenesPorPagina(bytes)).toEqual([[{ ancho: 601, alto: 145 }], [{ ancho: 601, alto: 145 }]]);
  });
});

describe("PDF de la cotización: la letra del comparativo no baja de 7.5 pt", () => {
  it("con 24 meses, todo el texto del comparativo de la página 2 mide 7.5 pt o más", { timeout: TIEMPO }, async () => {
    const m = modelo("CREDIFLEXI");
    const b = m.pagina2.benchmark;
    if (b.tipo !== "grafica") throw new Error("Se esperaba el comparativo dibujado");
    const textosBenchmark = [
      b.titulo,
      b.actualizado,
      b.fuentes,
      ...b.notas,
      ...b.grupos.flatMap((g) => [g.titulo, ...g.leyendas, ...g.barras.flatMap((x) => [x.nombre, x.tasa, x.detalle ?? ""])]),
    ].filter((t) => t !== "");
    const items = (await textosConTamano(await renderizarPdf(m), 2)).filter(
      (i) => i.texto.trim().length >= 4 && textosBenchmark.some((t) => t.includes(i.texto.trim())),
    );
    // Todos los rótulos del comparativo aparecen y ninguno mide menos de 7.5 pt.
    expect(items.length).toBeGreaterThan(20);
    for (const i of items) expect(i.tamano, i.texto).toBeGreaterThanOrEqual(7.5 - 1e-6);
  });
});
