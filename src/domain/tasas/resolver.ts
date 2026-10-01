import { Decimal, RE_MONTO } from "../comun/decimal";
import { crearError } from "../comun/errores";
import { formatearMonto, listaEnEspanol } from "../comun/formato";
import { exito, fallo, type Resultado } from "../comun/resultado";
import { avisoDeCoherencia } from "./coherencia";
import type { Esquema, Estatus, Moneda, Semilla, TablaTasas, Tramo } from "./semilla.esquema";

export interface SolicitudTasa {
  readonly entidad: string;
  readonly moneda: Moneda;
  readonly esquema: Esquema;
  /** Texto sin comas ni exponentes ("150000.50") o Decimal. Nunca number. */
  readonly monto: string | Decimal;
  /** Meses enteros. */
  readonly plazo: number;
}

export interface TasaResuelta {
  readonly entidad: string;
  readonly moneda: Moneda;
  readonly esquema: Esquema;
  readonly plazo: number;
  readonly monto: Decimal;
  readonly tasa: Decimal;
  /** "plazo_adicional" cuando la tasa sale de tasas_mxn.plazo_adicional (36 meses). */
  readonly origen: "tramo" | "plazo_adicional";
  readonly tramo: {
    readonly indice: number;
    readonly desde: Decimal;
    readonly hasta: Decimal | null;
    /** Estatus efectivo: el del tramo o, si no trae, el de la tabla. */
    readonly estatus: Estatus | null;
  };
  /** Versión y fecha de la semilla: es la "fecha de las tasas" del cálculo. */
  readonly semilla: { readonly version: string; readonly generado: string };
}

function leerMonto(monto: string | Decimal): Decimal | null {
  let d: Decimal;
  if (typeof monto === "string") {
    const texto = monto.trim();
    if (!RE_MONTO.test(texto)) return null;
    d = new Decimal(texto);
  } else if (Decimal.isDecimal(monto)) {
    d = new Decimal(monto);
  } else {
    return null;
  }
  if (!d.isFinite() || !d.gt(0) || d.decimalPlaces() > 2) return null;
  return d;
}

function describirTramo(tramo: Tramo, moneda: Moneda): string {
  return tramo.hasta === null
    ? `desde ${formatearMonto(tramo.desde, moneda)}`
    : `desde ${formatearMonto(tramo.desde, moneda)} hasta ${formatearMonto(tramo.hasta, moneda)}`;
}

/** Índice del tramo de mayor "desde" que contiene al monto, o -1 si queda debajo del primero. */
function indiceDeTramo(tabla: TablaTasas, monto: Decimal, inclusivo: boolean): number {
  for (let i = tabla.tramos.length - 1; i >= 0; i--) {
    const desde = tabla.tramos[i].desde;
    if (inclusivo ? monto.gte(desde) : monto.gt(desde)) return i;
  }
  return -1;
}

/**
 * Resuelve la tasa anual de una cotización a partir de la semilla.
 *
 * Orden de verificación (BLUEPRINT §11.1): tabla de la moneda, entidad,
 * estatus de la tabla, monto, tramo, estatus del tramo y plazo. El plazo
 * adicional (36 meses) solo aplica desde su monto mínimo y hereda el estatus
 * del tramo donde cae el monto.
 */
export function resolverTasa(semilla: Semilla, solicitud: SolicitudTasa): Resultado<TasaResuelta> {
  const { entidad, moneda, esquema, plazo } = solicitud;

  const tabla = semilla.tablas[moneda];
  if (tabla === undefined) {
    return fallo(
      crearError(
        "MONEDA_SIN_TABLA",
        `No hay tabla de tasas en ${moneda} en la semilla ${semilla.version}. ` +
          "Captura la tabla en los parámetros o elige otra moneda.",
      ),
    );
  }

  if (!semilla.entidades.includes(entidad)) {
    return fallo(
      crearError(
        "ENTIDAD_SIN_TABLA",
        `La entidad "${entidad}" no existe en la semilla. Elige una de: ${listaEnEspanol(semilla.entidades)}.`,
      ),
    );
  }
  if (tabla.aplicaAEntidades !== null && !tabla.aplicaAEntidades.includes(entidad)) {
    return fallo(
      crearError(
        "ENTIDAD_SIN_TABLA",
        `La tabla de tasas en ${moneda} no aplica a la entidad "${entidad}" ` +
          `(solo a ${listaEnEspanol(tabla.aplicaAEntidades)}). ` +
          "Elige otra entidad o agrega esta entidad a aplica_a_entidades en los parámetros.",
      ),
    );
  }

  if (tabla.estatus === "POR_CONFIRMAR") {
    return fallo(
      crearError(
        "TABLA_POR_CONFIRMAR",
        `La tabla de tasas en ${moneda} está POR_CONFIRMAR: no se puede cotizar en ${moneda} hasta que se confirmen sus tasas. ` +
          "Pide la confirmación y, cuando la tengas, cambia el estatus de la tabla en los parámetros.",
      ),
    );
  }

  const monto = leerMonto(solicitud.monto);
  if (monto === null) {
    return fallo(
      crearError(
        "MONTO_INVALIDO",
        "El monto no es válido: escribe una cantidad mayor que cero, sin comas ni símbolos " +
          "y con máximo 2 decimales (por ejemplo 150000.50).",
      ),
    );
  }

  const inclusivo = tabla.limiteInferiorInclusivo;
  if (inclusivo === null) {
    // La semilla solo permite esto en tablas POR_CONFIRMAR, que ya se bloquearon arriba.
    return fallo(
      crearError(
        "SEMILLA_INVALIDA",
        `La tabla de tasas en ${moneda} no define limite_inferior_inclusivo. ` +
          "Defínelo (true o false) en los parámetros antes de cotizar.",
      ),
    );
  }

  const indice = indiceDeTramo(tabla, monto, inclusivo);
  if (indice === -1) {
    const minimo = tabla.tramos[0].desde;
    return fallo(
      crearError(
        "MONTO_FUERA_DE_RANGO",
        `El monto ${formatearMonto(monto, moneda)} está por debajo del mínimo de la tabla ` +
          `(${inclusivo ? "desde" : "más de"} ${formatearMonto(minimo, moneda)}). ` +
          `Captura un monto ${inclusivo ? "de al menos" : "mayor que"} ${formatearMonto(minimo, moneda)}.`,
      ),
    );
  }

  const tramo = tabla.tramos[indice];
  const esUltimo = indice === tabla.tramos.length - 1;
  if (esUltimo && tramo.hasta !== null && monto.gt(tramo.hasta)) {
    return fallo(
      crearError(
        "MONTO_FUERA_DE_RANGO",
        `El monto ${formatearMonto(monto, moneda)} está por encima del máximo de la tabla ` +
          `(${formatearMonto(tramo.hasta, moneda)}). Captura un monto de hasta ${formatearMonto(tramo.hasta, moneda)}.`,
      ),
    );
  }

  const estatus = tramo.estatus ?? tabla.estatus;
  if (estatus === "POR_CONFIRMAR") {
    return fallo(
      crearError(
        "TRAMO_POR_CONFIRMAR",
        `Las tasas del tramo ${describirTramo(tramo, moneda)} están POR_CONFIRMAR: no se puede cotizar este monto ` +
          "hasta que se confirmen. Pide la confirmación y cambia el estatus del tramo en los parámetros, " +
          "o cotiza un monto de otro tramo.",
      ),
    );
  }

  const adicional = tabla.plazoAdicional;
  const adicionalAplica = adicional !== null && monto.gte(adicional.aplicaDesdeMonto);
  const disponibles = [
    ...tramo.plazosDisponibles,
    ...(adicionalAplica && !tramo.plazosDisponibles.includes(adicional.plazoMeses) ? [adicional.plazoMeses] : []),
  ].sort((a, b) => a - b);
  const sugerencia =
    `Plazos disponibles para ${formatearMonto(monto, moneda)}: ${listaEnEspanol(disponibles)} meses. ` +
    "Elige uno de esos plazos.";

  if (!Number.isInteger(plazo) || plazo <= 0) {
    return fallo(
      crearError("PLAZO_NO_DISPONIBLE", `El plazo indicado no es un número entero de meses. ${sugerencia}`),
    );
  }

  const base = {
    entidad,
    moneda,
    esquema,
    plazo,
    monto,
    tramo: { indice, desde: tramo.desde, hasta: tramo.hasta, estatus },
    semilla: { version: semilla.version, generado: semilla.generado },
  };

  if (tramo.plazosDisponibles.includes(plazo)) {
    // La semilla garantiza que cada plazo disponible tiene tasa en ambos esquemas.
    const tasa = tramo.tasas[esquema].get(plazo)!;
    const aviso = avisoDeCoherencia(tabla, indice, esquema, plazo, tasa);
    return exito({ ...base, tasa, origen: "tramo" }, aviso === null ? [] : [aviso]);
  }

  if (adicional !== null && plazo === adicional.plazoMeses) {
    if (adicionalAplica) {
      return exito({ ...base, tasa: adicional.tasas[esquema], origen: "plazo_adicional" });
    }
    return fallo(
      crearError(
        "PLAZO_NO_DISPONIBLE",
        `El plazo de ${plazo} meses solo se ofrece desde ${formatearMonto(adicional.aplicaDesdeMonto, moneda)}; ` +
          `no está disponible para ${formatearMonto(monto, moneda)}. ${sugerencia}`,
      ),
    );
  }

  return fallo(
    crearError(
      "PLAZO_NO_DISPONIBLE",
      `El plazo de ${plazo} meses no está disponible para ${formatearMonto(monto, moneda)}. ${sugerencia}`,
    ),
  );
}
