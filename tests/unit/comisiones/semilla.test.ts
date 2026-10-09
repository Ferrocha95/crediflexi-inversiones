import { describe, expect, it } from "vitest";
import { cargarSemillaComisiones } from "../../../src/domain/comisiones/semilla";
import { copiaSemilla, mal, semillaComisiones as s } from "./ayudas";

describe("cargarSemillaComisiones con la semilla 0.9.2", () => {
  it("lee la versión, el nivel vigente y los parámetros confirmados", () => {
    expect(s.version).toBe("0.9.2");
    expect(s.generado).toBe("2026-10-07");
    expect(s.nivelVigente).toBe("N1");
    expect(s.renovacionesPaganComision).toBe(true);
    expect(s.renovacionesCuentanParaMeta).toBe(false);
    expect(s.montoMinimo.toFixed(2)).toBe("30000.00");
    expect(s.umbralDesbloqueo.toString()).toBe("0.8");
    expect(s.metas.EJECUTIVO.toFixed(0)).toBe("1000000");
    expect(s.metas.GERENTE.toFixed(0)).toBe("2000000");
    expect(s.notaComisionBloqueada).toBe("se_pierde (POR_CONFIRMAR, editable)");
  });

  it("ya no trae el 30% de la red externa para la meta (decisión de Fernando, 0.8.1)", () => {
    expect(s).not.toHaveProperty("porcentajeRedExterna");
    expect(copiaSemilla().parametros).not.toHaveProperty("porcentaje_sobre_red_externa");
  });

  it("lee el bono de gerente (30% de la comisión N1 del equipo, por confirmar)", () => {
    expect(s.bonoGerente.porcentaje.toString()).toBe("0.3");
    expect(s.bonoGerente.requiereDesbloqueoDelEquipo).toBe(false);
    expect(s.bonoGerente.estado).toBe("por confirmar");
  });

  it("lee el calendario de pago por quincena", () => {
    expect(s.pago).toEqual({ ultimoDiaQuincena1: 15, diaPagoQuincena1: 16, diaPagoQuincena2: 1 });
  });

  it("lee las tablas N1, N2 y N3 de nuevas y renovaciones con 6 tramos y los plazos 6, 12, 18 y 24", () => {
    for (const tipo of ["nueva", "renovacion"] as const) {
      for (const nivel of ["N1", "N2", "N3"] as const) {
        const t = s.tablas[tipo][nivel];
        expect(t).toHaveLength(6);
        for (const tramo of t) expect([...tramo.tasas.keys()]).toEqual([6, 12, 18, 24]);
        expect(t[5].hasta).toBeNull();
      }
    }
  });

  it("guarda las tasas completas, sin redondear", () => {
    expect(s.tablas.renovacion.N3[1].tasas.get(18)?.toString()).toBe("0.0212175");
  });

  it("lee los incentivos INTERNOS", () => {
    expect(s.incentivosInternos.map((i) => [i.desde.toFixed(0), i.bono.toFixed(0)])).toEqual([
      ["1000000", "0"],
      ["1500000", "5000"],
      ["2000000", "10000"],
    ]);
    expect(s.sueldoBaseInterno.toFixed(0)).toBe("15000");
    expect(s.externos.sueldoBase.toFixed(0)).toBe("0");
  });

  it("lee los tres rangos de EXTERNOS reactivados (Sprint 5), ordenados y sin tope en el último", () => {
    expect(s.incentivosExternos.map((i) => [i.desde.toFixed(0), i.hasta?.toFixed(0) ?? null, i.bono.toFixed(0)])).toEqual([
      ["1000000", "1499999", "15000"],
      ["1500000", "1999999", "20000"],
      ["2000000", null, "25000"],
    ]);
  });

  it("las filas EXTERNOS ya no llevan la marca DESCARTADA", () => {
    const externos = copiaSemilla().incentivos_propuesta.filter((f) => f.tipo === "EXTERNOS");
    expect(externos).toHaveLength(3);
    for (const f of externos) expect(JSON.stringify(f)).not.toMatch(/DESCARTADA/i);
  });

  it("lee el cumplimiento y el rango de cada fila INTERNOS (0.9.1), sin mayúsculas tipo META", () => {
    expect(s.incentivosInternos.map((i) => [i.cumplimiento, i.desde.toFixed(0), i.hasta?.toFixed(0) ?? null])).toEqual([
      ["100% de la meta", "1000000", "1499999"],
      ["150% de la meta", "1500000", "1999999"],
      ["200% de la meta", "2000000", null],
    ]);
  });

  it("lee el cumplimiento de cada fila EXTERNOS (0.9.1): es solo la etiqueta, el rango sigue siendo de captación nueva", () => {
    expect(s.incentivosExternos.map((i) => i.cumplimiento)).toEqual([
      "100% de la meta interna",
      "150% de la meta interna",
      "200% de la meta interna",
    ]);
  });

  it("lee la comisión por externos (30% de la comisión N1 de sus externos, confirmada el 2026-10-09)", () => {
    expect(s.redExterna.porcentaje.toString()).toBe("0.3");
    expect(s.redExterna.requiereDesbloqueoDelInterno).toBe(true);
    expect(s.redExterna.estado).toBe("confirmado (2026-10-09)");
    expect(copiaSemilla().parametros.red_externa.base).toBe("comision N1 de las inversiones de sus externos");
  });
});

describe("cargarSemillaComisiones: errores en español con la ubicación", () => {
  const errorDe = (j: unknown) => mal(cargarSemillaComisiones(j));

  it("una tasa escrita como número", () => {
    const j = copiaSemilla();
    (j.comisiones.nuevos.N1[0] as Record<string, unknown>)["12"] = 0.0264;
    const e = errorDe(j);
    expect(e.codigo).toBe("SEMILLA_COMISIONES_INVALIDA");
    expect(e.detalles?.join("\n")).toContain("comisiones.nuevos.N1.0.12");
  });

  it("tramos que no son contiguos", () => {
    const j = copiaSemilla();
    j.comisiones.nuevos.N1[1].desde = 300002;
    expect(errorDe(j).detalles?.join("\n")).toMatch(/comisiones\.nuevos\.N1.*contiguo/);
  });

  it("un nivel vigente que no existe", () => {
    const j = copiaSemilla();
    (j.parametros as Record<string, unknown>).nivel_vigente = "N4";
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.nivel_vigente");
  });

  it("un umbral fuera de 0 a 1", () => {
    const j = copiaSemilla();
    j.parametros.desbloqueo.umbral = "1.5";
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.desbloqueo.umbral");
  });

  it("incentivos INTERNOS con sueldos base distintos", () => {
    const j = copiaSemilla();
    j.incentivos_propuesta[2].sueldo_base = 16000;
    expect(errorDe(j).detalles?.join("\n")).toMatch(/incentivos_propuesta.*sueldo_base/);
  });

  it("un incentivo INTERNO sin bono numérico", () => {
    const j = copiaSemilla();
    delete (j.incentivos_propuesta[0] as Record<string, unknown>).bono;
    expect(errorDe(j).detalles?.join("\n")).toContain("incentivos_propuesta.0.bono");
  });

  it("un incentivo EXTERNO sin bono numérico", () => {
    const j = copiaSemilla();
    const i = j.incentivos_propuesta.findIndex((f) => f.tipo === "EXTERNOS");
    delete (j.incentivos_propuesta[i] as Record<string, unknown>).bono;
    expect(errorDe(j).detalles?.join("\n")).toContain(`incentivos_propuesta.${i}.bono`);
  });

  it("rangos EXTERNOS que no son contiguos", () => {
    const j = copiaSemilla();
    const i = j.incentivos_propuesta.findIndex((f) => f.tipo === "EXTERNOS" && f.desde === 1500000);
    j.incentivos_propuesta[i].desde = 1500001;
    expect(errorDe(j).detalles?.join("\n")).toMatch(/incentivos_propuesta.*EXTERNOS.*contigu/);
  });

  it("el último rango EXTERNO debe quedar sin tope", () => {
    const j = copiaSemilla();
    const i = j.incentivos_propuesta.findIndex((f) => f.tipo === "EXTERNOS" && f.desde === 2000000);
    (j.incentivos_propuesta[i] as Record<string, unknown>).hasta = 2999999;
    expect(errorDe(j).detalles?.join("\n")).toMatch(/incentivos_propuesta.*EXTERNOS.*sin tope/);
  });

  it("el día de pago de la primera quincena debe ser el siguiente al último día", () => {
    const j = copiaSemilla();
    j.parametros.pago_comisiones.quincena_1.dia_de_pago = 20;
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.pago_comisiones");
  });

  it("un porcentaje del bono de gerente fuera de 0 a 1", () => {
    const j = copiaSemilla();
    j.parametros.bono_gerente.porcentaje = "30";
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.bono_gerente.porcentaje");
  });

  it("una fila de incentivos sin cumplimiento", () => {
    const j = copiaSemilla();
    const i = j.incentivos_propuesta.findIndex((f) => f.tipo === "EXTERNOS");
    delete (j.incentivos_propuesta[i] as Record<string, unknown>).cumplimiento;
    expect(errorDe(j).detalles?.join("\n")).toContain(`incentivos_propuesta.${i}.cumplimiento`);
  });

  it("un porcentaje de la comisión por externos fuera de 0 a 1", () => {
    const j = copiaSemilla();
    j.parametros.red_externa.porcentaje = "30";
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.red_externa.porcentaje");
  });

  it("requiere_desbloqueo_del_interno que no es true ni false", () => {
    const j = copiaSemilla();
    (j.parametros.red_externa as Record<string, unknown>).requiere_desbloqueo_del_interno = "si";
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.red_externa.requiere_desbloqueo_del_interno");
  });

  it("falta la comisión por externos", () => {
    const j = copiaSemilla();
    delete (j.parametros as Record<string, unknown>).red_externa;
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.red_externa");
  });

  it("falta el bono de gerente", () => {
    const j = copiaSemilla();
    delete (j.parametros as Record<string, unknown>).bono_gerente;
    expect(errorDe(j).detalles?.join("\n")).toContain("parametros.bono_gerente");
  });
});
