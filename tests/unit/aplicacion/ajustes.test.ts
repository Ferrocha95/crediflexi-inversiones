// Capa de aplicación de los ajustes (Sprint 3a): armar el ajuste desde los
// campos de la pantalla, el aviso de tasa acordada alta, la vista previa y la
// página 2 con puntos extra o plazo especial. Cifras de referencia calculadas
// fuera del motor (ver tests/unit/interes/ajustes.test.ts).

import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { ajusteDesdeCampos, avisoTasaAcordada, OPCIONES_PUNTOS } from "../../../src/aplicacion/ajustes";
import { modeloVistaPrevia } from "../../../src/aplicacion/modelo";
import { datosPagina2, modeloPagina2 } from "../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../src/aplicacion/textos";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearPorcentaje } from "../../../src/domain/comun/formato";
import { cotizarConAjuste, tasaMaximaDeTabla, type Ajuste } from "../../../src/domain/interes/ajustes";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import { semillaReal } from "../oro/ayudas";

const textosCarga = cargarTextos(textosJson, "seed/textos_cotizacion.json");
if (!textosCarga.ok) throw new Error(textosCarga.error.mensaje);
const textos = textosCarga.valor;

const base: SolicitudTasa = { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1500000", plazo: 12 };
const ESPECIAL_9: Ajuste = { tipo: "especial", plazo: 9, tasas: { mensual: "17" } };

function cotizada(solicitud: Partial<SolicitudTasa>, ajuste: Ajuste) {
  const r = cotizarConAjuste(semillaReal, { ...base, ...solicitud }, ajuste);
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

describe("ajusteDesdeCampos", () => {
  it("sin plazo especial: los puntos extra sobre la tabla", () => {
    expect(ajusteDesdeCampos({ puntosExtra: "1.0", especial: null })).toEqual({ ok: true, valor: { tipo: "tabla", puntos: "1.0" } });
  });

  it("con plazo especial: las tasas capturadas por modalidad; la que viene vacía se omite", () => {
    expect(ajusteDesdeCampos({ puntosExtra: "0", especial: { plazo: 9, tasaMensual: "17", tasaFinal: null } })).toEqual({
      ok: true,
      valor: { tipo: "especial", plazo: 9, tasas: { mensual: "17" } },
    });
    expect(ajusteDesdeCampos({ puntosExtra: "0", especial: { plazo: 9, tasaMensual: " ", tasaFinal: "19.50" } })).toEqual({
      ok: true,
      valor: { tipo: "especial", plazo: 9, tasas: { final_del_plazo: "19.50" } },
    });
  });

  it("los puntos extra no aplican a un plazo especial", () => {
    const r = ajusteDesdeCampos({ puntosExtra: "1.0", especial: { plazo: 9, tasaMensual: "17", tasaFinal: null } });
    expect(r).toEqual({
      ok: false,
      error: {
        codigo: "AJUSTE_INVALIDO",
        mensaje: "Los puntos extra solo aplican a plazos de la tabla; el plazo especial ya trae su tasa acordada. Deja los puntos en 0.",
      },
    });
  });
});

describe("OPCIONES_PUNTOS", () => {
  it("de 0.0 a 5.0 en pasos de 0.5", () => {
    expect(OPCIONES_PUNTOS).toEqual(["0.0", "0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"]);
  });
});

describe("avisoTasaAcordada: máxima de la tabla de la moneda más 5 puntos", () => {
  const maximo = tasaMaximaDeTabla(semillaReal, "MXN")!;
  const limite = maximo.plus("0.05");

  it("en el límite exacto no avisa; un centésimo arriba, sí", () => {
    expect(avisoTasaAcordada(semillaReal, "MXN", limite.toFixed())).toBeNull();
    expect(avisoTasaAcordada(semillaReal, "MXN", limite.plus("0.0001").toFixed())).toEqual({
      tasa: formatearPorcentaje(limite.plus("0.0001")),
      maximoTabla: formatearPorcentaje(maximo),
      limite: formatearPorcentaje(limite),
    });
  });

  it("USD compara contra la tabla en dólares", () => {
    const maxUsd = tasaMaximaDeTabla(semillaReal, "USD")!;
    expect(avisoTasaAcordada(semillaReal, "USD", maxUsd.plus("0.06").toFixed())?.maximoTabla).toBe(formatearPorcentaje(maxUsd));
    expect(avisoTasaAcordada(semillaReal, "USD", new Decimal("0.09").toFixed())).toBeNull();
  });
});

describe("modeloVistaPrevia con ajustes", () => {
  it("puntos extra: el desglose Tasa de tabla 19.00% + 1.0 puntos extra = 20.00% y las cifras con 20%", () => {
    const v = modeloVistaPrevia(cotizada({}, { tipo: "tabla", puntos: "1.0" }), textos);
    expect(v.tasa).toBe("20.00%");
    expect(v.desgloseTasa).toEqual({ tasaTabla: "19.00%", puntos: "1.0", tasa: "20.00%" });
    expect(v.plazoEspecial).toBe(false);
    expect(v.salidas.map((s) => s.cifra)).toEqual(["$25,000.00", "$300,000.00", "$300,000.00"]);
  });

  it("sin puntos no hay desglose", () => {
    expect(modeloVistaPrevia(cotizada({}, { tipo: "tabla", puntos: "0" }), textos).desgloseTasa).toBeNull();
  });

  it("plazo especial: sin tramo ni estatus de tabla, marcado como especial y con las cifras de la tasa acordada", () => {
    const v = modeloVistaPrevia(cotizada({ monto: "100000", plazo: 9 }, ESPECIAL_9), textos);
    expect([v.tramo, v.plazoEspecial, v.origenTasa, v.desgloseTasa]).toEqual([null, true, "especial", null]);
    expect(v.solicitud.plazo).toBe("9 meses");
    expect(v.tasa).toBe("17.00%");
    expect(v.salidas.map((s) => s.cifra)).toEqual(["$1,416.67", "$17,000.00", "$12,750.00"]);
  });

  it("lleva el aviso de tasa acordada alta que recibe", () => {
    const aviso = { tasa: "99.00%", maximoTabla: "21.50%", limite: "26.50%" };
    expect(modeloVistaPrevia(cotizada({ monto: "100000", plazo: 9 }, ESPECIAL_9), textos, { tasaAcordadaAlta: aviso }).tasaAcordadaAlta).toEqual(aviso);
  });
});

describe("página 2 con ajustes", () => {
  it("puntos extra: las dos tarjetas usan la tasa de tabla de su modalidad más los puntos", () => {
    const c = cotizada({}, { tipo: "tabla", puntos: "1.0" });
    const p = modeloPagina2(c, datosPagina2(semillaReal, c.solicitud, { tipo: "tabla", puntos: "1.0" }), textos.pdfPagina2);
    expect(p.tarjetas[0].detalle!.tasa).toBe("20.00%");
    expect(p.tarjetas[0].detalle!.filas[0].rendimiento).toBe("$25,000.00");
    const tablaFinal = cotizada({ esquema: "final_del_plazo" }, { tipo: "tabla", puntos: "0" }).tasa;
    expect(p.tarjetas[1].detalle!.tasa).toBe(formatearPorcentaje(new Decimal(tablaFinal).plus("0.01")));
  });

  it("plazo especial con una sola tasa: la otra modalidad se omite con su nota y la comparación también", () => {
    const c = cotizada({ monto: "100000", plazo: 9 }, ESPECIAL_9);
    const p = modeloPagina2(c, datosPagina2(semillaReal, c.solicitud, ESPECIAL_9), textos.pdfPagina2);
    expect(p.tarjetas[0].detalle!.filas.map((f) => f.rendimiento)).toEqual([...Array(8).fill("$1,416.67"), "$1,416.64"]);
    expect(p.tarjetas[1].detalle).toBeNull();
    expect(p.tarjetas[1].nota).toBe(textos.pdfPagina2.modalidadSinTasa);
    expect(p.graficas[0].dibujo).toBeNull();
  });

  it("sin ajuste la página 2 sigue igual que antes", () => {
    const c = cotizada({}, { tipo: "tabla", puntos: "0" });
    expect(datosPagina2(semillaReal, c.solicitud)).toEqual(datosPagina2(semillaReal, c.solicitud, { tipo: "tabla", puntos: "0" }));
  });
});
