import { Decimal } from "../comun/decimal";
import { resolverTasa, type SolicitudTasa } from "../tasas/resolver";
import type { Esquema, Semilla } from "../tasas/semilla.esquema";
import { aCentavos } from "./redondeo";

/** Meses del año: divisor de la tasa anual en interés simple (no es un parámetro de negocio). */
const MESES_POR_ANIO = 12;

/**
 * Incremento mínimo de capital en la modalidad Creciente: si el primer pago
 * mensual es menor, el escenario de reinversión no se muestra.
 * Origen: Manual de capacitación, modalidad Creciente.
 * Pendiente: moverlo a la semilla (PENDIENTES_TECNICOS.md).
 */
export const INCREMENTO_MINIMO_REINVERSION = new Decimal(1000);

/** Un mes del escenario. Cifras como texto decimal con 2 decimales. */
export interface PuntoEscenario {
  /** 1 a 2 × plazo. */
  readonly mes: number;
  /** Mensual: el pago del mes (se reinvierte). Final del plazo: lo devengado en el mes. */
  readonly rendimiento: string;
  /** Valor de la inversión al final del mes, con reinversión. */
  readonly valor: string;
  /** monto + monto × tasa × mes ÷ 12, con la tasa cotizada y sin reinvertir. */
  readonly sinReinvertir: string;
  /** Tasa anual aplicada en el mes, como texto decimal. */
  readonly tasa: string;
}

export type MotivoOmision = "INCREMENTO_MINIMO" | "TASA_NO_DISPONIBLE";

export type EscenarioReinversion =
  | {
      readonly tipo: "ok";
      readonly esquema: Esquema;
      readonly capitalInicial: string;
      /** 2 × plazo: dos plazos seguidos. */
      readonly meses: number;
      /** Último mes del primer plazo. */
      readonly finPrimerPlazo: number;
      readonly puntos: readonly PuntoEscenario[];
    }
  | { readonly tipo: "omitido"; readonly motivo: MotivoOmision };

const omitido = (motivo: MotivoOmision): EscenarioReinversion => ({ tipo: "omitido", motivo });

/** Tasa de la tabla para ese capital, plazo y esquema, o null si no se puede resolver. */
function tasaPara(semilla: Semilla, solicitud: SolicitudTasa, monto: Decimal): Decimal | null {
  const r = resolverTasa(semilla, { ...solicitud, monto });
  return r.ok ? r.valor.tasa : null;
}

/** Lo devengado en k meses: capital × tasa × k ÷ 12 a centavos. */
const devengado = (capital: Decimal, tasa: Decimal, k: number) =>
  aCentavos(capital.times(tasa).times(k).div(MESES_POR_ANIO));

/**
 * Escenario ilustrativo de reinversión a dos plazos seguidos (2 × plazo meses),
 * con las tasas vigentes de la semilla.
 *
 * Mensual (modo Creciente): cada mes rinde capital × tasa ÷ 12, con la tasa de
 * resolverTasa para el capital al inicio del mes y el plazo cotizado; el pago se
 * redondea a centavos y se reinvierte ya redondeado. El valor del mes es el
 * capital al final del mes. Se omite si el primer pago es menor al incremento
 * mínimo.
 *
 * Final del plazo: al vencer el primer plazo se renueva capital más ganancia
 * total por un plazo igual, con la tasa de resolverTasa para el nuevo monto. El
 * valor del mes es el capital del plazo en curso más lo devengado en él.
 *
 * Si resolverTasa falla en cualquier mes, el escenario se omite.
 */
export function escenarioReinversion(semilla: Semilla, solicitud: SolicitudTasa): EscenarioReinversion {
  const inicial = resolverTasa(semilla, solicitud);
  if (!inicial.ok) return omitido("TASA_NO_DISPONIBLE");

  const { monto, tasa: tasaCotizada, plazo, esquema } = inicial.valor;
  const meses = 2 * plazo;
  const sinReinvertir = (k: number) => monto.plus(devengado(monto, tasaCotizada, k)).toFixed(2);
  const puntos: PuntoEscenario[] = [];

  if (esquema === "mensual") {
    if (devengado(monto, tasaCotizada, 1).lt(INCREMENTO_MINIMO_REINVERSION)) return omitido("INCREMENTO_MINIMO");

    let capital = monto;
    for (let k = 1; k <= meses; k++) {
      const tasa = tasaPara(semilla, solicitud, capital);
      if (tasa === null) return omitido("TASA_NO_DISPONIBLE");
      const pago = devengado(capital, tasa, 1);
      capital = capital.plus(pago);
      puntos.push({
        mes: k,
        rendimiento: pago.toFixed(2),
        valor: capital.toFixed(2),
        sinReinvertir: sinReinvertir(k),
        tasa: tasa.toFixed(),
      });
    }
  } else {
    let capital = monto;
    let tasa = tasaCotizada;
    for (let k = 1; k <= meses; k++) {
      if (k === plazo + 1) {
        // Renovación: capital más la ganancia total del primer plazo.
        capital = capital.plus(devengado(capital, tasa, plazo));
        const renovada = tasaPara(semilla, solicitud, capital);
        if (renovada === null) return omitido("TASA_NO_DISPONIBLE");
        tasa = renovada;
      }
      const enCurso = k > plazo ? k - plazo : k;
      puntos.push({
        mes: k,
        rendimiento: devengado(capital, tasa, enCurso).minus(devengado(capital, tasa, enCurso - 1)).toFixed(2),
        valor: capital.plus(devengado(capital, tasa, enCurso)).toFixed(2),
        sinReinvertir: sinReinvertir(k),
        tasa: tasa.toFixed(),
      });
    }
  }

  return { tipo: "ok", esquema, capitalInicial: monto.toFixed(2), meses, finPrimerPlazo: plazo, puntos };
}
