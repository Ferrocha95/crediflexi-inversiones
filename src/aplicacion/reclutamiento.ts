import { Decimal } from "../domain/comun/decimal";
import { formatearPesos } from "../domain/comun/formato";
import { comisionDeInversion } from "../domain/comisiones/comision";
import { fechaDePagoComision } from "../domain/comisiones/fechas";
import type { SemillaComisiones } from "../domain/comisiones/semilla";
import { limpiarCampo } from "./campos";
import { porcentajeComision } from "./comisiones";
import { fechaDeTextoIso, fechaEnMexico, fechaIsoEnMexico, fechaLarga, nombreDeMes } from "./fecha";
import { normalizarMonto } from "./monto";
import { rellenar } from "./rellenar";
import { error, ok, type ResultadoApp } from "./resultado";
import type { TextosReclutamiento } from "./textos";

// Modo reclutamiento: lo que una persona externa se ganaría en un mes según lo
// que capte por plazo. Perfil externo (todo pagable, sin desbloqueo), tabla
// del nivel vigente; cada monto por plazo se calcula como UNA inversión nueva.
// No calcula por su cuenta: las comisiones salen de comisionDeInversion.

export const TOPES_RECLUTAMIENTO = { presenta: 80, nombreEscenario: 40 } as const;

export interface CamposReclutamiento {
  readonly presenta: string;
  /** Tres escenarios: nombre y monto por plazo, tal como se escriben ("1,500,000"; "" = sin captación). */
  readonly escenarios: readonly { readonly nombre: string; readonly montos: Readonly<Record<string, string>> }[];
}

export interface EscenarioModelo {
  readonly nombre: string;
  readonly total: string;
  readonly lineas: readonly {
    readonly plazo: string;
    readonly monto: string;
    readonly tasa: string;
    readonly comision: string;
    /** Desglose: "$300,000.00 × 2.64% = $7,920.00". */
    readonly operacion: string;
  }[];
}

export interface ModeloReclutamiento {
  readonly textos: TextosReclutamiento;
  /** "Presenta: Nombre"; null si no se escribió. */
  readonly presenta: string | null;
  /** Fecha del documento (hoy en la Ciudad de México), DD/MM/AAAA. */
  readonly fecha: string;
  /** El aviso fijo, con la fecha de las tablas vigentes. */
  readonly aviso: string;
  readonly escenarios: readonly EscenarioModelo[];
  /** Barras de la gráfica: fracción del total mayor (0 a 1), solo para dibujar. */
  readonly grafica: readonly { readonly nombre: string; readonly total: string; readonly fraccion: number }[];
  /** Las dos líneas de fechas de pago (quincena 1 y 2) del mes en curso. */
  readonly fechas: readonly [string, string];
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha de pago ya validada (las fechas que se arman aquí siempre existen). */
function pago(s: SemillaComisiones, fecha: string): string {
  const r = fechaDePagoComision(s, fecha);
  if (!r.ok) throw new Error(r.error.mensaje);
  return fechaDeTextoIso(r.valor);
}

export function modeloReclutamiento(
  s: SemillaComisiones,
  t: TextosReclutamiento,
  c: CamposReclutamiento,
  ahora: Date,
): ResultadoApp<ModeloReclutamiento> {
  const escenarios: { nombre: string; total: Decimal; lineas: EscenarioModelo["lineas"] }[] = [];
  for (const [i, e] of c.escenarios.entries()) {
    const nombre = limpiarCampo(e.nombre, TOPES_RECLUTAMIENTO.nombreEscenario);
    if (nombre === "") return error("COMISION_INVALIDA", `Escribe el nombre del escenario ${i + 1}.`);
    let total = new Decimal(0);
    const lineas: EscenarioModelo["lineas"][number][] = [];
    const plazos = Object.keys(e.montos).sort((a, b) => Number(a) - Number(b));
    for (const plazo of plazos) {
      const escrito = e.montos[plazo].trim();
      if (escrito === "") continue;
      const prefijo = `${nombre}, ${plazo} meses: `;
      const monto = normalizarMonto(escrito);
      if (!monto.ok) {
        if (monto.error.codigo === "MONTO_CERO") continue;
        return error("COMISION_INVALIDA", prefijo + monto.error.mensaje);
      }
      const r = comisionDeInversion(s, { tipo: "nueva", monto: monto.valor, plazo: Number(plazo) });
      if (!r.ok) return error("COMISION_INVALIDA", prefijo + r.error.mensaje);
      total = total.plus(r.valor.comision);
      const tasa = porcentajeComision(r.valor.tasa);
      lineas.push({
        plazo: `${plazo} meses`,
        monto: formatearPesos(r.valor.monto),
        tasa,
        comision: formatearPesos(r.valor.comision),
        operacion: `${formatearPesos(r.valor.monto)} × ${tasa} = ${formatearPesos(r.valor.comision)}`,
      });
    }
    escenarios.push({ nombre, total, lineas });
  }

  const mayor = escenarios.reduce((m, e) => (e.total.greaterThan(m) ? e.total : m), new Decimal(0));
  const presenta = limpiarCampo(c.presenta, TOPES_RECLUTAMIENTO.presenta);

  // Fechas de pago del mes en curso, con los días de la semilla.
  const [anio, mes] = fechaIsoEnMexico(ahora).split("-");
  const delMes = (dia: number) => `${anio}-${mes}-${dos(dia)}`;
  const nombreMes = nombreDeMes(delMes(1));
  const { ultimoDiaQuincena1 } = s.pago;

  return ok({
    textos: t,
    presenta: presenta === "" ? null : rellenar(t.pdfPresenta, { presenta }),
    fecha: fechaEnMexico(ahora),
    aviso: rellenar(t.aviso, { fecha: fechaLarga(s.generado) }),
    escenarios: escenarios.map((e) => ({ nombre: e.nombre, total: formatearPesos(e.total), lineas: e.lineas })),
    grafica: escenarios.map((e) => ({
      nombre: e.nombre,
      total: formatearPesos(e.total),
      // Coordenada de dibujo (no es dinero): número.
      fraccion: mayor.isZero() ? 0 : e.total.div(mayor).toNumber(),
    })),
    fechas: [
      rellenar(t.fechaQuincena1, { dia_corte: String(ultimoDiaQuincena1), mes: nombreMes, fecha_pago: pago(s, delMes(1)) }),
      rellenar(t.fechaQuincena2, { dia_siguiente: String(ultimoDiaQuincena1 + 1), mes: nombreMes, fecha_pago: pago(s, delMes(ultimoDiaQuincena1 + 1)) }),
    ],
  });
}
