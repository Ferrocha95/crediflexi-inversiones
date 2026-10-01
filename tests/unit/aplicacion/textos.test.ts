import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { cargarTextos, type TextosCotizacion } from "../../../src/aplicacion/textos";

const ARCHIVO = "seed/textos_cotizacion.json";

type TextosJson = typeof textosJson;
const copia = (): TextosJson => structuredClone(textosJson);

function cargarBien(json: unknown): TextosCotizacion {
  const r = cargarTextos(json, ARCHIVO);
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

function errorDe(json: unknown): { mensaje: string; detalles: readonly string[] } {
  const r = cargarTextos(json, ARCHIVO);
  if (r.ok) throw new Error("Se esperaba que la carga fallara");
  expect(r.error.codigo).toBe("TEXTOS_INVALIDOS");
  return { mensaje: r.error.mensaje, detalles: r.error.detalles ?? [] };
}

describe("cargarTextos: el archivo real", () => {
  it("carga seed/textos_cotizacion.json", () => {
    const t = cargarBien(textosJson);
    expect(t.version).toBe("0.1");
    expect(t.pieBase).toContain("{razon_social}");
    expect(t.lineaPreparadoPor).toBe("Preparado por {ejecutivo}.");
    expect(t.lineaVigencia).toBe("Vigencia: {vigencia}.");
    expect(t.monedaDeshabilitada).toBe("Las tasas en {moneda} están por confirmar.");
  });

  it("trae la explicación de los tres estatus", () => {
    const t = cargarBien(textosJson);
    expect(Object.keys(t.estatusTramo).sort()).toEqual(["CONFIRMADA", "POR_CONFIRMAR", "SEGUN_USUARIO_PPTX"]);
    expect(t.estatusTramo.SEGUN_USUARIO_PPTX).toBe(
      "Tasa según la tabla de rendimientos vigente; aún sin confirmación formal.",
    );
  });
});

describe("cargarTextos: marcadores", () => {
  it("un marcador desconocido rompe la carga y el error dice el archivo y el marcador", () => {
    const j = copia();
    j.pie_base = "Cotización para {cliente}.";
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    const texto = [e.mensaje, ...e.detalles].join("\n");
    expect(texto).toContain("{cliente}");
    expect(texto).toContain("pie_base");
  });

  it("un marcador desconocido dentro de estatus_tramo también rompe la carga", () => {
    const j = copia();
    j.estatus_tramo.CONFIRMADA = "Tasa confirmada por {gerente}.";
    const texto = (({ mensaje, detalles }) => [mensaje, ...detalles].join("\n"))(errorDe(j));
    expect(texto).toContain("{gerente}");
    expect(texto).toContain("estatus_tramo.CONFIRMADA");
  });

  it("{moneda} solo se permite en moneda_deshabilitada", () => {
    const j = copia();
    j.pie_base = `${j.pie_base} Moneda: {moneda}.`;
    const texto = (({ mensaje, detalles }) => [mensaje, ...detalles].join("\n"))(errorDe(j));
    expect(texto).toContain("{moneda}");
    expect(texto).toContain("pie_base");
  });

  it("acepta todos los marcadores permitidos en pie_base", () => {
    const j = copia();
    j.pie_base = "{razon_social} {version_tasas} {fecha_tasas} {ejecutivo} {vigencia}";
    expect(cargarBien(j).pieBase).toBe(j.pie_base);
  });

  it("una llave sin cerrar rompe la carga", () => {
    const j = copia();
    j.linea_vigencia = "Vigencia: {vigencia.";
    const texto = (({ mensaje, detalles }) => [mensaje, ...detalles].join("\n"))(errorDe(j));
    expect(texto).toContain("linea_vigencia");
    expect(texto).toMatch(/llave/i);
  });

  it("reporta todos los marcadores desconocidos, no solo el primero", () => {
    const j = copia();
    j.pie_base = "{uno} y {dos}";
    const { detalles } = errorDe(j);
    expect(detalles.some((d) => d.includes("{uno}"))).toBe(true);
    expect(detalles.some((d) => d.includes("{dos}"))).toBe(true);
  });
});

describe("cargarTextos: textos vacíos y estructura", () => {
  it("un texto vacío rompe la carga y dice cuál", () => {
    const j = copia();
    j.linea_preparado_por = "";
    const e = errorDe(j);
    expect(e.mensaje).toContain(ARCHIVO);
    expect(e.detalles.join("\n")).toContain("linea_preparado_por");
  });

  it("un texto de puros espacios cuenta como vacío", () => {
    const j = copia();
    j.estatus_tramo.POR_CONFIRMAR = "   ";
    expect(errorDe(j).detalles.join("\n")).toContain("estatus_tramo.POR_CONFIRMAR");
  });

  it("falta la explicación de un estatus", () => {
    const j: Record<string, unknown> = copia();
    j.estatus_tramo = { CONFIRMADA: "Tasa confirmada.", POR_CONFIRMAR: "Por confirmar." };
    expect(errorDe(j).detalles.join("\n")).toContain("SEGUN_USUARIO_PPTX");
  });

  it("una clave que no existe (por ejemplo, un error de dedo) rompe la carga", () => {
    const j: Record<string, unknown> = { ...copia(), linea_vigensia: "Vigencia: {vigencia}." };
    expect(errorDe(j).detalles.join("\n")).toContain("linea_vigensia");
  });

  it("falta la versión", () => {
    const j: Record<string, unknown> = copia();
    delete j.version;
    expect(errorDe(j).detalles.join("\n")).toContain("version");
  });

  it("si el JSON no es un objeto, falla con un mensaje en español", () => {
    expect(errorDe("hola").mensaje).toContain(ARCHIVO);
  });
});
