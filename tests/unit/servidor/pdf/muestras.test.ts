// Muestras para la revisión visual de la página 2. Solo corre si existe la
// variable MUESTRAS_DIR (por ejemplo C:\dev\informes\sprint-3a, fuera del
// repositorio). Escribe cada PDF, la página 2 en PNG y su texto extraído.
// Datos sintéticos.
//
//   PowerShell: $env:MUESTRAS_DIR = "C:\dev\informes\sprint-3a"; npx vitest run --project unit muestras

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf, type EntradaPdf } from "../../../../src/aplicacion/modelo";
import { datosPagina2 } from "../../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import { cotizarConAjuste, type Ajuste } from "../../../../src/domain/interes/ajustes";
import type { Esquema } from "../../../../src/domain/tasas/semilla.esquema";
import { renderizarPdf } from "../../../../src/servidor/pdf/renderizar";
import { semillaReal } from "../../oro/ayudas";
import { extraerTexto } from "./extraer";
import { benchmarkReal } from "../../benchmarkReal";

const DIRECTORIO = process.env.MUESTRAS_DIR;

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));

const OPCIONALES: EntradaPdf = {
  preparadoPara: "Persona Sintética Uno",
  ejecutivo: "Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test",
  vigencia: "15 días naturales",
};

interface Muestra {
  readonly archivo: string;
  readonly entidad: string;
  readonly moneda: "MXN" | "USD";
  readonly esquema: Esquema;
  readonly monto: string;
  readonly plazo: number;
  readonly ajuste: Ajuste;
  /** Fecha del PDF (inyectada): decide qué entra al comparativo. */
  readonly ahora: Date;
}

const SIN_AJUSTE: Ajuste = { tipo: "tabla", puntos: "0" };
const DIA_DE_LOS_DATOS = new Date("2026-10-07T12:00:00-06:00");

const MUESTRAS: readonly Muestra[] = [
  { archivo: "a-crediflexi-mensual-1500000-12m-mas1", entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1500000", plazo: 12, ajuste: { tipo: "tabla", puntos: "1.0" }, ahora: DIA_DE_LOS_DATOS },
  { archivo: "b-ramisise-usd-mensual-10000-12m", entidad: "RAMI_SISE", moneda: "USD", esquema: "mensual", monto: "10000", plazo: 12, ajuste: SIN_AJUSTE, ahora: DIA_DE_LOS_DATOS },
  { archivo: "c-crediflexi-especial-100000-9m", entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "100000", plazo: 9, ajuste: { tipo: "especial", plazo: 9, tasas: { mensual: "17", final_del_plazo: "19" } }, ahora: DIA_DE_LOS_DATOS },
  // 31 días después de actualizado_al: el comparativo se omite por antigüedad.
  { archivo: "d-crediflexi-mensual-1500000-12m-benchmark-viejo", entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1500000", plazo: 12, ajuste: SIN_AJUSTE, ahora: new Date("2026-11-07T12:00:00-06:00") },
  { archivo: "e-ramisise-final-500000-24m", entidad: "RAMI_SISE", moneda: "MXN", esquema: "final_del_plazo", monto: "500000", plazo: 24, ajuste: SIN_AJUSTE, ahora: DIA_DE_LOS_DATOS },
  { archivo: "f-crediflexi-mensual-30000-6m", entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "30000", plazo: 6, ajuste: SIN_AJUSTE, ahora: DIA_DE_LOS_DATOS },
];

/** Dibuja una página del PDF en PNG con pdfjs-dist y @napi-rs/canvas (ya instalados para pruebas). */
async function paginaEnPng(bytes: Uint8Array, numero: number, escala: number): Promise<Buffer> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const pdf = await tarea.promise;
  const pagina = await pdf.getPage(numero);
  const vista = pagina.getViewport({ scale: escala });
  const lienzo = createCanvas(Math.ceil(vista.width), Math.ceil(vista.height));
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#FFFFFF";
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  await pagina.render({
    canvasContext: contexto as unknown as CanvasRenderingContext2D,
    canvas: lienzo as unknown as HTMLCanvasElement,
    viewport: vista,
  }).promise;
  await tarea.destroy();
  return lienzo.encode("png");
}

describe.runIf(DIRECTORIO !== undefined)("muestras de la página 2 para revisión visual", () => {
  for (const m of MUESTRAS) {
    it(m.archivo, { timeout: 120_000 }, async () => {
      const dir = DIRECTORIO!;
      await mkdir(dir, { recursive: true });
      const { entidad, moneda, esquema, monto, plazo, ajuste } = m;
      const c = cotizarConAjuste(semillaReal, { entidad, moneda, esquema, monto, plazo }, ajuste);
      if (!c.ok) throw new Error(c.error.mensaje);
      const modelo = sinError(
        modeloPdf(c.valor, { razonesSociales, textos, benchmark: benchmarkReal }, OPCIONALES, m.ahora, datosPagina2(semillaReal, c.valor.solicitud, ajuste)),
      );
      const bytes = await renderizarPdf(modelo);
      const { paginas, porPagina } = await extraerTexto(bytes);
      expect(paginas).toBe(2);
      await writeFile(path.join(dir, `${m.archivo}.pdf`), bytes);
      await writeFile(path.join(dir, `${m.archivo}-pagina1.png`), await paginaEnPng(bytes, 1, 1.5));
      await writeFile(path.join(dir, `${m.archivo}-pagina2.png`), await paginaEnPng(bytes, 2, 2));
      await writeFile(path.join(dir, `${m.archivo}-pagina2.txt`), porPagina[1], "utf8");
    });
  }
});
