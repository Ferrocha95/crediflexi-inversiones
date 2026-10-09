import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../src/aplicacion/entidades";
import { opcionesCotizador } from "../../../src/aplicacion/opciones";
import { monedaParaEntidad, monedasDeEntidad, monedasSoloPara } from "../../../src/app/(app)/cotizador/monedas";
import { TOPES } from "../../../src/aplicacion/modelo";
import { cargarTextos, type TextosCotizacion } from "../../../src/aplicacion/textos";
import { cargar, copiaSemilla, semillaReal } from "../oro/ayudas";

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos: TextosCotizacion = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const parametros = { semilla: semillaReal, razonesSociales, textos, rangoFechaInicio: { diasAtras: 7, diasAdelante: 365 } };
const HOY = "2026-10-09";

describe("opcionesCotizador", () => {
  it("fecha de inicio: hoy por omisión y el rango de la semilla (7 días atrás, 365 adelante)", () => {
    expect(opcionesCotizador(parametros, HOY).fechaInicio).toEqual({ hoy: "2026-10-09", minimo: "2026-10-02", maximo: "2027-10-09" });
  });

  it("ofrece las dos entidades de la semilla con su razón social completa", () => {
    expect(opcionesCotizador(parametros, HOY).entidades).toEqual([
      { clave: "CREDIFLEXI", razonSocial: "CREDIFLEXI, S.A.P.I. DE C.V." },
      { clave: "RAMI_SISE", razonSocial: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R." },
    ]);
  });

  it("MXN y USD habilitadas; USD solo para RAMI_SISE (aplica_a_entidades de la semilla)", () => {
    expect(opcionesCotizador(parametros, HOY).monedas).toEqual([
      { moneda: "MXN", habilitada: true, motivo: null, entidades: ["CREDIFLEXI", "RAMI_SISE"] },
      { moneda: "USD", habilitada: true, motivo: null, entidades: ["RAMI_SISE"] },
    ]);
  });

  it("el estado de la moneda sale de los datos: una tabla USD POR_CONFIRMAR va deshabilitada con su motivo", () => {
    const j = copiaSemilla();
    j.tasas_usd.estatus = "POR_CONFIRMAR";
    const o = opcionesCotizador({ ...parametros, semilla: cargar(j) }, HOY);
    expect(o.monedas).toContainEqual({ moneda: "USD", habilitada: false, motivo: "Las tasas en USD están por confirmar.", entidades: ["RAMI_SISE"] });
  });

  it("una tabla sin aplica_a_entidades aplica a todas las entidades (entidades: null)", () => {
    const j = copiaSemilla();
    delete (j.tasas_usd as Record<string, unknown>).aplica_a_entidades;
    expect(opcionesCotizador({ ...parametros, semilla: cargar(j) }, HOY).monedas[1].entidades).toBeNull();
  });

  it("monedasDeEntidad: CREDIFLEXI solo ofrece MXN y RAMI_SISE ofrece MXN y USD", () => {
    const o = opcionesCotizador(parametros, HOY);
    expect(monedasDeEntidad(o, "CREDIFLEXI").map((m) => m.moneda)).toEqual(["MXN"]);
    expect(monedasDeEntidad(o, "RAMI_SISE").map((m) => m.moneda)).toEqual(["MXN", "USD"]);
  });

  it("monedaParaEntidad: conserva la moneda si aplica y, si no, regresa a la primera habilitada", () => {
    const o = opcionesCotizador(parametros, HOY);
    expect(monedaParaEntidad(o, "RAMI_SISE", "USD")).toBe("USD");
    expect(monedaParaEntidad(o, "CREDIFLEXI", "USD")).toBe("MXN");
    expect(monedaParaEntidad(o, "CREDIFLEXI", "MXN")).toBe("MXN");
  });

  it("monedasSoloPara: explica que USD es solo para la razón social de RAMI_SISE", () => {
    const o = opcionesCotizador(parametros, HOY);
    expect(monedasSoloPara(o, "CREDIFLEXI")).toEqual([{ moneda: "USD", razonesSociales: ["RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R."] }]);
    expect(monedasSoloPara(o, "RAMI_SISE")).toEqual([]);
  });

  it("una moneda sin tabla en la semilla no se ofrece", () => {
    const j: Record<string, unknown> = copiaSemilla();
    delete j.tasas_usd;
    expect(opcionesCotizador({ ...parametros, semilla: cargar(j) }, HOY).monedas.map((m) => m.moneda)).toEqual(["MXN"]);
  });

  it("los esquemas llevan el nombre del archivo de textos", () => {
    expect(opcionesCotizador(parametros, HOY).esquemas).toEqual([
      { esquema: "mensual", nombre: "Mensual" },
      { esquema: "final_del_plazo", nombre: "Al final del plazo" },
    ]);
  });

  it("trae los topes de los campos opcionales del PDF, los mismos de modelo.ts", () => {
    expect(opcionesCotizador(parametros, HOY).topes).toEqual(TOPES);
    expect(opcionesCotizador(parametros, HOY).topes).toEqual({ preparadoPara: 120, ejecutivo: 120, vigencia: 60, notaAdicional: 300 });
  });

  it("trae las opciones de puntos extra (0.0 a 5.0 en pasos de 0.5) y el rango del plazo especial", () => {
    const o = opcionesCotizador(parametros, HOY);
    expect(o.puntosExtra).toEqual(["0.0", "0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0"]);
    expect(o.plazoEspecial).toEqual({ minimo: 6, maximo: 60 });
  });

  it("solo trae texto: sobrevive igual a JSON y no incluye tasas ni tablas", () => {
    const o = opcionesCotizador(parametros, HOY);
    expect(JSON.parse(JSON.stringify(o))).toEqual(o);
    const texto = JSON.stringify(o);
    expect(texto).not.toMatch(/tasas_|tramos|0\.165|0\.19/);
  });
});
