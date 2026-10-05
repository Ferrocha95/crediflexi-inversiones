// Muestras para la revisión visual de la página 2. Solo corre si existe la
// variable MUESTRAS_DIR (por ejemplo C:\dev\informes\calendario-pdf, fuera del
// repositorio). Escribe cada PDF, la página 2 en PNG y su texto extraído.
// Datos sintéticos.
//
//   PowerShell: $env:MUESTRAS_DIR = "C:\dev\informes\calendario-pdf"; npx vitest run --project unit muestras

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import semillaJson from "../../../../seed/parametros_iniciales.json";
import textosJson from "../../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../../src/aplicacion/entidades";
import { modeloPdf, type EntradaPdf } from "../../../../src/aplicacion/modelo";
import { datosPagina2 } from "../../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../../src/aplicacion/textos";
import type { Esquema } from "../../../../src/domain/tasas/semilla.esquema";
import { renderizarPdf } from "../../../../src/servidor/pdf/renderizar";
import { cotizarBien, semillaReal } from "../../oro/ayudas";
import { extraerTexto } from "./extraer";

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

const MUESTRAS: readonly { archivo: string; entidad: string; esquema: Esquema; monto: string; plazo: number }[] = [
  { archivo: "a-crediflexi-mensual-1500000-12m", entidad: "CREDIFLEXI", esquema: "mensual", monto: "1500000", plazo: 12 },
  { archivo: "b-ramisise-final-500000-24m", entidad: "RAMI_SISE", esquema: "final_del_plazo", monto: "500000", plazo: 24 },
  { archivo: "c-crediflexi-mensual-55000-6m", entidad: "CREDIFLEXI", esquema: "mensual", monto: "55000", plazo: 6 },
  { archivo: "d-crediflexi-mensual-950000-12m", entidad: "CREDIFLEXI", esquema: "mensual", monto: "950000", plazo: 12 },
  { archivo: "e-crediflexi-final-580000-12m", entidad: "CREDIFLEXI", esquema: "final_del_plazo", monto: "580000", plazo: 12 },
  { archivo: "f-crediflexi-mensual-1000000-6m", entidad: "CREDIFLEXI", esquema: "mensual", monto: "1000000", plazo: 6 },
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
      const c = cotizarBien({ entidad: m.entidad, esquema: m.esquema, monto: m.monto, plazo: m.plazo });
      const modelo = sinError(
        modeloPdf(c, { razonesSociales, textos }, OPCIONALES, new Date(), datosPagina2(semillaReal, c.solicitud)),
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
