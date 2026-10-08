// Muestras del PDF "Propuesta de ingresos" para la revisión visual. Solo corre
// con la variable MUESTRAS_DIR (fuera del repositorio). Datos sintéticos.
//
//   PowerShell: $env:MUESTRAS_DIR = "C:\dev\informes\sprint-5"; npx vitest run --project unit comisiones/muestras

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { modeloReclutamiento } from "../../../src/aplicacion/reclutamiento";
import { leerParametrosReclutamiento } from "../../../src/servidor/parametros";
import { renderizarReclutamiento } from "../../../src/servidor/pdf/renderizar";
import { extraerTexto, paginaEnPng } from "../servidor/pdf/extraer";

const DIRECTORIO = process.env.MUESTRAS_DIR;

describe.runIf(DIRECTORIO !== undefined)("muestras del PDF de reclutamiento", () => {
  it("propuesta de ingresos con $1,000,000 (1 y 3 inversiones por plazo), a 390 y 1280 px de ancho", { timeout: 120_000 }, async () => {
    const dir = DIRECTORIO!;
    await mkdir(dir, { recursive: true });
    const p = await leerParametrosReclutamiento();
    if (!p.ok) throw new Error(p.error.mensaje);
    // Con 1 inversión por plazo (por omisión) y con 3.
    for (const [n, sufijo] of [
      [1, ""],
      [3, "-3-inversiones"],
    ] as const) {
      const m = modeloReclutamiento(
        p.valor.semilla,
        p.valor.textos,
        { presenta: "Persona Sintética Uno", monto: "1000000", inversionesPorPlazo: n },
        new Date("2026-10-08T12:00:00-06:00"),
      );
      if (!m.ok) throw new Error(m.error.mensaje);
      const bytes = await renderizarReclutamiento(m.valor);
      expect((await extraerTexto(bytes)).paginas).toBe(1);
      await writeFile(path.join(dir, `propuesta-de-ingresos${sufijo}.pdf`), bytes);
      // La hoja carta mide 612 pt de ancho: la escala da el ancho en píxeles.
      for (const ancho of [390, 1280]) {
        await writeFile(path.join(dir, `propuesta-de-ingresos${sufijo}-${ancho}.png`), await paginaEnPng(bytes, 1, ancho / 612));
      }
    }
  });
});
