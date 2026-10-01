import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../src/aplicacion/entidades";
import { opcionesCotizador } from "../../../src/aplicacion/opciones";
import { cargarTextos, type TextosCotizacion } from "../../../src/aplicacion/textos";
import { cargar, copiaSemilla, semillaReal } from "../oro/ayudas";

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos: TextosCotizacion = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const parametros = { semilla: semillaReal, razonesSociales, textos };

describe("opcionesCotizador", () => {
  it("ofrece las dos entidades de la semilla con su razón social completa", () => {
    expect(opcionesCotizador(parametros).entidades).toEqual([
      { clave: "CREDIFLEXI", razonSocial: "CREDIFLEXI, S.A.P.I. DE C.V." },
      { clave: "RAMI_SISE", razonSocial: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R." },
    ]);
  });

  it("MXN habilitada y USD deshabilitada con el texto de moneda_deshabilitada", () => {
    expect(opcionesCotizador(parametros).monedas).toEqual([
      { moneda: "MXN", habilitada: true, motivo: null },
      { moneda: "USD", habilitada: false, motivo: "Las tasas en USD están por confirmar." },
    ]);
  });

  it("el estado de la moneda sale de los datos: si la tabla USD se confirma, se habilita", () => {
    const j = copiaSemilla();
    j.tasas_usd.estatus = "CONFIRMADA";
    (j.tasas_usd as Record<string, unknown>).limite_inferior_inclusivo = true;
    const o = opcionesCotizador({ ...parametros, semilla: cargar(j) });
    expect(o.monedas).toContainEqual({ moneda: "USD", habilitada: true, motivo: null });
  });

  it("una moneda sin tabla en la semilla no se ofrece", () => {
    const j: Record<string, unknown> = copiaSemilla();
    delete j.tasas_usd;
    expect(opcionesCotizador({ ...parametros, semilla: cargar(j) }).monedas.map((m) => m.moneda)).toEqual(["MXN"]);
  });

  it("los esquemas llevan el nombre del archivo de textos", () => {
    expect(opcionesCotizador(parametros).esquemas).toEqual([
      { esquema: "mensual", nombre: "Rendimientos mensuales" },
      { esquema: "final_del_plazo", nombre: "Al final del plazo" },
    ]);
  });

  it("solo trae texto: sobrevive igual a JSON y no incluye tasas ni tablas", () => {
    const o = opcionesCotizador(parametros);
    expect(JSON.parse(JSON.stringify(o))).toEqual(o);
    const texto = JSON.stringify(o);
    expect(texto).not.toMatch(/tasas_|tramos|0\.165|0\.19/);
  });
});
