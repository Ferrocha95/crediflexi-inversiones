import { describe, expect, it } from "vitest";
import {
  agruparPorCategoriaYCarpeta,
  carpetaParaPantalla,
  elementoParaPantalla,
  type FilaBiblioteca,
  type FilaCarpeta,
} from "../../../src/aplicacion/biblioteca/vista";

// Agrupado de la pantalla por sección y subcarpeta: en cada sección, primero
// "Sin carpeta" y luego las carpetas por nombre, con su número de elementos.
// La búsqueda por nombre recorre todas las carpetas. En "Ver archivados", los
// elementos archivados van bajo su carpeta aunque la carpeta esté archivada.

const C1 = "c1c1c1c1-0000-4000-8000-000000000001";
const C2 = "c2c2c2c2-0000-4000-8000-000000000002";
const C3 = "c3c3c3c3-0000-4000-8000-000000000003";

const fila = (cambios: Partial<FilaBiblioteca>): FilaBiblioteca => ({
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  categoria: "CAPACITACION",
  nombre: "Manual",
  descripcion: "",
  tipo: "ENLACE",
  enlace: "https://ejemplo.test/x",
  ruta: null,
  tipo_mime: null,
  tamano_bytes: null,
  subido_por_nombre: "Gerente Sintético",
  creado_en: "2026-10-14T18:30:00Z",
  archivado_en: null,
  carpeta_id: null,
  ...cambios,
});

const carpeta = (cambios: Partial<FilaCarpeta>): FilaCarpeta => ({
  id: C1,
  categoria: "CAPACITACION",
  nombre: "Guías",
  archivado_en: null,
  ...cambios,
});

const elementos = (filas: Partial<FilaBiblioteca>[]) => filas.map((f) => elementoParaPantalla(fila(f)));
const carpetas = (filas: Partial<FilaCarpeta>[]) => filas.map((f) => carpetaParaPantalla(carpeta(f)));

describe("carpetaParaPantalla y elementoParaPantalla", () => {
  it("la carpeta lleva id, sección, nombre y si está archivada", () => {
    expect(carpetaParaPantalla(carpeta({}))).toEqual({ id: C1, categoria: "CAPACITACION", nombre: "Guías", archivada: false });
    expect(carpetaParaPantalla(carpeta({ archivado_en: "2026-10-20T00:00:00Z" })).archivada).toBe(true);
  });

  it("el elemento lleva el id de su carpeta, o null si está Sin carpeta", () => {
    expect(elementoParaPantalla(fila({ carpeta_id: C1 })).carpetaId).toBe(C1);
    expect(elementoParaPantalla(fila({})).carpetaId).toBeNull();
  });
});

describe("agruparPorCategoriaYCarpeta: activos", () => {
  const cs = carpetas([
    { id: C1, nombre: "Zeta" },
    { id: C2, nombre: "Ábaco" },
    { id: C3, nombre: "Vieja", archivado_en: "2026-10-20T00:00:00Z" },
  ]);
  const es = elementos([
    { id: "1", nombre: "Uno", carpeta_id: C1 },
    { id: "2", nombre: "Dos", carpeta_id: null },
    { id: "3", nombre: "Tres", carpeta_id: C1 },
    { id: "4", nombre: "Organigrama", categoria: "EMPRESA" },
    { id: "5", nombre: "Archivado", archivado_en: "2026-10-20T00:00:00Z", carpeta_id: C3 },
  ]);

  it("4 secciones en orden; en cada una, Sin carpeta y las carpetas activas por nombre sin acentos", () => {
    const grupos = agruparPorCategoriaYCarpeta(es, cs, { archivados: false, busqueda: "" });
    expect(grupos.map((g) => g.categoria)).toEqual(["HERRAMIENTAS", "MULTIMEDIA", "EMPRESA", "CAPACITACION"]);
    const cap = grupos[3];
    expect(cap.sinCarpeta.map((e) => e.id)).toEqual(["2"]);
    expect(cap.carpetas.map((g) => g.carpeta.nombre)).toEqual(["Ábaco", "Zeta"]);
    expect(cap.carpetas.map((g) => g.elementos.map((e) => e.nombre))).toEqual([[], ["Tres", "Uno"]]);
    expect(cap.carpetas.map((g) => g.activos)).toEqual([0, 2]);
    expect(grupos[2].sinCarpeta.map((e) => e.id)).toEqual(["4"]);
    expect(grupos[2].carpetas).toEqual([]);
  });

  it("la carpeta archivada y los elementos archivados no aparecen", () => {
    const cap = agruparPorCategoriaYCarpeta(es, cs, { archivados: false, busqueda: "" })[3];
    expect(cap.carpetas.some((g) => g.carpeta.id === C3)).toBe(false);
    expect([...cap.sinCarpeta, ...cap.carpetas.flatMap((g) => g.elementos)].some((e) => e.id === "5")).toBe(false);
  });

  it("un elemento activo cuya carpeta no llegó se muestra en Sin carpeta (no se pierde)", () => {
    const cap = agruparPorCategoriaYCarpeta(elementos([{ id: "9", carpeta_id: "ffffffff-0000-4000-8000-00000000000f" }]), [], {
      archivados: false,
      busqueda: "",
    })[3];
    expect(cap.sinCarpeta.map((e) => e.id)).toEqual(["9"]);
  });

  it("la búsqueda recorre todas las carpetas, sin mayúsculas ni acentos, y deja solo las que coinciden", () => {
    const busca = agruparPorCategoriaYCarpeta(
      elementos([
        { id: "1", nombre: "Guía rápida", carpeta_id: C1 },
        { id: "2", nombre: "Otra cosa", carpeta_id: C2 },
        { id: "3", nombre: "GUIA larga", carpeta_id: null },
      ]),
      cs,
      { archivados: false, busqueda: "guia" },
    )[3];
    expect(busca.sinCarpeta.map((e) => e.id)).toEqual(["3"]);
    expect(busca.carpetas.map((g) => [g.carpeta.id, g.elementos.map((e) => e.id)])).toEqual([[C1, ["1"]]]);
  });

  it("al buscar, los activos de cada carpeta siguen contando todos los activos (para Archivar carpeta)", () => {
    const busca = agruparPorCategoriaYCarpeta(
      elementos([
        { id: "1", nombre: "Guía", carpeta_id: C1 },
        { id: "2", nombre: "Otra", carpeta_id: C1 },
      ]),
      cs,
      { archivados: false, busqueda: "guia" },
    )[3];
    expect(busca.carpetas[0].elementos.map((e) => e.id)).toEqual(["1"]);
    expect(busca.carpetas[0].activos).toBe(2);
  });
});

describe("agruparPorCategoriaYCarpeta: Ver archivados", () => {
  const cs = carpetas([
    { id: C1, nombre: "Activa" },
    { id: C3, nombre: "Vieja", archivado_en: "2026-10-20T00:00:00Z" },
    { id: C2, nombre: "Vacía archivada", archivado_en: "2026-10-20T00:00:00Z" },
  ]);
  const es = elementos([
    { id: "1", nombre: "Activo", carpeta_id: C1 },
    { id: "2", nombre: "Archivado en vieja", carpeta_id: C3, archivado_en: "2026-10-20T00:00:00Z" },
    { id: "3", nombre: "Archivado en activa", carpeta_id: C1, archivado_en: "2026-10-20T00:00:00Z" },
    { id: "4", nombre: "Archivado suelto", archivado_en: "2026-10-20T00:00:00Z" },
  ]);

  it("los archivados van bajo su carpeta, aunque esté archivada; solo aparecen carpetas con archivados", () => {
    const cap = agruparPorCategoriaYCarpeta(es, cs, { archivados: true, busqueda: "" })[3];
    expect(cap.sinCarpeta.map((e) => e.id)).toEqual(["4"]);
    expect(cap.carpetas.map((g) => [g.carpeta.nombre, g.carpeta.archivada, g.elementos.map((e) => e.id)])).toEqual([
      ["Activa", false, ["3"]],
      ["Vieja", true, ["2"]],
    ]);
  });
});
