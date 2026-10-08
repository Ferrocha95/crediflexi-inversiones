import { Decimal, ROUND_HALF_UP } from "../domain/comun/decimal";
import { formatearPesos } from "../domain/comun/formato";
import { bonoDeExterno } from "../domain/comisiones/bonoExterno";
import { comisionDeInversion, type ComisionInversion } from "../domain/comisiones/comision";
import { fechaDePagoComision } from "../domain/comisiones/fechas";
import type { SemillaComisiones } from "../domain/comisiones/semilla";
import { limpiarCampo } from "./campos";
import { plazosDeComision, porcentajeComision } from "./comisiones";
import { fechaDeTextoIso, fechaEnMexico, fechaIsoEnMexico, fechaLarga, nombreDeMes } from "./fecha";
import { lenguajeDePromesa } from "./lenguaje";
import { normalizarMonto } from "./monto";
import { rellenar } from "./rellenar";
import { error, ok, type ResultadoApp } from "./resultado";
import type { TextosReclutamiento } from "./textos";

// Modo reclutamiento (Sprint 5): lo que una persona externa se ganaría en un
// mes según cuánto capte. Un solo dato, la captación del mes: puesta entera
// en cada plazo de la tabla (el comparativo) y en el plazo elegido o en la
// mezcla de plazos (la cifra grande), siempre más el bono de externos por
// captación nueva. Perfil externo: todo pagable, sin desbloqueo, sin sueldo
// base. El monto de cada plazo se reparte en partes iguales a centavos entre
// las "inversiones por plazo" (el sobrante va a la primera); cada parte paga
// con su propio tramo. No calcula por su cuenta: las comisiones salen de
// comisionDeInversion y el bono de bonoDeExterno.

export const TOPES_RECLUTAMIENTO = { presenta: 60 } as const;
/** Inversiones por plazo: entero de 1 a 20 (decisión de Fernando); por omisión, 1. */
export const INVERSIONES_POR_PLAZO = { minimo: 1, maximo: 20, porOmision: 1 } as const;

export interface CamposReclutamiento {
  readonly presenta: string;
  /** "¿Cuánto captarías al mes?", tal como se escribe ("1,000,000"). */
  readonly monto: string;
  /** Plazo de la cifra grande; por omisión, el de los textos (12 meses). */
  readonly plazo?: number;
  /** Personalizar: monto por plazo ("" = nada). Si alguno tiene monto, la cifra grande usa la mezcla. */
  readonly mezcla?: Readonly<Record<string, string>>;
  /** Entre cuántas inversiones iguales se reparte cada monto; por omisión, 1. */
  readonly inversionesPorPlazo?: number;
}

export interface PlazoComparativo {
  readonly plazo: number;
  /** "12 meses". */
  readonly etiqueta: string;
  readonly comision: string;
  /** Una sola línea: "$1,000,000 × 2.838% = $28,380.00" (o el reparto si hay varias inversiones). */
  readonly linea: string;
  /** Largo de la barra: fracción de la comisión mayor (0 a 1), solo para dibujar. */
  readonly fraccion: number;
  /** El plazo de la cifra grande (ninguno con la mezcla). */
  readonly elegido: boolean;
}

export interface ModeloReclutamiento {
  readonly textos: TextosReclutamiento;
  /** "Presenta: Nombre"; null si no se escribió. */
  readonly presenta: string | null;
  /** Fecha del documento (hoy en la Ciudad de México), DD/MM/AAAA. */
  readonly fecha: string;
  /** Las frases, con el monto mínimo de la semilla. */
  readonly frases: readonly string[];
  /** Aviso interno solo para la pantalla mientras RH no apruebe las frases; null si ya las aprobó. */
  readonly avisoFrasesRh: string | null;
  /** La captación del mes: "$1,000,000". */
  readonly captacion: string;
  readonly cifra: {
    /** Comisión más bono. */
    readonly total: string;
    /** "$1,000,000 a 12 meses: comisión $28,380.00 más bono $15,000.00". */
    readonly detalle: string;
    /** null con la mezcla de plazos. */
    readonly plazo: number | null;
  };
  /** La misma captación, entera, en cada plazo de la tabla. */
  readonly comparativo: readonly PlazoComparativo[];
  /** "A 24 meses se ganaría 4.60 veces lo de 6 meses."; null si el plazo menor no deja comisión. */
  readonly fraseVeces: string | null;
  /** Desglose de la mezcla de plazos (solo los plazos con monto); null sin mezcla. */
  readonly mezcla: readonly { readonly plazo: string; readonly monto: string; readonly comision: string; readonly operacion: string }[] | null;
  /** Escalera de bonos: debajo del primer rango y cada rango, con el de esta captación marcado. */
  readonly escalera: readonly { readonly texto: string; readonly actual: boolean }[];
  readonly avisoIncorporacion: string;
  /** El aviso fijo aprobado por RH, con la fecha de las tablas vigentes. */
  readonly aviso: string;
  /** "Cálculo con {n} inversión(es) por plazo: ..." (siempre visible, en pantalla y en el PDF). */
  readonly avisoInversiones: string;
  readonly avisoTasas: string;
  /** Las dos líneas de fechas de pago (quincena 1 y 2) del mes en curso. */
  readonly fechas: readonly [string, string];
}

const dos = (n: number) => String(n).padStart(2, "0");
const CERO = new Decimal(0);

/** Pesos sin centavos cuando son cero ("$1,000,000"); con centavos, completos. */
const pesosEnteros = (d: Decimal) => (d.isInteger() ? formatearPesos(d).replace(/\.00$/, "") : formatearPesos(d));

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

/** Comisión de un monto a un plazo, repartido en `n` inversiones, con su línea de operación. */
function comisionDePlazo(
  s: SemillaComisiones,
  monto: Decimal,
  plazo: number,
  n: number,
): ResultadoApp<{ readonly comision: Decimal; readonly linea: string }> {
  const partes: ComisionInversion[] = [];
  for (const parte of repartir(monto, n)) {
    const r = comisionDeInversion(s, { tipo: "nueva", monto: parte.toFixed(2), plazo });
    if (!r.ok) return error("COMISION_INVALIDA", r.error.mensaje);
    partes.push(r.valor);
  }
  const comision = partes.reduce((a, p) => a.plus(p.comision), CERO);
  const una = (p: ComisionInversion) => `${pesosEnteros(p.monto)} × ${porcentajeComision(p.tasa)} = ${formatearPesos(p.comision)}`;
  if (n === 1) return ok({ comision, linea: una(partes[0]) });
  // Las partes iguales se agrupan (a lo más dos grupos: la primera con el sobrante y las demás).
  const grupos: { texto: string; cuantas: number }[] = [];
  for (const p of partes) {
    const texto = una(p);
    const g = grupos.find((x) => x.texto === texto);
    if (g === undefined) grupos.push({ texto, cuantas: 1 });
    else g.cuantas += 1;
  }
  return ok({ comision, linea: `${grupos.map((g) => `${g.cuantas} × (${g.texto})`).join(" + ")} = ${formatearPesos(comision)}` });
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

  // La captación del mes.
  const leido = normalizarMonto(c.monto);
  if (!leido.ok) {
    return leido.error.codigo === "MONTO_CERO" || c.monto.trim() === ""
      ? error("COMISION_INVALIDA", "Escribe cuánto captarías al mes, por ejemplo 1,000,000.")
      : error("COMISION_INVALIDA", `Captación del mes: ${leido.error.mensaje}`);
  }
  const captacion = new Decimal(leido.valor);
  const plazos = plazosDeComision(s);

  // El comparativo: la misma captación, entera, en cada plazo.
  const porPlazo: { plazo: number; comision: Decimal; linea: string }[] = [];
  for (const plazo of plazos) {
    const r = comisionDePlazo(s, captacion, plazo, n);
    if (!r.ok) return r;
    porPlazo.push({ plazo, ...r.valor });
  }

  // La mezcla de plazos (Personalizar): solo cuenta si algún plazo tiene monto, y debe sumar la captación.
  const mezclaEscrita = Object.entries(c.mezcla ?? {})
    .filter(([, v]) => v.trim() !== "")
    .sort(([a], [b]) => Number(a) - Number(b));
  let mezcla: { plazo: string; monto: Decimal; comision: Decimal; operacion: string }[] | null = null;
  if (mezclaEscrita.length > 0) {
    mezcla = [];
    for (const [plazo, escrito] of mezclaEscrita) {
      const prefijo = `Mezcla, ${plazo} meses: `;
      const m = normalizarMonto(escrito);
      if (!m.ok) {
        if (m.error.codigo === "MONTO_CERO") continue;
        return error("COMISION_INVALIDA", prefijo + m.error.mensaje);
      }
      const monto = new Decimal(m.valor);
      const r = comisionDePlazo(s, monto, Number(plazo), n);
      if (!r.ok) return error("COMISION_INVALIDA", prefijo + r.error.mensaje);
      mezcla.push({ plazo: rellenar(t.plazoMeses, { meses: plazo }), monto, comision: r.valor.comision, operacion: r.valor.linea });
    }
    const suma = mezcla.reduce((a, l) => a.plus(l.monto), CERO);
    if (!suma.equals(captacion)) {
      return error(
        "COMISION_INVALIDA",
        `La mezcla de plazos suma ${formatearPesos(suma)} y la captación del mes es ${formatearPesos(captacion)}. Ajusta los montos para que sumen lo mismo.`,
      );
    }
  }

  // La cifra grande: comisión del plazo elegido (o de la mezcla) más el bono de externos.
  const plazoElegido = c.plazo ?? t.plazoPorOmision;
  const elegido = porPlazo.find((p) => p.plazo === plazoElegido);
  if (mezcla === null && elegido === undefined) {
    // Mensaje del motor, con los plazos de la tabla.
    const r = comisionDeInversion(s, { tipo: "nueva", monto: captacion.toFixed(2), plazo: plazoElegido });
    return error("COMISION_INVALIDA", r.ok ? `El plazo de ${plazoElegido} meses no está en la tabla.` : r.error.mensaje);
  }
  const bono = bonoDeExterno(s, captacion);
  const comision = mezcla === null ? elegido!.comision : mezcla.reduce((a, l) => a.plus(l.comision), CERO);
  const valores = { captacion: pesosEnteros(captacion), comision: formatearPesos(comision), bono: formatearPesos(bono.bono) };
  const cifra = {
    total: formatearPesos(comision.plus(bono.bono)),
    detalle:
      mezcla === null ? rellenar(t.cifraDetalle, { ...valores, meses: String(plazoElegido) }) : rellenar(t.cifraDetalleMezcla, valores),
    plazo: mezcla === null ? plazoElegido : null,
  };

  // "A 24 meses se ganaría N.NN veces lo de 6 meses": plazo mayor entre plazo menor, a 2 decimales.
  const menor = porPlazo[0];
  const mayor = porPlazo[porPlazo.length - 1];
  const fraseVeces =
    menor === undefined || mayor === undefined || menor.comision.isZero() || menor === mayor
      ? null
      : rellenar(t.fraseVeces, {
          meses_mayor: String(mayor.plazo),
          veces: mayor.comision.div(menor.comision).toFixed(2, ROUND_HALF_UP),
          meses_menor: String(menor.plazo),
        });
  const tope = porPlazo.reduce((m, p) => (p.comision.greaterThan(m) ? p.comision : m), CERO);

  // La escalera de bonos, con los rangos de la semilla.
  const rangos = s.incentivosExternos;
  const escalera = [
    ...(rangos.length === 0 ? [] : [{ texto: rellenar(t.escalonSinBono, { desde: pesosEnteros(rangos[0].desde) }), actual: bono.rango === null }]),
    ...rangos.map((r) => ({
      texto:
        r.hasta === null
          ? rellenar(t.escalonUltimo, { desde: pesosEnteros(r.desde), bono: pesosEnteros(r.bono) })
          : rellenar(t.escalonRango, { desde: pesosEnteros(r.desde), hasta: pesosEnteros(r.hasta), bono: pesosEnteros(r.bono) }),
      actual: bono.rango !== null && bono.rango.desde.equals(r.desde),
    })),
  ];

  // Fechas de pago del mes en curso, con los días de la semilla.
  const [anio, mes] = fechaIsoEnMexico(ahora).split("-");
  const delMes = (dia: number) => `${anio}-${mes}-${dos(dia)}`;
  const nombreMes = nombreDeMes(delMes(1));
  const { ultimoDiaQuincena1 } = s.pago;

  return ok({
    textos: t,
    presenta: presenta === "" ? null : rellenar(t.pdfPresenta, { presenta }),
    fecha: fechaEnMexico(ahora),
    frases: t.frases.map((f) => rellenar(f, { monto_minimo: pesosEnteros(s.montoMinimo) })),
    avisoFrasesRh: t.frasesAprobadasPorRh ? null : t.avisoFrasesRh,
    captacion: pesosEnteros(captacion),
    cifra,
    comparativo: porPlazo.map((p) => ({
      plazo: p.plazo,
      etiqueta: rellenar(t.plazoMeses, { meses: String(p.plazo) }),
      comision: formatearPesos(p.comision),
      linea: p.linea,
      // Coordenada de dibujo (no es dinero): número.
      fraccion: tope.isZero() ? 0 : p.comision.div(tope).toNumber(),
      elegido: mezcla === null && p.plazo === plazoElegido,
    })),
    fraseVeces,
    mezcla:
      mezcla === null
        ? null
        : mezcla.map((l) => ({ plazo: l.plazo, monto: pesosEnteros(l.monto), comision: formatearPesos(l.comision), operacion: l.operacion })),
    escalera,
    avisoIncorporacion: t.avisoIncorporacion,
    aviso: rellenar(t.aviso, { fecha: fechaLarga(s.generado) }),
    avisoInversiones: rellenar(t.avisoInversionesPorPlazo, { n: String(n) }),
    avisoTasas: t.avisoTasas,
    fechas: [
      rellenar(t.fechaQuincena1, { dia_corte: String(ultimoDiaQuincena1), mes: nombreMes, fecha_pago: pago(s, delMes(1)) }),
      rellenar(t.fechaQuincena2, { dia_siguiente: String(ultimoDiaQuincena1 + 1), mes: nombreMes, fecha_pago: pago(s, delMes(ultimoDiaQuincena1 + 1)) }),
    ],
  });
}
