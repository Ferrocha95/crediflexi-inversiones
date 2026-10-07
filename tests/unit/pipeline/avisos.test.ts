import { describe, expect, it } from "vitest";
import { avisosProspecto } from "../../../src/aplicacion/pipeline/avisos";

const HOY = "2026-10-07";
const activos = [
  { id: "p-1", nombre: "Prospecto Sintético 01", contacto: "5500000001" },
  { id: "p-2", nombre: "Prospecto Sintético 02", contacto: "5500000002" },
];

const avisos = (seguimiento: string | null, contacto = "5599999999", id?: string) =>
  avisosProspecto({ id, seguimiento, contacto }, { hoy: HOY, activos });

describe("avisosProspecto: fecha de seguimiento", () => {
  it("sin fecha o con fecha reciente no avisa", () => {
    expect(avisos(null)).toEqual([]);
    expect(avisos("2026-10-07")).toEqual([]);
    expect(avisos("2026-12-31")).toEqual([]);
  });

  it("exactamente 60 días antes de hoy no avisa", () => {
    expect(avisos("2026-08-08")).toEqual([]);
  });

  it("61 días antes de hoy avisa", () => {
    expect(avisos("2026-08-07")).toEqual([
      "La fecha de seguimiento (07/08/2026) es de hace más de 60 días. Revisa que sea correcta; puedes guardar de todos modos.",
    ]);
  });

  it("otro año avisa, aunque la fecha sea cercana", () => {
    expect(avisosProspecto({ seguimiento: "2025-12-31", contacto: "5599999999" }, { hoy: "2026-01-02", activos: [] })).toEqual([
      "La fecha de seguimiento (31/12/2025) es de otro año. Revisa que sea correcta; puedes guardar de todos modos.",
    ]);
    expect(avisos("2027-01-04")).toEqual([
      "La fecha de seguimiento (04/01/2027) es de otro año. Revisa que sea correcta; puedes guardar de todos modos.",
    ]);
  });

  it("de otro año y de hace más de 60 días: un solo aviso, el del año", () => {
    const r = avisos("2025-03-01");
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("es de otro año");
  });
});

describe("avisosProspecto: teléfono repetido", () => {
  it("avisa si el teléfono ya está en otro prospecto activo visible", () => {
    expect(avisos(null, "5500000002")).toEqual([
      "El teléfono 55 0000 0002 ya está en otro prospecto activo (Prospecto Sintético 02). Puedes guardar de todos modos.",
    ]);
  });

  it("al editar no se compara consigo mismo", () => {
    expect(avisos(null, "5500000002", "p-2")).toEqual([]);
  });

  it("puede dar los dos avisos", () => {
    expect(avisos("2025-01-01", "5500000001")).toHaveLength(2);
  });
});
