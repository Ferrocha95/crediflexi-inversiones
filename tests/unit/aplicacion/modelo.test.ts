import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarRazonesSociales } from "../../../src/aplicacion/entidades";
import {
  modeloPdf,
  modeloVistaPrevia,
  TOPES,
  type ContextoPdf,
  type EntradaPdf,
  type ModeloPdf,
} from "../../../src/aplicacion/modelo";
import { cargarTextos, type TextosCotizacion } from "../../../src/aplicacion/textos";
import { ESTATUS } from "../../../src/domain/tasas/semilla.esquema";
import { datosPagina2 } from "../../../src/aplicacion/pagina2";
import type { Cotizacion } from "../../../src/domain/interes/cotizar";
import { cotizarConAjuste, type Ajuste } from "../../../src/domain/interes/ajustes";
import { cargar, copiaSemilla, cotizarBien, semillaReal } from "../oro/ayudas";
import { benchmarkReal } from "../benchmarkReal";

function sinError<T>(r: { ok: true; valor: T } | { ok: false; error: { mensaje: string } }): T {
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

const textos: TextosCotizacion = sinError(cargarTextos(textosJson, "seed/textos_cotizacion.json"));
const razonesSociales = sinError(cargarRazonesSociales(semillaJson, "seed/parametros_iniciales.json"));
const contexto = { razonesSociales, textos, benchmark: benchmarkReal };
const VERSION = semillaJson.version;
/** Fecha de la semilla como la imprime la app (DD/MM/AAAA). */
const FECHA_SEMILLA = semillaJson.generado.split("-").reverse().join("/");

/** modeloPdf con los datos de la página 2 calculados con la semilla real. */
function modeloPdfConDatos(c: Cotizacion, ...resto: [ContextoPdf, EntradaPdf, Date]) {
  return modeloPdf(c, ...resto, datosPagina2(semillaReal, c.solicitud));
}

/** 1 de octubre de 2026, 12:00 en la Ciudad de México. */
const AHORA = new Date("2026-10-01T18:00:00Z");

const ENTIDADES = [
  { clave: "CREDIFLEXI", razonSocial: "CREDIFLEXI, S.A.P.I. DE C.V." },
  { clave: "RAMI_SISE", razonSocial: "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R." },
] as const;

const pieEsperado = (razonSocial: string) =>
  `Cotización informativa para ${razonSocial}, calculada con interés simple sobre la tasa anual indicada ` +
  `y con las tasas de la versión ${VERSION} del ${FECHA_SEMILLA}. La ganancia anual es un equivalente a 12 meses; ` +
  "la ganancia del plazo corresponde al plazo elegido. Esta cotización no es un contrato: las condiciones aplicables " +
  "son las del contrato que se firme.";

/** Textos reales con otros nombres de esquema, para probar que el nombre sale del archivo (esquema_corto). */
const textosOtrosNombres: TextosCotizacion = {
  ...textos,
  esquemaCorto: { mensual: "Esquema sintético A", final_del_plazo: "Esquema sintético B" },
};

const ENTRADA_COMPLETA: EntradaPdf = {
  preparadoPara: "Persona Sintética Uno",
  ejecutivo: "Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test",
  vigencia: "15 días naturales",
  notaAdicional: "Nota sintética de prueba.",
};

function pdf(entidad: string, entrada: EntradaPdf = {}, cambios = {}): ModeloPdf {
  return sinError(modeloPdfConDatos(cotizarBien({ entidad, ...cambios }), contexto, entrada, AHORA));
}

const cuenta = (texto: string, buscado: string) => texto.split(buscado).length - 1;

describe.each(ENTIDADES)("modeloPdf ($clave)", ({ clave, razonSocial }) => {
  it("ejemplo oficial: 1,500,000 pesos a 12 meses, mensual, 19% -> 23,750.00 y 285,000.00", () => {
    const m = pdf(clave);
    expect(m.tasa).toBe("19.00%");
    expect(m.cifras).toEqual([
      {
        clave: "rendimiento_mensual_pesos",
        etiqueta: "Ganancia esperada del periodo (1 mes)",
        cifra: "$23,750.00",
        formula: "monto × tasa anual ÷ 12",
        operacion: "1,500,000.00 × 0.19 ÷ 12 = 23,750.00",
      },
      {
        clave: "rendimiento_anual_pesos",
        etiqueta: "Ganancia esperada del periodo (12 meses)",
        cifra: "$285,000.00",
        formula: "monto × tasa anual",
        operacion: "1,500,000.00 × 0.19 = 285,000.00",
      },
      {
        clave: "ganancia_total_plazo",
        etiqueta: "Ganancia esperada del periodo (plazo de 12 meses)",
        cifra: "$285,000.00",
        formula: "monto × tasa anual × plazo ÷ 12",
        operacion: "1,500,000.00 × 0.19 × 12 ÷ 12 = 285,000.00",
      },
    ]);
  });

  it("cada cifra trae la fórmula y la operación tal como vienen en la cotización", () => {
    for (const esquema of ["mensual", "final_del_plazo"] as const) {
      const c = cotizarBien({ entidad: clave, esquema, monto: "500000", plazo: 24 });
      const m = sinError(modeloPdfConDatos(c, contexto, {}, AHORA));
      expect(m.cifras.map((x) => [x.clave, x.formula, x.operacion])).toEqual(
        c.salidas.map((s) => [s.clave, s.desglose.formula, s.desglose.operacion]),
      );
      for (const x of m.cifras) {
        expect(x.formula).not.toBe("");
        expect(x.operacion).toMatch(/=/);
      }
    }
  });

  it("cifra principal en esquema mensual: el pago mensual, con su etiqueta de la semilla", () => {
    expect(pdf(clave).cifraPrincipal).toEqual({
      clave: "rendimiento_mensual_pesos",
      etiqueta: "Ganancia esperada del periodo (1 mes)",
      cifra: "$23,750.00",
    });
  });

  it("cifra principal al final del plazo: la ganancia total, con su etiqueta de la semilla", () => {
    expect(pdf(clave, {}, { esquema: "final_del_plazo" }).cifraPrincipal).toEqual({
      clave: "ganancia_total_plazo",
      etiqueta: "Ganancia esperada del periodo (plazo de 12 meses)",
      cifra: "$315,000.00",
    });
  });

  it("la cifra principal es una de las cifras del modelo (misma etiqueta y monto)", () => {
    for (const esquema of ["mensual", "final_del_plazo"] as const) {
      const m = pdf(clave, {}, { esquema, monto: "55000", plazo: 6 });
      const misma = m.cifras.find((x) => x.clave === m.cifraPrincipal.clave);
      expect(misma).toMatchObject(m.cifraPrincipal);
    }
  });

  it("trae los textos del bloque pdf del archivo de textos", () => {
    expect(pdf(clave).textos).toEqual({
      titulo: "Tu cotización de inversión",
      preparadoPara: "Preparado para",
      fecha: "Fecha",
      resumenMonto: "Monto de inversión",
      resumenPlazo: "Plazo",
      resumenTasa: "Tasa anual",
      resumenEsquema: "Esquema",
      seccionResultados: "Tus resultados",
      seccionCalculo: "Cómo se calculó",
      plazoEspecial: "Plazo especial",
      tasaAcordada: "Tasa acordada",
    });
  });

  it("los textos del PDF salen del archivo, no del código", () => {
    const otros: TextosCotizacion = {
      ...textos,
      pdf: {
        ...textos.pdf,
        titulo: "Título sintético",
        seccionCalculo: "Cálculo sintético",
        lineaTasas: "Versión sintética {version_tasas}, {fecha_tasas}",
      },
    };
    const m = sinError(modeloPdfConDatos(cotizarBien({ entidad: clave }), { razonesSociales, textos: otros, benchmark: benchmarkReal }, {}, AHORA));
    expect(m.textos.titulo).toBe("Título sintético");
    expect(m.textos.seccionCalculo).toBe("Cálculo sintético");
    expect(m.lineaTasas).toBe(`Versión sintética ${VERSION}, ${FECHA_SEMILLA}`);
  });

  it("la línea de las tasas lleva la versión y la fecha de la semilla", () => {
    expect(pdf(clave).lineaTasas).toBe(`Tasas versión ${VERSION} del ${FECHA_SEMILLA}.`);
  });

  it("el modelo del PDF no trae avisos (aviso fabricado a mano en la cotización)", () => {
    const aviso = {
      codigo: "TASA_MAYOR_QUE_TRAMO_SIGUIENTE" as const,
      severidad: "aviso" as const,
      mensaje: "Aviso sintético que no debe llegar al PDF.",
      datos: { esquema: "mensual" },
    };
    const c = { ...cotizarBien({ entidad: clave }), avisos: [aviso] };
    const texto = JSON.stringify(sinError(modeloPdfConDatos(c, contexto, ENTRADA_COMPLETA, AHORA)));
    expect(texto).not.toContain("Aviso sintético");
    expect(texto).not.toContain("TASA_MAYOR_QUE_TRAMO_SIGUIENTE");
    // "avisoFondo" es el pie fijo del fondo, no un aviso de la cotización.
    expect(texto.replaceAll('"avisoFondo":', "")).not.toMatch(/aviso/i);
  });

  it("final del plazo: etiquetas del esquema y 21% -> 26,250.00 y 315,000.00", () => {
    const m = pdf(clave, {}, { esquema: "final_del_plazo" });
    expect(m.solicitud.esquema).toBe("Al final del plazo");
    expect(m.tasa).toBe("21.00%");
    expect(m.cifras.map((c) => [c.etiqueta, c.cifra])).toEqual([
      ["Ganancia esperada del periodo (1 mes), se acumula y se paga al final del plazo", "$26,250.00"],
      ["Ganancia esperada del periodo (12 meses)", "$315,000.00"],
      ["Ganancia esperada del periodo (plazo de 12 meses)", "$315,000.00"],
    ]);
  });

  it("datos de la solicitud, fecha y versión de las tasas", () => {
    const m = pdf(clave);
    expect(m.fecha).toBe("01/10/2026");
    expect(m.solicitud).toEqual({
      moneda: "MXN",
      esquema: "Mensual",
      monto: "$1,500,000.00 MXN",
      plazo: "12 meses",
    });
    expect(m.tasas).toEqual({ version: VERSION, fecha: FECHA_SEMILLA });
  });

  it("la fecha del PDF es la de la Ciudad de México", () => {
    const m = sinError(modeloPdfConDatos(cotizarBien({ entidad: clave }), contexto, {}, new Date("2026-10-02T05:00:00Z")));
    expect(m.fecha).toBe("01/10/2026");
  });

  it("el encabezado lleva la razón social completa de la entidad", () => {
    expect(pdf(clave).encabezado.razonSocial).toBe(razonSocial);
  });

  it("el pie base lleva la razón social de la entidad, la versión y la fecha de las tasas", () => {
    expect(pdf(clave).pie.base).toBe(pieEsperado(razonSocial));
  });

  it('el pie no contiene ".." en ningún lugar, con o sin las líneas opcionales', () => {
    for (const entrada of [{}, ENTRADA_COMPLETA]) {
      const { pie } = pdf(clave, entrada);
      for (const linea of [pie.base, pie.preparadoPor, pie.vigencia, pie.notaAdicional]) {
        expect(linea ?? "").not.toContain("..");
      }
    }
  });

  it("el nombre del esquema sale del archivo de textos", () => {
    const c = cotizarBien({ entidad: clave });
    const f = cotizarBien({ entidad: clave, esquema: "final_del_plazo" });
    const ctx = { razonesSociales, textos: textosOtrosNombres, benchmark: benchmarkReal };
    expect(sinError(modeloPdfConDatos(c, ctx, {}, AHORA)).solicitud.esquema).toBe("Esquema sintético A");
    expect(sinError(modeloPdfConDatos(f, ctx, {}, AHORA)).solicitud.esquema).toBe("Esquema sintético B");
  });

  it("la razón social solo aparece en el encabezado y en el pie (el PDF no dice que las tasas sean de la entidad)", () => {
    expect(cuenta(JSON.stringify(pdf(clave, ENTRADA_COMPLETA)), razonSocial)).toBe(2);
  });

  it("sin los campos opcionales, el pie no trae las líneas opcionales", () => {
    const m = pdf(clave);
    expect(m.preparadoPara).toBeNull();
    expect(m.pie).toMatchObject({ base: pieEsperado(razonSocial), preparadoPor: null, vigencia: null, notaAdicional: null });
  });

  it("con los campos opcionales, el pie trae las dos líneas y la nota después", () => {
    const m = pdf(clave, ENTRADA_COMPLETA);
    expect(m.preparadoPara).toBe("Persona Sintética Uno");
    expect(m.pie).toMatchObject({
      base: pieEsperado(razonSocial),
      preparadoPor: "Preparado por Ejecutivo Prueba · ejecutivo.prueba@ejemplo.test.",
      vigencia: "Vigencia: 15 días naturales.",
      notaAdicional: "Nota sintética de prueba.",
    });
  });

  it("solo una de las líneas opcionales", () => {
    expect(pdf(clave, { vigencia: "30 días" }).pie).toMatchObject({ preparadoPor: null, vigencia: "Vigencia: 30 días." });
    expect(pdf(clave, { ejecutivo: "Ejecutivo Prueba" }).pie).toMatchObject({
      preparadoPor: "Preparado por Ejecutivo Prueba.",
      vigencia: null,
    });
  });

  it("los campos con solo espacios o caracteres de control cuentan como vacíos", () => {
    const m = pdf(clave, { preparadoPara: "  \n ", ejecutivo: "\t", vigencia: "\u0000", notaAdicional: "   " });
    expect(m.preparadoPara).toBeNull();
    expect(m.pie).toMatchObject({ preparadoPor: null, vigencia: null, notaAdicional: null });
  });

  it("los campos se limpian de caracteres de control", () => {
    const m = pdf(clave, { preparadoPara: "Persona\nSintética\u202EUno", notaAdicional: "Línea uno\r\nLínea dos" });
    expect(m.preparadoPara).toBe("Persona Sintética Uno");
    expect(m.pie.notaAdicional).toBe("Línea uno Línea dos");
  });

  it("la nota adicional se recorta a 300 caracteres", () => {
    const nota = `${"n".repeat(299)}ñX${"z".repeat(50)}`;
    const m = pdf(clave, { notaAdicional: nota });
    expect(TOPES.notaAdicional).toBe(300);
    expect(m.pie.notaAdicional).toBe(`${"n".repeat(299)}ñ`);
  });

  it("topes: preparado para 120, ejecutivo 120 y vigencia 60", () => {
    expect(TOPES).toEqual({ preparadoPara: 120, ejecutivo: 120, vigencia: 60, notaAdicional: 300 });
    const m = pdf(clave, { preparadoPara: "p".repeat(200), ejecutivo: "e".repeat(200), vigencia: "v".repeat(200) });
    expect(m.preparadoPara).toBe("p".repeat(120));
    expect(m.pie.preparadoPor).toBe(`Preparado por ${"e".repeat(120)}.`);
    expect(m.pie.vigencia).toBe(`Vigencia: ${"v".repeat(60)}.`);
  });

  it("el modelo del PDF jamás incluye el estatus del tramo", () => {
    const c = cotizarBien({ entidad: clave, monto: "1500000", plazo: 12 });
    expect(c.tramo.estatus).not.toBeNull();
    const texto = JSON.stringify(sinError(modeloPdfConDatos(c, contexto, ENTRADA_COMPLETA, AHORA)));
    expect(texto).not.toMatch(/estatus/i);
    for (const e of ESTATUS) {
      expect(texto).not.toContain(e);
      expect(texto).not.toContain(textos.estatusTramo[e]);
    }
  });

  it("el modelo del PDF tampoco incluye un estatus CONFIRMADA (semilla modificada en la prueba)", () => {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[5].estatus = "CONFIRMADA";
    const c = cotizarBien({ entidad: clave }, cargar(j));
    expect(c.tramo.estatus).toBe("CONFIRMADA");
    const texto = JSON.stringify(sinError(modeloPdfConDatos(c, contexto, ENTRADA_COMPLETA, AHORA)));
    expect(texto).not.toContain("CONFIRMADA");
    expect(texto).not.toContain(textos.estatusTramo.CONFIRMADA);
  });
});

describe("modeloPdf: errores", () => {
  it("si la entidad no tiene razón social, falla con un mensaje en español", () => {
    const r = modeloPdfConDatos(cotizarBien({}), { razonesSociales: new Map(), textos, benchmark: benchmarkReal }, {}, AHORA);
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("ENTIDADES_INVALIDAS");
    expect(r.error.mensaje).toContain("CREDIFLEXI");
    expect(r.error.mensaje).toContain("razon_social");
  });

  it("si la semilla no trae la salida que se destaca, falla con un mensaje en español", () => {
    const c = cotizarBien({});
    const sinMensual = { ...c, salidas: c.salidas.filter((x) => x.clave !== "rendimiento_mensual_pesos") };
    const r = modeloPdfConDatos(sinMensual, contexto, {}, AHORA);
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("SEMILLA_INVALIDA");
    expect(r.error.mensaje).toContain("rendimiento_mensual_pesos");
    expect(r.error.mensaje).toContain("salidas_de_cotizacion");
  });
});

describe.each(ENTIDADES)("modeloVistaPrevia ($clave)", ({ clave }) => {
  it("ejemplo oficial con su desglose: fórmula y operación con números", () => {
    const v = modeloVistaPrevia(cotizarBien({ entidad: clave }), textos);
    expect(v.tasa).toBe("19.00%");
    expect(v.salidas).toEqual([
      {
        clave: "rendimiento_mensual_pesos",
        etiqueta: "Ganancia esperada del periodo (1 mes)",
        cifra: "$23,750.00",
        formula: "monto × tasa anual ÷ 12",
        operacion: "1,500,000.00 × 0.19 ÷ 12 = 23,750.00",
      },
      {
        clave: "rendimiento_anual_pesos",
        etiqueta: "Ganancia esperada del periodo (12 meses)",
        cifra: "$285,000.00",
        formula: "monto × tasa anual",
        operacion: "1,500,000.00 × 0.19 = 285,000.00",
      },
      {
        clave: "ganancia_total_plazo",
        etiqueta: "Ganancia esperada del periodo (plazo de 12 meses)",
        cifra: "$285,000.00",
        formula: "monto × tasa anual × plazo ÷ 12",
        operacion: "1,500,000.00 × 0.19 × 12 ÷ 12 = 285,000.00",
      },
    ]);
  });

  it("datos de la solicitud y versión de las tasas", () => {
    const v = modeloVistaPrevia(cotizarBien({ entidad: clave }), textos);
    expect(v.solicitud).toEqual({
      entidad: clave,
      moneda: "MXN",
      esquema: "Mensual",
      monto: "$1,500,000.00 MXN",
      plazo: "12 meses",
    });
    expect(v.tasas).toEqual({ version: VERSION, fecha: FECHA_SEMILLA });
  });

  it("muestra el tramo aplicado con su estatus y la explicación del archivo de textos (pendiente t)", () => {
    const v = modeloVistaPrevia(cotizarBien({ entidad: clave }), textos);
    expect(v.origenTasa).toBe("tramo");
    expect(v.tramo).toEqual({
      rango: "Desde $1,000,001.00 MXN",
      estatus: "CONFIRMADA",
      explicacionEstatus: "Tasa confirmada.",
    });
  });

  it("tramo con límite superior", () => {
    const v = modeloVistaPrevia(cotizarBien({ entidad: clave, monto: "150000" }), textos);
    expect(v.tramo!.rango).toBe("Desde $30,000.00 MXN hasta $200,000.00 MXN");
  });

  it("un estatus CONFIRMADA muestra su explicación (semilla modificada en la prueba)", () => {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[5].estatus = "CONFIRMADA";
    const v = modeloVistaPrevia(cotizarBien({ entidad: clave }, cargar(j)), textos);
    expect(v.tramo!.estatus).toBe("CONFIRMADA");
    expect(v.tramo!.explicacionEstatus).toBe("Tasa confirmada.");
  });

  it("trae los avisos no bloqueantes tal cual vienen en la cotización (aviso fabricado a mano)", () => {
    // La Tabla de Diseño no produce avisos: se agrega uno sintético al objeto de cotización.
    const aviso = {
      codigo: "TASA_MAYOR_QUE_TRAMO_SIGUIENTE" as const,
      severidad: "aviso" as const,
      mensaje: "Aviso sintético de prueba.",
      datos: { esquema: "mensual" },
    };
    const c = { ...cotizarBien({ entidad: clave }), avisos: [aviso] };
    const v = modeloVistaPrevia(c, textos);
    expect(v.avisos).toEqual([{ codigo: "TASA_MAYOR_QUE_TRAMO_SIGUIENTE", mensaje: "Aviso sintético de prueba." }]);
  });

  it("sin avisos, la lista va vacía", () => {
    expect(modeloVistaPrevia(cotizarBien({ entidad: clave }), textos).avisos).toEqual([]);
  });

  it("el nombre del esquema sale del archivo de textos", () => {
    const v = modeloVistaPrevia(cotizarBien({ entidad: clave, esquema: "final_del_plazo" }), textosOtrosNombres);
    expect(v.solicitud.esquema).toBe("Esquema sintético B");
  });
});

describe("modelo.ts ya no define nombres de esquema", () => {
  it("no exporta NOMBRE_ESQUEMA", async () => {
    const modulo: Record<string, unknown> = await import("../../../src/aplicacion/modelo");
    expect(modulo.NOMBRE_ESQUEMA).toBeUndefined();
  });
});

describe("modelo con los textos 0.5 (Sprint 3a)", () => {
  const ajustado = (solicitud: Partial<Parameters<typeof cotizarBien>[0]>, ajuste: Ajuste) => {
    const plazo = ajuste.tipo === "especial" ? ajuste.plazo : (solicitud.plazo ?? 12);
    const r = cotizarConAjuste(semillaReal, { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1500000", ...solicitud, plazo }, ajuste);
    if (!r.ok) throw new Error(r.error.mensaje);
    return r.valor;
  };
  const pdfDe = (c: ReturnType<typeof ajustado>, ajuste: Ajuste) =>
    sinError(modeloPdf(c, contexto, {}, AHORA, datosPagina2(semillaReal, c.solicitud, ajuste)));

  it("las etiquetas de los resultados salen del archivo de textos, no de la semilla", () => {
    const otros: TextosCotizacion = {
      ...textos,
      etiquetasResultados: {
        ...textos.etiquetasResultados,
        mensual: { ...textos.etiquetasResultados.mensual, rendimiento_mensual_pesos: "Etiqueta sintética" },
      },
    };
    expect(modeloVistaPrevia(cotizarBien({}), otros).salidas[0].etiqueta).toBe("Etiqueta sintética");
    expect(sinError(modeloPdfConDatos(cotizarBien({}), { razonesSociales, textos: otros, benchmark: benchmarkReal }, {}, AHORA)).cifraPrincipal.etiqueta).toBe(
      "Etiqueta sintética",
    );
  });

  it("la línea de pago, en la vista previa y en la página 1, con el plazo de la cotización", () => {
    expect(modeloVistaPrevia(cotizarBien({}), textos).lineaPago).toBe("Pago de rendimiento mensual: cada mes, del mes 1 al mes 12");
    const f = cotizarBien({ esquema: "final_del_plazo", plazo: 24 });
    expect(modeloVistaPrevia(f, textos).lineaPago).toBe("Pago de rendimiento: al final del plazo (mes 24), junto con el capital");
    expect(sinError(modeloPdfConDatos(f, contexto, {}, AHORA)).lineaPago).toBe(
      "Pago de rendimiento: al final del plazo (mes 24), junto con el capital",
    );
  });

  it("la etiqueta de la ganancia del plazo lleva el plazo de la cotización (6 meses)", () => {
    const c = cotizarBien({ monto: "500000", plazo: 6 });
    const etiqueta = (x: { clave: string; etiqueta: string }[]) => x.find((y) => y.clave === "ganancia_total_plazo")?.etiqueta;
    expect(etiqueta([...modeloVistaPrevia(c, textos).salidas])).toBe("Ganancia esperada del periodo (plazo de 6 meses)");
    expect(etiqueta([...sinError(modeloPdfConDatos(c, contexto, {}, AHORA)).cifras])).toBe("Ganancia esperada del periodo (plazo de 6 meses)");
  });

  it("el pie, para las dos entidades: la línea SIPRES y el disclaimer", () => {
    const credi = sinError(modeloPdfConDatos(cotizarBien({}), contexto, {}, AHORA)).pie;
    const rami = sinError(modeloPdfConDatos(cotizarBien({ entidad: "RAMI_SISE" }), contexto, {}, AHORA)).pie;
    for (const pie of [credi, rami]) {
      expect(pie.avisoFondo).toBe(textos.pieAvisoFondo);
      expect(pie.sipres).toBe(textos.pieSipres);
    }
  });

  it("con puntos extra la página 1 lleva el desglose", () => {
    const a: Ajuste = { tipo: "tabla", puntos: "1.0" };
    const m = pdfDe(ajustado({}, a), a);
    expect(m.desgloseTasa).toBe("Tasa de tabla 19.00% + 1.0 puntos extra = 20.00%");
    expect([m.etiquetas.plazo, m.etiquetas.tasa]).toEqual([textos.pdf.resumenPlazo, textos.pdf.resumenTasa]);
  });

  it("sin puntos no hay desglose", () => {
    expect(sinError(modeloPdfConDatos(cotizarBien({}), contexto, {}, AHORA)).desgloseTasa).toBeNull();
  });

  it("plazo especial: Plazo especial y Tasa acordada en lugar de Plazo y Tasa anual, sin desglose", () => {
    const a: Ajuste = { tipo: "especial", plazo: 9, tasas: { mensual: "17" } };
    const m = pdfDe(ajustado({ monto: "100000" }, a), a);
    expect([m.etiquetas.plazo, m.etiquetas.tasa]).toEqual([textos.pdf.plazoEspecial, textos.pdf.tasaAcordada]);
    expect(m.desgloseTasa).toBeNull();
    expect(JSON.stringify(m)).not.toMatch(/tasa de tabla/i);
  });
});
