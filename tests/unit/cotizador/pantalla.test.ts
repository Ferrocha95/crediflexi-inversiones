import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS as TEXTOS_PANTALLA } from "../../../src/app/(app)/cotizador/textosPantalla";

// Revisión estática de los archivos que llegan al navegador: no deben traer
// el dominio, decimal.js ni la semilla, ni guardar o registrar lo que se escribe.

const CLIENTE = [
  "src/app/(app)/cotizador/Cotizador.tsx",
  "src/app/(app)/cotizador/VistaPrevia.tsx",
  "src/app/(app)/cotizador/textosPantalla.ts",
  "src/app/(app)/cotizador/peticionPdf.ts",
  "src/app/(app)/cotizador/monedas.ts",
];
const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

/** Importaciones que traen valores (no solo tipos). */
function importacionesDeValor(codigo: string): string[] {
  return [...codigo.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
}

describe("archivos del navegador", () => {
  it("Cotizador.tsx y VistaPrevia.tsx son componentes de cliente", () => {
    for (const f of CLIENTE.slice(0, 2)) expect(leer(f).startsWith('"use client";')).toBe(true);
  });

  it.each(CLIENTE)("%s no importa valores del dominio, de la aplicación, del servidor, de decimal.js ni de la semilla", (f) => {
    const prohibidas = importacionesDeValor(leer(f)).filter((m) => /domain|aplicacion|servidor|decimal|seed|\.json$/.test(m));
    expect(prohibidas).toEqual([]);
  });

  it.each(CLIENTE)("%s no guarda nada ni registra en la consola", (f) => {
    expect(leer(f)).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|useSearchParams|useRouter|history\.|console\./);
  });

  it("la acción no registra en la consola", () => {
    for (const f of ["src/app/(app)/cotizador/acciones.ts", "src/servidor/vistaPrevia.ts", "src/servidor/guardiaHost.ts", "src/proxy.ts"]) {
      expect(leer(f)).not.toMatch(/console\./);
    }
  });

  it("acciones.ts es un archivo de acciones del servidor", () => {
    expect(leer("src/app/(app)/cotizador/acciones.ts").startsWith('"use server";')).toBe(true);
  });

  it("la página principal enlaza al cotizador", () => {
    expect(leer("src/app/(app)/page.tsx")).toMatch(/href="\/cotizador"/);
  });
});

describe("pantalla: generación del PDF", () => {
  const cotizador = leer("src/app/(app)/cotizador/Cotizador.tsx");

  it("ya no muestra el aviso de la siguiente etapa", () => {
    expect(cotizador).not.toMatch(/pdfSiguienteEtapa|siguiente etapa/);
    expect(leer("src/app/(app)/cotizador/textosPantalla.ts")).not.toMatch(/siguiente etapa/);
  });

  it("hace un POST a /cotizador/pdf con el cuerpo de cuerpoPeticionPdf y la versión de la vista previa", () => {
    expect(cotizador).toMatch(/fetch\(\s*["']\/cotizador\/pdf["']/);
    expect(cotizador).toMatch(/method:\s*["']POST["']/);
    expect(cotizador).toMatch(/cuerpoPeticionPdf\(/);
    expect(cotizador).toMatch(/tasas\.version/);
  });

  it("los campos opcionales usan los topes que llegan del servidor", () => {
    expect(cotizador).toMatch(/opciones\.topes/);
    expect(cotizador).not.toMatch(/\b(120|60|300)\b/);
  });

  it("tiene los cuatro campos opcionales con su etiqueta", () => {
    expect(TEXTOS_PANTALLA).toMatchObject({
      preparadoPara: "Preparado para",
      ejecutivo: "Ejecutivo (nombre y contacto)",
      vigencia: "Vigencia",
      notaAdicional: "Nota adicional",
    });
    expect(cotizador).toContain('CAMPOS_OPCIONALES = ["preparadoPara", "ejecutivo", "vigencia", "notaAdicional"]');
    expect(cotizador).toContain("{TEXTOS[clave]}");
  });

  it("peticionPdf.ts tampoco guarda ni registra nada", () => {
    expect(leer("src/app/(app)/cotizador/peticionPdf.ts")).not.toMatch(
      /localStorage|sessionStorage|indexedDB|document\.cookie|console\./,
    );
  });
});

describe("vista previa sin cálculo (Sprint 6a)", () => {
  const vista = leer("src/app/(app)/cotizador/VistaPrevia.tsx");

  it("no muestra importes ni tablas de rendimientos: no usa las cifras, la línea de pago ni las tarjetas de cifra", () => {
    expect(vista).not.toMatch(/salidas|TarjetaCifra|lineaPago|formula|operacion/);
  });

  it("sí muestra los datos capturados, la tasa con su desglose, el tramo y los avisos", () => {
    for (const t of ["vista.solicitud.monto", "vista.solicitud.plazo", "vista.solicitud.esquema", "vista.etiquetaTasa", "vista.desgloseTasa", "vista.tramo", "vista.avisos", "TEXTOS.tituloDatos"]) {
      expect(vista).toContain(t);
    }
  });

  it("el título de la sección es Datos capturados y la confirmación habla de los datos, no de los números", () => {
    expect(TEXTOS_PANTALLA.tituloDatos).toBe("Datos capturados");
    expect(TEXTOS_PANTALLA.confirmo).toBe("Confirmo que los datos capturados son correctos");
    expect(TEXTOS_PANTALLA.motivoSinConfirmar).toBe('Marca la casilla "Confirmo que los datos capturados son correctos" para habilitar el PDF.');
    expect(JSON.stringify(TEXTOS_PANTALLA)).not.toMatch(/números son correctos/);
  });
});
