import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as Tarjetas from "../../../src/componentes/inicio/TarjetasResumen";
import {
  CARTERA_TOTAL_EJEMPLO,
  DOCUMENTOS_POR_VENCER_EJEMPLO,
  ENVIO_EJEMPLO,
  META_EJEMPLO,
  PIPELINE_ESTATUS_EJEMPLO,
  PLAN_HOY_EJEMPLO,
  PROYECCION_SEMANA_EJEMPLO,
  SEGUIMIENTOS_EJEMPLO,
  VENCIMIENTOS_EJEMPLO,
} from "../../../src/app/diseno/datosEjemplo";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

const TARJETAS = {
  TarjetaMeta: { titulo: "Meta del mes", ejemplo: META_EJEMPLO },
  TarjetaPipelineEstatus: { titulo: "Pipeline por estatus", ejemplo: PIPELINE_ESTATUS_EJEMPLO },
  TarjetaSeguimientos: { titulo: "Seguimientos de hoy", ejemplo: SEGUIMIENTOS_EJEMPLO },
  TarjetaProyeccionSemana: { titulo: "Proyección de la semana", ejemplo: PROYECCION_SEMANA_EJEMPLO },
  TarjetaPlanHoy: { titulo: "Plan de hoy", ejemplo: PLAN_HOY_EJEMPLO },
  TarjetaEnvioViernes: { titulo: "Envío del viernes", ejemplo: ENVIO_EJEMPLO },
  TarjetaCarteraTotal: { titulo: "Cartera total", ejemplo: CARTERA_TOTAL_EJEMPLO },
  TarjetaVencimientos: { titulo: "Vencimientos de los próximos 30 días", ejemplo: VENCIMIENTOS_EJEMPLO },
  TarjetaDocumentosPorVencer: { titulo: "Documentos por vencer", ejemplo: DOCUMENTOS_POR_VENCER_EJEMPLO },
} as const;

const html = (nombre: keyof typeof TARJETAS, datos?: unknown) =>
  renderToStaticMarkup(createElement(Tarjetas[nombre] as FunctionComponent<{ datos?: unknown }>, { datos }));

describe("página de inicio (/): ningún dato inventado", () => {
  const pagina = leer("src/app/page.tsx");

  it("no importa datos de ejemplo ni nada de /diseno", () => {
    const importaciones = [...pagina.matchAll(/^import[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(importaciones.filter((m) => /datosEjemplo|diseno/.test(m))).toEqual([]);
    expect(pagina).not.toMatch(/_EJEMPLO\b/);
  });

  it("no le pasa datos a ninguna tarjeta", () => {
    expect(pagina).not.toMatch(/datos=/);
    for (const nombre of Object.keys(TARJETAS)) expect(pagina).toContain(`<${nombre} />`);
    expect(pagina.match(/<Tarjeta\w+ \/>/g)).toHaveLength(9);
  });

  it("el acceso al cotizador está activo y el de nuevo prospecto es Próximamente", () => {
    expect(pagina).toMatch(/href="\/cotizador"/);
    expect(pagina).toContain("Nueva cotización");
    expect(pagina).toMatch(/aria-disabled="true"\s+aria-label=\{`Nuevo prospecto, \$\{PROXIMAMENTE\}`\}/);
  });
});

describe("tarjetas de resumen", () => {
  for (const [nombre, { titulo, ejemplo }] of Object.entries(TARJETAS) as [keyof typeof TARJETAS, (typeof TARJETAS)[keyof typeof TARJETAS]][]) {
    it(`${titulo}: sin datos dice Próximamente y no muestra cifras`, () => {
      const h = html(nombre);
      expect(h).toContain(titulo);
      expect(h).toContain("Próximamente");
      expect(h).not.toMatch(/\$|\d+%|Ejemplo/);
    });

    it(`${titulo}: con datos de ejemplo ya no dice Próximamente`, () => {
      const h = html(nombre, ejemplo);
      expect(h).toContain(titulo);
      expect(h).not.toContain("Próximamente");
    });
  }

  it("la meta de ejemplo cuadra: 1,550,000 de 2,500,000 es 62 %", () => {
    expect(META_EJEMPLO).toMatchObject({ fraccion: 0.62, porcentaje: "62%", logrado: "$1,550,000.00", meta: "$2,500,000.00" });
  });

  it("los nombres de los seguimientos de ejemplo dicen «Ejemplo»", () => {
    for (const f of SEGUIMIENTOS_EJEMPLO.filas) expect(f.nombre).toMatch(/Ejemplo/);
  });
});
