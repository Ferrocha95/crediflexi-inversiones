// Sprint 6b de punta a punta: fecha de inicio, rendimientos a días naturales y
// fechas de pago en la página 1, la página 2, la tercera página, la vista
// previa y el PDF. Datos sintéticos. Los valores de referencia (casos A, D y F)
// se calcularon fuera del motor.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { huellaDeCampos } from "../../../src/app/(app)/cotizador/confirmacion";
import { cuerpoPeticionPdf } from "../../../src/app/(app)/cotizador/peticionPdf";
import { cargarRazonesSociales } from "../../../src/aplicacion/entidades";
import { fechaIsoEnMexico } from "../../../src/aplicacion/fecha";
import { cargarRangoFechaInicio } from "../../../src/aplicacion/fechaInicio";
import { modeloPdf, modeloVistaPrevia, type ModeloPdf } from "../../../src/aplicacion/modelo";
import { datosPagina2, modeloPagina2 } from "../../../src/aplicacion/pagina2";
import { cargarTextos } from "../../../src/aplicacion/textos";
import { Decimal } from "../../../src/domain/comun/decimal";
import { cotizarConAjuste, type Ajuste } from "../../../src/domain/interes/ajustes";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import { leerParametrosCotizacion } from "../../../src/servidor/parametros";
import { manejarPdf } from "../../../src/servidor/pdf/manejador";
import { renderizarPdf } from "../../../src/servidor/pdf/renderizar";
import { previsualizarCon } from "../../../src/servidor/vistaPrevia";
import { benchmarkReal } from "../benchmarkReal";
import { semillaReal } from "../oro/ayudas";
import { extraerTexto } from "../servidor/pdf/extraer";

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const P2 = textos.pdfPagina2;
const AHORA = new Date("2026-10-09T18:00:00Z");
const INICIO = "2026-10-15";
const TIEMPO = 60_000;

/** Casos A (Mensual 18.00%) y D (Al final del plazo 20.00%): plazo especial de 6 meses sobre $1,000,000. */
const AJUSTE_AD: Ajuste = { tipo: "especial", plazo: 6, tasas: { mensual: "18.00", final_del_plazo: "20.00" } };
/** Caso F: plazo especial de 36 meses, $100,000 al 17.00%, solo Mensual. */
const AJUSTE_F: Ajuste = { tipo: "especial", plazo: 36, tasas: { mensual: "17.00" } };

function solicitud(monto: string, plazo: number): SolicitudTasa {
  return { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: new Decimal(monto), plazo };
}

function cotizacion(s: SolicitudTasa, a: Ajuste) {
  return sinError(cotizarConAjuste(semillaReal, s, a));
}

function modeloA(preparadoPara: string | null = "Persona Sintética Uno"): ModeloPdf {
  const s = solicitud("1000000", 6);
  const c = cotizacion(s, AJUSTE_AD);
  const entrada = preparadoPara === null ? {} : { preparadoPara };
  return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, entrada, AHORA, datosPagina2(semillaReal, s, INICIO, AJUSTE_AD)));
}

function modeloF(): ModeloPdf {
  const s = solicitud("100000", 36);
  const c = cotizacion(s, AJUSTE_F);
  return sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, {}, AHORA, datosPagina2(semillaReal, s, INICIO, AJUSTE_F)));
}

describe("textos 0.10 y semilla 0.9.2 (Sprint 6b)", () => {
  it("versiones", () => {
    expect(textos.version).toBe("0.16");
    expect(semillaJson.version).toBe("0.9.2");
  });

  it("textos nuevos de la fecha de inicio, la tabla por fechas y los días naturales, exactos", () => {
    expect(textos.pdf.fechaInicio).toBe("Fecha de inicio: {fecha}");
    expect(textos.pdf.notaDiasNaturales).toBe("Rendimientos calculados a días naturales (días reales ÷ 365).");
    expect(P2.columnaFechaPago).toBe("Fecha de pago");
    expect(P2.columnaDias).toBe("Días");
    expect(P2.vencimiento).toBe("Vencimiento: {fecha}");
    expect(P2.notaDiaInhabil).toBe("Si la fecha de pago cae en día inhábil, el depósito se realiza el siguiente día hábil; esto no modifica el rendimiento.");
    expect(textos.glosario.rendimiento_mensual_promedio).toBe("Rendimiento mensual (promedio)");
  });

  it("RH aprobó las frases y la comisión por externos ya no es supuesto", () => {
    expect(textos.reclutamiento.frasesAprobadasPorRh).toBe(true);
    expect(textos.comisiones).not.toHaveProperty("supuestoPorConfirmar");
    expect(JSON.stringify(textosJson)).not.toMatch(/Supuesto por confirmar/);
    expect(semillaJson.parametros.red_externa.estado).toBe("confirmado (2026-10-09)");
  });

  it("la pantalla de comisiones ya no lleva la insignia de supuesto en Mis externos", () => {
    const codigo = readFileSync(path.join(process.cwd(), "src/app/(app)/comisiones/Resultado.tsx"), "utf8");
    expect(codigo).not.toMatch(/supuestoPorConfirmar/);
  });

  it("el rango de la fecha de inicio sale de la semilla: 7 días atrás y 365 adelante", () => {
    expect(sinError(cargarRangoFechaInicio(semillaJson, "seed/parametros_iniciales.json"))).toEqual({ diasAtras: 7, diasAdelante: 365 });
  });

  it("un rango mal escrito en la semilla da un error en español con su ubicación", () => {
    const r = cargarRangoFechaInicio({ ...semillaJson, cotizador: { fecha_inicio: { dias_atras: -1, dias_adelante: 365 } } }, "seed/x.json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.detalles!.join(" ")).toMatch(/cotizador\.fecha_inicio\.dias_atras/);
  });
});

describe("página 2 por fechas (casos A y D)", () => {
  const s = solicitud("1000000", 6);
  const p = modeloPagina2(cotizacion(s, AJUSTE_AD), datosPagina2(semillaReal, s, INICIO, AJUSTE_AD), P2);
  const [m1, m2] = p.tarjetas;

  it("Modalidad 1: fecha de pago, días, rendimiento mensual y acumulado (caso A)", () => {
    expect(m1.detalle!.filas).toEqual([
      { fecha: "15/11/2026", dias: "31", rendimiento: "$15,287.67", acumulado: "$15,287.67" },
      { fecha: "15/12/2026", dias: "30", rendimiento: "$14,794.52", acumulado: "$30,082.19" },
      { fecha: "15/01/2027", dias: "31", rendimiento: "$15,287.67", acumulado: "$45,369.86" },
      { fecha: "15/02/2027", dias: "31", rendimiento: "$15,287.67", acumulado: "$60,657.53" },
      { fecha: "15/03/2027", dias: "28", rendimiento: "$13,808.22", acumulado: "$74,465.75" },
      { fecha: "15/04/2027", dias: "31", rendimiento: "$15,287.67", acumulado: "$89,753.42" },
    ]);
    expect(m1.detalle!.renglones.map((r) => r.cifra)).toEqual(["$1,000,000.00", "$89,753.42", "$1,089,753.42"]);
  });

  it("Modalidad 2: rendimiento total por días y capital + rendimiento total, sin filas (caso D)", () => {
    expect(m2.detalle!.renglones).toEqual([
      { etiqueta: P2.capitalInicial, cifra: "$1,000,000.00" },
      { etiqueta: "Rendimiento total (6 meses)", cifra: "$99,726.03" },
      { etiqueta: "Capital + rendimiento total", cifra: "$1,099,726.03" },
    ]);
    expect(m2.detalle!.filas).toEqual([]);
  });

  it("las dos tarjetas llevan el vencimiento", () => {
    expect(m1.detalle!.vencimiento).toBe("Vencimiento: 15/04/2027");
    expect(m2.detalle!.vencimiento).toBe("Vencimiento: 15/04/2027");
  });

  it("la gráfica usa el acumulado por fechas: Mensual el de la tabla, Al final del plazo lo devengado", () => {
    const series = p.graficas[0].dibujo!.series;
    expect(series.map((x) => [x.nombre, x.final.texto])).toEqual([
      [P2.serieMensual, "$89,753.42"],
      [P2.serieFinal, "$99,726.03"],
    ]);
  });
});

describe("página 1 por días (caso A)", () => {
  const m = modeloA();

  it("rendimiento mensual (promedio), anual y total por días, con su desglose", () => {
    expect(m.cifras.map((c) => [c.etiqueta, c.cifra])).toEqual([
      ["Rendimiento mensual (promedio)", "$15,000.00"],
      ["Rendimiento anual (12 meses)", "$180,000.00"],
      ["Rendimiento total (6 meses)", "$89,753.42"],
    ]);
    expect(m.cifras[2].formula).toBe("monto × tasa anual neta × días ÷ 365");
    expect(m.cifras[2].operacion).toBe("1,000,000.00 × 0.18 × 182 ÷ 365 = 89,753.42");
    expect(m.cifras[0].formula).toBe("monto × tasa anual neta ÷ 12");
    expect(m.cifras[1].formula).toBe("monto × tasa anual neta");
  });

  it("al final del plazo, \"Cómo se calculó\" usa la etiqueta sin la nota de pago (la nota sigue en Rendimientos esperados del periodo)", () => {
    const s = { ...solicitud("1000000", 6), esquema: "final_del_plazo" as const };
    const c = cotizacion(s, AJUSTE_AD);
    const m = sinError(modeloPdf(c, { razonesSociales, textos, benchmark: benchmarkReal }, {}, AHORA, datosPagina2(semillaReal, s, INICIO, AJUSTE_AD)));
    expect(m.cifras[0].etiqueta).toBe("Rendimiento mensual (promedio), se acumula y se paga al final del plazo");
    expect(m.cifras[0].etiquetaCalculo).toBe("Rendimiento mensual (promedio)");
    expect(m.cifras[2].cifra).toBe("$99,726.03");
  });

  it("fecha de inicio en letra y la nota de los días naturales", () => {
    expect(m.fechaInicio).toBe("Fecha de inicio: 15 de octubre de 2026");
    expect(m.textos.notaDiasNaturales).toBe("Rendimientos calculados a días naturales (días reales ÷ 365).");
  });
});

describe("PDF renderizado", () => {
  it(
    "página 1: la fecha de inicio va inmediatamente después del nombre; página 2: fechas, días, vencimiento y nota de día inhábil",
    async () => {
      const t = await extraerTexto(await renderizarPdf(modeloA()));
      expect(t.paginas).toBe(2);
      const [p1, p2] = t.porPagina;
      expect(p1).toContain("Persona Sintética Uno Fecha de inicio: 15 de octubre de 2026");
      expect(p1).toContain("Rendimientos calculados a días naturales (días reales ÷ 365).");
      expect(p1).toContain("monto × tasa anual neta × días ÷ 365");
      // Los cuatro encabezados completos: con las columnas de fecha y días, el último no debe cortarse ("Rendimiento…").
      for (const x of [P2.columnaFechaPago, P2.columnaDias, P2.columnaRendimientoMensual, P2.columnaRendimientoAcumulado]) expect(p2).toContain(x);
      expect(p2).not.toContain("Rendimiento…");
      for (const x of ["15/11/2026", "15/03/2027", "Vencimiento: 15/04/2027", P2.notaDiaInhabil, "$99,726.03"]) {
        expect(p2).toContain(x);
      }
    },
    TIEMPO,
  );

  it(
    "sin nombre, la fecha de inicio va en su lugar",
    async () => {
      const t = await extraerTexto(await renderizarPdf(modeloA(null)));
      expect(t.porPagina[0]).toContain("Fecha de inicio: 15 de octubre de 2026");
      expect(t.porPagina[0]).not.toContain(textos.pdf.preparadoPara);
    },
    TIEMPO,
  );

  it(
    "caso F: la tercera página lleva el calendario por fechas, con el último pago de $1,397.18 el 15/10/2029",
    async () => {
      const t = await extraerTexto(await renderizarPdf(modeloF()));
      expect(t.paginas).toBe(3);
      const p3 = t.porPagina[2];
      expect(p3).toContain("15/10/2029");
      expect(p3).toContain("$1,397.18");
      expect(p3).toContain("$51,046.58");
      expect(p3).toContain(P2.notaDiaInhabil);
      expect(t.porPagina[0]).toContain("$51,046.58");
    },
    TIEMPO,
  );
});

describe("fecha de inicio en la pantalla y en el servidor", () => {
  const BASE = { peticion: 1, entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1,500,000", plazo: 12 };

  it("la huella cambia con la fecha de inicio y el cuerpo del PDF la lleva", () => {
    const campos = { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1000000", plazo: 12 };
    expect(huellaDeCampos({ ...campos, fechaInicio: "2026-10-15" })).not.toBe(huellaDeCampos({ ...campos, fechaInicio: "2026-10-16" }));
    const cuerpo = cuerpoPeticionPdf({ ...campos, fechaInicio: "2026-10-15" }, { preparadoPara: "", ejecutivo: "", vigencia: "", notaAdicional: "" }, "0.9.2");
    expect(cuerpo.fechaInicio).toBe("2026-10-15");
  });

  it("la vista previa muestra la fecha de inicio en los datos capturados (DD/MM/AAAA)", async () => {
    const r = await previsualizarCon({ ...BASE, fechaInicio: "2026-10-15" }, "localhost:3000", leerParametrosCotizacion, () => AHORA);
    if (r.resultado.tipo !== "vista_previa") throw new Error(JSON.stringify(r.resultado));
    expect(r.resultado.vistaPrevia.solicitud.fechaInicio).toBe("15/10/2026");
  });

  it.each(["2026-10-01", "2027-10-10", "2026-02-30", "15/10/2026"])("rechaza la fecha de inicio %s con un mensaje en español", async (fechaInicio) => {
    const r = await previsualizarCon({ ...BASE, fechaInicio }, "localhost:3000", leerParametrosCotizacion, () => AHORA);
    expect(r.resultado.tipo).toBe("error");
    if (r.resultado.tipo === "error") expect(r.resultado.mensaje).toMatch(/fecha de inicio.*Elige una fecha del 02\/10\/2026 al 09\/10\/2027/);
  });

  it("sin fecha de inicio, la vista previa no tiene la forma esperada", async () => {
    const r = await previsualizarCon(BASE, "localhost:3000", leerParametrosCotizacion, () => AHORA);
    expect(r.resultado.tipo).toBe("error");
  });

  async function pdf(fechaInicio: string) {
    const modelos: ModeloPdf[] = [];
    const respuesta = await manejarPdf(
      new Request("http://localhost:3000/cotizador/pdf", {
        method: "POST",
        headers: { host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ ...BASE, peticion: undefined, fechaInicio, confirmado: true, versionTasas: semillaJson.version }),
      }),
      {
        leer: leerParametrosCotizacion,
        renderizar: async (m) => {
          modelos.push(m);
          return new Uint8Array([1]);
        },
        ahora: () => AHORA,
      },
    );
    return { respuesta, modelos };
  }

  it("el PDF usa la fecha de inicio recibida", async () => {
    const { respuesta, modelos } = await pdf("2026-10-15");
    expect(respuesta.status).toBe(200);
    expect(modelos[0].fechaInicio).toBe("Fecha de inicio: 15 de octubre de 2026");
    expect(modelos[0].pagina2.tarjetas[0].detalle!.filas[0].fecha).toBe("15/11/2026");
  });

  it("el PDF rechaza una fecha de inicio fuera de rango con 422 y el mensaje en español", async () => {
    const { respuesta, modelos } = await pdf("2026-10-01");
    expect(respuesta.status).toBe(422);
    expect(((await respuesta.json()) as { error: string }).error).toMatch(/fecha de inicio/);
    expect(modelos).toEqual([]);
  });

  it("modeloVistaPrevia sin importes nuevos: la fecha va solo en los datos capturados", () => {
    const s = solicitud("1000000", 6);
    const v = modeloVistaPrevia(cotizacion(s, AJUSTE_AD), textos, { fechaInicio: INICIO });
    expect(v.solicitud.fechaInicio).toBe("15/10/2026");
  });

  it("hoy en la Ciudad de México sirve de valor por omisión", () => {
    // 9 de octubre de 2026 a las 23:30 en la Ciudad de México ya es 10 de octubre en UTC.
    expect(fechaIsoEnMexico(new Date("2026-10-10T05:30:00Z"))).toBe("2026-10-09");
  });
});
