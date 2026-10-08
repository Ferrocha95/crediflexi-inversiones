// Puntos extra y plazo especial de punta a punta en el servidor: la vista
// previa (previsualizarCon), el PDF (manejarPdf), la huella de la
// confirmación y el cuerpo de la petición del PDF. Datos sintéticos.

import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { huellaDeCampos, type CamposHuella } from "../../../src/app/(app)/cotizador/confirmacion";
import { cuerpoPeticionPdf } from "../../../src/app/(app)/cotizador/peticionPdf";
import type { ModeloPdf } from "../../../src/aplicacion/modelo";
import { manejarPdf } from "../../../src/servidor/pdf/manejador";
import { leerParametrosCotizacion } from "../../../src/servidor/parametros";
import { previsualizarCon, type RespuestaVistaPrevia } from "../../../src/servidor/vistaPrevia";

const HOST = "localhost:3000";
const BASE = { peticion: 1, entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1,500,000", plazo: 12 };
const ESPECIAL = { plazo: 9, tasaMensual: "17", tasaFinal: null };

async function vista(cambios: Record<string, unknown>) {
  const r: RespuestaVistaPrevia = await previsualizarCon({ ...BASE, ...cambios }, HOST);
  return r;
}

function vistaPrevia(r: RespuestaVistaPrevia) {
  if (r.resultado.tipo !== "vista_previa") throw new Error(`Se esperaba vista previa: ${JSON.stringify(r.resultado)}`);
  return r.resultado.vistaPrevia;
}

describe("vista previa con ajustes", () => {
  it("+1.0 punto: 20.00% con su desglose y 25,000.00 al mes", async () => {
    const v = vistaPrevia(await vista({ puntosExtra: "1.0" }));
    expect(v.desgloseTasa).toEqual({ tasaTabla: "19.00%", puntos: "1.0", tasa: "20.00%" });
    expect(v.salidas[0].cifra).toBe("$25,000.00");
  });

  it("sin puntosExtra se comporta como antes (0 puntos)", async () => {
    const v = vistaPrevia(await vista({}));
    expect([v.tasa, v.desgloseTasa]).toEqual(["19.00%", null]);
  });

  it.each(["0.3", "5.5", "-1"])("rechaza %s puntos con un mensaje claro", async (puntosExtra) => {
    const r = await vista({ puntosExtra });
    expect(r.resultado).toMatchObject({ tipo: "error" });
    expect(r.resultado.tipo === "error" && r.resultado.mensaje).toContain("Los puntos extra");
  });

  it("plazo especial de 9 meses al 17%: no necesita plazo de tabla", async () => {
    const r = await vista({ plazo: null, monto: "100,000", especial: ESPECIAL });
    const v = vistaPrevia(r);
    expect([v.solicitud.plazo, v.tasa, v.plazoEspecial, v.tramo]).toEqual(["9 meses", "17.00%", true, null]);
    expect(v.salidas.map((s) => s.cifra)).toEqual(["$1,416.67", "$17,000.00", "$12,750.00"]);
    expect(v.tasaAcordadaAlta).toBeNull();
  });

  it.each([0, 25])("rechaza un plazo especial de %s meses", async (plazo) => {
    const r = await vista({ plazo: null, monto: "100,000", especial: { ...ESPECIAL, plazo } });
    expect(r.resultado).toMatchObject({ tipo: "error" });
  });

  it("una tasa acordada muy por encima de la tabla da un aviso que no bloquea", async () => {
    const v = vistaPrevia(await vista({ plazo: null, monto: "100,000", especial: { ...ESPECIAL, tasaMensual: "99" } }));
    expect(v.tasaAcordadaAlta?.tasa).toBe("99.00%");
  });

  it("puntos con plazo especial no se aceptan", async () => {
    const r = await vista({ plazo: null, monto: "100,000", puntosExtra: "1.0", especial: ESPECIAL });
    expect(r.resultado.tipo === "error" && r.resultado.mensaje).toContain("Los puntos extra solo aplican a plazos de la tabla");
  });

  it("CREDIFLEXI con USD en plazo especial: el motor valida la entidad", async () => {
    const r = await vista({ plazo: null, moneda: "USD", monto: "10,000", especial: ESPECIAL });
    expect(r.resultado.tipo === "error" && r.resultado.mensaje).toContain("no aplica a la entidad");
  });
});

describe("PDF con ajustes", () => {
  const AHORA = new Date("2026-10-07T18:00:00Z");
  const CUERPO = { ...BASE, confirmado: true, versionTasas: semillaJson.version };

  async function pdf(cambios: Record<string, unknown>) {
    const modelos: ModeloPdf[] = [];
    const r = await manejarPdf(
      new Request(`http://${HOST}/cotizador/pdf`, {
        method: "POST",
        headers: { host: HOST, origin: `http://${HOST}`, "content-type": "application/json" },
        body: JSON.stringify({ ...CUERPO, ...cambios }),
      }),
      {
        leer: () => leerParametrosCotizacion(),
        renderizar: async (m) => {
          modelos.push(m);
          return new TextEncoder().encode("%PDF-espia");
        },
        ahora: () => AHORA,
      },
    );
    return { r, modelo: modelos[0] };
  }

  it("+1.0 punto: el PDF usa 20.00% en la página 1 y en las dos tarjetas", async () => {
    const { r, modelo } = await pdf({ puntosExtra: "1.0" });
    expect(r.status).toBe(200);
    expect(modelo.tasa).toBe("20.00%");
    expect(modelo.cifraPrincipal.cifra).toBe("$25,000.00");
    expect(modelo.pagina2.tarjetas[0].detalle!.tasa).toBe("20.00%");
  });

  it("plazo especial: 9 meses con la tasa acordada", async () => {
    const { r, modelo } = await pdf({ plazo: 9, monto: "100,000", especial: ESPECIAL });
    expect(r.status).toBe(200);
    expect([modelo.tasa, modelo.cifraPrincipal.cifra, modelo.solicitud.plazo]).toEqual(["17.00%", "$1,416.67", "9 meses"]);
    expect(modelo.pagina2.tarjetas[1].detalle).toBeNull();
  });

  it("puntos inválidos responden 422", async () => {
    const { r } = await pdf({ puntosExtra: "5.5" });
    expect(r.status).toBe(422);
  });
});

describe("la confirmación y la petición llevan los ajustes", () => {
  const CAMPOS: CamposHuella = { entidad: "CREDIFLEXI", moneda: "MXN", esquema: "mensual", monto: "1,500,000", plazo: 12 };

  it("cambiar los puntos o el plazo especial cambia la huella (invalida la vista previa confirmada)", () => {
    const h = huellaDeCampos({ ...CAMPOS, puntosExtra: "0.0", especial: null });
    expect(huellaDeCampos({ ...CAMPOS, puntosExtra: "1.0", especial: null })).not.toBe(h);
    expect(huellaDeCampos({ ...CAMPOS, puntosExtra: "0.0", especial: ESPECIAL })).not.toBe(h);
    expect(huellaDeCampos({ ...CAMPOS, puntosExtra: "0.0", especial: { ...ESPECIAL, tasaMensual: "18" } })).not.toBe(
      huellaDeCampos({ ...CAMPOS, puntosExtra: "0.0", especial: ESPECIAL }),
    );
  });

  it("el cuerpo del PDF lleva puntosExtra y especial", () => {
    const vacios = { preparadoPara: "", ejecutivo: "", vigencia: "", notaAdicional: "" };
    expect(cuerpoPeticionPdf({ ...CAMPOS, plazo: 9, puntosExtra: "0.0", especial: ESPECIAL }, vacios, "0.7")).toMatchObject({
      puntosExtra: "0.0",
      especial: ESPECIAL,
      plazo: 9,
    });
  });
});
