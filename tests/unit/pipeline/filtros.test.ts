import { describe, expect, it } from "vitest";
import {
  aplicarFiltros,
  contarPorEstatus,
  esVencido,
  hrefPipeline,
  leerFiltros,
  textoDeBusqueda,
  type ProspectoFila,
} from "../../../src/aplicacion/pipeline/filtros";

const HOY = "2026-10-07";
const UUID = "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f";

const fila = (cambios: Partial<ProspectoFila>): ProspectoFila => ({
  id: "p",
  ejecutivoId: "e-1",
  ejecutivo: "Ejecutivo Sintético",
  nombre: "Prospecto Sintético",
  contacto: "5500000001",
  comentarios: "",
  estatus: "INTERESADO",
  seguimiento: null,
  archivadoEn: null,
  ...cambios,
});

const FILAS: ProspectoFila[] = [
  fila({ id: "1", nombre: "José Ñúñez Sintético", estatus: "INTERESADO", seguimiento: "2026-10-06" }),
  fila({ id: "2", nombre: "Ana Sintética", estatus: "INTERMITENTE", seguimiento: "2026-10-07", ejecutivoId: "e-2" }),
  fila({ id: "3", nombre: "JOSE Prueba", estatus: "NO_INTERESADO", seguimiento: null }),
];

const SIN_FILTROS = leerFiltros({});

describe("leerFiltros", () => {
  it("sin parámetros", () => {
    expect(SIN_FILTROS).toEqual({ estatus: null, q: "", vencido: false, ejecutivo: null, semana: null, archivados: false, nuevo: false });
  });

  it("lee todos los parámetros; la semana se lleva a su lunes", () => {
    expect(
      leerFiltros({ estatus: "NO_INTERESADO", q: "  josé ", vencido: "1", ejecutivo: UUID, semana: "2026-10-01", archivados: "1", nuevo: "1" }),
    ).toEqual({ estatus: "NO_INTERESADO", q: "josé", vencido: true, ejecutivo: UUID, semana: "2026-09-28", archivados: true, nuevo: true });
  });

  it("ignora lo que no es válido", () => {
    expect(leerFiltros({ estatus: "CIERRE", vencido: "si", ejecutivo: "x'; drop", semana: "2026-02-31", archivados: ["1", "1"] })).toEqual(SIN_FILTROS);
  });

  it("corta la búsqueda a 100 caracteres", () => {
    expect(leerFiltros({ q: "a".repeat(300) }).q).toHaveLength(100);
  });
});

describe("búsqueda por nombre sin distinguir mayúsculas ni acentos", () => {
  it("textoDeBusqueda quita acentos y pasa a minúsculas", () => {
    expect(textoDeBusqueda("José ÑÚÑEZ")).toBe("jose nunez");
  });

  it.each([
    ["jose", ["1", "3"]],
    ["JOSÉ", ["1", "3"]],
    ["nunez", ["1"]],
    ["sintetica", ["2"]],
    ["zzz", []],
  ])("%j encuentra %j", (q, ids) => {
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, q }, HOY).map((f) => f.id)).toEqual(ids);
  });

  it("no busca en los comentarios", () => {
    expect(aplicarFiltros([fila({ id: "9", nombre: "Otro", comentarios: "José" })], { ...SIN_FILTROS, q: "jose" }, HOY)).toEqual([]);
  });

  it("los comodines de SQL no tienen efecto: se buscan como texto", () => {
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, q: "%" }, HOY)).toEqual([]);
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, q: "_" }, HOY)).toEqual([]);
  });
});

describe("seguimiento vencido", () => {
  it("es una fecha anterior a hoy, solo en activos", () => {
    expect(esVencido(fila({ seguimiento: "2026-10-06" }), HOY)).toBe(true);
    expect(esVencido(fila({ seguimiento: "2026-10-07" }), HOY)).toBe(false);
    expect(esVencido(fila({ seguimiento: null }), HOY)).toBe(false);
    expect(esVencido(fila({ seguimiento: "2026-10-06", archivadoEn: "2026-10-07T10:00:00Z" }), HOY)).toBe(false);
  });

  it("el filtro deja solo los vencidos", () => {
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, vencido: true }, HOY).map((f) => f.id)).toEqual(["1"]);
  });
});

describe("filtros por estatus y ejecutivo", () => {
  it("estatus", () => {
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, estatus: "INTERMITENTE" }, HOY).map((f) => f.id)).toEqual(["2"]);
  });

  it("ejecutivo", () => {
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, ejecutivo: "e-2" }, HOY).map((f) => f.id)).toEqual(["2"]);
  });

  it("se combinan", () => {
    expect(aplicarFiltros(FILAS, { ...SIN_FILTROS, q: "jose", estatus: "NO_INTERESADO" }, HOY).map((x) => x.id)).toEqual(["3"]);
  });
});

describe("contarPorEstatus", () => {
  it("cuenta los tres estatus y el total", () => {
    expect(contarPorEstatus(FILAS)).toEqual({ INTERESADO: 1, INTERMITENTE: 1, NO_INTERESADO: 1, total: 3 });
    expect(contarPorEstatus([])).toEqual({ INTERESADO: 0, INTERMITENTE: 0, NO_INTERESADO: 0, total: 0 });
  });
});

describe("hrefPipeline", () => {
  it("sin filtros", () => {
    expect(hrefPipeline(SIN_FILTROS)).toBe("/pipeline");
  });

  it("conserva los filtros y aplica los cambios", () => {
    const f = leerFiltros({ q: "josé", semana: "2026-10-01" });
    expect(hrefPipeline(f, { estatus: "INTERESADO" })).toBe("/pipeline?estatus=INTERESADO&q=jos%C3%A9&semana=2026-09-28");
    expect(hrefPipeline({ ...f, vencido: true, archivados: true, ejecutivo: "e-1" }, { q: "" })).toBe(
      "/pipeline?vencido=1&ejecutivo=e-1&semana=2026-09-28&archivados=1",
    );
  });

  it("nunca conserva nuevo=1", () => {
    expect(hrefPipeline(leerFiltros({ nuevo: "1" }))).toBe("/pipeline");
  });
});
