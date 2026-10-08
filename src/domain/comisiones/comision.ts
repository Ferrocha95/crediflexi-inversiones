import { Decimal, RE_MONTO } from "../comun/decimal";
import { formatearPesos, listaEnEspanol } from "../comun/formato";
import { aCentavos } from "../interes/redondeo";
import { exitoComision, falloComision, type ResultadoComision } from "./errores";
import type { SemillaComisiones, TipoInversion } from "./semilla";

export interface SolicitudComision {
  readonly tipo: TipoInversion;
  /** Texto decimal sin comas, con máximo 2 decimales ("1500000", "300000.50"). */
  readonly monto: string;
  readonly plazo: number;
  /** Solo hay tablas en pesos; USD se rechaza. Por omisión, MXN. */
  readonly moneda?: "MXN" | "USD";
}

export interface ComisionInversion {
  readonly tipo: TipoInversion;
  readonly monto: Decimal;
  readonly plazo: number;
  /** Tasa completa de la tabla, sin redondear (0.02904 = 2.904%). */
  readonly tasa: Decimal;
  readonly tramo: { readonly desde: Decimal; readonly hasta: Decimal | null };
  /** monto × tasa, a 2 decimales, mitad hacia arriba. */
  readonly comision: Decimal;
}

/**
 * Comisión de UNA inversión con la tabla del nivel vigente (parametros.nivel_vigente).
 * El tramo se elige por el monto, con límite superior inclusivo (300,000 cae
 * en el primer tramo y 300,000.01 en el segundo).
 */
export function comisionDeInversion(s: SemillaComisiones, sol: SolicitudComision): ResultadoComision<ComisionInversion> {
  if ((sol.moneda ?? "MXN") !== "MXN") {
    return falloComision(
      "MONEDA_SIN_COMISION",
      `No hay tabla de comisiones en ${sol.moneda}: las comisiones solo se calculan para inversiones en pesos (MXN).`,
    );
  }
  if (!RE_MONTO.test(sol.monto)) {
    return falloComision(
      "MONTO_INVALIDO",
      `El monto "${sol.monto}" no se puede leer. Escríbelo sin comas, con máximo 2 decimales, por ejemplo 1500000 o 300000.50.`,
    );
  }
  const monto = new Decimal(sol.monto);
  if (monto.lessThan(s.montoMinimo)) {
    return falloComision(
      "MONTO_MENOR_AL_MINIMO",
      `La inversión de ${formatearPesos(monto)} es menor que el mínimo de ${formatearPesos(s.montoMinimo)} para calcular comisión. ` +
        "Captura un monto igual o mayor.",
    );
  }

  const tabla = s.tablas[sol.tipo][s.nivelVigente];
  // Límite superior inclusivo: el primer tramo cuyo "hasta" no es menor que el
  // monto. Entre dos tramos de pesos enteros (300,000.50) va al siguiente.
  const tramo = tabla.find((t) => t.hasta === null || monto.lessThanOrEqualTo(t.hasta));
  const tasa = tramo?.tasas.get(sol.plazo);
  if (tramo === undefined || tasa === undefined) {
    const plazos = [...(tabla[0]?.tasas.keys() ?? [])];
    return falloComision(
      "PLAZO_INVALIDO",
      `El plazo de ${sol.plazo} meses no está en la tabla de comisiones. Usa ${listaEnEspanol(plazos)} meses.`,
    );
  }

  return exitoComision({
    tipo: sol.tipo,
    monto,
    plazo: sol.plazo,
    tasa,
    tramo: { desde: tramo.desde, hasta: tramo.hasta },
    comision: aCentavos(monto.times(tasa)),
  });
}
