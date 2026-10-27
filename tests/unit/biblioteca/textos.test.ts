import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIAS } from "../../../src/aplicacion/biblioteca/reglas";
import { cargarTextos } from "../../../src/aplicacion/textos";
import { leerTextosBiblioteca } from "../../../src/servidor/parametros";

// Bloque "biblioteca" de seed/textos_cotizacion.json (0.16): los textos de la
// pantalla /biblioteca, con los de las subcarpetas (Sprint 7c). Sin marcadores.

const RUTA = path.join(process.cwd(), "seed", "textos_cotizacion.json");
const json = () => JSON.parse(readFileSync(RUTA, "utf8")) as Record<string, unknown> & { biblioteca: Record<string, unknown> };

function cargar(j: unknown) {
  const r = cargarTextos(j, "textos_cotizacion.json");
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

describe("textos: bloque biblioteca", () => {
  it("la versión es 0.19", () => {
    expect(cargar(json()).version).toBe("0.19");
  });

  it("las 4 categorías llevan los nombres acordados, en el orden del enum", () => {
    const t = cargar(json()).biblioteca;
    expect(CATEGORIAS.map((c) => t.categorias[c])).toEqual([
      "Herramientas",
      "Material multimedia",
      "Información de la empresa",
      "Capacitación (manuales y guías)",
    ]);
  });

  it("la casilla obligatoria y el aviso de las cuentas de la empresa dicen lo acordado", () => {
    const t = cargar(json()).biblioteca;
    expect(t.confirmacion).toBe("Confirmo que el archivo no contiene datos personales de clientes ni datos bancarios");
    expect(t.avisoCuentas).toMatch(/cuentas bancarias de la empresa/);
  });

  it("los botones de Director y Gerente", () => {
    const t = cargar(json()).biblioteca;
    expect([t.subirArchivo, t.agregarEnlace, t.archivar]).toEqual(["Subir archivo", "Agregar enlace", "Archivar"]);
  });

  it("los textos de las subcarpetas (Sprint 7c)", () => {
    const t = cargar(json()).biblioteca;
    expect([t.sinCarpeta, t.nuevaCarpeta, t.archivarCarpeta, t.moverA]).toEqual(["Sin carpeta", "Nueva carpeta", "Archivar carpeta", "Mover a…"]);
    expect(t.explicacionCarpetaNoVacia).toMatch(/vacía/);
    expect(t.textoArchivarCarpeta).toMatch(/No se borra/);
  });

  it("todas las claves traen texto", () => {
    const t = cargar(json()).biblioteca;
    for (const [clave, valor] of Object.entries(t)) {
      if (clave === "categorias") continue;
      expect(typeof valor, clave).toBe("string");
      expect((valor as string).trim(), clave).not.toBe("");
    }
  });

  it("sin el bloque, el error dice qué falta", () => {
    const j = json();
    delete (j as Record<string, unknown>).biblioteca;
    const r = cargarTextos(j, "textos_cotizacion.json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r.error.detalles ?? []).join(" ")).toContain("biblioteca");
  });

  it("una clave de más o de menos se rechaza", () => {
    const sobra = json();
    sobra.biblioteca.sobrante = "Texto";
    expect(cargarTextos(sobra, "x.json").ok).toBe(false);
    const falta = json();
    delete falta.biblioteca.subir_archivo;
    expect(cargarTextos(falta, "x.json").ok).toBe(false);
  });

  it("no admite marcadores", () => {
    const j = json();
    j.biblioteca.titulo_pagina = "Biblioteca {ejecutivo}";
    expect(cargarTextos(j, "x.json").ok).toBe(false);
  });

  it("leerTextosBiblioteca lee el archivo real", async () => {
    const r = await leerTextosBiblioteca();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.tituloPagina).toBe("Biblioteca");
  });
});
