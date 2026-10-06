import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  estadoInicial,
  huellaDeCampos,
  motivoPdfDeshabilitado,
  puedeGenerarPdf,
  reducirConfirmacion,
  type AccionConfirmacion,
  type CamposHuella,
  type EstadoConfirmacion,
} from "../../../src/app/(app)/cotizador/confirmacion";
import { TEXTOS } from "../../../src/app/(app)/cotizador/textosPantalla";

/** Una vista previa cualquiera: el reducer no mira su contenido. */
type Vista = { readonly tasa: string };
const VISTA: Vista = { tasa: "19.00%" };

const CAMPOS: CamposHuella = { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1,500,000", plazo: 12 };
const H = huellaDeCampos(CAMPOS);
const H2 = huellaDeCampos({ ...CAMPOS, plazo: 18 });

const aplicar = (estado: EstadoConfirmacion<Vista>, ...acciones: AccionConfirmacion<Vista>[]) =>
  acciones.reduce(reducirConfirmacion<Vista>, estado);

const recibida = (huella = H, vistaPrevia: Vista | null = VISTA): AccionConfirmacion<Vista> => ({
  tipo: "vistaPreviaRecibida",
  huella,
  vistaPrevia,
});

/** Vista previa válida para H y casilla marcada. */
const listo = () => aplicar(estadoInicial<Vista>(H), recibida(), { tipo: "confirmar" });

describe("huellaDeCampos", () => {
  it("es igual para los mismos campos", () => {
    expect(huellaDeCampos({ ...CAMPOS })).toBe(H);
  });

  it.each([
    ["entidad", { entidad: "RAMI_SISE" }],
    ["moneda", { moneda: "USD" }],
    ["esquema", { esquema: "final_del_plazo" }],
    ["monto", { monto: "1,500,001" }],
    ["plazo", { plazo: 18 }],
    ["plazo vacío", { plazo: null }],
  ])("cambia si cambia %s", (_, cambio) => {
    expect(huellaDeCampos({ ...CAMPOS, ...cambio })).not.toBe(H);
  });

  it("usa el monto tal como se escribió: otro formato del mismo monto también cuenta como cambio", () => {
    expect(huellaDeCampos({ ...CAMPOS, monto: "1500000" })).not.toBe(H);
  });

  it("no confunde campos al concatenar", () => {
    expect(huellaDeCampos({ ...CAMPOS, entidad: "A", moneda: "BC" })).not.toBe(
      huellaDeCampos({ ...CAMPOS, entidad: "AB", moneda: "C" }),
    );
  });
});

describe("estado inicial", () => {
  it("sin vista previa, sin confirmación y sin poder generar el PDF", () => {
    const e = estadoInicial<Vista>(H);
    expect(e).toEqual({ huellaActual: H, vistaPrevia: null, huellaVistaPrevia: null, confirmado: false });
    expect(puedeGenerarPdf(e)).toBe(false);
    expect(motivoPdfDeshabilitado(e)).toBe(TEXTOS.motivoSinVistaPrevia);
  });
});

describe("vistaPreviaRecibida", () => {
  it("se acepta si la huella coincide con los campos actuales", () => {
    const e = aplicar(estadoInicial<Vista>(H), recibida());
    expect(e.vistaPrevia).toBe(VISTA);
    expect(e.huellaVistaPrevia).toBe(H);
    expect(e.confirmado).toBe(false);
  });

  it("se descarta si la huella no coincide (respuesta vieja)", () => {
    const inicial = estadoInicial<Vista>(H);
    expect(aplicar(inicial, recibida(H2))).toEqual(inicial);
  });

  it("una respuesta de error (sin vista previa) deja la vista previa vacía", () => {
    const e = aplicar(estadoInicial<Vista>(H), recibida(), recibida(H, null));
    expect(e.vistaPrevia).toBeNull();
    expect(puedeGenerarPdf(e)).toBe(false);
  });

  it("una vista previa nueva quita la confirmación anterior", () => {
    const e = aplicar(listo(), recibida(H, { tasa: "19.00%" }));
    expect(e.confirmado).toBe(false);
  });
});

describe("campoCambiado", () => {
  it("borra la vista previa y la confirmación", () => {
    const e = aplicar(listo(), { tipo: "campoCambiado", huella: H2 });
    expect(e).toEqual({ huellaActual: H2, vistaPrevia: null, huellaVistaPrevia: null, confirmado: false });
    expect(puedeGenerarPdf(e)).toBe(false);
  });

  it("borra la confirmación aunque el valor nuevo dé la misma huella", () => {
    const e = aplicar(listo(), { tipo: "campoCambiado", huella: H });
    expect(e.confirmado).toBe(false);
    expect(e.vistaPrevia).toBeNull();
  });

  it("después del cambio, la vista previa vieja ya no se acepta", () => {
    const e = aplicar(listo(), { tipo: "campoCambiado", huella: H2 }, recibida(H));
    expect(e.vistaPrevia).toBeNull();
  });

  it("la vista previa de los campos nuevos sí se acepta", () => {
    const e = aplicar(listo(), { tipo: "campoCambiado", huella: H2 }, recibida(H2));
    expect(e.vistaPrevia).toBe(VISTA);
    expect(e.huellaVistaPrevia).toBe(H2);
  });
});

describe("confirmar y desconfirmar", () => {
  it("confirmar con vista previa válida habilita el PDF", () => {
    const e = listo();
    expect(e.confirmado).toBe(true);
    expect(puedeGenerarPdf(e)).toBe(true);
    expect(motivoPdfDeshabilitado(e)).toBeNull();
  });

  it("confirmar sin vista previa no hace nada", () => {
    const inicial = estadoInicial<Vista>(H);
    expect(aplicar(inicial, { tipo: "confirmar" })).toEqual(inicial);
  });

  it("confirmar después de un error no hace nada", () => {
    const e = aplicar(estadoInicial<Vista>(H), recibida(H, null), { tipo: "confirmar" });
    expect(e.confirmado).toBe(false);
  });

  it("desconfirmar quita la confirmación y deshabilita el PDF", () => {
    const e = aplicar(listo(), { tipo: "desconfirmar" });
    expect(e.confirmado).toBe(false);
    expect(e.vistaPrevia).toBe(VISTA);
    expect(puedeGenerarPdf(e)).toBe(false);
    expect(motivoPdfDeshabilitado(e)).toBe(TEXTOS.motivoSinConfirmar);
  });

  it("no muta el estado anterior", () => {
    const antes = estadoInicial<Vista>(H);
    const copia = structuredClone(antes);
    aplicar(antes, recibida(), { tipo: "confirmar" }, { tipo: "campoCambiado", huella: H2 });
    expect(antes).toEqual(copia);
  });
});

describe("puedeGenerarPdf exige las tres cosas", () => {
  const base = { huellaActual: H, vistaPrevia: VISTA, huellaVistaPrevia: H, confirmado: true };

  it("las tres: sí", () => {
    expect(puedeGenerarPdf(base)).toBe(true);
  });

  it("sin vista previa válida: no", () => {
    const e = { ...base, vistaPrevia: null };
    expect(puedeGenerarPdf(e)).toBe(false);
    expect(motivoPdfDeshabilitado(e)).toBe(TEXTOS.motivoSinVistaPrevia);
  });

  it("sin la casilla marcada: no", () => {
    const e = { ...base, confirmado: false };
    expect(puedeGenerarPdf(e)).toBe(false);
    expect(motivoPdfDeshabilitado(e)).toBe(TEXTOS.motivoSinConfirmar);
  });

  it("con huella distinta: no", () => {
    const e = { ...base, huellaActual: H2 };
    expect(puedeGenerarPdf(e)).toBe(false);
    expect(motivoPdfDeshabilitado(e)).toBe(TEXTOS.motivoVistaPreviaVieja);
  });

  it("sin huella de la vista previa: no", () => {
    expect(puedeGenerarPdf({ ...base, huellaVistaPrevia: null })).toBe(false);
  });
});

describe("textos de la confirmación", () => {
  it("son los de la pantalla", () => {
    expect(TEXTOS.confirmo).toBe("Confirmo que los números son correctos");
    expect(TEXTOS.generarPdf).toBe("Generar PDF");
    expect(TEXTOS).not.toHaveProperty("pdfSiguienteEtapa");
  });
});

describe("confirmacion.ts es lógica pura", () => {
  const codigo = readFileSync(path.join(process.cwd(), "src/app/(app)/cotizador/confirmacion.ts"), "utf8");
  const origenes = [...codigo.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

  it("no importa nada de src/domain ni de Next ni de React", () => {
    expect(origenes.filter((o) => /domain|^next|^react/.test(o))).toEqual([]);
  });

  it("solo importa los textos de la pantalla", () => {
    expect(origenes).toEqual(["./textosPantalla"]);
  });
});
