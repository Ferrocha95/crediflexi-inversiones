import { describe, expect, it } from "vitest";
import { DESTINOS } from "../../../src/componentes/estructura/navegacion";

describe("destinos del menú", () => {
  it("Cotizador y Pipeline están disponibles; los demás siguen en Próximamente", () => {
    expect(DESTINOS.filter((d) => d.disponible).map((d) => d.ruta)).toEqual(["/cotizador", "/pipeline"]);
    expect(DESTINOS.filter((d) => !d.disponible).map((d) => d.etiqueta)).toEqual(["Plan semanal", "Proyección", "Metas", "Cartera", "Biblioteca"]);
  });
});
