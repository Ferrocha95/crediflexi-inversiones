import { describe, expect, it } from "vitest";
import type { ProspectoFila } from "../../../src/aplicacion/pipeline/filtros";
import { filaParaPantalla, tipoListaVacia } from "../../../src/aplicacion/pipeline/vista";

const HOY = "2026-10-07";
const fila: ProspectoFila = {
  id: "p-1",
  ejecutivoId: "u-1",
  ejecutivo: "Ejecutivo Sintético",
  nombre: "Prospecto Sintético",
  contacto: "5512345678",
  comentarios: "Llamar el 15/10",
  estatus: "NO_INTERESADO",
  seguimiento: "2026-10-06",
  archivadoEn: null,
};

describe("filaParaPantalla", () => {
  it("da formato a teléfono, estatus y fecha, y marca el vencido", () => {
    expect(filaParaPantalla(fila, HOY, "u-1")).toEqual({
      datos: {
        id: "p-1",
        nombre: "Prospecto Sintético",
        contacto: "55 1234 5678",
        comentarios: "Llamar el 15/10",
        estatus: "NO INTERESADO",
        seguimiento: "06/10/2026",
        ejecutivo: "Ejecutivo Sintético",
        vencido: true,
      },
      propio: true,
      archivado: false,
      valores: { nombre: "Prospecto Sintético", contacto: "5512345678", comentarios: "Llamar el 15/10", estatus: "NO_INTERESADO", seguimiento: "2026-10-06" },
    });
  });

  it("sin seguimiento muestra una raya y no es vencido", () => {
    const r = filaParaPantalla({ ...fila, seguimiento: null }, HOY, "u-1");
    expect(r.datos.seguimiento).toBe("—");
    expect(r.datos.vencido).toBe(false);
    expect(r.valores.seguimiento).toBe("");
  });

  it("el prospecto de otro ejecutivo no es propio", () => {
    expect(filaParaPantalla(fila, HOY, "u-2").propio).toBe(false);
  });

  it("un archivado no se marca como vencido", () => {
    const r = filaParaPantalla({ ...fila, archivadoEn: "2026-10-07T10:00:00Z" }, HOY, "u-1");
    expect(r.archivado).toBe(true);
    expect(r.datos.vencido).toBe(false);
  });
});

describe("tipoListaVacia", () => {
  it("con filas que no coinciden con los filtros: sin resultados", () => {
    expect(tipoListaVacia({ vistaArchivados: false, totalSinFiltrar: 3, archivados: 0 })).toBe("sin_resultados");
    expect(tipoListaVacia({ vistaArchivados: true, totalSinFiltrar: 2, archivados: 2 })).toBe("sin_resultados");
  });

  it("sin activos pero con archivados: solo archivados (no dice que no hay prospectos)", () => {
    expect(tipoListaVacia({ vistaArchivados: false, totalSinFiltrar: 0, archivados: 1 })).toBe("solo_archivados");
  });

  it("sin activos ni archivados: sin prospectos", () => {
    expect(tipoListaVacia({ vistaArchivados: false, totalSinFiltrar: 0, archivados: 0 })).toBe("sin_prospectos");
  });

  it("en la vista de archivados vacía: sin archivados", () => {
    expect(tipoListaVacia({ vistaArchivados: true, totalSinFiltrar: 0, archivados: 0 })).toBe("sin_archivados");
  });
});
