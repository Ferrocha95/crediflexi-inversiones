import { Decimal } from "../domain/comun/decimal";
import { formatearPesos } from "../domain/comun/formato";
import { comisionDeInversion, type ComisionInversion } from "../domain/comisiones/comision";
import { fechaDePagoComision } from "../domain/comisiones/fechas";
import type { SemillaComisiones } from "../domain/comisiones/semilla";
import { limpiarCampo } from "./campos";
import { porcentajeComision } from "./comisiones";
import { fechaDeTextoIso, fechaEnMexico, fechaIsoEnMexico, fechaLarga, nombreDeMes } from "./fecha";
import { lenguajeDePromesa } from "./lenguaje";
import { normalizarMonto } from "./monto";
import { rellenar } from "./rellenar";
import { error, ok, type ResultadoApp } from "./resultado";
import type { TextosReclutamiento } from "./textos";

// Modo reclutamiento: lo que una persona externa se ganaría en un mes según lo
// que capte por plazo. Perfil externo (todo pagable, sin desbloqueo), tabla
// del nivel vigente. El monto de cada plazo se reparte en partes iguales a
// centavos entre las "inversiones por plazo" (el sobrante de centavos va a la
// primera); cada parte paga con su propio tramo. No calcula por su cuenta: las
// comisiones salen de comisionDeInversion.

export const TOPES_RECLUTAMIENTO = { presenta: 60, nombreEscenario: 40 } as const;
/** Inversiones por plazo: entero de 1 a 20 (decisión de Fernando); por omisión, 1. */
export const INVERSIONES_POR_PLAZO = { minimo: 1, maximo: 20, porOmision: 1 } as const;

export interface CamposReclutamiento {
  readonly presenta: string;
  /** Tres escenarios: nombre y monto por plazo, tal como se escriben ("1,500,000"; "" = sin captación). */
  readonly escenarios: readonly { readonly nombre: string; readonly montos: Readonly<Record<string, string>> }[];
  /** Entre cuántas inversiones iguales se reparte cada monto; por omisión, 1. */
  readonly inversionesPorPlazo?: number;
}

export interface EscenarioModelo {
  readonly nombre: string;
  readonly total: string;
  readonly lineas: readonly {
    readonly plazo: string;
    readonly monto: string;
    /** Tasa de la parte o, si las partes caen en tramos distintos, "2.706% y 2.64%". */
    readonly tasa: string;
    readonly comision: string;
    /**
     * Desglose: "$300,000.00 × 2.64% = $7,920.00"; repartido,
     * "1 × ($333,333.34 × 2.706% = $9,020.00) + 2 × ($333,333.33 × 2.706% = $9,020.00) = $27,060.00".
     */
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
  /** "Cálculo con {n} inversión(es) por plazo: ..." (siempre visible, en pantalla y en el PDF). */
  readonly avisoInversiones: string;
  readonly escenarios: readonly EscenarioModelo[];
  /** Barras de la gráfica: fracción del total mayor (0 a 1), solo para dibujar. */
  readonly grafica: readonly { readonly nombre: string; readonly total: string; readonly fraccion: number }[];
  /** Las dos líneas de fechas de pago (quincena 1 y 2) del mes en curso. */
  readonly fechas: readonly [string, string];
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Reparte el monto en `n` partes iguales a centavos; el sobrante de centavos va a la primera. */
function repartir(monto: Decimal, n: number): Decimal[] {
  const centavos = monto.times(100);
  const base = centavos.divToInt(n);
  const sobrante = centavos.minus(base.times(n));
  return Array.from({ length: n }, (_, i) => (i === 0 ? base.plus(sobrante) : base).div(100));
}

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
  const n = c.inversionesPorPlazo ?? INVERSIONES_POR_PLAZO.porOmision;
  if (!Number.isInteger(n) || n < INVERSIONES_POR_PLAZO.minimo || n > INVERSIONES_POR_PLAZO.maximo) {
    return error(
      "COMISION_INVALIDA",
      `Las inversiones por plazo deben ser un número entero de ${INVERSIONES_POR_PLAZO.minimo} a ${INVERSIONES_POR_PLAZO.maximo}.`,
    );
  }
  const presenta = limpiarCampo(c.presenta, TOPES_RECLUTAMIENTO.presenta);
  const promesa = lenguajeDePromesa(presenta);
  if (promesa !== null) {
    return error(
      "COMISION_INVALIDA",
      `El nombre de quien presenta no puede llevar lenguaje de promesa ("${promesa}"). Escribe solo el nombre.`,
    );
  }

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
      // Cada parte con su propio tramo; la comisión del plazo es la suma de las partes.
      const partes: ComisionInversion[] = [];
      for (const parte of repartir(new Decimal(monto.valor), n)) {
        const r = comisionDeInversion(s, { tipo: "nueva", monto: parte.toFixed(2), plazo: Number(plazo) });
        if (!r.ok) return error("COMISION_INVALIDA", prefijo + r.error.mensaje);
        partes.push(r.valor);
      }
      const comision = partes.reduce((a, p) => a.plus(p.comision), new Decimal(0));
      total = total.plus(comision);
      const una = (p: (typeof partes)[number]) => `${formatearPesos(p.monto)} × ${porcentajeComision(p.tasa)} = ${formatearPesos(p.comision)}`;
      // Las partes iguales se agrupan (a lo más dos grupos: la primera con el sobrante y las demás).
      const grupos: { texto: string; cuantas: number }[] = [];
      for (const p of partes) {
        const texto = una(p);
        const g = grupos.find((x) => x.texto === texto);
        if (g === undefined) grupos.push({ texto, cuantas: 1 });
        else g.cuantas += 1;
      }
      lineas.push({
        plazo: `${plazo} meses`,
        monto: formatearPesos(new Decimal(monto.valor)),
        tasa: [...new Set(partes.map((p) => porcentajeComision(p.tasa)))].join(" y "),
        comision: formatearPesos(comision),
        operacion:
          n === 1
            ? una(partes[0])
            : `${grupos.map((g) => `${g.cuantas} × (${g.texto})`).join(" + ")} = ${formatearPesos(comision)}`,
      });
    }
    escenarios.push({ nombre, total, lineas });
  }

  const mayor = escenarios.reduce((m, e) => (e.total.greaterThan(m) ? e.total : m), new Decimal(0));

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
    avisoInversiones: rellenar(t.avisoInversionesPorPlazo, { n: String(n) }),
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
